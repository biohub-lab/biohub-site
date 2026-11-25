'use strict';

document.addEventListener('DOMContentLoaded', () => {
    // =========================================================
    // 1. SELEÇÃO DOS ELEMENTOS DO DOM
    // =========================================================
    const gridLista = document.getElementById('grid-noticias-lista');
    const botoesFiltro = document.querySelectorAll('.pilula-filtro');
    const inputBusca = document.getElementById('busca-noticias');
    const botaoLimparBusca = document.getElementById('btn-limpar-busca');

    const seletorOrdenacao = document.getElementById('seletor-ordenacao');
    const botaoOrdenacao = document.getElementById('btn-ordem-noticias');
    const textoOrdemAtual = document.getElementById('texto-ordem-atual');
    const menuOrdenacao = document.getElementById('menu-ordem-noticias');
    const opcoesOrdenacao = Array.from(document.querySelectorAll('.opcao-ordenacao'));

    const contadorNoticias = document.getElementById('contador-noticias');
    const botaoResetarFiltros = document.getElementById('btn-resetar-filtros');

    const mensagemVazio = document.getElementById('mensagem-vazio');
    const mensagemVazioTitulo = document.getElementById('mensagem-vazio-titulo');
    const mensagemVazioDetalhe = document.getElementById('mensagem-vazio-detalhe');
    const botaoVazioLimpar = document.getElementById('btn-vazio-limpar');

    const modal = document.getElementById('modal-noticia');
    const modalCaixa = modal ? modal.querySelector('.modal-noticia-caixa') : null;
    const modalTopoArraste = modal ? modal.querySelector('.modal-noticia-topo') : null;
    const modalAlcaArraste = modal ? modal.querySelector('.modal-alca-mobile') : null;
    const botaoFecharModal = document.getElementById('btn-fechar-modal');
    const botaoModalVoltar = document.getElementById('btn-modal-voltar');
    const botaoModalSalvar = document.getElementById('btn-modal-salvar');
    const botaoModalCompartilhar = document.getElementById('btn-modal-compartilhar');

    const modalImagem = document.getElementById('modal-noticia-img');
    const modalCategoria = document.getElementById('modal-noticia-categoria');
    const modalMeta = document.getElementById('modal-noticia-meta');
    const modalTitulo = document.getElementById('modal-noticia-titulo');
    const modalResumo = document.getElementById('modal-noticia-resumo');
    const modalCorpo = document.getElementById('modal-noticia-corpo');

    if (!gridLista) return;

    // Converte NodeList em Array para permitir ordenação dinâmica no DOM
    const cartoesNoticia = Array.from(gridLista.querySelectorAll('.card-feed-noticia'));

    // Estado reativo simples da página de notícias
    const estado = {
        categoria: 'todos',
        termoBusca: '',
        ordenacao: 'recentes'
    };

    let ultimoElementoFocado = null;
    let cartaoAbertoNoModal = null;

    // =========================================================
    // 2. FUNÇÕES UTILITÁRIAS (Texto sem acentos e datas ISO)
    // =========================================================
    function obterTextoLimpo(elemento) {
        if (!elemento) return '';
        return elemento.textContent.replace(/\s+/g, ' ').trim();
    }

    function normalizarParaBusca(texto) {
        if (!texto) return '';
        return texto
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
    }

    function obterTimestampPublicacao(cartao) {
        const elementoTime = cartao.querySelector('time[datetime]');
        const dataIso =
            cartao.dataset.publicacao ||
            (elementoTime ? elementoTime.getAttribute('datetime') : '');

        const timestamp = Date.parse(dataIso);
        return Number.isNaN(timestamp) ? 0 : timestamp;
    }

    // Pré-indexa o texto buscável e o timestamp de cada cartão para performance
    const indiceCartoes = new Map();
    cartoesNoticia.forEach((cartao, indiceOriginal) => {
        const titulo = obterTextoLimpo(cartao.querySelector('h2'));
        const resumo = obterTextoLimpo(cartao.querySelector('.card-feed-resumo'));
        const completo = obterTextoLimpo(cartao.querySelector('.card-feed-completo'));
        const categoriaRotulo = obterTextoLimpo(cartao.querySelector('.categoria'));

        indiceCartoes.set(cartao, {
            indiceOriginal,
            titulo,
            resumo,
            timestamp: obterTimestampPublicacao(cartao),
            textoBusca: normalizarParaBusca(`${titulo} ${resumo} ${completo} ${categoriaRotulo}`)
        });
    });

    // =========================================================
    // 3. BUSCA + FILTRO POR CATEGORIA/SALVOS + ORDENAÇÃO POR DATA
    // =========================================================
    function atualizarBotaoCategoriaAtivo() {
        botoesFiltro.forEach((botao) => {
            const filtroBotao = botao.dataset.filtro || 'todos';
            const estaAtivo = filtroBotao === estado.categoria;
            botao.classList.toggle('ativo', estaAtivo);
            botao.setAttribute('aria-pressed', String(estaAtivo));
        });
    }

    function atualizarResumoEControles(totalVisiveis) {
        const termoOriginal = inputBusca ? inputBusca.value.trim() : '';
        const temBusca = estado.termoBusca.length > 0;
        const temCategoria = estado.categoria !== 'todos';
        const temOrdenacaoAntiga = estado.ordenacao === 'antigas';

        if (botaoLimparBusca) {
            botaoLimparBusca.hidden = !temBusca;
        }

        if (botaoResetarFiltros) {
            botaoResetarFiltros.hidden = !(temBusca || temCategoria || temOrdenacaoAntiga);
        }

        if (contadorNoticias) {
            const rotuloOrdem = estado.ordenacao === 'antigas' ? 'mais antigas primeiro' : 'mais recentes primeiro';
            if (totalVisiveis === 0) {
                contadorNoticias.textContent = estado.categoria === 'salvos'
                    ? 'Nenhuma notícia salva ainda'
                    : 'Nenhuma notícia encontrada';
            } else if (totalVisiveis === 1) {
                contadorNoticias.textContent = `Exibindo 1 notícia · ${rotuloOrdem}`;
            } else {
                contadorNoticias.textContent = `Exibindo ${totalVisiveis} notícias · ${rotuloOrdem}`;
            }
        }

        if (mensagemVazio) {
            mensagemVazio.hidden = totalVisiveis > 0;

            if (totalVisiveis === 0) {
                if (estado.categoria === 'salvos' && !termoOriginal) {
                    if (mensagemVazioTitulo) {
                        mensagemVazioTitulo.textContent = 'Sua lista de salvos está vazia';
                    }
                    if (mensagemVazioDetalhe) {
                        mensagemVazioDetalhe.textContent =
                            'Toque em "Salvar" em qualquer publicação do feed para ler depois com facilidade.';
                    }
                } else {
                    if (mensagemVazioTitulo) {
                        mensagemVazioTitulo.textContent = termoOriginal
                            ? `Nenhum resultado para "${termoOriginal}"`
                            : 'Nenhuma notícia encontrada nessa categoria';
                    }
                    if (mensagemVazioDetalhe) {
                        mensagemVazioDetalhe.textContent = temCategoria && temBusca
                            ? 'Experimente pesquisar em "Todos" ou usar palavras-chave mais gerais.'
                            : 'Tente buscar por outro termo ou limpar os filtros ativos.';
                    }
                }
            }
        }
    }

    function aplicarFiltrosEOrdenacao() {
        // 1) Ordena os cartões pela data de publicação (mais recentes vs mais antigas)
        const cartoesOrdenados = [...cartoesNoticia].sort((cartaoA, cartaoB) => {
            const dadosA = indiceCartoes.get(cartaoA);
            const dadosB = indiceCartoes.get(cartaoB);
            const diferencaData = estado.ordenacao === 'antigas'
                ? dadosA.timestamp - dadosB.timestamp
                : dadosB.timestamp - dadosA.timestamp;

            if (diferencaData !== 0) return diferencaData;
            return dadosA.indiceOriginal - dadosB.indiceOriginal;
        });

        const salvosSet = new Set(
            window.BioHubMobile ? window.BioHubMobile.obterSalvos() : []
        );

        // 2) Reinsere na ordem escolhida e avalia visibilidade (categoria/salvos + busca)
        let totalVisiveis = 0;
        const fragmento = document.createDocumentFragment();

        cartoesOrdenados.forEach((cartao) => {
            const categoriaDoCartao = cartao.dataset.categoria || '';
            const idDoCartao = cartao.id || '';
            const dados = indiceCartoes.get(cartao);

            let bateCategoria = false;
            if (estado.categoria === 'todos') {
                bateCategoria = true;
            } else if (estado.categoria === 'salvos') {
                bateCategoria = Boolean(idDoCartao) && salvosSet.has(idDoCartao);
            } else {
                bateCategoria = categoriaDoCartao === estado.categoria;
            }

            const bateBusca =
                estado.termoBusca === '' ||
                dados.textoBusca.includes(estado.termoBusca);

            const deveMostrar = bateCategoria && bateBusca;
            cartao.hidden = !deveMostrar;

            if (deveMostrar) {
                totalVisiveis += 1;
                const seloNumero = cartao.querySelector('.card-feed-numero');
                if (seloNumero) {
                    seloNumero.textContent = String(totalVisiveis).padStart(2, '0');
                }
            }

            fragmento.appendChild(cartao);
        });

        gridLista.appendChild(fragmento);
        atualizarResumoEControles(totalVisiveis);
    }

    const ROTULOS_ORDENACAO = {
        recentes: 'Mais recentes primeiro',
        antigas: 'Mais antigas primeiro'
    };

    function atualizarUIOrdenacao() {
        const rotuloAtivo = ROTULOS_ORDENACAO[estado.ordenacao] || ROTULOS_ORDENACAO.recentes;

        if (textoOrdemAtual) {
            textoOrdemAtual.textContent = rotuloAtivo;
        }

        if (botaoOrdenacao) {
            botaoOrdenacao.setAttribute('aria-label', `Ordenar por publicação: ${rotuloAtivo}`);
        }

        opcoesOrdenacao.forEach((opcao) => {
            const ativo = (opcao.dataset.valor || 'recentes') === estado.ordenacao;
            opcao.classList.toggle('ativo', ativo);
            opcao.setAttribute('aria-selected', String(ativo));
        });
    }

    function fecharMenuOrdenacao(devolverFoco = false) {
        if (!menuOrdenacao || menuOrdenacao.hidden) return;
        menuOrdenacao.hidden = true;
        if (botaoOrdenacao) {
            botaoOrdenacao.setAttribute('aria-expanded', 'false');
            if (devolverFoco) {
                botaoOrdenacao.focus();
            }
        }
    }

    function abrirMenuOrdenacao() {
        if (!menuOrdenacao) return;
        menuOrdenacao.hidden = false;
        if (botaoOrdenacao) {
            botaoOrdenacao.setAttribute('aria-expanded', 'true');
        }
        const opcaoSelecionada = opcoesOrdenacao.find(
            (op) => (op.dataset.valor || 'recentes') === estado.ordenacao
        );
        if (opcaoSelecionada) {
            opcaoSelecionada.focus();
        }
    }

    function resetarTodosFiltros() {
        estado.categoria = 'todos';
        estado.termoBusca = '';
        estado.ordenacao = 'recentes';

        if (inputBusca) inputBusca.value = '';
        fecharMenuOrdenacao(false);
        atualizarUIOrdenacao();

        atualizarBotaoCategoriaAtivo();
        aplicarFiltrosEOrdenacao();
    }

    // =========================================================
    // 4. MODAL DE LEITURA COMPLETA (Bottom Sheet + Gesto 1 Mão)
    // =========================================================
    function sincronizarAcoesDoModal(cartao) {
        if (!cartao) return;
        const idCartao = cartao.id || '';
        const dados = indiceCartoes.get(cartao);

        if (botaoModalSalvar) {
            botaoModalSalvar.dataset.itemId = idCartao;
            if (window.BioHubMobile) {
                window.BioHubMobile.sincronizarBotoesSalvar();
            }
        }

        if (botaoModalCompartilhar && dados) {
            botaoModalCompartilhar.dataset.shareTitulo = dados.titulo;
            botaoModalCompartilhar.dataset.shareTexto = dados.resumo;
            botaoModalCompartilhar.dataset.shareUrl = idCartao ? `noticias.html#${idCartao}` : 'noticias.html';
        }
    }

    function preencherModal(cartao) {
        const imagemCartao = cartao.querySelector('img');
        const categoriaCartao = cartao.querySelector('.categoria');
        const metaCartao = cartao.querySelector('.card-feed-meta');
        const tituloCartao = cartao.querySelector('h2');
        const resumoCartao = cartao.querySelector('.card-feed-resumo');
        const completoCartao = cartao.querySelector('.card-feed-completo');

        if (modalImagem && imagemCartao) {
            modalImagem.src = imagemCartao.getAttribute('src') || '';
            modalImagem.alt = imagemCartao.getAttribute('alt') || '';
        }

        if (modalCategoria && categoriaCartao) {
            modalCategoria.className = categoriaCartao.className;
            modalCategoria.textContent = obterTextoLimpo(categoriaCartao);
        }

        if (modalMeta) {
            modalMeta.textContent = obterTextoLimpo(metaCartao);
        }

        if (modalTitulo) {
            modalTitulo.textContent = obterTextoLimpo(tituloCartao);
        }

        if (modalResumo) {
            modalResumo.textContent = obterTextoLimpo(resumoCartao);
        }

        if (modalCorpo) {
            modalCorpo.replaceChildren();
            const paragrafos = completoCartao ? completoCartao.querySelectorAll('p') : [];

            paragrafos.forEach((paragrafoOriginal) => {
                const novoParagrafo = document.createElement('p');
                novoParagrafo.className = 'modal-noticia-texto';
                novoParagrafo.textContent = obterTextoLimpo(paragrafoOriginal);
                modalCorpo.appendChild(novoParagrafo);
            });
        }

        sincronizarAcoesDoModal(cartao);
    }

    function abrirModal(cartao) {
        if (!modal || !cartao) return;

        cartaoAbertoNoModal = cartao;
        ultimoElementoFocado = document.activeElement;
        preencherModal(cartao);

        const areaScroll = modal.querySelector('.modal-noticia-conteudo-scroll');
        if (areaScroll) {
            areaScroll.scrollTop = 0;
        }

        if (modalCaixa) {
            modalCaixa.style.transform = '';
        }

        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        // Em telas móveis foca o botão inferior de voltar (zona do polegar)
        const ehMobile = window.matchMedia('(max-width: 768px)').matches;
        if (ehMobile && botaoModalVoltar) {
            botaoModalVoltar.focus();
        } else if (botaoFecharModal) {
            botaoFecharModal.focus();
        }
    }

    function fecharModal() {
        if (!modal || modal.getAttribute('aria-hidden') === 'true') return;

        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        cartaoAbertoNoModal = null;

        if (modalCaixa) {
            modalCaixa.style.transform = '';
        }

        if (window.location.hash && window.location.hash.startsWith('#noticia-')) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }

        if (ultimoElementoFocado && typeof ultimoElementoFocado.focus === 'function') {
            ultimoElementoFocado.focus();
        }
    }

    function manterFocoNoModal(evento) {
        if (!modal || modal.getAttribute('aria-hidden') === 'true' || evento.key !== 'Tab' || !modalCaixa) {
            return;
        }

        const elementosFocaveis = Array.from(
            modalCaixa.querySelectorAll(
                'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
        ).filter((el) => el.offsetParent !== null);

        if (elementosFocaveis.length === 0) return;

        const primeiro = elementosFocaveis[0];
        const ultimo = elementosFocaveis[elementosFocaveis.length - 1];

        if (evento.shiftKey && document.activeElement === primeiro) {
            evento.preventDefault();
            ultimo.focus();
        } else if (!evento.shiftKey && document.activeElement === ultimo) {
            evento.preventDefault();
            primeiro.focus();
        }
    }

    // Gesto de deslizar para baixo (swipe-down) na alça/topo do modal no celular
    function configurarArrasteFecharModal() {
        if (!modalCaixa) return;
        const alvosArraste = [modalAlcaArraste, modalTopoArraste].filter(Boolean);
        let inicioY = null;
        let deltaAtualY = 0;

        alvosArraste.forEach((alvo) => {
            alvo.addEventListener('touchstart', (evento) => {
                if (evento.touches.length !== 1) return;
                inicioY = evento.touches[0].clientY;
                deltaAtualY = 0;
                modalCaixa.style.transition = 'none';
            }, { passive: true });

            alvo.addEventListener('touchmove', (evento) => {
                if (inicioY === null) return;
                const diferenca = evento.touches[0].clientY - inicioY;
                if (diferenca > 0) {
                    deltaAtualY = diferenca;
                    modalCaixa.style.transform = `translateY(${Math.min(diferenca, 260)}px)`;
                }
            }, { passive: true });

            alvo.addEventListener('touchend', () => {
                if (inicioY === null) return;
                modalCaixa.style.transition = '';
                inicioY = null;

                if (deltaAtualY > 75) {
                    fecharModal();
                } else {
                    modalCaixa.style.transform = '';
                }
                deltaAtualY = 0;
            });
        });
    }

    // Abre notícia automaticamente quando vier da Home via #noticia-...
    function verificarHashNoticia() {
        const hash = window.location.hash ? window.location.hash.slice(1) : '';
        if (!hash) return;

        const cartaoAlvo = document.getElementById(hash);
        if (cartaoAlvo && cartaoAlvo.classList.contains('card-feed-noticia')) {
            abrirModal(cartaoAlvo);
        }
    }

    // =========================================================
    // 5. REGISTRO DE EVENTOS
    // =========================================================
    botoesFiltro.forEach((botao) => {
        botao.addEventListener('click', () => {
            estado.categoria = botao.dataset.filtro || 'todos';
            atualizarBotaoCategoriaAtivo();
            aplicarFiltrosEOrdenacao();
        });
    });

    if (inputBusca) {
        inputBusca.addEventListener('input', () => {
            estado.termoBusca = normalizarParaBusca(inputBusca.value);
            aplicarFiltrosEOrdenacao();
        });
    }

    if (botaoLimparBusca && inputBusca) {
        botaoLimparBusca.addEventListener('click', () => {
            inputBusca.value = '';
            estado.termoBusca = '';
            aplicarFiltrosEOrdenacao();
            inputBusca.focus();
        });
    }

    if (botaoOrdenacao && menuOrdenacao) {
        botaoOrdenacao.addEventListener('click', () => {
            if (menuOrdenacao.hidden) {
                abrirMenuOrdenacao();
            } else {
                fecharMenuOrdenacao(false);
            }
        });

        botaoOrdenacao.addEventListener('keydown', (evento) => {
            if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
                evento.preventDefault();
                abrirMenuOrdenacao();
            }
        });
    }

    opcoesOrdenacao.forEach((opcao, indice) => {
        opcao.addEventListener('click', () => {
            estado.ordenacao = opcao.dataset.valor || 'recentes';
            atualizarUIOrdenacao();
            fecharMenuOrdenacao(true);
            aplicarFiltrosEOrdenacao();
        });

        opcao.addEventListener('keydown', (evento) => {
            if (evento.key === 'Enter' || evento.key === ' ') {
                evento.preventDefault();
                estado.ordenacao = opcao.dataset.valor || 'recentes';
                atualizarUIOrdenacao();
                fecharMenuOrdenacao(true);
                aplicarFiltrosEOrdenacao();
                return;
            }

            if (evento.key === 'ArrowDown') {
                evento.preventDefault();
                const proxima = opcoesOrdenacao[(indice + 1) % opcoesOrdenacao.length];
                if (proxima) proxima.focus();
            } else if (evento.key === 'ArrowUp') {
                evento.preventDefault();
                const anterior = opcoesOrdenacao[(indice - 1 + opcoesOrdenacao.length) % opcoesOrdenacao.length];
                if (anterior) anterior.focus();
            } else if (evento.key === 'Tab') {
                fecharMenuOrdenacao(false);
            }
        });
    });

    document.addEventListener('click', (evento) => {
        if (seletorOrdenacao && !seletorOrdenacao.contains(evento.target)) {
            fecharMenuOrdenacao(false);
        }
    });

    if (botaoResetarFiltros) {
        botaoResetarFiltros.addEventListener('click', resetarTodosFiltros);
    }

    if (botaoVazioLimpar) {
        botaoVazioLimpar.addEventListener('click', () => {
            resetarTodosFiltros();
            if (inputBusca) inputBusca.focus();
        });
    }

    cartoesNoticia.forEach((cartao) => {
        cartao.addEventListener('click', (evento) => {
            if (evento.target.closest('.btn-acao-social')) return;
            evento.preventDefault();
            abrirModal(cartao);
        });
    });

    if (botaoFecharModal) {
        botaoFecharModal.addEventListener('click', fecharModal);
    }

    if (botaoModalVoltar) {
        botaoModalVoltar.addEventListener('click', fecharModal);
    }

    if (modal) {
        modal.addEventListener('click', (evento) => {
            if (evento.target === modal) {
                fecharModal();
            }
        });
    }

    document.addEventListener('biohub:salvos-alterados', () => {
        if (estado.categoria === 'salvos') {
            aplicarFiltrosEOrdenacao();
        }
        if (cartaoAbertoNoModal) {
            sincronizarAcoesDoModal(cartaoAbertoNoModal);
        }
    });

    document.addEventListener('keydown', (evento) => {
        if (evento.key === 'Escape') {
            if (menuOrdenacao && !menuOrdenacao.hidden) {
                fecharMenuOrdenacao(true);
            } else if (modal && modal.getAttribute('aria-hidden') === 'false') {
                fecharModal();
            } else if (inputBusca && document.activeElement === inputBusca && inputBusca.value !== '') {
                inputBusca.value = '';
                estado.termoBusca = '';
                aplicarFiltrosEOrdenacao();
            }
            return;
        }

        manterFocoNoModal(evento);
    });

    window.addEventListener('hashchange', verificarHashNoticia);

    // Inicializa ordenação, suporte ao swipe-down e leitura via link direto
    configurarArrasteFecharModal();
    aplicarFiltrosEOrdenacao();
    verificarHashNoticia();
});
