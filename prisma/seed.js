const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // Cria ou garante existência dos estoques
  for (const name of ['BarPlaypub', 'LojaPark']) {
    await prisma.stock.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // Hash de senhas de exemplo
  const hashAdmin = await bcrypt.hash('525210', 10);
  const hashFunc  = await bcrypt.hash('525210', 10);

  // Cria Admin vinculado a LojaPark
  await prisma.usuario.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashAdmin,
      role: 'ADMIN',
      stock: { connect: { name: 'LojaPark' } },
    },
  });

  // Cria Funcionário vinculado a BarPlaypub
  await prisma.usuario.upsert({
    where: { username: 'Douglas' },
    update: {},
    create: {
      username: 'funcionario',
      password: hashFunc,
      role: 'EMPLOYEE',
      stock: { connect: { name: 'BarPlaypub' } },
    },
  });

  console.log('→ Seed concluído!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
