// Peças usadas por todas as páginas da Área da Liga:
// Firebase Auth + chamada da API já com o token de quem está logado.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

export const auth = getAuth(initializeApp(firebaseConfig));

// No seu PC (Live Server) a API é o Flask local; na Vercel é a mesma origem.
const rodandoLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
export const BASE_API = rodandoLocal ? "http://127.0.0.1:5000" : "";

// A matrícula vira o e-mail interno que o Firebase exige.
const DOMINIO_EMAIL = "biohub-lab.app";
export function matriculaParaEmail(matricula) {
    return matricula.replace(/\s+/g, "").toLowerCase() + "@" + DOMINIO_EMAIL;
}

export class ApiErro extends Error {
    constructor(mensagem, status, codigo) {
        super(mensagem);
        this.status = status;
        this.codigo = codigo;
    }
}

// Chama a API mandando o token do Firebase (renovado sozinho se expirou).
export async function chamarApi(caminho, { metodo = "GET", corpo } = {}) {
    const headers = {};
    if (auth.currentUser) {
        headers.Authorization = "Bearer " + (await auth.currentUser.getIdToken());
    }
    if (corpo !== undefined) headers["Content-Type"] = "application/json";

    let resposta;
    try {
        resposta = await fetch(BASE_API + caminho, {
            method: metodo,
            headers,
            body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
        });
    } catch {
        throw new ApiErro("Não foi possível conectar ao servidor.", 0, "REDE");
    }

    let dados = null;
    try { dados = await resposta.json(); } catch { /* resposta sem JSON */ }
    if (!resposta.ok) {
        throw new ApiErro(
            (dados?.mensagem || "Erro inesperado no servidor") + " (HTTP " + resposta.status + ")" + (dados?.detalhe ? " — " + dados.detalhe : ""),
            resposta.status, dados?.codigo);
    }
    return dados;
}

// Ao abrir a página o Firebase ainda está "lembrando" quem estava logado;
// isso espera ele terminar e devolve o usuário (ou null).
export function esperarUsuario() {
    return new Promise((resolve) => {
        const parar = onAuthStateChanged(auth, (usuario) => { parar(); resolve(usuario); });
    });
}
