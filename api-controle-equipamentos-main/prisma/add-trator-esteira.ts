/**
 * Script one-off: adiciona o equipamento "Trator Esteira" em todos os contratos que ainda não têm.
 * Rode com: npx tsx prisma/add-trator-esteira.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EQUIPMENT_NAME = 'Trator Esteira';

async function main() {
  const contracts = await prisma.contracts.findMany({ where: { active: true } });
  let added = 0;

  for (const contract of contracts) {
    const exists = await prisma.equipments.findFirst({
      where: {
        contract_id: contract.id,
        name: EQUIPMENT_NAME,
      },
    });
    if (!exists) {
      await prisma.equipments.create({
        data: {
          name: EQUIPMENT_NAME,
          contract_id: contract.id,
        },
      });
      console.log(`✅ Adicionado "${EQUIPMENT_NAME}" ao contrato ${contract.name}`);
      added++;
    } else {
      console.log(`ℹ️  "${EQUIPMENT_NAME}" já existe no contrato ${contract.name}`);
    }
  }

  console.log(`\n🎉 Pronto. Equipamento "${EQUIPMENT_NAME}" adicionado em ${added} contrato(s).`);
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
