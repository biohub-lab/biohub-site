'use strict';

document.addEventListener('DOMContentLoaded', () => {
    // =========================================================
    // 1. SELEÇÃO DOS ELEMENTOS DO DOM
    // =========================================================
    const gridLista = document.getElementById('grid-noticias-lista');
    const botoesFiltro = document.querySelectorAll('.pilula-filtro');
    const inputBusca = document.getElementById('busca-noticias');
    const botaoLimparBusca = document.getElementById('btn-limpar-busca');
    const selectOrdenacao = document.getElementById('ordem-noticias');
    const contadorNoticias = document.getElementById('contador-noticias');
    const botaoResetarFiltros = document.getElementById('btn-resetar-filtros');

    const mensagemVazio = document.getElementById('mensagem-vazio');
    const mensagemVazioTitulo = document.getElementById('mensagem-vazio-titulo');
    const mensagemVazioDetalhe = document.getElementById('mensagem-vazio-detalhe');
    const botaoVazioLimpar = document.getElementById('btn-vazio-limpar');

    const modal = document.getElementById('modal-noticia');
    const modalCaixa = modal ? modal.querySelector('.modal-noticia-caixa') : null;
    const botaoFecharModal = document.getElementById('btn-fechar-modal');
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
        ordenacao: selectOrdenacao ? selectOrdenacao.value : 'recentes'
    };

    let ultimoElementoFocado = null;

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
            timestamp: obterTimestampPublicacao(cartao),
            textoBusca: normalizarParaBusca(`${titulo} ${resumo} ${completo} ${categoriaRotulo}`)
        });
    });

    // =========================================================
    // 3. BUSCA + FILTRO POR CATEGORIA + ORDENAÇÃO POR DATA
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
                contadorNoticias.textContent = 'Nenhuma notícia encontrada';
            } else if (totalVisiveis === 1) {
                contadorNoticias.textContent = `Exibindo 1 notícia · ${rotuloOrdem}`;
            } else {
                contadorNoticias.textContent = `Exibindo ${totalVisiveis} notícias · ${rotuloOrdem}`;
            }
        }

        if (mensagemVazio) {
            mensagemVazio.hidden = totalVisiveis > 0;

            if (totalVisiveis === 0) {
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

        // 2) Reinsere na ordem escolhida e avalia visibilidade (categoria + busca)
        let totalVisiveis = 0;
        const fragmento = document.createDocumentFragment();

        cartoesOrdenados.forEach((cartao) => {
            const categoriaDoCartao = cartao.dataset.categoria || '';
            const dados = indiceCartoes.get(cartao);

            const bateCategoria =
                estado.categoria === 'todos' ||
                categoriaDoCartao === estado.categoria;

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

    function resetarTodosFiltros() {
        estado.categoria = 'todos';
        estado.termoBusca = '';
        estado.ordenacao = 'recentes';

        if (inputBusca) inputBusca.value = '';
        if (selectOrdenacao) selectOrdenacao.value = 'recentes';

        atualizarBotaoCategoriaAtivo();
        aplicarFiltrosEOrdenacao();
    }

    // =========================================================
    // 4. MODAL DE LEITURA COMPLETA (com foco acessível)
    // =========================================================
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
    }

    function abrirModal(cartao) {
        if (!modal) return;

        ultimoElementoFocado = document.activeElement;
        preencherModal(cartao);

        const areaScroll = modal.querySelector('.modal-noticia-conteudo-scroll');
        if (areaScroll) {
            areaScroll.scrollTop = 0;
        }

        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        if (botaoFecharModal) {
            botaoFecharModal.focus();
        }
    }

    function fecharModal() {
        if (!modal || modal.getAttribute('aria-hidden') === 'true') return;

        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';

        if (ultimoElementoFocado && typeof ultimoElementoFocado.focus === 'function') {
            ultimoElementoFocado.focus();
        }
    }

    function manterFocoNoModal(evento) {
        if (!modal || modal.getAttribute('aria-hidden') === 'true' || evento.key !== 'Tab' || !modalCaixa) {
            return;
        }

        const elementosFocaveis = modalCaixa.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );

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

    if (selectOrdenacao) {
        selectOrdenacao.addEventListener('change', () => {
            estado.ordenacao = selectOrdenacao.value || 'recentes';
            aplicarFiltrosEOrdenacao();
        });
    }

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
            evento.preventDefault();
            abrirModal(cartao);
        });
    });

    if (botaoFecharModal) {
        botaoFecharModal.addEventListener('click', fecharModal);
    }

    if (modal) {
        modal.addEventListener('click', (evento) => {
            if (evento.target === modal) {
                fecharModal();
            }
        });
    }

    document.addEventListener('keydown', (evento) => {
        if (evento.key === 'Escape') {
            if (modal && modal.getAttribute('aria-hidden') === 'false') {
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

    // Inicializa ordenação (mais recentes primeiro) e numeração ao carregar
    aplicarFiltrosEOrdenacao();
});
