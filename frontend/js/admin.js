import { signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { auth, chamarApi, esperarUsuario, ApiErro } from "./api.js";

const $ = (seletor) => document.querySelector(seletor);
const irParaLogin = (motivo) => location.replace("area-da-liga.html" + (motivo ? "?motivo=" + motivo : ""));

let euMesmo = null;       // quem está logado
let uidDaSenha = null;    // de quem é a senha que o diálogo está redefinindo

function avisar(tipo, texto) {
    const caixa = $("#aviso");
    caixa.className = "aviso is-" + tipo;
    caixa.textContent = texto;
    caixa.hidden = false;
    caixa.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function tratarErro(erro) {
    if (erro instanceof ApiErro && (erro.status === 401 || erro.status === 403) && erro.codigo !== "SEM_PERMISSAO") {
        signOut(auth).then(() => irParaLogin(erro.codigo === "REVOGADO" ? "revogado" : "sessao"));
        return;
    }
    avisar("error", erro.message);
}

function celula(texto) {
    const td = document.createElement("td");
    td.textContent = texto;     // textContent: nome com "<" ou HTML não vira código
    return td;
}

function selo(texto, classe) {
    const td = document.createElement("td");
    const span = document.createElement("span");
    span.className = "badge " + classe;
    span.textContent = texto;
    td.append(span);
    return td;
}

function botao(texto, classe, aoClicar) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-pequeno " + classe;
    b.textContent = texto;
    b.addEventListener("click", aoClicar);
    return b;
}

async function mudarAtivo(usuario, ativo) {
    const verbo = ativo ? "reativar" : "desativar";
    if (!ativo && !confirm("Desativar " + usuario.nome + "? A pessoa perde o acesso na hora.")) return;
    try {
        await chamarApi("/api/admin/usuarios/" + encodeURIComponent(usuario.uid) + "/ativo", { metodo: "PATCH", corpo: { ativo } });
        avisar("success", usuario.nome + (ativo ? " foi reativado(a)." : " foi desativado(a)."));
        await carregarLista();
    } catch (erro) { tratarErro(erro); }
}

function abrirSenha(usuario) {
    uidDaSenha = usuario.uid;
    $("#dlg-titulo").textContent = "Nova senha de " + usuario.nome;
    $("#s-nova").value = "";
    $("#dlg-senha").showModal();
    $("#s-nova").focus();
}

async function carregarLista() {
    const lista = await chamarApi("/api/admin/usuarios");
    const corpo = $("#corpo-tabela");
    corpo.replaceChildren();
    for (const u of lista) {
        const linha = document.createElement("tr");
        if (!u.ativo) linha.className = "desativado";
        linha.append(
            celula(u.nome),
            celula(u.matricula),
            selo(u.papel === "admin" ? "Admin" : "Membro", u.papel === "admin" ? "badge-admin" : "badge-membro"),
            selo(u.ativo ? "Ativo" : "Desativado", u.ativo ? "badge-ativo" : "badge-inativo"),
        );
        const acoes = document.createElement("td");
        acoes.className = "acoes";
        acoes.append(botao("Redefinir senha", "btn-sec", () => abrirSenha(u)));
        if (u.uid !== euMesmo.uid) {   // ninguém desativa a si mesmo
            acoes.append(u.ativo
                ? botao("Desativar", "btn-perigo", () => mudarAtivo(u, false))
                : botao("Reativar", "", () => mudarAtivo(u, true)));
        }
        linha.append(acoes);
        corpo.append(linha);
    }
}

$("#form-novo").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const corpo = {
        nome: $("#n-nome").value.trim(),
        matricula: $("#n-matricula").value.trim(),
        senha: $("#n-senha").value,
        papel: $("#n-papel").value,
    };
    if (!corpo.nome || !corpo.matricula || !corpo.senha) return avisar("error", "Preencha nome, matrícula e senha.");
    $("#btn-cadastrar").disabled = true;
    try {
        const criado = await chamarApi("/api/admin/usuarios", { metodo: "POST", corpo });
        avisar("success", criado.nome + " foi cadastrado(a). Matrícula " + criado.matricula + ".");
        $("#form-novo").reset();
        await carregarLista();
    } catch (erro) { tratarErro(erro); }
    $("#btn-cadastrar").disabled = false;
});

$("#dlg-cancelar").addEventListener("click", () => $("#dlg-senha").close());
$("#form-senha").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    $("#dlg-salvar").disabled = true;
    try {
        await chamarApi("/api/admin/usuarios/" + encodeURIComponent(uidDaSenha) + "/senha", { metodo: "POST", corpo: { senha: $("#s-nova").value } });
        $("#dlg-senha").close();
        avisar("success", "Senha redefinida. Avise a pessoa da nova senha.");
    } catch (erro) {
        $("#dlg-senha").close();
        tratarErro(erro);
    }
    $("#dlg-salvar").disabled = false;
});

$("#btn-sair").addEventListener("click", async () => { await signOut(auth); irParaLogin("saiu"); });

// ----- início -----
if (!(await esperarUsuario())) irParaLogin("sessao");
try {
    euMesmo = await chamarApi("/api/me");
    $("#quem").textContent = euMesmo.nome;
    $("#quem").hidden = false;
    $("#btn-sair").hidden = false;
    if (euMesmo.papel !== "admin") {
        $("#carregando-texto").textContent = "Só administradores da liga podem ver esta página.";
    } else {
        await carregarLista();
        $("#cartao-carregando").hidden = true;
        $("#conteudo").hidden = false;
    }
} catch (erro) {
    if (erro instanceof ApiErro && (erro.status === 401 || erro.status === 403)) {
        await signOut(auth);
        irParaLogin(erro.codigo === "REVOGADO" ? "revogado" : "sessao");
    } else {
        $("#carregando-texto").textContent = erro.message;
    }
}
