import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type CanonicalConfig = {
  number: string;
  canonicalName: string;
  aliases: string[];
};

const CANONICAL_CONTRACTS: CanonicalConfig[] = [
  { number: '229', canonicalName: '229 - ECO Barreira', aliases: ['ECO Barreira', '229 - ECO BARREIRA'] },
  { number: '232', canonicalName: '232 - LimpaRio', aliases: ['LimpaRio', '232 - LIMPA RIO'] },
  { number: '242', canonicalName: '242 - ATA', aliases: ['ATA'] },
];

function normalizeForMatch(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toUpperCase();
}

async function main() {
  console.log('🧹 Iniciando deduplicação de contratos...');

  const allContracts = await prisma.contracts.findMany({
    orderBy: { created_at: 'asc' },
  });

  for (const config of CANONICAL_CONTRACTS) {
    const acceptedNames = [config.canonicalName, ...config.aliases];
    const acceptedNormalized = acceptedNames.map(normalizeForMatch);

    const matches = allContracts.filter((contract) => {
      const normalized = normalizeForMatch(contract.name);
      const startsWithNumber = normalized.startsWith(`${config.number} -`);
      return startsWithNumber || acceptedNormalized.includes(normalized);
    });

    if (matches.length <= 1) {
      if (matches.length === 1 && matches[0].name !== config.canonicalName) {
        await prisma.contracts.update({
          where: { id: matches[0].id },
          data: { name: config.canonicalName },
        });
        console.log(`♻️ Renomeado: ${matches[0].name} → ${config.canonicalName}`);
      }
      continue;
    }

    const canonicalExisting = matches.find(
      (c) => normalizeForMatch(c.name) === normalizeForMatch(config.canonicalName),
    );
    const keeper = canonicalExisting ?? matches[0];

    if (keeper.name !== config.canonicalName) {
      await prisma.contracts.update({
        where: { id: keeper.id },
        data: { name: config.canonicalName },
      });
      console.log(`♻️ Renomeado: ${keeper.name} → ${config.canonicalName}`);
    }

    const duplicates = matches.filter((c) => c.id !== keeper.id);

    for (const duplicate of duplicates) {
      await prisma.users.updateMany({
        where: { contract_id: duplicate.id },
        data: { contract_id: keeper.id },
      });
      await prisma.equipments.updateMany({
        where: { contract_id: duplicate.id },
        data: { contract_id: keeper.id },
      });
      await prisma.check_operations.updateMany({
        where: { contract_id: duplicate.id },
        data: { contract_id: keeper.id },
      });
      await prisma.obras.updateMany({
        where: { contract_id: duplicate.id },
        data: { contract_id: keeper.id },
      });

      await prisma.contracts.delete({
        where: { id: duplicate.id },
      });
      console.log(`🗑️ Duplicado removido: ${duplicate.name} (${duplicate.id})`);
    }
  }

  console.log('✅ Deduplicação finalizada.');
}

main()
  .catch((error) => {
    console.error('❌ Erro ao deduplicar contratos:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
