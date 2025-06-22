// public/js/admin.js

// --------------------------------------------------
// CONSTANTES DE LIMIAR (copie do .env, mas aqui em front)
// --------------------------------------------------
const ALERT_THRESHOLD_DAYS = 7;  // dias antes da validade para alertar
const LOW_STOCK_THRESHOLD   = 5;  // quantidade mínima para alertar

// Elementos do DOM – produtos
const formAddProduto         = document.getElementById('form-add-produto');
const produtoIdInput         = document.getElementById('produto-id');
const nomeInput              = document.getElementById('nome-produto');
const qtdeInput              = document.getElementById('qtde-produto');
const validadeInput          = document.getElementById('validade-produto');
const btnCancelar            = document.getElementById('btn-cancelar-edicao');

const tabelaProdutosBody     = document.querySelector('#tabela-produtos tbody');
const tabelaRelEstoqueBody   = document.querySelector('#tabela-relatorio-estoque tbody');

// Elementos de busca e ordenação
const inputBuscaProduto      = document.getElementById('input-busca-produto');
const sortableHeaders        = document.querySelectorAll('th.sortable');

// Elementos de Alertas
const alertBox               = document.getElementById('alert-box');

// Elementos do DOM – retiradas
const tabelaRetiradasBody    = document.querySelector('#tabela-retiradas tbody');
const dataInicioInput        = document.getElementById('data-inicio');
const dataFimInput           = document.getElementById('data-fim');
const btnFiltrarRetiradas    = document.getElementById('btn-filtrar-retiradas');
const tabelaRelRetiradasBody = document.querySelector('#tabela-relatorio-retiradas tbody');

// Containers de cards (mobile)
const containerCardsProdutos = document.getElementById('cards-produtos');
const containerCardsRetiradas= document.getElementById('cards-retiradas');

const API_BASE        = '/api';
let modoEdicao        = false;
let produtosCache     = [];
let ordenacaoState    = {};

/* ---------------------------
   FUNÇÃO: Gera cards de produtos (para mobile)
*/
function gerarCardsProdutos(produtos) {
  containerCardsProdutos.innerHTML = '';
  produtos.forEach((prod) => {
    const dataValidade = new Date(prod.validade).toLocaleDateString('pt-BR');
    const card = document.createElement('div');
    card.classList.add('card');

    const header = document.createElement('div');
    header.classList.add('card-header');
    header.textContent = `${prod.nome} (ID: ${prod.id})`;
    card.appendChild(header);

    const rowQtd = document.createElement('div');
    rowQtd.classList.add('card-row');
    rowQtd.innerHTML = `<span class="label">Quantidade:</span> <span class="value">${prod.quantidade}</span>`;
    card.appendChild(rowQtd);

    const rowVal = document.createElement('div');
    rowVal.classList.add('card-row');
    rowVal.innerHTML = `<span class="label">Validade:</span> <span class="value">${dataValidade}</span>`;
    card.appendChild(rowVal);

    const actions = document.createElement('div');
    actions.classList.add('card-actions');
    const btnEdit = document.createElement('button');
    btnEdit.textContent = 'Editar';
    btnEdit.classList.add('btn-edit');
    btnEdit.dataset.id = prod.id;
    btnEdit.addEventListener('click', iniciarEdicaoProduto);
    actions.appendChild(btnEdit);
    const btnDel = document.createElement('button');
    btnDel.textContent = 'Apagar';
    btnDel.classList.add('btn-delete');
    btnDel.dataset.id = prod.id;
    btnDel.addEventListener('click', apagarProduto);
    actions.appendChild(btnDel);
    card.appendChild(actions);

    containerCardsProdutos.appendChild(card);
  });
}

/* ---------------------------
   FUNÇÃO: Gera cards de retiradas (para mobile)
*/
function gerarCardsRetiradas(retiradas) {
  containerCardsRetiradas.innerHTML = '';
  retiradas.forEach((r) => {
    const dataFormat = new Date(r.data).toLocaleString('pt-BR');
    const card = document.createElement('div');
    card.classList.add('card');

    const header = document.createElement('div');
    header.classList.add('card-header');
    header.textContent = `#${r.id} – ${r.produtoNome}`;
    card.appendChild(header);

    const rowQtd = document.createElement('div');
    rowQtd.classList.add('card-row');
    rowQtd.innerHTML = `<span class="label">Qtde:</span> <span class="value">${r.quantidade}</span>`;
    card.appendChild(rowQtd);

    const rowUser = document.createElement('div');
    rowUser.classList.add('card-row');
    rowUser.innerHTML = `<span class="label">Funcionário:</span> <span class="value">${r.usuarioNome}</span>`;
    card.appendChild(rowUser);

    const rowData = document.createElement('div');
    rowData.classList.add('card-row');
    rowData.innerHTML = `<span class="label">Data:</span> <span class="value">${dataFormat}</span>`;
    card.appendChild(rowData);

    containerCardsRetiradas.appendChild(card);
  });
}

