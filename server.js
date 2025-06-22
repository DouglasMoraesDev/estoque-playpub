require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcryptjs');
const { PrismaClient, Destination } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;

// =========================
// LIMIARES DE ALERTAS
// =========================
const ALERT_THRESHOLD_DAYS = parseInt(process.env.ALERT_THRESHOLD_DAYS || '7', 10);
const LOW_STOCK_THRESHOLD   = parseInt(process.env.LOW_STOCK_THRESHOLD   || '5', 10);

// ---------------------------
// MIDDLEWARES
// ---------------------------
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'muitosecreto',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 },
  })
);

app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------
// AUTENTICAÇÃO
// ---------------------------
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

// ---------------------------
// ROTAS de Autenticação
// ---------------------------
app.get('/', (req, res) => {
  return res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.redirect('/?error=Dados incompletos');
  }

  const user = await prisma.usuario.findUnique({ where: { username } });
  if (!user) return res.redirect('/?error=Usuário não encontrado');

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.redirect('/?error=Senha incorreta');

  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.role = user.role;

  if (user.role === 'ADMIN') return res.redirect('/admin');
  else return res.redirect('/employee');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// ---------------------------
// PÁGINAS
// ---------------------------
app.get('/admin', checkAuthenticated, checkAdmin, (req, res) => {
  return res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/employee', checkAuthenticated, checkEmployee, (req, res) => {
  return res.sendFile(path.join(__dirname, 'public', 'employee.html'));
});

app.get('/config', checkAuthenticated, checkAdmin, (req, res) => {
  return res.sendFile(path.join(__dirname, 'public', 'config.html'));
});

// ---------------------------
// API: Change Password
// ---------------------------
app.post('/api/change-password', checkAuthenticated, checkAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.session.userId;
    if (!currentPassword || !newPassword || !confirmPassword)
      return res.status(400).json({ error: 'Preencha todos os campos.' });
    if (newPassword !== confirmPassword)
      return res.status(400).json({ error: 'Nova senha e confirmação não conferem.' });
    if (newPassword.length < 6)
      return res.status(400).json({ error: 'A nova senha deve ter ao menos 6 caracteres.' });

    const usuario = await prisma.usuario.findUnique({ where: { id: userId } });
    if (!usuario) return res.status(404).json({ error: 'Usuário não encontrado.' });

    const valid = await bcrypt.compare(currentPassword, usuario.password);
    if (!valid) return res.status(400).json({ error: 'Senha atual incorreta.' });

    const hashedNew = await bcrypt.hash(newPassword, 10);
    await prisma.usuario.update({ where: { id: userId }, data: { password: hashedNew } });

    return res.json({ message: 'Senha alterada com sucesso.' });
  } catch (err) {
    console.error('Erro ao trocar senha:', err);
    return res.status(500).json({ error: 'Erro interno ao trocar senha.' });
  }
});

// ---------------------------
// API: Produtos
// ---------------------------
app.get('/api/products', checkAuthenticated, async (req, res) => {
  try {
    const produtos = await prisma.produto.findMany();
    return res.json(produtos);
  } catch (err) {
    console.error('ERRO ao listar produtos:', err);
    return res.status(500).json({ error: 'Erro interno ao listar produtos.' });
  }
});

app.get('/api/products/:id', checkAuthenticated, async (req, res) => {
  try {
    const prod = await prisma.produto.findUnique({ where: { id: Number(req.params.id) } });
    if (!prod) return res.status(404).json({ error: 'Produto não encontrado.' });
    return res.json(prod);
  } catch (err) {
    console.error(`ERRO ao buscar produto ${req.params.id}:`, err);
    return res.status(500).json({ error: 'Erro interno ao buscar produto.' });
  }
});

app.post('/api/products', checkAuthenticated, checkAdmin, async (req, res) => {
  try {
    const { nome, quantidade, validade } = req.body;
    const novo = await prisma.produto.create({
      data: { nome, quantidade: Number(quantidade), validade: new Date(validade) },
    });
    return res.json(novo);
  } catch (err) {
    console.error('ERRO ao criar produto:', err);
    return res.status(500).json({ error: 'Erro interno ao criar produto.' });
  }
});

