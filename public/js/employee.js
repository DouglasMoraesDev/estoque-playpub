const inputBuscaEstoque      = document.getElementById('input-busca-estoque');
const resultsContainer       = document.getElementById('results-container');
const produtoNomeDisplay     = document.getElementById('produto-nome-display');
const produtoQtdeDisplay     = document.getElementById('produto-qtde-display');
const produtoValidadeDisplay = document.getElementById('produto-validade-display');
const qtdeRetirarInput       = document.getElementById('qtde-retirar');
const formRetirar            = document.getElementById('form-retirar');
const tabelaEstoqueBody      = document.querySelector('#tabela-estoque tbody');
const sortableHeadersEmp     = document.querySelectorAll('#tabela-estoque th.sortable');

const API_BASE               = '/api';

let estoqueCache = [];
let selectedProductId = null;
let ordenacaoStateEmp = null;

async function carregarEstoque() {
  try {
    const res = await fetch(`${API_BASE}/products`);
    if (!res.ok) {
      console.error('Erro ao buscar produtos:', res.statusText);
      return;
    }
    const produtos = await res.json();
    estoqueCache = produtos.slice();

    tabelaEstoqueBody.innerHTML = '';
    produtos.forEach((prod) => {
      const dataVal = new Date(prod.validade).toLocaleDateString('pt-BR');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${prod.id}</td>
        <td>${prod.nome}</td>
        <td>${prod.quantidade}</td>
        <td>${dataVal}</td>
      `;
      tabelaEstoqueBody.appendChild(tr);
    });

    if (ordenacaoStateEmp) {
      const { col, asc } = ordenacaoStateEmp;
      const isNum = [0, 2].includes(col);
      sortTable(tabelaEstoqueBody, col, isNum, asc);
    }
  } catch (err) {
    console.error('Erro de rede ao carregar estoque:', err);
  }
}

inputBuscaEstoque.addEventListener('input', () => {
  const termo = inputBuscaEstoque.value.trim().toLowerCase();
  if (!termo) {
    resultsContainer.style.display = 'none';
    resultsContainer.innerHTML = '';
    return;
  }
  const filtrados = estoqueCache.filter((p) =>
    p.nome.toLowerCase().includes(termo)
  );
  if (filtrados.length === 0) {
    resultsContainer.innerHTML = '<div class="result-item">Nenhum produto encontrado</div>';
  } else {
    resultsContainer.innerHTML = filtrados
      .map(
        (p) =>
          `<div class="result-item" data-id="${p.id}">${p.nome} (Disponível: ${p.quantidade})</div>`
      )
      .join('');
  }
  resultsContainer.style.display = 'block';

  document.querySelectorAll('.result-item').forEach((div) => {
    div.addEventListener('click', () => {
      const pid = div.dataset.id;
      selecionarProduto(pid);
    });
  });
});

function selecionarProduto(produtoId) {
  const prod = estoqueCache.find((p) => p.id === Number(produtoId));
  if (!prod) return;

  selectedProductId = prod.id;
  produtoNomeDisplay.value = prod.nome;
  produtoQtdeDisplay.value = prod.quantidade;
  produtoValidadeDisplay.value = new Date(prod.validade).toLocaleDateString('pt-BR');
  resultsContainer.style.display = 'none';
}

function sortTable(tableBody, colIndex, isNum, asc) {
  const rows = Array.from(tableBody.querySelectorAll('tr'));
  rows.sort((a, b) => {
    let va = a.children[colIndex].textContent.trim();
    let vb = b.children[colIndex].textContent.trim();
    if (isNum) {
      return (parseFloat(va) - parseFloat(vb)) * (asc ? 1 : -1);
    } else {
      return va.localeCompare(vb) * (asc ? 1 : -1);
    }
  });
  rows.forEach((tr) => tableBody.appendChild(tr));
}

sortableHeadersEmp.forEach((th) => {
  const colIndex = parseInt(th.dataset.col, 10);
  th.querySelector('.btn-sort').addEventListener('click', () => {
    if (!ordenacaoStateEmp || ordenacaoStateEmp.col !== colIndex) {
      ordenacaoStateEmp = { col: colIndex, asc: true };
    } else {
      ordenacaoStateEmp.asc = !ordenacaoStateEmp.asc;
    }
    sortTable(tabelaEstoqueBody, colIndex, [0,2].includes(colIndex), ordenacaoStateEmp.asc);
  });
});

formRetirar.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedProductId) {
    alert('Selecione um produto antes de retirar.');
    return;
  }
  const quantidadeDesejada = parseInt(qtdeRetirarInput.value, 10);
  if (isNaN(quantidadeDesejada) || quantidadeDesejada <= 0) {
    alert('Informe uma quantidade válida (maior que zero).');
    return;
  }
  const destination = document.getElementById('destino-retirada').value;
  if (!destination) {
    alert('Selecione o destino da mercadoria.');
    return;
  }

  const prodAtual = estoqueCache.find((p) => p.id === Number(selectedProductId));
  if (!prodAtual) {
    alert('Produto não encontrado no estoque.');
    return;
  }
  if (prodAtual.quantidade < quantidadeDesejada) {
    alert('Quantidade insuficiente em estoque.');
    return;
  }

  try {
    const resRetirada = await fetch(`${API_BASE}/retiradas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        produtoId: prodAtual.id,
        quantidade: quantidadeDesejada,
        destination,
      }),
    });
    if (!resRetirada.ok) {
      const body = await resRetirada.json();
      alert('Erro ao registrar retirada: ' + (body.error || resRetirada.statusText));
      return;
    }

    alert('Retirada registrada com sucesso!');
    inputBuscaEstoque.value = '';
    resultsContainer.style.display = 'none';
    produtoNomeDisplay.value = '';
    produtoQtdeDisplay.value = '';
    produtoValidadeDisplay.value = '';
    qtdeRetirarInput.value  = '';
    selectedProductId = null;

    carregarEstoque();
  } catch (err) {
    console.error('Erro de rede ao registrar retirada:', err);
    alert('Falha de rede ao registrar retirada.');
  }
});

window.addEventListener('load', () => {
  carregarEstoque();
});