/* ---------------------------
   CARREGA PRODUTOS e monta tabela + cards (se mobile)
*/
async function carregarProdutos() {
  try {
    const res = await fetch(`${API_BASE}/products`);
    const produtos = await res.json();
    produtosCache = produtos.slice();

    // Filtra por busca
    const termo = inputBuscaProduto.value.trim().toLowerCase();
    const filtrados = termo
      ? produtosCache.filter((p) => p.nome.toLowerCase().includes(termo))
      : produtosCache.slice();

    // Preenche tabela de produtos
    tabelaProdutosBody.innerHTML = '';
    tabelaRelEstoqueBody.innerHTML = '';

    filtrados.forEach((prod) => {
      const dataValidade = new Date(prod.validade).toLocaleDateString('pt-BR');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${prod.id}</td>
        <td>${prod.nome}</td>
        <td>${prod.quantidade}</td>
        <td>${dataValidade}</td>
        <td>
          <button class="btn-editar" data-id="${prod.id}">Editar</button>
          <button class="btn-apagar" data-id="${prod.id}">Apagar</button>
        </td>
      `;
      tabelaProdutosBody.appendChild(tr);

      if (prod.quantidade > 0) {
        const tr2 = document.createElement('tr');
        tr2.innerHTML = `
          <td>${prod.id}</td>
          <td>${prod.nome}</td>
          <td>${prod.quantidade}</td>
          <td>${dataValidade}</td>
        `;
        tabelaRelEstoqueBody.appendChild(tr2);
      }
    });

    document.querySelectorAll('.btn-editar').forEach((btn) => {
      btn.addEventListener('click', iniciarEdicaoProduto);
    });
    document.querySelectorAll('.btn-apagar').forEach((btn) => {
      btn.addEventListener('click', apagarProduto);
    });

    if (window.innerWidth <= 768) {
      gerarCardsProdutos(filtrados);
    }

    aplicarOrdenacao(); // reaplica ordenação se estiver definida
  } catch (err) {
    console.error('Erro ao carregar produtos:', err);
  }
}

/* ---------------------------
   FILTRA PRODUTOS POR NOME
*/
inputBuscaProduto.addEventListener('input', () => {
  carregarProdutos();
});

/* ---------------------------
   Ordena qualquer tabela dada pelo índice da coluna
*/
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

function aplicarOrdenacao() {
  // Produtos (tabela principal)
  if (ordenacaoState['produtos']) {
    const { col, asc } = ordenacaoState['produtos'];
    const isNum = [0, 2].includes(col);
    sortTable(tabelaProdutosBody, col, isNum, asc);
  }
  // Relatório de Estoque
  if (ordenacaoState['relEstoque']) {
    const { col, asc } = ordenacaoState['relEstoque'];
    const isNum = [0, 2].includes(col);
    sortTable(tabelaRelEstoqueBody, col, isNum, asc);
  }
  // Retiradas (tabela principal)
  if (ordenacaoState['retiradas']) {
    const { col, asc } = ordenacaoState['retiradas'];
    const isNum = [0, 2].includes(col);
    sortTable(tabelaRetiradasBody, col, isNum, asc);
  }
  // Relatório de Retiradas
  if (ordenacaoState['relRetiradas']) {
    const { col, asc } = ordenacaoState['relRetiradas'];
    const isNum = [0, 2].includes(col);
    sortTable(tabelaRelRetiradasBody, col, isNum, asc);
  }
}

/* ---------------------------
   Configura clique nos cabeçalhos “sortable”
*/
sortableHeaders.forEach((th) => {
  const colIndex = parseInt(th.dataset.col, 10);
  th.querySelector('.btn-sort').addEventListener('click', () => {
    let keyState;
    if (th.closest('#seccao-lista-produtos'))           keyState = 'produtos';
    else if (th.closest('#seccao-lista-retiradas'))     keyState = 'retiradas';
    else if (th.closest('#tabela-relatorio-estoque'))   keyState = 'relEstoque';
    else if (th.closest('#tabela-relatorio-retiradas')) keyState = 'relRetiradas';

    if (!ordenacaoState[keyState] || ordenacaoState[keyState].col !== colIndex) {
      ordenacaoState[keyState] = { col: colIndex, asc: true };
    } else {
      ordenacaoState[keyState].asc = !ordenacaoState[keyState].asc;
    }
    aplicarOrdenacao();
  });
});

/* ---------------------------
   Exibir Alertas no painel (chama GET /api/alerts)
*/
async function carregarAlertasPainel() {
  try {
    const res = await fetch(`${API_BASE}/alerts`);
    const { almostExpiring, lowStock } = await res.json();
    let html = '';
    if (almostExpiring.length === 0 && lowStock.length === 0) {
      html = '<p>Nenhum alerta no momento.</p>';
    } else {
      if (almostExpiring.length > 0) {
        html += '<div class="alert-section">';
        html += `<h3>Produtos quase vencendo (${ALERT_THRESHOLD_DAYS} dias):</h3><ul>`;
        almostExpiring.forEach((p) => {
          html += `<li>ID ${p.id} – ${p.nome} (Validade: ${new Date(p.validade).toLocaleDateString(
            'pt-BR'
          )}, Qtde: ${p.quantidade})</li>`;
        });
        html += '</ul></div>';
      }
      if (lowStock.length > 0) {
        html += '<div class="alert-section">';
        html += `<h3>Produtos com estoque abaixo (${LOW_STOCK_THRESHOLD} unidades):</h3><ul>`;
        lowStock.forEach((p) => {
          html += `<li>ID ${p.id} – ${p.nome} (Qtde: ${p.quantidade}, Validade: ${new Date(
            p.validade
          ).toLocaleDateString('pt-BR')})</li>`;
        });
        html += '</ul></div>';
      }
    }
    alertBox.innerHTML = html;
    alertBox.style.display = 'block';
  } catch (err) {
    console.error('Erro ao carregar alertas no painel:', err);
    alertBox.innerHTML = '<p>Não foi possível obter alertas.</p>';
    alertBox.style.display = 'block';
  }
}

/* ---------------------------
   CARREGA RETIRADAS (com filtro) e monta tabela + cards
*/
async function carregarRetiradas(startDate, endDate) {
  try {
    let url = `${API_BASE}/retiradas`;
    if (startDate && endDate) url += `?start=${startDate}&end=${endDate}`;
    else {
      const hoje = new Date();
      const ano   = hoje.getFullYear();
      const mes   = String(hoje.getMonth() + 1).padStart(2, '0');
      const dia   = String(hoje.getDate()).padStart(2, '0');
      url += `?start=${ano}-${mes}-${dia}&end=${ano}-${mes}-${dia}`;
    }

    const res = await fetch(url);
    const retiradas = await res.json();

    tabelaRetiradasBody.innerHTML = '';
    tabelaRelRetiradasBody.innerHTML = '';

    retiradas.forEach((r) => {
      const dataFormat = new Date(r.data).toLocaleString('pt-BR');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.id}</td>
        <td>${r.produtoNome}</td>
        <td>${r.quantidade}</td>
        <td>${r.usuarioNome}</td>
        <td>${dataFormat}</td>
      `;
      tabelaRetiradasBody.appendChild(tr);

      const tr2 = document.createElement('tr');
      tr2.innerHTML = `
        <td>${r.id}</td>
        <td>${r.produtoNome}</td>
        <td>${r.quantidade}</td>
        <td>${r.usuarioNome}</td>
        <td>${dataFormat}</td>
      `;
      tabelaRelRetiradasBody.appendChild(tr2);
    });

    if (window.innerWidth <= 768) {
      gerarCardsRetiradas(retiradas);
    }

    aplicarOrdenacao();
  } catch (err) {
    console.error('Erro ao carregar retiradas:', err);
  }
}

