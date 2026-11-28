# ============================================================
# API Flask do BioHub-LAB
#
# Rotas públicas
#   /api               boas-vindas
#   /api/health        prova que o Flask está rodando (não usa banco)
#   /api/posts         lê a tabela "posts" do Supabase
# Rotas de quem está logado (header  Authorization: Bearer <token do Firebase>)
#   /api/me                                  quem sou eu (nome, papel...)
# Rotas só de admin
#   GET   /api/admin/usuarios                lista membros
#   POST  /api/admin/usuarios                cadastra membro (cria no Firebase + Supabase)
#   PATCH /api/admin/usuarios/<uid>/ativo    desativa / reativa membro
#   POST  /api/admin/usuarios/<uid>/senha    redefine a senha de um membro
#
# Como o login funciona:
#   1) o front entra no Firebase (matricula@biohub-lab.app + senha) e ganha um token;
#   2) manda o token pra cá; o Flask confere com o Firebase se ele é de verdade;
#   3) pelo uid do token, procura a pessoa na tabela "usuarios" do Supabase
#      e só deixa passar se ativo = true (o papel diz se é membro ou admin).
# ============================================================
import json
import os
import re
from functools import wraps

import firebase_admin
from dotenv import load_dotenv
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials
from flask import Flask, g, jsonify, request
from flask_cors import CORS
from werkzeug.exceptions import HTTPException
from supabase import create_client

# Lê o .env (só existe na sua máquina). Na Vercel as variáveis vêm das configurações.
load_dotenv()

app = Flask(__name__)
CORS(app)  # o front (outra origem, tipo Live Server) pode chamar a API

DOMINIO_EMAIL = "biohub-lab.app"   # e-mail interno: matricula@biohub-lab.app
PAPEIS = ("membro", "admin")
TAMANHO_MIN_SENHA = 6              # mínimo do Firebase


# ------------------------------------------------------------
# Clientes (criados só quando alguém precisa, pra uma variável
# faltando não derrubar a API inteira)
# ------------------------------------------------------------
_supabase_publico = None
_supabase_admin = None


def get_supabase():
    """Cliente com a chave publishable (leitura pública, ex.: posts)."""
    global _supabase_publico
    if _supabase_publico is None:
        url, chave = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY")
        if not url or not chave:
            raise RuntimeError("Faltam SUPABASE_URL e/ou SUPABASE_KEY nas variáveis de ambiente")
        _supabase_publico = create_client(url.strip(), chave.strip())
    return _supabase_publico


def get_supabase_admin():
    """Cliente com a chave SECRETA (lê/escreve 'usuarios'). Só existe no backend."""
    global _supabase_admin
    if _supabase_admin is None:
        url, chave = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SECRET_KEY")
        if not url or not chave:
            raise RuntimeError("Faltam SUPABASE_URL e/ou SUPABASE_SECRET_KEY nas variáveis de ambiente")
        _supabase_admin = create_client(url.strip(), chave.strip())
    return _supabase_admin


def iniciar_firebase():
    """Liga o Firebase Admin (uma vez só). Aceita o JSON inteiro ou o caminho do arquivo."""
    if firebase_admin._apps:
        return
    bruto = (os.getenv("FIREBASE_SERVICE_ACCOUNT") or "").strip()
    if not bruto:
        raise RuntimeError("Falta FIREBASE_SERVICE_ACCOUNT nas variáveis de ambiente")
    if len(bruto) >= 2 and bruto[0] == bruto[-1] and bruto[0] in "'\"":
        bruto = bruto[1:-1].strip()  # tira aspas coladas junto com o JSON
    if bruto.startswith("{"):
        # strict=False tolera quebras de linha "de verdade" dentro da private_key
        cred = credentials.Certificate(json.loads(bruto, strict=False))
    else:
        cred = credentials.Certificate(bruto)  # caminho do arquivo .json
    firebase_admin.initialize_app(cred)


# ------------------------------------------------------------
# Erros em JSON (o front lê "mensagem" e "codigo")
# ------------------------------------------------------------
class ErroApi(Exception):
    def __init__(self, mensagem, status=400, codigo=None):
        super().__init__(mensagem)
        self.mensagem = mensagem
        self.status = status
        self.codigo = codigo


