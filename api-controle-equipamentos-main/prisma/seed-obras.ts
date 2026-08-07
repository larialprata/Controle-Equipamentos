/**
 * Popula a tabela obras: ATA → 242,243,244,245,246,247; Limpa Rio → 232; ECO Barreira → 229.
 * Só cria se ainda não existir (por contrato + code). Rode: npx tsx prisma/seed-obras.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CONTRATOS_OBRAS: { nameMatch: string; codes: string[] }[] = [
  { nameMatch: 'ATA', codes: ['242', '243', '244', '245', '246', '247'] },
  { nameMatch: 'Limpa', codes: ['232'] },
  { nameMatch: 'ECO', codes: ['229'] },
];

async function main() {
  const contracts = await prisma.contracts.findMany({ where: { active: true } });
  let created = 0;

  for (const { nameMatch, codes } of CONTRATOS_OBRAS) {
    const contract = contracts.find((c) => c.name.includes(nameMatch));
    if (!contract) {
      console.log(`⚠️ Contrato com "${nameMatch}" não encontrado.`);
      continue;
    }
    for (const code of codes) {
      const exists = await prisma.obras.findFirst({
        where: { contract_id: contract.id, code },
      });
      if (!exists) {
        await prisma.obras.create({
          data: { code, contract_id: contract.id },
        });
        console.log(`✅ Obra ${code} → ${contract.name}`);
        created++;
      }
    }
  }

  console.log(`\n🎉 Pronto. ${created} obra(s) criada(s).`);
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
