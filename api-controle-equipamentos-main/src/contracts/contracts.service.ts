import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContractDto } from './dto/create-contract.dto';

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);

  constructor(private prisma: PrismaService) {}

  async findAllActive() {
    try {
      this.logger.log('Fetching all active contracts');
      const contracts = await this.prisma.contracts.findMany({
        where: { active: true },
        orderBy: { created_at: 'desc' },
      });
      this.logger.log(`Found ${contracts.length} active contracts`);
      return contracts;
    } catch (error) {
      this.logger.error('Error fetching contracts', error);
      throw error;
    }
  }

  async create(dto: CreateContractDto) {
    const normalizedName = dto.name.trim();
    if (!normalizedName) {
      throw new BadRequestException('Informe o nome do contrato.');
    }

    const existing = await this.prisma.contracts.findFirst({
      where: {
        name: {
          equals: normalizedName,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      throw new BadRequestException('Já existe um contrato com este nome.');
    }

    return this.prisma.contracts.create({
      data: {
        name: normalizedName,
        active: true,
      },
    });
  }

  /** Retorna o contrato vinculado ao usuário para uso na tela de movimentações. */
  async findMyContract(userId: string) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { contract_id: true },
    });
    if (!user?.contract_id) {
      return null;
    }
    return this.prisma.contracts.findFirst({
      where: { id: user.contract_id, active: true },
    });
  }

  /** Lista obras do contrato (ATA → 242,243,244,245,246,247; Limpa Rio → 232; ECO Barreira → 229). */
  async findObrasByContract(contractId: string) {
    const contract = await this.prisma.contracts.findUnique({
      where: { id: contractId },
    });
    if (!contract) {
      throw new BadRequestException('Contrato não encontrado');
    }
    return this.prisma.obras.findMany({
      where: { contract_id: contractId, active: true },
      orderBy: { code: 'asc' },
    });
  }

  async createContract(dto: CreateContractDto) {
    const normalizedName = dto.name.trim();
    if (!normalizedName) {
      throw new BadRequestException('Nome do contrato é obrigatório');
    }

    const existing = await this.prisma.contracts.findFirst({
      where: { name: { equals: normalizedName, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('Já existe um contrato com esse nome');
    }

    return this.prisma.contracts.create({
      data: {
        name: normalizedName,
        active: true,
      },
    });
  }

  async updateStatus(contractId: string, active: boolean) {
    const exists = await this.prisma.contracts.findUnique({
      where: { id: contractId },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException('Contrato não encontrado');
    }

    return this.prisma.contracts.update({
      where: { id: contractId },
      data: { active },
    });
  }
}