@app.errorhandler(ErroApi)
def tratar_erro_api(erro):
    return jsonify(mensagem=erro.mensagem, codigo=erro.codigo), erro.status


@app.errorhandler(RuntimeError)
def tratar_config_faltando(erro):
    return jsonify(mensagem=str(erro), codigo="CONFIG"), 500


@app.errorhandler(Exception)
def tratar_erro_inesperado(erro):
    if isinstance(erro, HTTPException):  # 404, 405... continuam com o código certo
        return jsonify(mensagem=erro.description, codigo="HTTP"), erro.code
    app.logger.exception("Erro inesperado")  # o traceback aparece nos Logs da Vercel
    resposta = {"mensagem": "Erro interno do servidor.", "codigo": "INTERNO"}
    if os.getenv("API_DEBUG") == "1":  # só pra depurar: mostra o tipo e o texto do erro
        resposta["detalhe"] = f"{type(erro).__name__}: {str(erro)[:300]}"
    return jsonify(resposta), 500


# ------------------------------------------------------------
# Quem está chamando? (valida token + confere cadastro e "ativo")
# ------------------------------------------------------------
def identificar_usuario():
    cabecalho = request.headers.get("Authorization", "")
    if not cabecalho.startswith("Bearer ") or not cabecalho[7:].strip():
        raise ErroApi("Faça login para continuar.", 401, "SEM_TOKEN")
    token = cabecalho[7:].strip()

    iniciar_firebase()
    try:
        dados = firebase_auth.verify_id_token(token, check_revoked=True)
    except (firebase_auth.RevokedIdTokenError, firebase_auth.UserDisabledError):
        raise ErroApi("Seu acesso foi desativado. Entre em contato com a liga.", 403, "REVOGADO")
    except (firebase_auth.InvalidIdTokenError, ValueError):   # inclui token expirado
        raise ErroApi("Sessão inválida ou expirada. Entre de novo.", 401, "TOKEN_INVALIDO")
    except firebase_auth.CertificateFetchError:
        raise ErroApi("Não consegui falar com o Firebase agora. Tente de novo.", 503, "FIREBASE_FORA")

    resposta = (
        get_supabase_admin().table("usuarios").select("*").eq("uid", dados["uid"]).limit(1).execute()
    )
    if not resposta.data:
        raise ErroApi("Sua conta não está cadastrada na liga. Entre em contato com a liga.", 403, "SEM_CADASTRO")
    usuario = resposta.data[0]
    if not usuario.get("ativo"):
        raise ErroApi("Seu acesso foi desativado. Entre em contato com a liga.", 403, "REVOGADO")
    return usuario


def exige_login(funcao):
    @wraps(funcao)
    def embrulho(*args, **kwargs):
        g.usuario = identificar_usuario()
        return funcao(*args, **kwargs)
    return embrulho


def exige_admin(funcao):
    @wraps(funcao)
    def embrulho(*args, **kwargs):
        g.usuario = identificar_usuario()
        if g.usuario.get("papel") != "admin":
            raise ErroApi("Só administradores da liga podem fazer isso.", 403, "SEM_PERMISSAO")
        return funcao(*args, **kwargs)
    return embrulho


def mostrar(usuario):
    """Só o que o front precisa ver."""
    return {k: usuario.get(k) for k in ("uid", "matricula", "nome", "papel", "ativo")}


def normalizar_matricula(valor):
    matricula = re.sub(r"\s+", "", str(valor or "")).lower()
    if not re.fullmatch(r"[a-z0-9]{3,30}", matricula):
        raise ErroApi("Matrícula inválida: use de 3 a 30 letras ou números, sem espaços ou símbolos.", 400)
    return matricula


def validar_senha(valor):
    senha = valor if isinstance(valor, str) else ""
    if len(senha) < TAMANHO_MIN_SENHA:
        raise ErroApi(f"A senha precisa ter pelo menos {TAMANHO_MIN_SENHA} caracteres.", 400)
    return senha


def corpo_json():
    dados = request.get_json(silent=True)
    if not isinstance(dados, dict):
        raise ErroApi("JSON inválido.", 400)
    return dados


# ------------------------------------------------------------
# Rotas públicas
# ------------------------------------------------------------
@app.route("/api")
def home():
    return jsonify(mensagem="Bem vindo a API da LAB")


