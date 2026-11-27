import { signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { auth, chamarApi, esperarUsuario, ApiErro } from "./api.js";

const irParaLogin = (motivo) => location.replace("area-da-liga.html" + (motivo ? "?motivo=" + motivo : ""));

document.querySelector("#btn-sair").addEventListener("click", async () => {
    await signOut(auth);
    irParaLogin("saiu");
});

const usuarioFirebase = await esperarUsuario();
if (!usuarioFirebase) irParaLogin("sessao");

try {
    const eu = await chamarApi("/api/me");
    document.querySelector("#ola").textContent = "Olá, " + eu.nome + "!";
    document.querySelector("#detalhes").textContent =
        "Matrícula " + eu.matricula + " · " + (eu.papel === "admin" ? "Administrador(a)" : "Membro") + " da liga";
    document.querySelector("#quem").textContent = eu.nome;
    document.querySelector("#quem").hidden = false;
    document.querySelector("#btn-sair").hidden = false;
    document.querySelector("#link-admin").hidden = eu.papel !== "admin";
    document.querySelector("#cartao-carregando").hidden = true;
    document.querySelector("#cartao-ola").hidden = false;
    document.querySelector("#cartao-aviso").hidden = false;
} catch (erro) {
    if (erro instanceof ApiErro && (erro.status === 401 || erro.status === 403)) {
        await signOut(auth);
        irParaLogin(erro.codigo === "REVOGADO" ? "revogado" : "sessao");
    } else {
        document.querySelector("#cartao-carregando").textContent = erro.message;
    }
}
