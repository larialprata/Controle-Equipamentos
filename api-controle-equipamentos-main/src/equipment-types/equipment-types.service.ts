import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EquipmentTypesService {
  private readonly logger = new Logger(EquipmentTypesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Lista tipos de equipamento (um por nome). Opcional: filtrar por contractId ou obraId. */
  async findAll(filters?: { contractId?: string; obraId?: string }) {
    const where: Record<string, unknown> = { active: true };
    // Se no futuro houver vínculo tipo ↔ contrato/obra, filtrar aqui
    const types = await this.prisma.equipment_types.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    this.logger.log(`Found ${types.length} equipment types`);
    return types;
  }

  /** Um tipo por ID. */
  async findOne(id: string) {
    const type = await this.prisma.equipment_types.findFirst({
      where: { id, active: true },
    });
    if (!type) {
      throw new BadRequestException('Tipo de equipamento não encontrado');
    }
    return type;
  }
}
