// Página de teste: botão -> fetch na API Flask -> mostra o JSON na tela.

// Se a página estiver aberta no seu PC (Live Server), a API é o Flask local.
// Na Vercel a API fica na mesma origem, então o caminho é só "/api/...".
const rodandoLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
const BASE_API = rodandoLocal ? "http://127.0.0.1:5000" : "";

const saida = document.querySelector("#saida");
const status = document.querySelector("#status");

async function chamarApi(caminho) {
    const url = BASE_API + caminho;
    status.textContent = "Chamando " + url + " ...";
    saida.textContent = "";
    const inicio = performance.now();

    try {
        const resposta = await fetch(url);          // 1. o front pede
        const texto = await resposta.text();        // 2. o servidor responde
        const ms = Math.round(performance.now() - inicio);

        status.textContent = "HTTP " + resposta.status + " em " + ms + " ms  ←  " + url;
        status.className = resposta.ok ? "ok" : "erro";

        try {                                       // 3. mostra o JSON bonitinho
            saida.textContent = JSON.stringify(JSON.parse(texto), null, 2);
        } catch {
            saida.textContent = texto;              // não era JSON (ex.: página de erro)
        }
    } catch (erro) {
        status.textContent = "Não consegui falar com " + url;
        status.className = "erro";
        saida.textContent = String(erro);
    }
}

document.querySelector("#btn-posts").addEventListener("click", () => chamarApi("/api/posts"));
document.querySelector("#btn-health").addEventListener("click", () => chamarApi("/api/health"));
