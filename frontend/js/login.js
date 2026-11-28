import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { auth, matriculaParaEmail, chamarApi, esperarUsuario, ApiErro } from "./api.js";

const form = document.querySelector("#login-form");
const campoMatricula = document.querySelector("#matricula");
const campoSenha = document.querySelector("#password");
const botao = document.querySelector("#btn-login");
const caixa = document.querySelector("#login-message");
const caixaTexto = document.querySelector("#login-message-text");
const botaoOlho = document.querySelector("#visible-password-btn");

function mostrarMensagem(tipo, texto) {
    caixa.className = "login-alert is-" + tipo;   // is-error | is-success | is-info
    caixaTexto.textContent = texto;
    caixa.hidden = false;
}

function carregando(sim) {
    botao.disabled = sim;
    botao.classList.toggle("is-loading", sim);
    botao.setAttribute("aria-busy", String(sim));
}

function marcarInvalido(...campos) {
    [campoMatricula, campoSenha].forEach((c) => c.removeAttribute("aria-invalid"));
    campos.forEach((c) => c.setAttribute("aria-invalid", "true"));
}

// Traduz os códigos de erro do Firebase.
function mensagemDoFirebase(codigo) {
    switch (codigo) {
        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
        case "auth/invalid-email":
            return "Matrícula ou senha incorretas.";
        case "auth/user-disabled":
            return "Seu acesso foi desativado. Entre em contato com a liga.";
        case "auth/too-many-requests":
            return "Muitas tentativas. Espere alguns minutos e tente de novo.";
        case "auth/network-request-failed":
            return "Não consegui falar com o servidor de login do Google. Verifique a internet, desative bloqueadores (adblock/VPN) ou teste numa aba anônima.";
        default:
            return "Não foi possível entrar agora. Tente de novo em instantes.";
    }
}

// Mostrar / ocultar senha
botaoOlho.addEventListener("click", () => {
    const mostrando = campoSenha.type === "text";
    campoSenha.type = mostrando ? "password" : "text";
    botaoOlho.setAttribute("aria-pressed", String(!mostrando));
    botaoOlho.querySelector(".visually-hidden").textContent = mostrando ? "Mostrar" : "Ocultar";
});

// Se o painel mandou a pessoa de volta pra cá, explica por quê.
const motivo = new URLSearchParams(location.search).get("motivo");
if (motivo === "revogado") mostrarMensagem("error", "Seu acesso foi desativado. Entre em contato com a liga.");
if (motivo === "sessao") mostrarMensagem("info", "Sua sessão acabou. Entre de novo.");
if (motivo === "saiu") mostrarMensagem("info", "Você saiu da Área da Liga.");

form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    caixa.hidden = true;

    const matricula = campoMatricula.value.trim();
    const senha = campoSenha.value;
    if (!matricula) { marcarInvalido(campoMatricula); mostrarMensagem("error", "Digite sua matrícula."); return campoMatricula.focus(); }
    if (!senha) { marcarInvalido(campoSenha); mostrarMensagem("error", "Digite sua senha."); return campoSenha.focus(); }
    marcarInvalido();

    carregando(true);
    try {
        // 1) Firebase confere matrícula + senha
        await signInWithEmailAndPassword(auth, matriculaParaEmail(matricula), senha);
    } catch (erro) {
        carregando(false);
        console.error("Falha no login (Firebase):", erro.code, erro.message, erro);
        // Só pinta os campos de vermelho quando o problema é mesmo matrícula/senha
        const erroDeCredencial = [
            "auth/invalid-credential", "auth/wrong-password",
            "auth/user-not-found", "auth/invalid-email",
        ].includes(erro.code);
        if (erroDeCredencial) marcarInvalido(campoMatricula, campoSenha); else marcarInvalido();
        const detalhe = erroDeCredencial ? "" : " (código: " + (erro.code || "desconhecido") + ")";
        return mostrarMensagem("error", mensagemDoFirebase(erro.code) + detalhe);
    }

    try {
        // 2) O servidor confere se a pessoa é membro ATIVO da liga
        const eu = await chamarApi("/api/me");
        mostrarMensagem("success", "Bem-vindo(a), " + eu.nome + "! Entrando...");
        setTimeout(() => { location.href = "painel.html"; }, 700);
    } catch (erro) {
        carregando(false);
        if (erro instanceof ApiErro && (erro.status === 401 || erro.status === 403)) {
            await signOut(auth);     // não deixa uma sessão "meio logada"
        }
        mostrarMensagem("error", erro.message);
    }
});

// Se já estava logado de antes, pula direto pro painel.
esperarUsuario().then(async (usuario) => {
    if (!usuario || motivo) return;
    try {
        await chamarApi("/api/me");
        location.replace("painel.html");
    } catch { /* fica na tela de login */ }
});
