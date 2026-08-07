import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOperatorDto } from './dto/create-operator.dto';

const SALT_ROUNDS = 10;

export type UserWithoutPassword = {
  id: string;
  full_name: string;
  phone: string | null;
  cpf: string;
  email: string | null;
  address: string | null;
  cnh_photo: string | null;
  is_active: boolean;
  is_admin: boolean;
  contract_id: string | null;
  equipment_type_id?: string | null;
  ativo_placa?: string | null;
  qr_payload?: string | null;
  qr_generated_at?: Date | null;
  created_at: Date;
  contract?: { id: string; name: string } | null;
  equipment_type?: { id: string; name: string } | null;
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  private isMissingQrManualColumnError(error: unknown): boolean {
    const code = (error as any)?.code;
    const message = `${(error as any)?.message ?? ''}`;
    return code === 'P2022' || message.includes('qr_manual_optout');
  }

  private async deleteUserRecord(userId: string): Promise<void> {
    try {
      await this.prisma.users.delete({
        where: { id: userId },
      });
    } catch (error) {
      if (!this.isMissingQrManualColumnError(error)) {
        throw error;
      }

      await this.prisma.$executeRaw`
        DELETE FROM "users" WHERE "id" = ${userId}
      `;
    }
  }

  async createOperator(dto: CreateOperatorDto): Promise<UserWithoutPassword> {
    const normalizedCpf = dto.cpf.replace(/\D+/g, '');

    const existingByCpf = await this.prisma.users.findUnique({
      where: { cpf: normalizedCpf },
      select: { id: true },
    });
    if (existingByCpf) {
      throw new ConflictException('Já existe um usuário cadastrado com este CPF');
    }

    const normalizedEmail = dto.email?.trim().toLowerCase() || null;
    if (normalizedEmail) {
      const existingByEmail = await this.prisma.users.findFirst({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        select: { id: true },
      });
      if (existingByEmail) {
        throw new ConflictException('Já existe um usuário cadastrado com este e-mail');
      }
    }

    let contractId: string | null = null;
    if (dto.contract_id) {
      const contract = await this.prisma.contracts.findUnique({
        where: { id: dto.contract_id },
        select: { id: true, active: true },
      });
      if (!contract || !contract.active) {
        throw new BadRequestException('Contrato não encontrado ou inativo.');
      }
      contractId = contract.id;
    }

    const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);
    let createdUserId: string;

    try {
      const created = await this.prisma.users.create({
        data: {
          full_name: dto.full_name.trim(),
          cpf: normalizedCpf,
          email: normalizedEmail,
          password: hashedPassword,
          is_active: true,
          is_admin: false,
          contract_id: contractId,
        },
        select: {
          id: true,
        },
      });
      createdUserId = created.id;
    } catch (error) {
      if (!this.isMissingQrManualColumnError(error)) {
        throw error;
      }

      const fallbackUserId = randomUUID();
      const insertedRows = await this.prisma.$queryRaw<Array<{ id: string }>>`
        INSERT INTO "users" ("id", "full_name", "cpf", "email", "password", "is_active", "is_admin", "contract_id")
        VALUES (${fallbackUserId}, ${dto.full_name.trim()}, ${normalizedCpf}, ${normalizedEmail}, ${hashedPassword}, ${true}, ${false}, ${contractId})
        RETURNING "id"
      `;

      const insertedId = insertedRows[0]?.id;
      if (!insertedId) {
        throw error;
      }
      createdUserId = insertedId;
    }

    return this.findOne(createdUserId);
  }

  async findAll(): Promise<UserWithoutPassword[]> {
    const users = await this.prisma.users.findMany({
      select: {
        id: true,
        full_name: true,
        phone: true,
        cpf: true,
        email: true,
        address: true,
        cnh_photo: true,
        is_active: true,
        is_admin: true,
        contract_id: true,
        equipment_type_id: true,
        ativo_placa: true,
        qr_payload: true,
        qr_generated_at: true,
        created_at: true,
        contract: { select: { id: true, name: true } },
        equipment_type: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
    });
    return users.map((u) => ({ ...u, contract: u.contract ?? null, equipment_type: u.equipment_type ?? null }));
  }

  async findOne(id: string): Promise<UserWithoutPassword> {
    const user = await this.prisma.users.findUnique({
      where: { id },
      select: {
        id: true,
        full_name: true,
        phone: true,
        cpf: true,
        email: true,
        address: true,
        cnh_photo: true,
        is_active: true,
        is_admin: true,
        contract_id: true,
        equipment_type_id: true,
        ativo_placa: true,
        qr_payload: true,
        qr_generated_at: true,
        created_at: true,
        contract: { select: { id: true, name: true } },
        equipment_type: { select: { id: true, name: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return { ...user, contract: user.contract ?? null, equipment_type: user.equipment_type ?? null };
  }

  async toggleUserStatus(userId: string): Promise<UserWithoutPassword> {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const updatedUser = await this.prisma.users.update({
      where: { id: userId },
      data: {
        is_active: !user.is_active,
      },
    });

    return {
      id: updatedUser.id,
      full_name: updatedUser.full_name,
      phone: updatedUser.phone,
      cpf: updatedUser.cpf,
      email: updatedUser.email,
      address: updatedUser.address,
      cnh_photo: updatedUser.cnh_photo,
      is_active: updatedUser.is_active,
      is_admin: updatedUser.is_admin,
      contract_id: updatedUser.contract_id,
      equipment_type_id: (updatedUser as any).equipment_type_id ?? null,
      ativo_placa: (updatedUser as any).ativo_placa ?? null,
      qr_payload: (updatedUser as any).qr_payload ?? null,
      qr_generated_at: (updatedUser as any).qr_generated_at ?? null,
      created_at: updatedUser.created_at,
    };
  }

  async deleteUser(userId: string, actingUserId?: string): Promise<{ message: string }> {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, is_admin: true, is_active: true, full_name: true },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    if (actingUserId && actingUserId === userId) {
      throw new BadRequestException('Você não pode excluir o próprio usuário.');
    }

    if (user.is_admin && user.is_active) {
      const activeAdmins = await this.prisma.users.count({
        where: { is_admin: true, is_active: true },
      });
      if (activeAdmins <= 1) {
        throw new BadRequestException('Não é possível excluir o último administrador ativo do sistema.');
      }
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.check_operations.updateMany({
          where: { created_by_user_id: userId },
          data: { created_by_user_id: null },
        });
      });

      await this.deleteUserRecord(userId);
    } catch (error) {
      this.logger.error(`Falha ao excluir usuário ${userId}`, error instanceof Error ? error.stack : String(error));

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException('Usuário não encontrado');
        }
        if (error.code === 'P2003') {
          throw new BadRequestException(
            'Não foi possível excluir o usuário porque ainda existem registros vinculados a ele.',
          );
        }
        if (error.code === 'P2022' || `${error.message}`.includes('qr_manual_optout')) {
          throw new BadRequestException(
            'Banco desatualizado: execute as migrations do Prisma (npx prisma migrate deploy) e reinicie a API.',
          );
        }
      }

      if (this.isMissingQrManualColumnError(error)) {
        throw new BadRequestException(
          'Banco desatualizado: execute as migrations do Prisma (npx prisma migrate deploy) e reinicie a API.',
        );
      }

      throw new BadRequestException(
        'Não foi possível excluir o usuário. Tente desativá-lo ou verifique os logs da API.',
      );
    }

    return {
      message: `Usuário ${user.full_name} excluído com sucesso.`,
    };
  }

  /** Atualiza is_admin, is_active e/ou contract_id. Retorna o user e uma mensagem. */
  async updateUser(
    userId: string,
    data: {
      is_admin?: boolean;
      is_active?: boolean;
      email?: string | null;
      contract_id?: string | null;
      equipment_type_id?: string | null;
      ativo_placa?: string | null;
      reload_qr?: boolean;
    },
  ): Promise<{ user: UserWithoutPassword; message: string }> {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const updateData: {
      is_admin?: boolean;
      is_active?: boolean;
      email?: string | null;
      contract_id?: string | null;
      equipment_type_id?: string | null;
      ativo_placa?: string | null;
      qr_payload?: string | null;
      qr_generated_at?: Date | null;
    } = {};
    if (typeof data.is_admin === 'boolean') updateData.is_admin = data.is_admin;
    if (typeof data.is_active === 'boolean') updateData.is_active = data.is_active;
    if (data.email !== undefined) {
      const normalizedEmail = data.email?.trim().toLowerCase() || null;
      if (normalizedEmail) {
        const existingByEmail = await this.prisma.users.findFirst({
          where: {
            email: { equals: normalizedEmail, mode: 'insensitive' },
            NOT: { id: userId },
          },
          select: { id: true },
        });
        if (existingByEmail) {
          throw new BadRequestException('Já existe um usuário cadastrado com este e-mail');
        }
      }
      updateData.email = normalizedEmail;
    }
    if (data.contract_id !== undefined) {
      const val = data.contract_id || null;
      if (val) {
        const contract = await this.prisma.contracts.findUnique({
          where: { id: val },
        });
        if (!contract || !contract.active) {
          throw new BadRequestException('Contrato não encontrado ou inativo.');
        }
      }
      updateData.contract_id = val;
    }
    if (data.equipment_type_id !== undefined) {
      const val = data.equipment_type_id || null;
      if (val) {
        const type = await this.prisma.equipment_types.findUnique({
          where: { id: val, active: true },
        });
        if (!type) {
          throw new BadRequestException('Tipo de equipamento não encontrado ou inativo.');
        }
      }
      updateData.equipment_type_id = val;
    }
    if (data.ativo_placa !== undefined) {
      updateData.ativo_placa = data.ativo_placa || null;
    }

    if (data.reload_qr === true) {
      const willBeActive = typeof data.is_active === 'boolean' ? data.is_active : user.is_active;
      const contractForQr = updateData.contract_id !== undefined ? updateData.contract_id : user.contract_id;
      const equipmentTypeForQr =
        updateData.equipment_type_id !== undefined ? updateData.equipment_type_id : (user as any).equipment_type_id;
      const ativoForQr = updateData.ativo_placa !== undefined ? updateData.ativo_placa : (user as any).ativo_placa;
      if (!willBeActive || !contractForQr || !equipmentTypeForQr || !ativoForQr) {
        throw new BadRequestException(
          'Não foi possível recarregar o QR. Usuário deve estar ativo e ter contrato, tipo de equipamento e ativo/placa.',
        );
      }
      updateData.qr_payload = JSON.stringify({
        contract_id: contractForQr,
        equipment_type_id: equipmentTypeForQr,
        ativo_placa: ativoForQr,
        user_id: user.id,
      });
      updateData.qr_generated_at = new Date();
    }

    if (Object.keys(updateData).length === 0) {
      const current = await this.findOne(userId);
      return { user: current, message: 'Usuário atualizado com sucesso.' };
    }

    await this.prisma.users.update({
      where: { id: userId },
      data: updateData,
    });

    const current = await this.findOne(userId);
    let message = 'Usuário atualizado com sucesso.';
    if (data.contract_id !== undefined) {
      message = current.contract_id
        ? 'Usuário vinculado ao contrato.'
        : 'Vínculo com contrato removido.';
    } else if (data.email !== undefined) {
      message = current.email ? 'E-mail atualizado com sucesso.' : 'E-mail removido com sucesso.';
    } else if (data.reload_qr === true) {
      message = 'QR Code recarregado com sucesso.';
    } else if (data.equipment_type_id !== undefined || data.ativo_placa !== undefined) {
      message = 'Dados de QR do usuário atualizados.';
    } else if (typeof data.is_admin === 'boolean') {
      message = (await this.prisma.users.findUnique({ where: { id: userId }, select: { is_admin: true } }))?.is_admin
        ? 'Permissão de administrador concedida.'
        : 'Permissão de administrador removida.';
    }

    return { user: current, message };
  }
}