/* ---------------------------
   Iniciar edição de produto (preenche form)
*/
async function iniciarEdicaoProduto(e) {
  const id = e.target.dataset.id;
  const res = await fetch(`${API_BASE}/products/${id}`);
  const prod = await res.json();
  produtoIdInput.value = prod.id;
  nomeInput.value      = prod.nome;
  qtdeInput.value      = prod.quantidade;
  const dt = new Date(prod.validade);
  const ano = dt.getFullYear();
  const mes = String(dt.getMonth() + 1).padStart(2, '0');
  const dia = String(dt.getDate()).padStart(2, '0');
  validadeInput.value = `${ano}-${mes}-${dia}`;
  modoEdicao = true;
  btnCancelar.style.display = 'inline-block';
}

/* ---------------------------
   Cancelar edição
*/
btnCancelar.addEventListener('click', () => {
  modoEdicao = false;
  produtoIdInput.value = '';
  formAddProduto.reset();
  btnCancelar.style.display = 'none';
});

/* ---------------------------
   Submeter formulário de produto (Criar ou Atualizar)
*/
formAddProduto.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nome      = nomeInput.value.trim();
  const quantidade= parseInt(qtdeInput.value, 10);
  const validade  = validadeInput.value;
  if (!nome) {
    alert('Informe o nome do produto.');
    return;
  }
  if (isNaN(quantidade) || quantidade < 0) {
    alert('Informe uma quantidade válida (número ≥ 0).');
    return;
  }
  if (!validade) {
    alert('Informe a data de validade.');
    return;
  }
  const dt = new Date(validade);
  if (isNaN(dt.getTime())) {
    alert('Validade inválida.');
    return;
  }
  if (!modoEdicao) {
    try {
      const res = await fetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, quantidade, validade }),
      });
      if (!res.ok) {
        const body = await res.json();
        alert('Erro ao criar produto: ' + (body.error || res.statusText));
        return;
      }
    } catch (fetchErr) {
      console.error('Erro de rede ao criar produto:', fetchErr);
      alert('Falha de rede ao criar produto.');
      return;
    }
  } else {
    const id = produtoIdInput.value;
    try {
      const res = await fetch(`${API_BASE}/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, quantidade, validade }),
      });
      if (!res.ok) {
        const body = await res.json();
        alert('Erro ao atualizar produto: ' + (body.error || res.statusText));
        return;
      }
    } catch (fetchErr) {
      console.error('Erro de rede ao atualizar produto:', fetchErr);
      alert('Falha de rede ao atualizar produto.');
      return;
    }
    modoEdicao = false;
    btnCancelar.style.display = 'none';
    produtoIdInput.value = '';
  }
  formAddProduto.reset();
  await carregarProdutos();
  carregarGrafico();
  carregarRetiradas(); // atualiza histórico de hoje
});

/* ---------------------------
   Apagar produto
*/
async function apagarProduto(e) {
  const id = e.target.dataset.id;
  if (confirm(`Deseja realmente apagar o produto de ID ${id}?`)) {
    await fetch(`${API_BASE}/products/${id}`, { method: 'DELETE' });
    await carregarProdutos();
    carregarGrafico();
    carregarRetiradas();
  }
}

/* ---------------------------
   Carrega gráficos de produtos mais retirados
*/
async function carregarGrafico() {
  try {
    const resRet = await fetch(`${API_BASE}/retiradas`);
    const retiradas = await resRet.json();
    const contagem = {};
    retiradas.forEach((r) => {
      if (!contagem[r.produtoNome]) contagem[r.produtoNome] = 0;
      contagem[r.produtoNome] += r.quantidade;
    });
    const labels     = Object.keys(contagem);
    const dataValues = labels.map((lab) => contagem[lab]);
    const ctx = document.getElementById('chart-mais-retirados').getContext('2d');
    if (window.meuGrafico) window.meuGrafico.destroy();
    window.meuGrafico = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Quantidade Retirada',
            data: dataValues,
            backgroundColor: 'rgba(52, 152, 219, 0.6)',
            borderColor: 'rgba(41, 128, 185, 0.8)',
            borderWidth: 1,
          },
        ],
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1 },
          },
        },
        plugins: { legend: { display: false } },
      },
    });
  } catch (err) {
    console.error('Erro ao carregar gráfico:', err);
  }
}

/* ---------------------------
   Filtrar retiradas ao clicar no botão
*/
btnFiltrarRetiradas.addEventListener('click', () => {
  const start = dataInicioInput.value;
  const end   = dataFimInput.value;
  if (!start || !end) {
    alert('Informe ambas as datas para filtrar.');
    return;
  }
  if (end < start) {
    alert('A data fim não pode ser anterior à data início.');
    return;
  }
  carregarRetiradas(start, end);
});

/* ---------------------------
   Inicialização ao carregar a página
*/
window.addEventListener('load', () => {
  const hoje = new Date();
  const ano  = hoje.getFullYear();
  const mes  = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia  = String(hoje.getDate()).padStart(2, '0');
  const dataHoje = `${ano}-${mes}-${dia}`;

  dataInicioInput.value = dataHoje;
  dataFimInput.value    = dataHoje;

  carregarProdutos();
  carregarGrafico();
  carregarRetiradas(dataHoje, dataHoje);
  carregarAlertasPainel();
});

/* ---------------------------
   Redimensionamento para mobile (recria cards)
*/
window.addEventListener('resize', () => {
  if (window.innerWidth <= 768) {
    carregarProdutos();
    const start = dataInicioInput.value;
    const end   = dataFimInput.value;
    carregarRetiradas(start, end);
  }
});
