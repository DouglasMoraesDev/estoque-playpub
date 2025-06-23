require('dotenv').config();
const express    = require('express');
const session    = require('express-session');
const bodyParser = require('body-parser');
const path       = require('path');
const bcrypt     = require('bcryptjs');
const fs         = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app    = express();
const PORT   = process.env.PORT || 3000;

const ALERT_THRESHOLD_DAYS = parseInt(process.env.ALERT_THRESHOLD_DAYS || '7', 10);
const LOW_STOCK_THRESHOLD  = parseInt(process.env.LOW_STOCK_THRESHOLD   || '5', 10);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'muitosecreto',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 },
}));
app.use(express.static(path.join(__dirname, 'public')));

// --- Auth middleware ---
function checkAuthenticated(req, res, next) {
  if (req.session.userId) return next();
  return res.redirect('/');
}
function checkAdmin(req, res, next) {
  if (req.session.role === 'ADMIN') return next();
  return res.status(403).send('Acesso negado.');
}
function checkEmployee(req, res, next) {
  if (req.session.role === 'EMPLOYEE') return next();
  return res.status(403).send('Acesso negado.');
}

// --- View routes ---
app.get('/', (req, res) => {
  return res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.redirect('/?error=Dados incompletos');

  const user = await prisma.usuario.findUnique({ where: { username } });
  if (!user) return res.redirect('/?error=Usuário não encontrado');

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.redirect('/?error=Senha incorreta');

  // salva session
  req.session.userId  = user.id;
  req.session.role    = user.role;
  req.session.stockId = user.stockId;

  return res.redirect(user.role === 'ADMIN' ? '/admin' : '/employee');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// Serve admin.html
app.get('/admin', checkAuthenticated, checkAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Serve employee.html
app.get('/employee', checkAuthenticated, checkEmployee, async (req, res) => {
  const htmlPath = path.join(__dirname, 'public', 'employee.html');
  let html = fs.readFileSync(htmlPath, 'utf8');

  const stock = await prisma.stock.findUnique({
    where: { id: req.session.stockId }
  });
  const destination = stock?.name === 'LojaPark' ? 'LOJA_PARK' : 'BAR_PUB';

  html = html.replace(
    '<script id="empStockData" type="application/json"></script>',
    `<script id="empStockData" type="application/json">${JSON.stringify({
      stockId: req.session.stockId,
      destination,
      userId: req.session.userId
    })}</script>`
  );

  res.send(html);
});

// Serve config.html
app.get('/config', checkAuthenticated, checkAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'config.html'));
});

