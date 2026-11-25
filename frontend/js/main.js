'use strict';

/**
 * BioHub-LAB — main.js
 * Interações compartilhadas focadas em usabilidade mobile com uma mão
 * e experiência de feed social (barra inferior, chips de tópico,
 * itens salvos localmente, compartilhamento nativo e atalhos de polegar).
 */
(function inicializarBioHubMobile() {
    const CHAVE_STORAGE_SALVOS = 'biohub_salvos_v1';
    const mediaMobile = window.matchMedia('(max-width: 768px)');
    let temporizadorToast = null;

    // =========================================================
    // 1. GERENCIAMENTO DE ITENS SALVOS (localStorage) E TOAST
    // =========================================================
    function obterSalvos() {
        try {
            const bruto = window.localStorage.getItem(CHAVE_STORAGE_SALVOS);
            const lista = bruto ? JSON.parse(bruto) : [];
            return Array.isArray(lista) ? lista : [];
        } catch {
            return [];
        }
    }

    function gravarSalvos(listaIds) {
        try {
            window.localStorage.setItem(CHAVE_STORAGE_SALVOS, JSON.stringify(listaIds));
        } catch {
            // Ignora falha caso armazenamento privado esteja bloqueado
        }
    }

    function estaSalvo(itemId) {
        if (!itemId) return false;
        return obterSalvos().includes(itemId);
    }

    function mostrarToast(mensagem) {
        if (!mensagem) return;

        let toast = document.getElementById('toast-biohub');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast-biohub';
            toast.className = 'toast-mobile';
            toast.setAttribute('role', 'status');
            toast.setAttribute('aria-live', 'polite');
            document.body.appendChild(toast);
        }

        toast.textContent = mensagem;
        toast.classList.add('visivel');

        if (temporizadorToast) {
            window.clearTimeout(temporizadorToast);
        }

        temporizadorToast = window.setTimeout(() => {
            toast.classList.remove('visivel');
        }, 2400);
    }

    function sincronizarBotoesSalvar() {
        const salvos = new Set(obterSalvos());
        const botoesSalvar = document.querySelectorAll('[data-acao="salvar"][data-item-id]');

        botoesSalvar.forEach((botao) => {
            const id = botao.dataset.itemId || '';
            const ativo = salvos.has(id);
            botao.classList.toggle('ativo', ativo);
            botao.setAttribute('aria-pressed', String(ativo));

            const rotulo = botao.querySelector('.rotulo-salvar');
            if (rotulo) {
                rotulo.textContent = ativo ? 'Salvo' : 'Salvar';
            }
        });

        // Atualiza contadores nos chips/pílulas de "Salvos"
        const contadoresSalvos = document.querySelectorAll('[data-contador-salvos]');
        contadoresSalvos.forEach((contador) => {
            const total = salvos.size;
            contador.textContent = total > 0 ? String(total) : '';
            contador.hidden = total === 0;
        });
    }

    function alternarSalvo(itemId) {
        if (!itemId) return false;

        const atual = obterSalvos();
        const indice = atual.indexOf(itemId);
        let agoraSalvo = false;

        if (indice >= 0) {
            atual.splice(indice, 1);
            agoraSalvo = false;
        } else {
            atual.push(itemId);
            agoraSalvo = true;
        }

        gravarSalvos(atual);
        sincronizarBotoesSalvar();

        document.dispatchEvent(new CustomEvent('biohub:salvos-alterados', {
            detail: { itemId, salvo: agoraSalvo, total: atual.length }
        }));

        mostrarToast(agoraSalvo ? 'Salvo na sua lista de leitura' : 'Removido dos salvos');
        return agoraSalvo;
    }

    async function compartilharItem({ titulo, texto, url }) {
        const urlFinal = url || window.location.href;
        const dadosShare = {
            title: titulo || document.title,
            text: texto || titulo || 'Confira no BioHub-LAB',
            url: urlFinal
        };

        if (navigator.share) {
            try {
                await navigator.share(dadosShare);
                return;
            } catch (erro) {
                if (erro && erro.name === 'AbortError') return;
            }
        }

        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            try {
                await navigator.clipboard.writeText(urlFinal);
                mostrarToast('Link copiado para compartilhar!');
                return;
            } catch {
                // Continua para aviso amigável
            }
        }

        mostrarToast('Copie o endereço da barra do navegador para compartilhar.');
    }

    // Expõe utilitário limpo para outras páginas (ex.: noticias.js)
    window.BioHubMobile = {
        obterSalvos,
        estaSalvo,
        alternarSalvo,
        sincronizarBotoesSalvar,
        compartilharItem,
        mostrarToast
    };

    // =========================================================
    // 2. INICIALIZAÇÃO DOM: BARRA INFERIOR, CHIPS HOME E AÇÕES
    // =========================================================
    document.addEventListener('DOMContentLoaded', () => {
        sincronizarBotoesSalvar();

        // 2.1 Tocar na aba já ativa da barra inferior rola suavemente ao topo (padrão rede social)
        const linksBarraInferior = document.querySelectorAll('.barra-navegacao-mobile a[aria-current="page"]');
        linksBarraInferior.forEach((linkAtivo) => {
            linkAtivo.addEventListener('click', (evento) => {
                if (!window.location.hash) {
                    evento.preventDefault();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        });

        // 2.2 Delegação global para botões sociais de Salvar e Compartilhar nos cards
        document.addEventListener('click', (evento) => {
            const botaoSocial = evento.target.closest('.btn-acao-social');
            if (!botaoSocial) return;

            evento.preventDefault();
            evento.stopPropagation();

            const acao = botaoSocial.dataset.acao;
            if (acao === 'salvar') {
                const itemId = botaoSocial.dataset.itemId;
                alternarSalvo(itemId);
                return;
            }

            if (acao === 'compartilhar') {
                const titulo = botaoSocial.dataset.shareTitulo || document.title;
                const texto = botaoSocial.dataset.shareTexto || titulo;
                const caminhoRelativo = botaoSocial.dataset.shareUrl || '';
                const urlCompleta = caminhoRelativo
                    ? new URL(caminhoRelativo, window.location.href).href
                    : window.location.href;

                compartilharItem({ titulo, texto, url: urlCompleta });
            }
        });

        // 2.3 Chips de tópico na Home ("Para você", "Pesquisa", "Campus", "Eventos", "Salvos")
        const containerChipsHome = document.querySelector('.chips-feed-mobile');
        if (containerChipsHome) {
            const botoesChip = Array.from(containerChipsHome.querySelectorAll('.chip-feed'));
            const itensFeedHome = Array.from(document.querySelectorAll('[data-feed-tags]'));
            const secaoHero = document.querySelector('.hero');
            const secaoEstatisticas = document.querySelector('.estatisticas');
            const secaoNoticias = document.querySelector('.noticias');
            const secaoEncontros = document.querySelector('.encontros');
            const estadoVazioHome = document.getElementById('feed-home-vazio');
            const botaoVoltarParaVoce = document.getElementById('btn-home-para-voce');

            let chipAtual = 'todos';

            function aplicarFiltroChipHome() {
                // No desktop (> 768px) mantém absolutamente tudo visível como no layout original
                if (!mediaMobile.matches) {
                    itensFeedHome.forEach((item) => { item.hidden = false; });
                    if (secaoHero) secaoHero.hidden = false;
                    if (secaoEstatisticas) secaoEstatisticas.hidden = false;
                    if (secaoNoticias) secaoNoticias.hidden = false;
                    if (secaoEncontros) secaoEncontros.hidden = false;
                    if (estadoVazioHome) estadoVazioHome.hidden = true;
                    return;
                }

                const salvos = new Set(obterSalvos());
                let totalCardsVisiveis = 0;

                itensFeedHome.forEach((item) => {
                    const tags = (item.dataset.feedTags || '').split(/\s+/).filter(Boolean);
                    const idItem = item.dataset.itemId || '';
                    let visivel = false;

                    if (chipAtual === 'todos') {
                        visivel = true;
                    } else if (chipAtual === 'salvos') {
                        visivel = Boolean(idItem) && salvos.has(idItem);
                    } else {
                        visivel = tags.includes(chipAtual);
                    }

                    item.hidden = !visivel;
                    if (visivel && idItem) {
                        totalCardsVisiveis += 1;
                    }
                });

                // Oculta seções inteiras caso não tenham itens compatíveis no filtro mobile ativo
                if (secaoNoticias) {
                    const noticiasVisiveis = secaoNoticias.querySelectorAll('.cartao-noticia:not([hidden])').length;
                    secaoNoticias.hidden = noticiasVisiveis === 0;
                }

                if (secaoEncontros) {
                    const encontrosVisiveis = secaoEncontros.querySelectorAll('.cartao-evento:not([hidden])').length;
                    secaoEncontros.hidden = encontrosVisiveis === 0;
                }

                if (estadoVazioHome) {
                    estadoVazioHome.hidden = !(chipAtual === 'salvos' && totalCardsVisiveis === 0);
                }
            }

            function selecionarChip(novoChip) {
                chipAtual = novoChip || 'todos';
                botoesChip.forEach((botao) => {
                    const ativo = (botao.dataset.chip || 'todos') === chipAtual;
                    botao.classList.toggle('ativo', ativo);
                    botao.setAttribute('aria-pressed', String(ativo));
                });
                aplicarFiltroChipHome();
            }

            botoesChip.forEach((botao) => {
                botao.addEventListener('click', () => {
                    selecionarChip(botao.dataset.chip || 'todos');
                });
            });

            if (botaoVoltarParaVoce) {
                botaoVoltarParaVoce.addEventListener('click', () => {
                    selecionarChip('todos');
                });
            }

            document.addEventListener('biohub:salvos-alterados', () => {
                if (chipAtual === 'salvos') {
                    aplicarFiltroChipHome();
                }
            });

            if (typeof mediaMobile.addEventListener === 'function') {
                mediaMobile.addEventListener('change', aplicarFiltroChipHome);
            }
        }

        // 2.4 Pílula flutuante na zona do polegar (Topo / Buscar rápido ao rolar o feed)
        const atalhoPolegar = document.getElementById('atalho-polegar-mobile');
        const btnPolegarTopo = document.getElementById('btn-polegar-topo');
        const btnPolegarBusca = document.getElementById('btn-polegar-busca');

        if (atalhoPolegar) {
            const atualizarVisibilidadeAtalho = () => {
                const deveMostrar = mediaMobile.matches && window.scrollY > 360;
                atalhoPolegar.classList.toggle('visivel', deveMostrar);
            };

            window.addEventListener('scroll', atualizarVisibilidadeAtalho, { passive: true });
            atualizarVisibilidadeAtalho();

            if (btnPolegarTopo) {
                btnPolegarTopo.addEventListener('click', () => {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                });
            }

            if (btnPolegarBusca) {
                btnPolegarBusca.addEventListener('click', () => {
                    const campoBusca = document.getElementById('busca-noticias');
                    if (campoBusca) {
                        campoBusca.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        window.setTimeout(() => campoBusca.focus({ preventScroll: true }), 280);
                    }
                });
            }
        }
    });
})();
