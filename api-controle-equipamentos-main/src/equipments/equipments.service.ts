import { Injectable, Logger, BadRequestException, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';

@Injectable()
export class EquipmentsService {
  private readonly logger = new Logger(EquipmentsService.name);
  private readonly equipmentInclude = {
    contract: { select: { id: true, name: true } },
    obra: { select: { id: true, code: true, contract_id: true } },
    equipment_type: { select: { id: true, name: true } },
  } as const;

  constructor(private prisma: PrismaService) {}

  private normalizeAtivoPlaca(value: string): string {
    return value.trim().toUpperCase().replace(/\s+/g, '');
  }

  private normalizeCompanyName(value: string): string {
    return value.trim();
  }

  private withQrValue<T extends { id: string; qr_token?: string | null }>(equipment: T) {
    return {
      ...equipment,
      qr_code_value: equipment.qr_token ?? equipment.id,
    };
  }

  private async findActiveEquipmentRecord(id: string) {
    const equipment = await this.prisma.equipments.findUnique({
      where: { id },
      include: this.equipmentInclude,
    });
    if (!equipment || !equipment.active) {
      throw new NotFoundException('Equipamento não encontrado.');
    }
    return equipment;
  }

  async findAllActive() {
    try {
      this.logger.log('Fetching all active equipments');

      const equipments = await this.prisma.equipments.findMany({
        where: { active: true },
        include: this.equipmentInclude,
        orderBy: { created_at: 'desc' },
      });

      this.logger.log(`Found ${equipments.length} active equipments`);
      return equipments.map((equipment) => this.withQrValue(equipment));
    } catch (error) {
      this.logger.error('Error fetching all active equipments', error);
      throw error;
    }
  }

  async findByContract(contractId: string) {
    try {
      this.logger.log(`Fetching equipments for contract: ${contractId}`);
      const contract = await this.prisma.contracts.findUnique({
        where: { id: contractId },
      });
      if (!contract) {
        throw new BadRequestException('Contract not found');
      }

      const equipments = await this.prisma.equipments.findMany({
        where: {
          active: true,
          contract_id: contractId,
        },
        include: this.equipmentInclude,
        orderBy: { created_at: 'asc' },
      });

      this.logger.log(`Found ${equipments.length} equipments for contract ${contractId}`);
      return equipments.map((equipment) => this.withQrValue(equipment));
    } catch (error) {
      this.logger.error(`Error fetching equipments for contract ${contractId}`, error);
      throw error;
    }
  }

  async create(dto: CreateEquipmentDto) {
    const ativoPlaca = this.normalizeAtivoPlaca(dto.ativo_placa);

    const [contract, obra, equipmentType, existing] = await Promise.all([
      this.prisma.contracts.findUnique({
        where: { id: dto.contract_id },
        select: { id: true, name: true, active: true },
      }),
      dto.obra_id
        ? this.prisma.obras.findUnique({
            where: { id: dto.obra_id },
            select: { id: true, contract_id: true, code: true, active: true },
          })
        : Promise.resolve(null),
      this.prisma.equipment_types.findUnique({
        where: { id: dto.equipment_type_id },
        select: { id: true, name: true, active: true },
      }),
      this.prisma.equipments.findFirst({
        where: { ativo_placa: ativoPlaca },
        select: { id: true },
      }),
    ]);

    if (!contract || !contract.active) {
      throw new BadRequestException('Contrato não encontrado ou inativo.');
    }
    if (dto.obra_id && (!obra || !obra.active || obra.contract_id !== contract.id)) {
      throw new BadRequestException('Obra não encontrada ou não pertence ao contrato selecionado.');
    }
    if (!equipmentType?.active) {
      throw new BadRequestException('Tipo de equipamento não encontrado ou inativo.');
    }
    if (existing) {
      throw new ConflictException('Já existe um equipamento vinculado a este ativo/placa.');
    }

    const created = await this.prisma.equipments.create({
      data: {
        name: dto.name.trim(),
        contract_id: contract.id,
        obra_id: obra?.id ?? null,
        company_name: this.normalizeCompanyName(dto.company_name),
        equipment_type_id: equipmentType.id,
        ativo_placa: ativoPlaca,
        active: dto.active ?? true,
      },
      include: this.equipmentInclude,
    });

    return this.withQrValue(created);
  }

  async update(id: string, dto: UpdateEquipmentDto) {
    const current = await this.findActiveEquipmentRecord(id);
    const data: {
      name?: string;
      contract_id?: string;
      obra_id?: string | null;
      company_name?: string;
      equipment_type_id?: string;
      ativo_placa?: string;
      active?: boolean;
    } = {};

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }

    if (dto.contract_id !== undefined) {
      const contract = await this.prisma.contracts.findUnique({
        where: { id: dto.contract_id },
        select: { id: true, active: true },
      });
      if (!contract || !contract.active) {
        throw new BadRequestException('Contrato não encontrado ou inativo.');
      }
      data.contract_id = contract.id;
    }

    if (dto.obra_id !== undefined) {
      if (!dto.obra_id) {
        data.obra_id = null;
      } else {
        const contractId = dto.contract_id ?? current.contract_id;
        const obra = await this.prisma.obras.findUnique({
          where: { id: dto.obra_id },
          select: { id: true, contract_id: true, active: true },
        });
        if (!obra || !obra.active || obra.contract_id !== contractId) {
          throw new BadRequestException('Obra não encontrada ou não pertence ao contrato selecionado.');
        }
        data.obra_id = obra.id;
      }
    }

    if (dto.equipment_type_id !== undefined) {
      const equipmentType = await this.prisma.equipment_types.findUnique({
        where: { id: dto.equipment_type_id },
        select: { id: true, active: true },
      });
      if (!equipmentType?.active) {
        throw new BadRequestException('Tipo de equipamento não encontrado ou inativo.');
      }
      data.equipment_type_id = equipmentType.id;
    }

    if (dto.company_name !== undefined) {
      data.company_name = this.normalizeCompanyName(dto.company_name);
    }

    if (dto.ativo_placa !== undefined) {
      const ativoPlaca = this.normalizeAtivoPlaca(dto.ativo_placa);
      const existing = await this.prisma.equipments.findFirst({
        where: { ativo_placa: ativoPlaca, NOT: { id } },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException('Já existe um equipamento vinculado a este ativo/placa.');
      }
      data.ativo_placa = ativoPlaca;
    }

    if (dto.active !== undefined) {
      data.active = dto.active;
    }

    if (Object.keys(data).length === 0) {
      return this.withQrValue(current);
    }

    const updated = await this.prisma.equipments.update({
      where: { id },
      data,
      include: this.equipmentInclude,
    });

    return this.withQrValue(updated);
  }

  async regenerateQr(id: string) {
    await this.findActiveEquipmentRecord(id);
    const updated = await this.prisma.equipments.update({
      where: { id },
      data: { qr_token: randomUUID() },
      include: this.equipmentInclude,
    });
    return this.withQrValue(updated);
  }

  async remove(id: string) {
    await this.findActiveEquipmentRecord(id);
    await this.prisma.equipments.update({
      where: { id },
      data: { active: false },
    });
    return { message: 'Equipamento excluído com sucesso.' };
  }

  async findByQrCode(qrCode: string, userId: string) {
    const normalizedQr = qrCode.trim();
    if (!normalizedQr) {
      throw new BadRequestException('QR code inválido.');
    }

    const [user, equipment] = await Promise.all([
      this.prisma.users.findUnique({
        where: { id: userId },
        select: { id: true, is_admin: true, contract_id: true },
      }),
      this.prisma.equipments.findFirst({
        where: {
          OR: [{ qr_token: normalizedQr }, { id: normalizedQr }],
        },
        include: this.equipmentInclude,
      }),
    ]);

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    if (!equipment || !equipment.active) {
      throw new NotFoundException('Equipamento não encontrado para este QR code.');
    }
    if (!equipment.contract_id || !equipment.equipment_type_id || !equipment.ativo_placa) {
      throw new BadRequestException('Este QR code está vinculado a um cadastro incompleto.');
    }
    if (!user.is_admin && user.contract_id !== equipment.contract_id) {
      throw new ForbiddenException('Sem permissão para acessar este equipamento.');
    }

    return this.withQrValue(equipment);
  }

  async findByQrCodePublic(qrCode: string) {
    const normalizedQr = qrCode.trim();
    if (!normalizedQr) {
      throw new BadRequestException('QR code inválido.');
    }

    const equipment = await this.prisma.equipments.findFirst({
      where: {
        OR: [{ qr_token: normalizedQr }, { id: normalizedQr }],
        active: true,
      },
      select: {
        id: true,
        contract_id: true,
        equipment_type_id: true,
        ativo_placa: true,
        active: true,
        qr_token: true,
      },
    });

    if (!equipment || !equipment.active) {
      throw new NotFoundException('Equipamento não encontrado para este QR code.');
    }
    if (!equipment.contract_id || !equipment.equipment_type_id || !equipment.ativo_placa) {
      throw new BadRequestException('Este QR code está vinculado a um cadastro incompleto.');
    }

    return this.withQrValue(equipment);
  }
}
