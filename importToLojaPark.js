// importToLojaPark.js

const { PrismaClient } = require('@prisma/client');
const fs   = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const BACKUP_FILE = path.resolve(__dirname, 'backup_produtos_2025-06-22T22-52-10-154Z.json');

async function main() {
  // 1) Lê o arquivo de backup
  const raw = fs.readFileSync(BACKUP_FILE, 'utf-8');
  const produtos = JSON.parse(raw);

  // 2) Busca o estoque LojaPark
  const lojaPark = await prisma.stock.findUnique({ where: { name: 'LojaPark' } });
  if (!lojaPark) {
    console.error('❌ Estoque "LojaPark" não encontrado. Rode o seed primeiro.');
    process.exit(1);
  }
  console.log(`→ Usando stockId=${lojaPark.id} (LojaPark)`);

  for (const p of produtos) {
    const { id: produtoId, nome, validade, quantidade } = p;
    try {
      // 3a) Upsert em Produto
      const prod = await prisma.produto.upsert({
        where: { id: produtoId },
        update: {
          nome,
          validade: new Date(validade)
        },
        create: {
          id: produtoId,
          nome,
          validade: new Date(validade)
        }
      });

      // 3b) Upsert em ProductStock
      const up = await prisma.productStock.upsert({
        where: {
          produtoId_stockId: {
            produtoId: prod.id,
            stockId: lojaPark.id
          }
        },
        create: {
          produtoId: prod.id,
          stockId: lojaPark.id,
          quantidade: quantidade
        },
        update: {
          quantidade: { increment: quantidade }
        }
      });

      console.log(`✔ [Produto ${prod.id}] "${prod.nome}": estoque LojaPark = ${up.quantidade}`);
    } catch (e) {
      console.error(`✖ Erro no produto ${produtoId}:`, e.message);
    }
  }

  console.log('✅ Importação concluída!');
}

main()
  .catch(e => {
    console.error('Erro inesperado:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
