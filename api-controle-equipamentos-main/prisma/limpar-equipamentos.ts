/**
 * Remove todos os equipamentos (tabela legada).
 * Antes, zera equipment_id nas operações para não quebrar a FK.
 * Rode: npx tsx prisma/limpar-equipamentos.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Zerando equipment_id nas check_operations...');
  const updated = await prisma.check_operations.updateMany({
    where: { equipment_id: { not: null } },
    data: { equipment_id: null },
  });
  console.log(`  ${updated.count} operação(ões) atualizada(s).`);

  console.log('Excluindo todos os equipamentos...');
  const deleted = await prisma.equipments.deleteMany({});
  console.log(`  ${deleted.count} equipamento(s) excluído(s).`);

  console.log('Pronto. A tabela equipments está vazia. Os tipos e instâncias (equipment_types + equipment_instances) continuam intactos.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