@app.route("/api/health")
def health():
    return jsonify(status="ok")


@app.route("/api/posts")
def listar_posts():
    try:
        resposta = get_supabase().table("posts").select("*").execute()
    except RuntimeError as erro:
        return jsonify(erro=str(erro)), 500
    except Exception as erro:
        return jsonify(erro="Falha ao consultar o Supabase", detalhe=str(erro)), 502
    return jsonify(resposta.data)


# ------------------------------------------------------------
# Logado
# ------------------------------------------------------------
@app.get("/api/me")
@exige_login
def quem_sou_eu():
    return jsonify(mostrar(g.usuario))


# ------------------------------------------------------------
# Admin
# ------------------------------------------------------------
@app.get("/api/admin/usuarios")
@exige_admin
def listar_usuarios():
    resposta = get_supabase_admin().table("usuarios").select("*").order("nome").execute()
    return jsonify([mostrar(u) for u in resposta.data])


@app.post("/api/admin/usuarios")
@exige_admin
def criar_usuario():
    dados = corpo_json()
    matricula = normalizar_matricula(dados.get("matricula"))
    nome = str(dados.get("nome") or "").strip()
    senha = validar_senha(dados.get("senha"))
    papel = dados.get("papel", "membro")
    if not nome:
        raise ErroApi("Informe o nome do membro.", 400)
    if papel not in PAPEIS:
        raise ErroApi("Papel inválido: use 'membro' ou 'admin'.", 400)

    banco = get_supabase_admin()
    if banco.table("usuarios").select("uid").eq("matricula", matricula).limit(1).execute().data:
        raise ErroApi("Já existe um membro com essa matrícula.", 409)

    iniciar_firebase()
    try:
        conta = firebase_auth.create_user(
            email=f"{matricula}@{DOMINIO_EMAIL}", password=senha, display_name=nome
        )
    except firebase_auth.EmailAlreadyExistsError:
        raise ErroApi(
            "Essa matrícula já tem login criado, mas não está na lista de membros. "
            "Fale com quem administra o sistema.", 409)

    novo = {"uid": conta.uid, "matricula": matricula, "nome": nome, "papel": papel, "ativo": True}
    try:
        banco.table("usuarios").insert(novo).execute()
    except Exception:
        firebase_auth.delete_user(conta.uid)  # desfaz, pra não ficar login órfão
        raise ErroApi("Não consegui salvar o membro no banco. Nada foi criado, tente de novo.", 502)
    return jsonify(mostrar(novo)), 201


@app.patch("/api/admin/usuarios/<uid>/ativo")
@exige_admin
def mudar_ativo(uid):
    ativo = corpo_json().get("ativo")
    if not isinstance(ativo, bool):
        raise ErroApi("Informe ativo: true ou false.", 400)
    if uid == g.usuario["uid"] and not ativo:
        raise ErroApi("Você não pode desativar a si mesmo.", 409)

    resposta = get_supabase_admin().table("usuarios").update({"ativo": ativo}).eq("uid", uid).execute()
    if not resposta.data:
        raise ErroApi("Membro não encontrado.", 404)

    # Também liga/desliga no Firebase e derruba sessões abertas de quem foi desativado
    iniciar_firebase()
    try:
        firebase_auth.update_user(uid, disabled=not ativo)
        if not ativo:
            firebase_auth.revoke_refresh_tokens(uid)
    except firebase_auth.UserNotFoundError:
        pass  # existe só no banco; o "ativo" já foi atualizado lá
    return jsonify(mostrar(resposta.data[0]))


@app.post("/api/admin/usuarios/<uid>/senha")
@exige_admin
def redefinir_senha(uid):
    senha = validar_senha(corpo_json().get("senha"))
    if not get_supabase_admin().table("usuarios").select("uid").eq("uid", uid).limit(1).execute().data:
        raise ErroApi("Membro não encontrado.", 404)
    iniciar_firebase()
    try:
        firebase_auth.update_user(uid, password=senha)
        firebase_auth.revoke_refresh_tokens(uid)  # sai de onde estava logado
    except firebase_auth.UserNotFoundError:
        raise ErroApi("Esse membro não tem login no Firebase.", 404)
    return jsonify(mensagem="Senha redefinida.")


if __name__ == "__main__":
    app.run(debug=True)  # porta 5000
