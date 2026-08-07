import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const SALT_ROUNDS = 10;

async function main() {
  console.log('🌱 Starting database seed...');

  // Create admin user
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@exemplo.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const adminCpf = process.env.ADMIN_CPF || '00000000000';
  const legacyAdminEmail = 'admin@example.com';

  const existingAdmin = await prisma.users.findFirst({
    where: {
      OR: [{ email: adminEmail }, { email: legacyAdminEmail }, { cpf: adminCpf }],
    },
  });

  const hashedPassword = await bcrypt.hash(adminPassword, SALT_ROUNDS);

  if (!existingAdmin) {
    const admin = await prisma.users.create({
      data: {
        full_name: 'Administrador',
        phone: '11999999999',
        cpf: adminCpf,
        email: adminEmail,
        address: 'Endereço administrativo',
        password: hashedPassword,
        cnh_photo: '/uploads/documents/admin-placeholder.jpg',
        is_active: true,
        is_admin: true,
      },
    });
    console.log(`✅ Created admin user: ${admin.email} (${admin.id})`);
    console.log(`   Default credentials: ${adminEmail} / ${adminPassword}`);
  } else {
    const admin = await prisma.users.update({
      where: { id: existingAdmin.id },
      data: {
        full_name: existingAdmin.full_name?.trim() || 'Administrador',
        phone: existingAdmin.phone || '11999999999',
        cpf: adminCpf,
        email: adminEmail,
        address: existingAdmin.address || 'Endereço administrativo',
        password: hashedPassword,
        cnh_photo: existingAdmin.cnh_photo || '/uploads/documents/admin-placeholder.jpg',
        is_active: true,
        is_admin: true,
      },
    });
    console.log(`♻️ Updated base admin user: ${admin.email} (${admin.id})`);
    console.log(`   Base credentials: ${adminEmail} / ${adminPassword}`);
  }

  // Create contracts using the standard format: "<number> - <name>"
  const contractsData = [
    { name: '242 - ATA', aliases: ['ATA'] },
    { name: '243 - ATA', aliases: [] },
    { name: '244 - ATA', aliases: [] },
    { name: '245 - ATA', aliases: [] },
    { name: '246 - ATA', aliases: [] },
    { name: '247 - ATA', aliases: [] },
    { name: '232 - LimpaRio', aliases: ['LimpaRio'] },
    { name: '229 - ECO Barreira', aliases: ['ECO Barreira'] },
  ];

  const createdContracts = [];
  for (const contract of contractsData) {
    const existing = await prisma.contracts.findFirst({
      where: { name: contract.name },
    });
    if (existing) {
      createdContracts.push(existing);
      console.log(`ℹ️ Contract already exists: ${existing.name}`);
    } else {
      const existingByAlias =
        contract.aliases.length > 0
          ? await prisma.contracts.findFirst({
              where: { name: { in: contract.aliases } },
            })
          : null;

      if (existingByAlias) {
        const renamed = await prisma.contracts.update({
          where: { id: existingByAlias.id },
          data: { name: contract.name },
        });
        createdContracts.push(renamed);
        console.log(`♻️ Renamed contract: ${existingByAlias.name} → ${renamed.name}`);
        continue;
      }

      const created = await prisma.contracts.create({
        data: { name: contract.name },
      });
      createdContracts.push(created);
      console.log(`✅ Created contract: ${created.name} (${created.id})`);
    }
  }

  // Create obras (ATA → 242-247, LimpaRio → 232, ECO Barreira → 229)
  const obrasConfig = [
    { nameMatch: 'ATA', codes: ['242', '243', '244', '245', '246', '247'] },
    { nameMatch: 'LimpaRio', codes: ['232'] },
    { nameMatch: 'ECO', codes: ['229'] },
  ];
  for (const { nameMatch, codes } of obrasConfig) {
    const contract = createdContracts.find((c) => c.name.includes(nameMatch));
    if (!contract) continue;
    for (const code of codes) {
      const exists = await prisma.obras.findFirst({
        where: { contract_id: contract.id, code },
      });
      if (!exists) {
        await prisma.obras.create({
          data: { code, contract_id: contract.id },
        });
        console.log(`✅ Created obra: ${code} → ${contract.name}`);
      }
    }
  }

  // Tipos de equipamento disponíveis para vínculo administrativo e uso nas movimentações.
  const EQUIPMENT_TYPE_NAMES = [
    'Caminhão Basculante Trucado',
    'Escavadeira Hidráulica Braço Longo',
    'Escavadeira Hidráulica',
    'Trator Esteira',
    'Escavadeira Anfíbia',
    'Retroescavadeira',
    'Pá Carregadeira',
    'Caminhão Combinado',
    'Caminhão Pipa',
    'Caminhão Tanque',
    'Carreta',
    'Caminhão Basculante Toco',
    'Motoniveladora',
    'Gerador',
  ];
  for (const name of EQUIPMENT_TYPE_NAMES) {
    const existing = await prisma.equipment_types.findUnique({
      where: { name },
    });
    if (!existing) {
      await prisma.equipment_types.create({ data: { name } });
      console.log(`✅ Equipment type: ${name}`);
    }
  }

  console.log('🎉 Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