// --- API: Users (cadastrar) ---
app.post('/api/usuarios', checkAuthenticated, checkAdmin, async (req, res) => {
  const { username, password, role, stockId } = req.body;
  const hash = await bcrypt.hash(password, 10);

  try {
    const novo = await prisma.usuario.create({
      data: {
        username,
        password: hash,
        role,
        stock: { connect: { id: Number(stockId) } }
      }
    });
    return res.status(201).json(novo);
  } catch (e) {
    // Duplicate username
    if (e.code === 'P2002' && e.meta?.target?.includes('Usuario_username_key')) {
      return res.status(400).json({ error: 'Username já existe.' });
    }
    console.error(e);
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

// --- API: Stocks ---
app.get('/api/stocks', checkAuthenticated, checkAdmin, async (req, res) => {
  const stocks = await prisma.stock.findMany();
  res.json(stocks);
});

// --- API: Products (via ProductStock) ---
app.get('/api/products', checkAuthenticated, async (req, res) => {
  const isEmp = req.session.role === 'EMPLOYEE';
  const sid   = isEmp ? req.session.stockId : (req.query.stockId && Number(req.query.stockId));
  const where = sid ? { stockId: sid } : {};
  const list  = await prisma.productStock.findMany({
    where,
    include: { produto: true }
  });
  res.json(list.map(x => ({
    id:        x.produto.id,
    nome:      x.produto.nome,
    validade:  x.produto.validade,
    quantidade:x.quantidade,
    stockId:   x.stockId
  })));
});

app.post('/api/products', checkAuthenticated, checkAdmin, async (req, res) => {
  const { nome, validade, quantidade, stockId } = req.body;
  const prod = await prisma.produto.create({
    data: { nome, validade: new Date(validade) }
  });
  await prisma.productStock.create({
    data: { produtoId: prod.id, stockId: Number(stockId), quantidade: Number(quantidade) }
  });
  res.json(prod);
});

app.put('/api/products/:id', checkAuthenticated, checkAdmin, async (req,res) => {
  const { nome, validade, quantidade, stockId } = req.body;

  // 1) Atualiza o produto (nome, validade)
  const prod = await prisma.produto.update({
    where: { id: Number(req.params.id) },
    data: { nome, validade: new Date(validade) }
  });

  // 2) Atualiza a quantidade no ProductStock
  await prisma.productStock.update({
    where: {
      produtoId_stockId: {
        produtoId: prod.id,
        stockId: Number(stockId)
      }
    },
    data: { quantidade: Number(quantidade) }
  });

  // Retorna o produto atualizado
  res.json(prod);
});

app.delete('/api/products/:id', checkAuthenticated, checkAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await prisma.retirada.deleteMany({ where: { produtoId: id } });
  await prisma.productStock.deleteMany({ where: { produtoId: id } });
  await prisma.produto.delete({ where: { id } });
  res.json({ message: 'Deletado com sucesso.' });
});

// Ajuste de estoque extra
app.post('/api/add-product-stock', checkAuthenticated, checkAdmin, async (req, res) => {
  const { productId, stockId, quantity } = req.body;
  const up = await prisma.productStock.upsert({
    where: { produtoId_stockId: { produtoId: Number(productId), stockId: Number(stockId) } },
    create: { produtoId: Number(productId), stockId: Number(stockId), quantidade: Number(quantity) },
    update: { quantidade: { increment: Number(quantity) } }
  });
  res.json(up);
});

// --- API: Retiradas para Employees ---
app.post('/api/retiradas',
  checkAuthenticated,
  (req, res, next) => {
    if (['ADMIN','EMPLOYEE'].includes(req.session.role)) return next();
    return res.status(403).json({ error: 'Acesso negado.' });
  },
  async (req, res) => {
    const { productId, quantity, destination } = req.body;
    const sid   = req.session.stockId;       // <-- pegamos o stockId da sessão
    const qty   = Number(quantity);
    const usrId = req.session.userId;

    // somente ADMIN e EMPLOYEE chegam aqui
    // (para EMPLOYEE, sid já é o dele; para ADMIN, ele pode indicar qualquer estoque)
    const ps = await prisma.productStock.findUnique({
      where: { produtoId_stockId: { produtoId: Number(productId), stockId: sid } }
    });
    if (!ps) {
      return res.status(400).json({ error: 'Produto não encontrado neste estoque.' });
    }
    if (ps.quantidade < qty) {
      return res.status(400).json({ error: 'Saldo insuficiente.' });
    }

    // atualiza o estoque
    await prisma.productStock.update({
      where: { id: ps.id },
      data: { quantidade: ps.quantidade - qty }
    });

    // registra a retirada
    const ret = await prisma.retirada.create({
      data: {
        produto:    { connect: { id: Number(productId) } },
        usuario:    { connect: { id: usrId } },
        quantidade: qty,
        destination
      }
    });

    return res.json({ success: true, retiradaId: ret.id });
  }
);

// --- API: Minhas retiradas (Employee) ---
app.get('/api/my-retiradas', checkAuthenticated, checkEmployee, async (req, res) => {
  const { start, end } = req.query;
  const where = { usuarioId: req.session.userId };
  if (start || end) {
    where.data = {};
    if (start) where.data.gte = new Date(start);
    if (end) {
      const dt = new Date(end);
      dt.setHours(23,59,59,999);
      where.data.lte = dt;
    }
  }
  const dados = await prisma.retirada.findMany({
    where,
    orderBy: { data: 'desc' },
    include: { produto: true }
  });
  res.json(dados.map(r => ({
    id: r.id,
    produtoNome: r.produto.nome,
    quantidade: r.quantidade,
    destination: r.destination,
    data: r.data
  })));
});

// --- API: Retiradas (Admin) ---
app.get('/api/retiradas', checkAuthenticated, checkAdmin, async (req, res) => {
  const { start, end } = req.query;
  const where = {};
  if (start || end) {
    where.data = {};
    if (start) where.data.gte = new Date(start);
    if (end) {
      const dt = new Date(end);
      dt.setHours(23,59,59,999);
      where.data.lte = dt;
    }
  }
  const regs = await prisma.retirada.findMany({
    where,
    orderBy: { data: 'desc' },
    include: { produto: true, usuario: true }
  });
  res.json(regs.map(r => ({
    id: r.id,
    produtoNome: r.produto.nome,
    quantidade: r.quantidade,
    usuarioNome: r.usuario.username,
    destination: r.destination,
    data: r.data
  })));
});

// --- API: Alerts ---
app.get('/api/alerts', checkAuthenticated, checkAdmin, async (req, res) => {
  const hoje = new Date();
  const limite = new Date(hoje);
  limite.setDate(hoje.getDate() + ALERT_THRESHOLD_DAYS);

  const quaseExp = await prisma.produto.findMany({
    where: { validade: { lte: limite } },
    orderBy: { validade: 'asc' }
  });

  const lowStock = await prisma.productStock.findMany({
    where: { quantidade: { lte: LOW_STOCK_THRESHOLD } },
    include: { produto: true }
  });

  res.json({
    almostExpiring: quaseExp,
    lowStock: lowStock.map(x => ({
      id: x.produto.id,
      nome: x.produto.nome,
      quantidade: x.quantidade,
      validade: x.produto.validade
    }))
  });
});

// 404
app.use((_, res) => res.status(404).send('Rota não encontrada'));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando em http://0.0.0.0:${PORT}`);
});
