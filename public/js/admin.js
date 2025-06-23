// public/js/admin.js
const API = window.location.origin + '/api';

window.addEventListener('DOMContentLoaded', () => {
  // Botões de navegação
  const btnLoja      = document.getElementById('btn-loja');
  const btnBar       = document.getElementById('btn-bar');
  const btnHistorico = document.getElementById('btn-historico');
  const btnUsuario   = document.getElementById('btn-usuario');

  const secProd    = document.getElementById('sec-produto');
  const secHist    = document.getElementById('sec-historico');
  const secUsuario = document.getElementById('sec-usuario');

  btnLoja     .addEventListener('click', () => activate('loja'));
  btnBar      .addEventListener('click', () => activate('bar'));
  btnHistorico.addEventListener('click', () => activate('hist'));
  btnUsuario  .addEventListener('click', () => activate('user'));

  function activate(view) {
    secProd.style.display    = (view === 'loja' || view === 'bar') ? '' : 'none';
    secHist.style.display    = (view === 'hist')               ? '' : 'none';
    secUsuario.style.display = (view === 'user')               ? '' : 'none';
    if (view === 'loja') loadProdutos(lojaId);
    if (view === 'bar')  loadProdutos(barId);
  }

  // IDs dos estoques
  let lojaId = null, barId = null;

  // DOM: Produtos
  const formProd    = document.getElementById('form-add-produto');
  const prodIdInput = document.getElementById('produto-id');
  const nomeInput   = document.getElementById('nome-produto');
  const qtdeInput   = document.getElementById('qtde-produto');
  const valInput    = document.getElementById('validade-produto');
  const stockSelect = document.getElementById('stockSelect');

  // DOM: Histórico
  const histStockSel = document.getElementById('hist-stock-select');
  const dIni         = document.getElementById('data-inicio');
  const dFim         = document.getElementById('data-fim');
  const btnRel       = document.getElementById('btn-gera-rel');
  const btnPDF       = document.getElementById('btn-pdf');

  // DOM: Usuário
  const formUser      = document.getElementById('form-add-usuario');
  const userStockSel  = document.getElementById('userStockSelect');

  let produtosCache = [];

  init();

  async function init() {
    // Carrega estoques
    const stocks = await fetch(`${API}/stocks`).then(r => r.json());
    lojaId = stocks.find(s => s.name === 'LojaPark').id;
    barId  = stocks.find(s => s.name === 'BarPlaypub').id;

    // Preenche selects
    const opts = stocks.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    stockSelect.innerHTML  = opts;
    histStockSel.innerHTML  = opts;
    userStockSel.innerHTML = opts;

    // Cadastro de usuário
    formUser.addEventListener('submit', async e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));
      const res = await fetch(`${API}/usuarios`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (!res.ok) return alert(json.error || 'Falha ao criar usuário.');
      alert(`Usuário "${json.username}" criado!`);
      e.target.reset();
    });

    // Cadastro/Edição de produto
    formProd.addEventListener('submit', async e => {
      e.preventDefault();
      const nome       = nomeInput.value.trim();
      const validade   = valInput.value;
      const quantidade = +qtdeInput.value;
      const stockId    = +stockSelect.value;

      if (prodIdInput.value) {
        // Edição — agora enviamos também quantidade e stockId
        await fetch(`${API}/products/${prodIdInput.value}`, {
          method: 'PUT',
          headers: { 'Content-Type':'application/json' },
          body: JSON.stringify({ 
            nome, 
            validade, 
            quantidade, 
            stockId 
          })
        });
      } else {
        // Novo produto
        await fetch(`${API}/products`, {
          method: 'POST',
          headers: { 'Content-Type':'application/json' },
          body: JSON.stringify({ nome, validade, quantidade, stockId })
        });
      }

      prodIdInput.value = '';
      formProd.reset();
      loadProdutos(stockId);
    });

    // Geração de relatório
    btnRel.addEventListener('click', gerarRelatorio);
    btnPDF.addEventListener('click', () => window.print());

    // Exibe produtos da LojaPark por padrão
    activate('loja');
  }

  async function loadProdutos(stockId) {
    produtosCache = await fetch(`${API}/products?stockId=${stockId}`).then(r => r.json());
    const tbody = document.querySelector('#tabela-produtos tbody');
    tbody.innerHTML = produtosCache.map(p => {
      const dt = new Date(p.validade).toLocaleDateString('pt-BR');
      return `
        <tr>
          <td>${p.id}</td>
          <td>${p.nome}</td>
          <td>${p.quantidade}</td>
          <td>${dt}</td>
          <td>
            <button class="edit" data-id="${p.id}">Editar</button>
            <button class="del"  data-id="${p.id}">Apagar</button>
          </td>
        </tr>`;
    }).join('');
    tbody.querySelectorAll('.edit').forEach(b => b.addEventListener('click', editProd));
    tbody.querySelectorAll('.del') .forEach(b => b.addEventListener('click', delProd));
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

  async function gerarRelatorio(e) {
    e.preventDefault();
    activate('hist');
    const start = dIni.value;
    const end   = dFim.value;
    const sId   = +histStockSel.value;

    try {
      const res   = await fetch(`${API}/retiradas?start=${start}&end=${end}`);
      const dados = await res.json();

      const tbody = document.querySelector('#tabela-historico tbody');
      tbody.innerHTML = dados
        .filter(r => (sId === lojaId && r.destination === 'LOJA_PARK')
                  || (sId === barId  && r.destination === 'BAR_PUB'))
        .map(r => {
          const dt      = new Date(r.data).toLocaleString('pt-BR');
          const destino = r.destination === 'LOJA_PARK' ? 'Loja Park' : 'Bar Pub';
          return `
            <tr>
              <td>${r.id}</td>
              <td>${r.produtoNome}</td>
              <td>${r.quantidade}</td>
              <td>${r.usuarioNome}</td>
              <td>${destino}</td>
              <td>${dt}</td>
            </tr>`;
        }).join('');
    } catch (err) {
      console.error('Erro gerarRelatorio:', err);
      alert('Falha ao buscar relatório.');
    }
  }
});
