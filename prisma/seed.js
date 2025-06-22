// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // Senhas padrão (texto puro)
  const senhaAdmin = '250719'
  const senhaFunc = 'func123';

  // Hash das senhas
  const hashAdmin = await bcrypt.hash(senhaAdmin, 10);
  const hashFunc = await bcrypt.hash(senhaFunc, 10);

  // Cria usuário ADMIN
  const usuarioAdmin = await prisma.usuario.upsert({
    where: { username: 'Vitoria' },
    update: {},
    create: {
      username: 'Vitoria',
      password: hashAdmin,
      role: 'ADMIN'
    }
  });

  // Cria usuário EMPLOYEE
  const usuarioFunc = await prisma.usuario.upsert({
    where: { username: 'funcionario' },
    update: {},
    create: {
      username: 'funcionario',
      password: hashFunc,
      role: 'EMPLOYEE'
    }
  });

  console.log('→ Usuários criados ou já existentes:');
  console.log({ usuarioAdmin, usuarioFunc });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
