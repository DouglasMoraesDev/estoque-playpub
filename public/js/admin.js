// public/js/admin.js
const API = window.location.origin + '/api';

window.addEventListener('DOMContentLoaded', () => {
  const btnDash     = document.getElementById('btn-dashboard');
  const btnLoja     = document.getElementById('btn-loja');
  const btnBar      = document.getElementById('btn-bar');
  const btnHist     = document.getElementById('btn-historico');
  const btnUser     = document.getElementById('btn-usuario');
  const secDash     = document.getElementById('sec-dashboard');
  const secProd     = document.getElementById('sec-produto');
  const secHist     = document.getElementById('sec-historico');
  const secUser     = document.getElementById('sec-usuario');

  const formProd       = document.getElementById('form-add-produto');
  const prodIdInput    = document.getElementById('produto-id');
  const nomeInput      = document.getElementById('nome-produto');
  const qtdeInput      = document.getElementById('qtde-produto');
  const addQtdeInput   = document.getElementById('add-qtde-produto');
  const valInput       = document.getElementById('validade-produto');
  const stockSelect    = document.getElementById('stockSelect');
  const searchInput    = document.getElementById('search-produto');
  const cardsContainer = document.getElementById('cards-produtos');

  let lojaId = null, barId = null, produtosCache = [];

  [btnDash, btnLoja, btnBar, btnHist, btnUser].forEach(btn =>
    btn && btn.addEventListener('click', () => activate(btn.id.replace('btn-','')))
  );

  function activate(view) {
    secDash.style.display = view==='dashboard'? '':'none';
    secProd.style.display = view==='loja'||view==='bar'? '':'none';
    secHist.style.display = view==='historico'? '':'none';
    secUser.style.display = view==='usuario'? '':'none';
    if (view==='loja')    loadProdutos(lojaId);
    if (view==='bar')     loadProdutos(barId);
    if (view==='dashboard') loadDashboard();
  }

  async function init() {
    const stocks = await fetch(`${API}/stocks`).then(r=>r.json());
    lojaId = stocks.find(s=>s.name==='LojaPark')?.id;
    barId  = stocks.find(s=>s.name==='BarPlaypub')?.id;
    const opts = stocks.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
    stockSelect.innerHTML = opts;
    document.getElementById('userStockSelect').innerHTML = opts;

    formProd.addEventListener('submit', handleProdSubmit);
    document.getElementById('form-add-usuario')
            .addEventListener('submit', handleUserSubmit);
    document.getElementById('btn-gera-rel')
            .addEventListener('click', gerarRelatorio);
    searchInput.addEventListener('input', ()=>renderCards(produtosCache));

    activate('dashboard');
  }

  async function loadDashboard() {
    const today = new Date().toISOString().slice(0,10);
    const dados1 = await fetch(`${API}/retiradas?start=${today}T00:00:00&end=${today}T23:59:59`)
                          .then(r=>r.json());
    document.getElementById('dash-retiradas').textContent = dados1.length;

    const al = await fetch(`${API}/alerts`).then(r=>r.json());

    document.getElementById('dash-vencendo-count').textContent = al.almostExpiring.length;
    const venListEl = document.getElementById('dash-vencendo-list');
    venListEl.innerHTML = al.almostExpiring.length
      ? al.almostExpiring.map(p=>{
          const dt = new Date(p.validade).toLocaleDateString('pt-BR');
          return `<li>${p.nome} — vence em ${dt}</li>`;
        }).join('')
      : '<li>— Nenhum —</li>';

    document.getElementById('dash-lowstock-count').textContent = al.lowStock.length;
    const lowListEl = document.getElementById('dash-lowstock-list');
    lowListEl.innerHTML = al.lowStock.length
      ? al.lowStock.map(p=>`<li>${p.nome} (${p.quantidade})</li>`).join('')
      : '<li>— Nenhum —</li>';

    const pLoja = await fetch(`${API}/products?stockId=${lojaId}`).then(r=>r.json());
    const pBar  = await fetch(`${API}/products?stockId=${barId}`).then(r=>r.json());
    document.getElementById('dash-total-loja').textContent = pLoja.length;
    document.getElementById('dash-total-bar').textContent = pBar.length;
  }

  async function loadProdutos(stockId) {
    produtosCache = await fetch(`${API}/products?stockId=${stockId}`).then(r=>r.json());
    renderCards(produtosCache);
  }

  function renderCards(list) {
    const term = searchInput.value.trim().toLowerCase();
    cardsContainer.innerHTML = '';
    list.filter(p=>p.nome.toLowerCase().includes(term)).forEach(p=>{
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
    cardsContainer.querySelectorAll('.edit').forEach(b=>b.addEventListener('click', editProd));
    cardsContainer.querySelectorAll('.del').forEach(b=>b.addEventListener('click', delProd));
  }

  function editProd(e) {
    e.preventDefault();
    const p = produtosCache.find(x=>x.id===+e.target.dataset.id);
    prodIdInput.value = p.id;
    nomeInput.value   = p.nome;
    qtdeInput.value   = p.quantidade;  // agora editável
    valInput.value    = p.validade.split('T')[0];
    stockSelect.value = p.stockId;
    addQtdeInput.style.display = '';
  }

  async function handleProdSubmit(e) {
    e.preventDefault();
    const id    = prodIdInput.value;
    const nome  = nomeInput.value.trim();
    const validade = valInput.value;
    const stockId  = +stockSelect.value;

    if (id && +addQtdeInput.value > 0) {
      await fetch(`${API}/add-product-stock`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ productId:+id, stockId, quantity:+addQtdeInput.value })
      });
    } else if (!id) {
      await fetch(`${API}/products`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ nome, validade, quantidade:+qtdeInput.value, stockId })
      });
    } else {
      await fetch(`${API}/products/${id}`, {
        method:'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ nome, validade, quantidade:+qtdeInput.value, stockId })
      });
    }

    prodIdInput.value = '';
    formProd.reset();
    addQtdeInput.style.display = 'none';
    loadProdutos(stockSelect.value);
  }

  async function delProd(e) {
    e.preventDefault();
    if (!confirm('Confirma exclusão?')) return;
    await fetch(`${API}/products/${+e.target.dataset.id}`, { method:'DELETE' });
    loadProdutos(+stockSelect.value);
  }

  async function handleUserSubmit(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    const res  = await fetch(`${API}/usuarios`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(data)
    });
    const json = await res.json();
    if (!res.ok) return alert(json.error || 'Falha ao criar usuário.');
    alert(`Usuário "${json.username}" criado!`);
    e.target.reset();
  }

  async function gerarRelatorio(e) {
    e.preventDefault();
    const date = document.getElementById('data-inicio').value;
    if (!date) return alert('Escolha uma data.');
    const dados = await fetch(`${API}/retiradas?start=${date}T00:00:00&end=${date}T23:59:59`, { cache:'no-store' })
                         .then(r=>r.json());
    const tbody = document.querySelector('#tabela-historico tbody');
    tbody.innerHTML = dados.map(r=>{
      const hora = new Date(r.data).toLocaleTimeString('pt-BR');
      const dest = r.destination==='LOJA_PARK'?'Loja Park':'Bar Pub';
      return `<tr>
        <td>${r.produtoNome}</td><td>${r.quantidade}</td><td>${r.usuarioNome}</td>
        <td>${dest}</td><td>${hora}</td>
      </tr>`;
    }).join('');
  }

  init();
});
