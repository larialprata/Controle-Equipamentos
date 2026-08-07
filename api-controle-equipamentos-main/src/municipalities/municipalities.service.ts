import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMunicipalityDto } from './dto/create-municipality.dto';
import { UpdateMunicipalityDto } from './dto/update-municipality.dto';

@Injectable()
export class MunicipalitiesService {
  private readonly logger = new Logger(MunicipalitiesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Lista municípios ativos de uma obra. */
  async findByObra(obraId: string) {
    const obra = await this.prisma.obras.findFirst({
      where: { id: obraId, active: true },
    });
    if (!obra) {
      throw new BadRequestException('Obra não encontrada');
    }
    const municipalities = await this.prisma.municipalities.findMany({
      where: { obra_id: obraId, active: true },
      orderBy: { name: 'asc' },
    });
    this.logger.log(`Found ${municipalities.length} municipalities for obra ${obraId}`);
    return municipalities;
  }

  /** Retorna um município por ID. */
  async findOne(id: string) {
    const municipality = await this.prisma.municipalities.findUnique({
      where: { id },
      include: {
        obra: { select: { id: true, code: true, contract_id: true } },
      },
    });
    if (!municipality) {
      throw new NotFoundException('Município não encontrado');
    }
    return municipality;
  }

  /** Cria um município. */
  async create(dto: CreateMunicipalityDto) {
    const obra = await this.prisma.obras.findFirst({
      where: { id: dto.obra_id, active: true },
    });
    if (!obra) {
      throw new BadRequestException('Obra não encontrada');
    }
    const municipality = await this.prisma.municipalities.create({
      data: {
        name: dto.name.trim(),
        obra_id: dto.obra_id,
      },
      include: {
        obra: { select: { id: true, code: true } },
      },
    });
    this.logger.log(`Created municipality: ${municipality.name} (${municipality.id})`);
    return municipality;
  }

  /** Atualiza um município. */
  async update(id: string, dto: UpdateMunicipalityDto) {
    await this.findOne(id);
    const municipality = await this.prisma.municipalities.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
      include: {
        obra: { select: { id: true, code: true } },
      },
    });
    this.logger.log(`Updated municipality: ${municipality.id}`);
    return municipality;
  }
}
