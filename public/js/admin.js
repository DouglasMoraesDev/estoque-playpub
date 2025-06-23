// public/js/admin.js

const API = window.location.origin + '/api';

window.addEventListener('DOMContentLoaded', () => {
  // Navegação
  const btnLoja      = document.getElementById('btn-loja');
  const btnBar       = document.getElementById('btn-bar');
  const btnHistorico = document.getElementById('btn-historico');
  const btnUsuario   = document.getElementById('btn-usuario');

  const secProd      = document.getElementById('sec-produto');
  const secHist      = document.getElementById('sec-historico');
  const secUsuario   = document.getElementById('sec-usuario');

  btnLoja     .addEventListener('click', () => activate('loja'));
  btnBar      .addEventListener('click', () => activate('bar'));
  btnHistorico.addEventListener('click', () => activate('hist'));
  btnUsuario  .addEventListener('click', () => activate('user'));

  function activate(view) {
    secProd.style.display    = view === 'loja' || view === 'bar'   ? ''   : 'none';
    secHist.style.display    = view === 'hist'                     ? ''   : 'none';
    secUsuario.style.display = view === 'user'                     ? ''   : 'none';
    if (view === 'loja')      loadProdutos(lojaId);
    if (view === 'bar')       loadProdutos(barId);
  }

  // Estoques
  let lojaId = null, barId = null;

  // Produto DOM
  const formProd    = document.getElementById('form-add-produto');
  const prodIdInput = document.getElementById('produto-id');
  const nomeInput   = document.getElementById('nome-produto');
  const qtdeInput   = document.getElementById('qtde-produto');
  const valInput    = document.getElementById('validade-produto');
  const stockSelect = document.getElementById('stockSelect');

  // Histórico DOM
  const histStockSel = document.getElementById('hist-stock-select');
  const dIni         = document.getElementById('data-inicio');
  const dFim         = document.getElementById('data-fim');
  const btnRel       = document.getElementById('btn-gera-rel');
  const btnPDF       = document.getElementById('btn-pdf');

  // Usuário DOM
  const formUser      = document.getElementById('form-add-usuario');
  const userStockSel  = document.getElementById('userStockSelect');

  let produtosCache = [];

  init();

  async function init() {
    const stocks = await fetch(`${API}/stocks`).then(r=>r.json());
    lojaId = stocks.find(s=>s.name==='LojaPark').id;
    barId  = stocks.find(s=>s.name==='BarPlaypub').id;

    const opts = stocks.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
    stockSelect.innerHTML   = opts;
    histStockSel.innerHTML   = opts;
    userStockSel.innerHTML   = opts;

    // cadastra usuário
    formUser.addEventListener('submit', async e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));
      await fetch(`${API}/usuarios`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(data)
      });
      alert('Usuário criado!');
      e.target.reset();
    });

    btnRel.addEventListener('click', gerarRelatorio);
    btnPDF.addEventListener('click', () => window.print());

    // Submit produto
    formProd.addEventListener('submit', async e => {
      e.preventDefault();
      const nome      = nomeInput.value.trim();
      const validade  = valInput.value;
      const quantidade= +qtdeInput.value;
      const stockId   = +stockSelect.value;
      if (prodIdInput.value) {
        await fetch(`${API}/products/${prodIdInput.value}`, {
          method:'PUT', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ nome, validade })
        });
      } else {
        await fetch(`${API}/products`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ nome, validade, quantidade, stockId })
        });
      }
      prodIdInput.value = '';
      formProd.reset();
      loadProdutos(stockId);
    });

    // ativa LojaPark
    activate('loja');
  }

  // Produtos
  async function loadProdutos(stockId) {
    produtosCache = await fetch(`${API}/products?stockId=${stockId}`).then(r=>r.json());
    const tbody = document.querySelector('#tabela-produtos tbody');
    tbody.innerHTML = produtosCache.map(p => {
      const dt = new Date(p.validade).toLocaleDateString('pt-BR');
      return `
        <tr>
          <td>${p.id}</td><td>${p.nome}</td><td>${p.quantidade}</td><td>${dt}</td>
          <td>
            <button class="edit" data-id="${p.id}">Editar</button>
            <button class="del"  data-id="${p.id}">Apagar</button>
          </td>
        </tr>`;
    }).join('');
    tbody.querySelectorAll('.edit').forEach(b=>b.onclick = e=>editProd(e));
    tbody.querySelectorAll('.del') .forEach(b=>b.onclick = e=>delProd(e));
  }

  function editProd(e) {
    const id = +e.target.dataset.id;
    const p = produtosCache.find(x=>x.id===id);
    prodIdInput.value   = p.id;
    nomeInput.value     = p.nome;
    qtdeInput.value     = p.quantidade;
    valInput.value      = p.validade.split('T')[0];
    stockSelect.value   = p.stockId;
  }

  async function delProd(e) {
    if (!confirm('Confirma exclusão?')) return;
    const id = +e.target.dataset.id;
    await fetch(`${API}/products/${id}`, { method:'DELETE' });
    loadProdutos(+stockSelect.value);
  }

  // Histórico
  async function gerarRelatorio() {
    activate('hist');
    const start = dIni.value, end = dFim.value, sId = +histStockSel.value;
    const dados = await fetch(`${API}/retiradas?start=${start}&end=${end}`).then(r=>r.json());
    const tbody = document.querySelector('#tabela-historico tbody');
    tbody.innerHTML = dados
      .filter(r => (sId===lojaId && r.destination==='LOJA_PARK')
                || (sId===barId  && r.destination==='BAR_PUB'))
      .map(r => {
        const dt = new Date(r.data).toLocaleString('pt-BR');
        return `<tr>
          <td>${r.id}</td><td>${r.produtoNome}</td>
          <td>${r.quantidade}</td><td>${r.usuarioNome}</td>
          <td>${dt}</td>
        </tr>`;
      }).join('');
  }
});
