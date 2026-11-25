'use strict';

document.addEventListener('DOMContentLoaded', () => {
    // =========================================================
    // 1. SELEÇÃO DOS ELEMENTOS DO DOM (As "peças" do HTML)
    // =========================================================
    const botoesFiltro = document.querySelectorAll('.pilula-filtro');
    const cartoesNoticia = document.querySelectorAll('.card-feed-noticia');
    const mensagemVazio = document.getElementById('mensagem-vazio');

    const modal = document.getElementById('modal-noticia');
    const botaoFecharModal = document.getElementById('btn-fechar-modal');
    const modalImagem = document.getElementById('modal-noticia-img');
    const modalCategoria = document.getElementById('modal-noticia-categoria');
    const modalMeta = document.getElementById('modal-noticia-meta');
    const modalTitulo = document.getElementById('modal-noticia-titulo');
    const modalResumo = document.getElementById('modal-noticia-resumo');

    // Guarda qual elemento estava focado antes de abrir o modal (acessibilidade)
    let ultimoElementoFocado = null;

    // =========================================================
    // 2. FUNÇÃO AUXILIAR (Utilitário)
    // =========================================================
    function obterTextoLimpo(elemento) {
        if (!elemento) return '';
        return elemento.textContent.replace(/\s+/g, ' ').trim();
    }

    // =========================================================
    // 3. SISTEMA DE FILTROS POR CATEGORIA
    // =========================================================
    function atualizarBotaoAtivo(botaoSelecionado) {
        botoesFiltro.forEach((botao) => {
            const estaAtivo = botao === botaoSelecionado;
            botao.classList.toggle('ativo', estaAtivo);
            botao.setAttribute('aria-pressed', String(estaAtivo));
        });
    }

    function filtrarNoticias(categoriaEscolhida) {
        let totalVisiveis = 0;

        cartoesNoticia.forEach((cartao) => {
            const categoriaDoCartao = cartao.dataset.categoria;
            const deveMostrar =
                categoriaEscolhida === 'todos' ||
                categoriaDoCartao === categoriaEscolhida;

            cartao.hidden = !deveMostrar;

            if (deveMostrar) {
                totalVisiveis += 1;

                // Renumera dinamicamente o selo no canto da foto (01, 02, 03...)
                const seloNumero = cartao.querySelector('.card-feed-numero');
                if (seloNumero) {
                    seloNumero.textContent = String(totalVisiveis).padStart(2, '0');
                }
            }
        });

        // Exibe a mensagem de lista vazia apenas se nenhum cartão ficar visível
        if (mensagemVazio) {
            mensagemVazio.hidden = totalVisiveis > 0;
        }
    }

    // =========================================================
    // 4. MODAL DE LEITURA DA NOTÍCIA
    // =========================================================
    function preencherModal(cartao) {
        const imagemCartao = cartao.querySelector('img');
        const categoriaCartao = cartao.querySelector('.categoria');
        const metaCartao = cartao.querySelector('.card-feed-meta');
        const tituloCartao = cartao.querySelector('h2');
        const resumoCartao = cartao.querySelector('.card-feed-resumo');

        if (modalImagem && imagemCartao) {
            modalImagem.src = imagemCartao.src;
            modalImagem.alt = imagemCartao.alt;
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
    }

    function abrirModal(cartao) {
        if (!modal) return;

        ultimoElementoFocado = document.activeElement;
        preencherModal(cartao);

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

    // =========================================================
    // 5. EVENTOS (Conecta as ações do usuário às funções)
    // =========================================================
    botoesFiltro.forEach((botao) => {
        botao.addEventListener('click', () => {
            const filtro = botao.dataset.filtro || 'todos';
            atualizarBotaoAtivo(botao);
            filtrarNoticias(filtro);
        });
    });

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
        // Fecha ao clicar no fundo escuro (fora da caixa branca)
        modal.addEventListener('click', (evento) => {
            if (evento.target === modal) {
                fecharModal();
            }
        });
    }

    // Fecha ao pressionar a tecla Esc
    document.addEventListener('keydown', (evento) => {
        if (evento.key === 'Escape') {
            fecharModal();
        }
    });
});