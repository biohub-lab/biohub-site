import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const db = createClient(
  'https://fbtazspzewrgoadtxgnh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZidGF6c3B6ZXdyZ29hZHR4Z25oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyODY0NTIsImV4cCI6MjEwODg2MjQ1Mn0.7X86tjZmM_6la-vthlNrGu0Wbdl7KsbrqPcBBXqM8tI'
);

const lista = document.getElementById('lista-artigos');
const formPesquisa = document.getElementById('form-pesquisa');
const pesquisaInput = document.getElementById('titulo_pesquisa');
const selArea = document.getElementById('filtro-area');
const selOrdem = document.getElementById('filtro-ordem');
const btnLimpar = document.getElementById('filtro-limpar');

let artigosCache = [];

function normalizar(texto = '') {
  return String(texto)
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function formatarData(timestamp) {
  if (!timestamp) return '';
  const data = new Date(String(timestamp).replace(' ', 'T'));
  if (Number.isNaN(data.getTime())) return '';

  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
    .format(data)
    .replace(/ de (\d{4})$/, ' $1');
}

function criarCard(infoBanco) {
  const card = document.createElement('article');
  card.className = 'cartao-artigo';
  card.innerHTML = `
    <a href="" class="cartao-artigo-link">
      <div class="cartao-artigo-capa">
        <img src="" alt="....">
      </div>
      <div class="cartao-artigo-info">
        <div>
          <h3></h3>
          <p></p>
          <p class="cartao-artigo-autor">Profissional convidado</p>
          <p class="cartao-artigo-meta">
            <span></span>
            <time datetime=""></time>
          </p>
        </div>
      </div>
    </a>
  `;

  const areaLimpa = infoBanco.categoria ? infoBanco.categoria.trim() : '';

  card.querySelector('h3').textContent = infoBanco.titulo ?? '';
  card.querySelector('p').textContent = infoBanco.sub_titulo ?? '';
  card.querySelector('a').href = infoBanco.link_artigo ?? '#';
  card.querySelector('img').src = infoBanco.imagem ?? '';
  card.querySelector('span').textContent = areaLimpa ? `${areaLimpa} · ` : '';

  const timeEl = card.querySelector('time');
  timeEl.textContent = formatarData(infoBanco.created_at);
  if (infoBanco.created_at) {
    timeEl.setAttribute('datetime', infoBanco.created_at);
  }

  
  card.dataset.area = normalizar(areaLimpa);
  card.dataset.data = infoBanco.created_at ? String(infoBanco.created_at) : '';
  card.dataset.titulo = infoBanco.titulo ? infoBanco.titulo.trim() : '';

  return card;
}

function popularAreas(artigos) {
  if (!selArea) return;

  const valorAtual = selArea.value;
  // Mantém apenas a primeira opção ("Todas as áreas")
  selArea.length = 1;

  const areasMap = new Map();
  artigos.forEach((item) => {
    if (item.areaOriginal) {
      const chave = normalizar(item.areaOriginal);
      if (!areasMap.has(chave)) {
        areasMap.set(chave, item.areaOriginal);
      }
    }
  });

  const areasOrdenadas = [...areasMap.entries()].sort((a, b) =>
    a[1].localeCompare(b[1], 'pt-BR')
  );

  areasOrdenadas.forEach(([chave, rotulo]) => {
    const opcao = document.createElement('option');
    opcao.value = chave;
    opcao.textContent = rotulo;
    selArea.appendChild(opcao);
  });

  // Preserva a seleção caso ainda exista após recarregar
  if ([...selArea.options].some((opt) => opt.value === valorAtual)) {
    selArea.value = valorAtual;
  }
}

function ordenarArtigos(itens) {
  const ordem = selOrdem ? selOrdem.value : 'recentes';

  return itens.slice().sort((a, b) => {
    if (ordem === 'az') {
      return a.titulo.localeCompare(b.titulo, 'pt-BR');
    }
    if (ordem === 'antigos') {
      return a.data.localeCompare(b.data);
    }
    return b.data.localeCompare(a.data); // recentes
  });
}

function aplicarFiltros() {
  const termo = normalizar(pesquisaInput ? pesquisaInput.value : '');
  const areaSelecionada = selArea ? selArea.value : 'todas';

  const ordenados = ordenarArtigos(artigosCache);

  ordenados.forEach((item) => {
    const combinaTexto =
      !termo ||
      normalizar(item.titulo).includes(termo) ||
      normalizar(item.sub_titulo).includes(termo);

    const combinaArea =
      areaSelecionada === 'todas' || item.areaNormalizada === areaSelecionada;

    const visivel = combinaTexto && combinaArea;
    item.element.classList.toggle('hide', !visivel);
  });

  // Reordena os bagulho
  if (lista) {
    lista.replaceChildren(...ordenados.map((item) => item.element));
  }
}

async function carregarArtigos() {
  const { data, error } = await db
    .from('artigos')
    .select('titulo, sub_titulo, link_artigo, imagem, categoria, cliques, created_at')
    .order('id', { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  artigosCache = (data || []).map((item) => {
    const areaOriginal = item.categoria ? item.categoria.trim() : '';
    const cardElement = criarCard(item);

    return {
      titulo: item.titulo ?? '',
      sub_titulo: item.sub_titulo ?? '',
      areaOriginal,
      areaNormalizada: normalizar(areaOriginal),
      data: item.created_at ? String(item.created_at) : '',
      element: cardElement,
    };
  });

  popularAreas(artigosCache);
  aplicarFiltros();
}

// Eventos de busca, filtro e ordenação
pesquisaInput?.addEventListener('input', aplicarFiltros);
selArea?.addEventListener('change', aplicarFiltros);
selOrdem?.addEventListener('change', aplicarFiltros);

btnLimpar?.addEventListener('click', () => {
  if (pesquisaInput) pesquisaInput.value = '';
  if (selArea) selArea.value = 'todas';
  if (selOrdem) selOrdem.value = 'recentes';
  aplicarFiltros();
});

formPesquisa?.addEventListener('submit', (evento) => {
  evento.preventDefault();
  aplicarFiltros();
});

















// Botão temporário de inserção no banco
document.getElementById('teste_button')?.addEventListener('click', async () => {
  const tituloInp = document.getElementById('titulo_input');
  const subtituloInp = document.getElementById('subtitulo_input');
  const imgInp = document.getElementById('img_input');
  const linkInp = document.getElementById('link_input');

  const titulo = tituloInp.value.trim();
  if (!titulo) return;

  const { error } = await db.from('artigos').insert({
    titulo,
    sub_titulo: subtituloInp.value.trim() || null,
    link_artigo: linkInp.value.trim() || null,
    imagem: imgInp.value.trim() || null,
  });

  if (error) {
    console.error(error.code, error.message, error.hint);
    return;
  }

  [tituloInp, subtituloInp, imgInp, linkInp].forEach((i) => (i.value = ''));
  carregarArtigos();
});

carregarArtigos();