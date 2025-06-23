// public/js/employee.js
const API_BASE = '/api';

const empData = JSON.parse(document.getElementById('empStockData').textContent);
const empStockId = empData.stockId;
const destination = empData.destination;
const userId = empData.userId;

const formRetirar = document.getElementById('form-retirar');
const inputBusca = document.getElementById('input-busca-estoque');
const resultsContainer = document.getElementById('results-container');
const produtoNome = document.getElementById('produto-nome-display');
const produtoQtde = document.getElementById('produto-qtde-display');
const produtoValidade = document.getElementById('produto-validade-display');
const qtdeRetirar = document.getElementById('qtde-retirar');
const destinoRetirada = document.getElementById('destino-retirada');
const tabelaHistorico = document.querySelector('#tabela-historico-func tbody');

let estoqueCache = [];
let selectedProduct = null;

async function initEmp() {
  destinoRetirada.value = destination;
  await carregarEstoque();
  await carregarHistoricoHoje();
}

async function carregarEstoque() {
  try {
    const res = await fetch(`${API_BASE}/products?stockId=${empStockId}`);
    estoqueCache = await res.json();
  } catch (err) {
    console.error('Erro ao carregar estoque:', err);
  }
}

inputBusca.addEventListener('input', () => {
  const termo = inputBusca.value.trim().toLowerCase();
  if (!termo) {
    resultsContainer.style.display = 'none';
    return;
  }

  const filtrados = estoqueCache.filter(p => p.nome.toLowerCase().includes(termo));
  resultsContainer.innerHTML = filtrados.length
    ? filtrados.map(p => `<div class="result-item" data-id="${p.id}">${p.nome} (${p.quantidade})</div>`).join('')
    : '<div class="result-item">Nenhum encontrado</div>';

  resultsContainer.style.display = 'block';

  document.querySelectorAll('.result-item').forEach(div => {
    div.addEventListener('click', () => {
      const id = Number(div.dataset.id);
      const p = estoqueCache.find(x => x.id === id);
      if (!p) return;

      selectedProduct = p;
      produtoNome.value = p.nome;
      produtoQtde.value = p.quantidade;
      produtoValidade.value = new Date(p.validade).toLocaleDateString('pt-BR');
      resultsContainer.style.display = 'none';
    });
  });
});

formRetirar.addEventListener('submit', async e => {
  e.preventDefault();
  if (!selectedProduct) return alert('Selecione um produto.');
  const qty = parseInt(qtdeRetirar.value, 10);
  if (isNaN(qty) || qty <= 0) return alert('Informe quantidade válida.');

  try {
    const res = await fetch(`${API_BASE}/retiradas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: selectedProduct.id,
        quantity: qty,
        destination: destination
      })
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error || 'Erro ao registrar retirada.');

    // limpar campos
    inputBusca.value = '';
    produtoNome.value = '';
    produtoQtde.value = '';
    produtoValidade.value = '';
    qtdeRetirar.value = '';
    selectedProduct = null;

    await carregarEstoque();
    await carregarHistoricoHoje();
  } catch (err) {
    console.error('Erro ao registrar retirada:', err);
  }
});

async function carregarHistoricoHoje() {
  const hoje = new Date().toISOString().split('T')[0];
  try {
    const res = await fetch(`${API_BASE}/my-retiradas?start=${hoje}&end=${hoje}`);
    const lista = await res.json();
    renderHistorico(lista);
  } catch (err) {
    console.error('Erro ao buscar retiradas:', err);
  }
}

function renderHistorico(lista) {
  tabelaHistorico.innerHTML = '';
  lista.forEach(r => {
    const dt = new Date(r.data);
    const hora = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const destinoLabel = r.destination === 'LOJA_PARK' ? 'Loja Park' : 'Bar Pub';
    tabelaHistorico.innerHTML += `
      <tr>
        <td>${r.id}</td>
        <td>${r.produtoNome}</td>
        <td>${r.quantidade}</td>
        <td>${destinoLabel}</td>
        <td>${hora}</td>
      </tr>
    `;
  });
}

window.addEventListener('load', initEmp);
