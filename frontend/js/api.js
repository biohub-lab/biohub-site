
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

export const auth = getAuth(initializeApp(firebaseConfig));

// PARA RODAR LOCAL
const rodandoLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
export const BASE_API = rodandoLocal ? "http://127.0.0.1:5000" : "";

// A matrícula digitada vira o falso emial que usamos
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
        throw new ApiErro(dados?.mensagem || "Erro inesperado no servidor.", resposta.status, dados?.codigo);
    }
    return dados;
}

export function esperarUsuario() {
    return new Promise((resolve) => {
        const parar = onAuthStateChanged(auth, (usuario) => { parar(); resolve(usuario); });
    });
}