app.put('/api/products/:id', checkAuthenticated, checkAdmin, async (req, res) => {
  try {
    const { nome, quantidade, validade } = req.body;
    const atualizado = await prisma.produto.update({
      where: { id: Number(req.params.id) },
      data: { nome, quantidade: Number(quantidade), validade: new Date(validade) },
    });
    return res.json(atualizado);
  } catch (err) {
    console.error('ERRO ao atualizar produto:', err);
    return res.status(500).json({ error: 'Erro interno ao atualizar produto.' });
  }
});

app.delete('/api/products/:id', checkAuthenticated, checkAdmin, async (req, res) => {
  try {
    await prisma.produto.delete({ where: { id: Number(req.params.id) } });
    return res.json({ message: 'Deletado com sucesso.' });
  } catch (err) {
    console.error('ERRO ao deletar produto:', err);
    return res.status(500).json({ error: 'Erro interno ao deletar produto.' });
  }
});

// ---------------------------
// API: Retiradas
// ---------------------------
// Listar (ADMIN)
app.get('/api/retiradas', checkAuthenticated, checkAdmin, async (req, res) => {
  try {
    const { start, end } = req.query;
    const whereClause = {};
    if (start || end) {
      if (start) whereClause.data = { gte: new Date(start) };
      if (end) {
        const dtEnd = new Date(end);
        dtEnd.setHours(23,59,59,999);
        whereClause.data = whereClause.data
          ? { ...whereClause.data, lte: dtEnd }
          : { lte: dtEnd };
      }
    }
    const dados = await prisma.retirada.findMany({
      where: whereClause,
      orderBy: { data: 'desc' },
      include: { produto: true, usuario: true },
    });
    const formatado = dados.map(r => ({
      id: r.id,
      produtoId: r.produtoId,
      produtoNome: r.produto.nome,
      usuarioId: r.usuarioId,
      usuarioNome: r.usuario.username,
      quantidade: r.quantidade,
      destination: r.destination,
      data: r.data,
    }));
    return res.json(formatado);
  } catch (err) {
    console.error('ERRO ao listar retiradas:', err);
    return res.status(500).json({ error: 'Erro interno ao listar retiradas.' });
  }
});

// Registrar (EMPLOYEE & ADMIN)
app.post(
  '/api/retiradas',
  checkAuthenticated,
  (req, res, next) => {
    if (['EMPLOYEE','ADMIN'].includes(req.session.role)) return next();
    return res.status(403).json({ error: 'Acesso negado.' });
  },
  async (req, res) => {
    try {
      const { produtoId, quantidade, destination } = req.body;
      const usuarioId = req.session.userId;

      const prod = await prisma.produto.findUnique({ where: { id: Number(produtoId) } });
      if (!prod) return res.status(404).json({ error: 'Produto não encontrado.' });
      if (prod.quantidade < Number(quantidade))
        return res.status(400).json({ error: 'Estoque insuficiente.' });

      const novaQtde = prod.quantidade - Number(quantidade);
      await prisma.produto.update({
        where: { id: Number(produtoId) },
        data: { quantidade: novaQtde },
      });

      const retirada = await prisma.retirada.create({
        data: {
          produto:    { connect: { id: Number(produtoId) } },
          usuario:    { connect: { id: usuarioId } },
          quantidade: Number(quantidade),
          destination,
        },
      });

      return res.json({
        message: 'Retirada registrada.',
        retiradaId: retirada.id,
        novaQuantidade: novaQtde,
        destination,
      });
    } catch (err) {
      console.error('Erro ao registrar retirada:', err);
      return res.status(500).json({ error: 'Erro interno ao registrar retirada.' });
    }
  }
);

// ---------------------------
// API: Alerts
// ---------------------------
app.get('/api/alerts', checkAuthenticated, checkAdmin, async (req, res) => {
  try {
    const hoje = new Date();
    const limite = new Date(hoje);
    limite.setDate(hoje.getDate() + ALERT_THRESHOLD_DAYS);

    const quaseExpiring = await prisma.produto.findMany({
      where: { validade: { lte: limite } },
      orderBy: { validade: 'asc' },
    });
    const lowStock = await prisma.produto.findMany({
      where: { quantidade: { lte: LOW_STOCK_THRESHOLD } },
      orderBy: { quantidade: 'asc' },
    });
    return res.json({ almostExpiring: quaseExpiring, lowStock });
  } catch (err) {
    console.error('Erro ao buscar alertas:', err);
    return res.status(500).json({ error: 'Erro interno ao buscar alertas.' });
  }
});

// 404
app.use((req, res) => res.status(404).send('Rota não encontrada'));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando em http://0.0.0.0:${PORT}`);
});
