// public/js/admin.js
const API = window.location.origin + '/api';

window.addEventListener('DOMContentLoaded', () => {
  // Seções e botões
  const btnLoja      = document.getElementById('btn-loja');
  const btnBar       = document.getElementById('btn-bar');
  const btnHistorico = document.getElementById('btn-historico');
  const btnUsuario   = document.getElementById('btn-usuario');
  const secProd      = document.getElementById('sec-produto');
  const secHist      = document.getElementById('sec-historico');
  const secUsuario   = document.getElementById('sec-usuario');

  // Produtos
  const formProd       = document.getElementById('form-add-produto');
  const prodIdInput    = document.getElementById('produto-id');
  const nomeInput      = document.getElementById('nome-produto');
  const qtdeInput      = document.getElementById('qtde-produto');
  const valInput       = document.getElementById('validade-produto');
  const stockSelect    = document.getElementById('stockSelect');
  const btnToggle      = document.getElementById('btn-toggle-view');
  const tableContainer = document.getElementById('table-container');
  const cardsContainer = document.getElementById('cards-produtos');

  // Histórico
  const dIni   = document.getElementById('data-inicio');
  const btnRel = document.getElementById('btn-gera-rel');

  // Usuário
  const formUser     = document.getElementById('form-add-usuario');
  const userStockSel = document.getElementById('userStockSelect');

  let lojaId = null, barId = null, produtosCache = [];

  // Navegação entre abas
  if (btnLoja)      btnLoja.addEventListener('click', () => activate('loja'));
  if (btnBar)       btnBar.addEventListener('click', () => activate('bar'));
  if (btnHistorico) btnHistorico.addEventListener('click', () => activate('hist'));
  if (btnUsuario)   btnUsuario.addEventListener('click', () => activate('user'));

  function activate(view) {
    if (secProd)    secProd.style.display    = (view === 'loja' || view === 'bar') ? '' : 'none';
    if (secHist)    secHist.style.display    = (view === 'hist')               ? '' : 'none';
    if (secUsuario) secUsuario.style.display = (view === 'user')               ? '' : 'none';
    if (view === 'loja') loadProdutos(lojaId);
    if (view === 'bar')  loadProdutos(barId);
    // histórico só via botão
  }

  init();

  async function init() {
    const stocks = await fetch(`${API}/stocks`).then(r => r.json());
    lojaId = stocks.find(s => s.name === 'LojaPark')?.id;
    barId  = stocks.find(s => s.name === 'BarPlaypub')?.id;

    const opts = stocks.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    if (stockSelect)  stockSelect.innerHTML  = opts;
    if (userStockSel) userStockSel.innerHTML = opts;

    // toggle cards/tabela
    if (btnToggle && tableContainer && cardsContainer) {
      btnToggle.addEventListener('click', () => {
        const showTable = tableContainer.style.display !== 'none';
        tableContainer.style.display = showTable ? 'none' : '';
        cardsContainer.style.display = showTable ? '' : 'none';
        btnToggle.textContent = showTable ? 'Ver como tabela' : 'Ver como cards';
      });
    }

    if (formProd) formProd.addEventListener('submit', handleProdSubmit);
    if (formUser) formUser.addEventListener('submit', handleUserSubmit);
    if (btnRel)   btnRel.addEventListener('click', gerarRelatorio);

    activate('loja');
  }

  // CRUD produtos
  async function handleProdSubmit(e) {
    e.preventDefault();
    const nome       = nomeInput.value.trim();
    const validade   = valInput.value;
    const quantidade = +qtdeInput.value;
    const stockId    = +stockSelect.value;
    const method     = prodIdInput.value ? 'PUT' : 'POST';
    const url        = prodIdInput.value
      ? `${API}/products/${prodIdInput.value}`
      : `${API}/products`;

    await fetch(url, {
      method,
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ nome, validade, quantidade, stockId })
    });
    prodIdInput.value = '';
    formProd.reset();
    loadProdutos(stockSelect.value);
  }

  // CRUD usuários
  async function handleUserSubmit(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    const res  = await fetch(`${API}/usuarios`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(data)
    });
    const json = await res.json();
    if (!res.ok) return alert(json.error || 'Falha ao criar usuário.');
    alert(`Usuário "${json.username}" criado!`);
    formUser.reset();
  }

  // Carrega e exibe produtos
  async function loadProdutos(stockId) {
    produtosCache = await fetch(`${API}/products?stockId=${stockId}`).then(r => r.json());
    const tbody = document.querySelector('#tabela-produtos tbody');
    if (tbody) {
      tbody.innerHTML = produtosCache.map(renderRow).join('');
      tbody.querySelectorAll('.edit').forEach(b => b.addEventListener('click', editProd));
      tbody.querySelectorAll('.del') .forEach(b => b.addEventListener('click', delProd));
    }
    if (cardsContainer) renderCards(produtosCache);
  }

  function renderRow(p) {
    const dt = new Date(p.validade).toLocaleDateString('pt-BR');
    return `
      <tr>
        <td>${p.id}</td><td>${p.nome}</td><td>${p.quantidade}</td><td>${dt}</td>
        <td>
          <button class="edit" data-id="${p.id}">Editar</button>
          <button class="del"  data-id="${p.id}">Apagar</button>
        </td>
      </tr>`;
  }

  function renderCards(produtos) {
    cardsContainer.innerHTML = '';
    produtos.forEach(p => {
      const card = document.createElement('div');
      card.className = 'card';
      const dt = new Date(p.validade).toLocaleDateString('pt-BR');
      card.innerHTML = `
        <div class="card-header">#${p.id} – ${p.nome}</div>
        <div class="card-row"><span class="label">Qtde:</span><span class="value">${p.quantidade}</span></div>
        <div class="card-row"><span class="label">Validade:</span><span class="value">${dt}</span></div>
        <div class="card-actions">
          <button class="edit" data-id="${p.id}">Editar</button>
          <button class="del"  data-id="${p.id}">Apagar</button>
        </div>`;
      cardsContainer.appendChild(card);
    });
    cardsContainer.querySelectorAll('.edit').forEach(b => b.addEventListener('click', editProd));
    cardsContainer.querySelectorAll('.del') .forEach(b => b.addEventListener('click', delProd));
  }

  function editProd(e) {
    e.preventDefault();
    const p = produtosCache.find(x => x.id === +e.target.dataset.id);
    prodIdInput.value = p.id;
    nomeInput.value   = p.nome;
    qtdeInput.value   = p.quantidade;
    valInput.value    = p.validade.split('T')[0];
    stockSelect.value = p.stockId;
  }

  async function delProd(e) {
    e.preventDefault();
    if (!confirm('Confirma exclusão?')) return;
    await fetch(`${API}/products/${+e.target.dataset.id}`, { method:'DELETE' });
    loadProdutos(+stockSelect.value);
  }

  // Buscar histórico com no-store para evitar cache
  async function gerarRelatorio(e) {
    e.preventDefault();
    const date = dIni.value;               // ex: '2025-06-27'
    if (!date) return alert('Escolha uma data.');

    // define início e fim do dia
    const start = `${date}T00:00:00`;
    const end   = `${date}T23:59:59`;

    // busca com no-store para evitar cache
    const res  = await fetch(
      `${API}/retiradas?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
      { cache: 'no-store' }
    );
    const dados = await res.json();
    console.log('Retiradas recebidas:', dados);

    const tbody = document.querySelector('#tabela-historico tbody');
    if (!tbody) return;

    // preenche linhas: produto, qtde, usuário, origem, hora
    tbody.innerHTML = dados.map(r => {
      const hora    = new Date(r.data).toLocaleTimeString('pt-BR');
      const destino = r.destination === 'LOJA_PARK' ? 'Loja Park' : 'Bar Pub';
      return `
        <tr>
          <td>${r.produtoNome}</td>
          <td>${r.quantidade}</td>
          <td>${r.usuarioNome}</td>
          <td>${destino}</td>
          <td>${hora}</td>
        </tr>`;
    }).join('');
  }
});
