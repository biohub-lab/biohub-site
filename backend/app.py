
import os
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from supabase import create_client


load_dotenv()

app = Flask(__name__)
CORS(app)  

_supabase = None  


def get_supabase():
    """Cria o cliente do Supabase na primeira vez que alguém precisa dele.
    Se criasse lá em cima e faltasse variável, a API INTEIRA cairia
    (até o /api/health). Assim, só o /api/posts reclama."""
    global _supabase
    if _supabase is None:
        url = os.getenv("SUPABASE_URL")
        chave = os.getenv("SUPABASE_KEY")
        if not url or not chave:
            raise RuntimeError("Faltam SUPABASE_URL e/ou SUPABASE_KEY nas variáveis de ambiente")
        _supabase = create_client(url.strip(), chave.strip())
    return _supabase


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


if __name__ == "__main__":
    app.run(debug=True)  # porta 5000
