import { Injectable, Logger, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateOperationDto } from './dto/create-operation.dto';
import { UpdateOperationDto } from './dto/update-operation.dto';
import * as fs from 'fs';
import * as path from 'path';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { OperationType } from '@prisma/client';

@Injectable()
export class CheckOperationsService {
  private readonly logger = new Logger(CheckOperationsService.name);
  private readonly uploadsDir = path.join(process.cwd(), 'uploads', 'operations');
  // Cache simples em memória: chave = lat/lng arredondados em 5 casas.
  private readonly municipalityCache = new Map<string, string | null>();

  constructor(
    private prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {
    this.ensureUploadsDirExists();
  }

  private ensureUploadsDirExists() {
    try {
      if (!fs.existsSync(this.uploadsDir)) {
        fs.mkdirSync(this.uploadsDir, { recursive: true, mode: 0o775 });
        this.logger.log(`Created uploads directory: ${this.uploadsDir}`);
      }
    } catch (error) {
      this.logger.error(`Failed to ensure uploads directory: ${this.uploadsDir}`, error);
    }
  }

  private async saveOperationPhoto(photo: Express.Multer.File): Promise<string> {
    if (!photo?.buffer?.length) {
      throw new BadRequestException('Foto inválida ou vazia. Tire a foto novamente.');
    }

    const filename = `${randomUUID()}${extname(photo.originalname) || '.jpg'}`;

    if (this.storageService.isConfigured()) {
      try {
        return await this.storageService.uploadOperation(
          photo.buffer,
          filename,
          photo.mimetype || 'image/jpeg',
        );
      } catch (error) {
        this.logger.error('Storage upload failed for operation photo', error);
        throw new BadRequestException(
          'Não foi possível enviar a foto para o armazenamento. Tente novamente em instantes.',
        );
      }
    }

    try {
      this.ensureUploadsDirExists();
      const filepath = path.join(this.uploadsDir, filename);
      fs.writeFileSync(filepath, photo.buffer);
      return `/uploads/operations/${filename}`;
    } catch (error) {
      this.logger.error(`Failed to write operation photo to disk: ${this.uploadsDir}`, error);
      throw new BadRequestException(
        'Não foi possível salvar a foto no servidor. Contate o suporte técnico.',
      );
    }
  }

  private getCoordCacheKey(lat: number, lng: number): string {
    return `${lat.toFixed(5)},${lng.toFixed(5)}`;
  }

  private async fetchJsonWithTimeout(url: string, headers: Record<string, string> = {}, timeoutMs = 3000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      if (!res.ok) {
        return null;
      }
      return res.json();
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private extractMunicipalityName(payload: any): string | null {
    const value =
      payload?.city ||
      payload?.municipality ||
      payload?.locality ||
      payload?.county ||
      payload?.address?.city ||
      payload?.address?.town ||
      payload?.address?.municipality ||
      payload?.address?.county ||
      payload?.address?.state_district ||
      payload?.address?.village ||
      null;
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  /** Resolve município no backend com fallback e cache para não depender do navegador. */
  private async resolveMunicipio(lat: number, lng: number): Promise<string | null> {
    const key = this.getCoordCacheKey(lat, lng);
    if (this.municipalityCache.has(key)) {
      return this.municipalityCache.get(key) ?? null;
    }

    const attempts: Array<() => Promise<any>> = [
      () =>
        this.fetchJsonWithTimeout(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=pt`,
        ),
      () =>
        this.fetchJsonWithTimeout(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`,
          { 'User-Agent': 'api-controle-equipamentos/1.0' },
        ),
      () =>
        this.fetchJsonWithTimeout(
          `https://geocode.maps.co/reverse?lat=${lat}&lon=${lng}`,
        ),
    ];

    for (const attempt of attempts) {
      const data = await attempt();
      const municipio = this.extractMunicipalityName(data);
      if (municipio) {
        this.municipalityCache.set(key, municipio);
        return municipio;
      }
    }

    this.municipalityCache.set(key, null);
    return null;
  }

  /** Adiciona nome do usuário (full_name da tabela users) para a coluna Usuário no front. */
  private mapOperationWithUserName<T extends { created_by_user?: { full_name: string } | null }>(
    op: T,
  ): T & { created_by_user_name: string; user_name: string; usuario: string } {
    const name = op.created_by_user?.full_name ?? '—';
    return {
      ...op,
      created_by_user_name: name,
      user_name: name,
      usuario: name,
    };
  }

  private normalizeAtivoPlaca(value: string): string {
    return value.trim().toUpperCase().replace(/\s+/g, '');
  }

  private isSameAssetContext(
    operation: {
      contract_id?: string | null;
      equipment_type_id?: string | null;
      ativo_placa?: string | null;
    } | null,
    target: {
      contractId: string;
      equipmentTypeId?: string | null;
      ativoPlaca?: string | null;
    },
  ): boolean {
    if (!operation?.contract_id || !target.contractId) {
      return false;
    }

    return (
      operation.contract_id === target.contractId &&
      (operation.equipment_type_id ?? null) === (target.equipmentTypeId ?? null) &&
      this.normalizeAtivoPlaca(operation.ativo_placa ?? '') === this.normalizeAtivoPlaca(target.ativoPlaca ?? '')
    );
  }

  /** Dia operacional no fuso de Brasília (evita abertura/fechamento em dias UTC diferentes). */
  private getOperationalDayRange(dateInput: string | Date): { start: Date; end: Date } {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Data/hora da operação inválida');
    }

    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    if (!year || !month || !day) {
      throw new BadRequestException('Data/hora da operação inválida');
    }

    const start = new Date(`${year}-${month}-${day}T00:00:00-03:00`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { start, end };
  }

  /** Inclui contract, equipment (legado), equipment_type e created_by_user nas listagens. */
  private readonly operationInclude = {
    contract: { select: { id: true, name: true } },
    equipment: { select: { id: true, name: true } },
    equipment_type: { select: { id: true, name: true } },
    created_by_user: {
      select: { id: true, full_name: true, email: true },
    },
  } as const;

  async findAll() {
    const list = await this.prisma.check_operations.findMany({
      orderBy: { operation_datetime: 'desc' },
      include: this.operationInclude,
    });
    return list.map((op) => this.mapOperationWithUserName(op));
  }

  /** Lista operações do contrato. Opcional: filtrar por equipmentTypeId (tipo de equipamento) e/or ativoPlaca (texto digitado). */
  async findByContract(
    contractId: string,
    filters?: { equipmentTypeId?: string; ativoPlaca?: string },
  ) {
    const where: Record<string, unknown> = { contract_id: contractId };
    if (filters?.equipmentTypeId) {
      where.equipment_type_id = filters.equipmentTypeId;
    }
    if (filters?.ativoPlaca && filters.ativoPlaca.trim() !== '') {
      where.ativo_placa = { equals: filters.ativoPlaca.trim(), mode: 'insensitive' };
    }
    const list = await this.prisma.check_operations.findMany({
      where,
      orderBy: { operation_datetime: 'desc' },
      include: this.operationInclude,
    });
    return list.map((op) => this.mapOperationWithUserName(op));
  }

  async findOne(id: string) {
    const operation = await this.prisma.check_operations.findUnique({
      where: { id },
      include: this.operationInclude,
    });
    if (!operation) {
      return null;
    }
    return this.mapOperationWithUserName(operation);
  }

  /** Resolve operação pelo nome do arquivo em photo_url (armazenamento local ou URL). */
  async findByPhotoFilename(filename: string) {
    if (
      !filename ||
      filename.includes('..') ||
      filename.includes('/') ||
      filename.includes('\\')
    ) {
      return null;
    }
    const operation = await this.prisma.check_operations.findFirst({
      where: {
        OR: [
          { photo_url: { endsWith: filename } },
          { photo_url: { endsWith: `/${filename}` } },
        ],
      },
      include: this.operationInclude,
    });
    if (!operation) {
      return null;
    }
    return this.mapOperationWithUserName(operation);
  }

  /**
   * Último checkin em aberto desse usuário — para preencher o checkout (mesmo contrato e equipamento).
   * Por usuário (conta), não por dispositivo. Retorna null se não houver checkin aberto.
   */
  async findLastCheckinByUser(userId: string) {
    const lastCheckin = await this.prisma.check_operations.findFirst({
      where: {
        created_by_user_id: userId,
        operation_type: OperationType.checkin,
      },
      orderBy: [{ operation_datetime: 'desc' }, { created_at: 'desc' }],
      include: this.operationInclude,
    });
    if (!lastCheckin) {
      return null;
    }
    const hasCheckout = await this.prisma.check_operations.findFirst({
      where: {
        created_by_user_id: userId,
        operation_type: OperationType.checkout,
        operation_datetime: { gte: lastCheckin.operation_datetime },
      },
    });
    if (hasCheckout) {
      return null;
    }
    return this.mapOperationWithUserName(lastCheckin);
  }

  async findOpenCheckinForUserAssetOnDate(params: {
    userId: string;
    contractId: string;
    equipmentTypeId: string;
    ativoPlaca: string;
    operationDate: string | Date;
  }) {
    const normalizedAtivoPlaca = this.normalizeAtivoPlaca(params.ativoPlaca);
    const { start, end } = this.getOperationalDayRange(params.operationDate);

    const checkins = await this.prisma.check_operations.findMany({
      where: {
        created_by_user_id: params.userId,
        contract_id: params.contractId,
        equipment_type_id: params.equipmentTypeId,
        ativo_placa: normalizedAtivoPlaca,
        operation_type: OperationType.checkin,
        operation_datetime: {
          gte: start,
          lt: end,
        },
      },
      orderBy: [{ operation_datetime: 'desc' }, { created_at: 'desc' }],
      include: this.operationInclude,
    });

    for (const checkin of checkins) {
      const hasCheckout = await this.prisma.check_operations.findFirst({
        where: {
          created_by_user_id: params.userId,
          contract_id: params.contractId,
          equipment_type_id: params.equipmentTypeId,
          ativo_placa: normalizedAtivoPlaca,
          operation_type: OperationType.checkout,
          operation_datetime: {
            gte: checkin.operation_datetime,
            lt: end,
          },
        },
        select: { id: true },
      });

      if (!hasCheckout) {
        return this.mapOperationWithUserName(checkin);
      }
    }

    return null;
  }

  async findOpenCheckinForAssetOnDate(params: {
    contractId: string;
    equipmentTypeId: string;
    ativoPlaca: string;
    operationDate: string | Date;
  }) {
    const normalizedAtivoPlaca = this.normalizeAtivoPlaca(params.ativoPlaca);
    const { start, end } = this.getOperationalDayRange(params.operationDate);

    const checkins = await this.prisma.check_operations.findMany({
      where: {
        contract_id: params.contractId,
        equipment_type_id: params.equipmentTypeId,
        ativo_placa: normalizedAtivoPlaca,
        operation_type: OperationType.checkin,
        operation_datetime: {
          gte: start,
          lt: end,
        },
      },
      orderBy: [{ operation_datetime: 'desc' }, { created_at: 'desc' }],
      include: this.operationInclude,
    });

    for (const checkin of checkins) {
      const hasCheckout = await this.prisma.check_operations.findFirst({
        where: {
          contract_id: params.contractId,
          equipment_type_id: params.equipmentTypeId,
          ativo_placa: normalizedAtivoPlaca,
          operation_type: OperationType.checkout,
          operation_datetime: {
            gte: checkin.operation_datetime,
            lt: end,
          },
        },
        select: { id: true },
      });

      if (!hasCheckout) {
        return this.mapOperationWithUserName(checkin);
      }
    }

    return null;
  }

  /** Última abertura sem fechamento (sem limite de dia — fallback para QR/guest). */
  async findLatestOpenCheckinForAsset(params: {
    contractId: string;
    equipmentTypeId: string;
    ativoPlaca: string;
  }) {
    const normalizedAtivoPlaca = this.normalizeAtivoPlaca(params.ativoPlaca);

    const checkins = await this.prisma.check_operations.findMany({
      where: {
        contract_id: params.contractId,
        equipment_type_id: params.equipmentTypeId,
        ativo_placa: normalizedAtivoPlaca,
        operation_type: OperationType.checkin,
      },
      orderBy: [{ operation_datetime: 'desc' }, { created_at: 'desc' }],
      take: 10,
      include: this.operationInclude,
    });

    for (const checkin of checkins) {
      const hasCheckout = await this.prisma.check_operations.findFirst({
        where: {
          contract_id: params.contractId,
          equipment_type_id: params.equipmentTypeId,
          ativo_placa: normalizedAtivoPlaca,
          operation_type: OperationType.checkout,
          operation_datetime: { gte: checkin.operation_datetime },
        },
        select: { id: true },
      });

      if (!hasCheckout) {
        return this.mapOperationWithUserName(checkin);
      }
    }

    return null;
  }

  async resolveOpenCheckinForAsset(params: {
    contractId: string;
    equipmentTypeId: string;
    ativoPlaca: string;
    operationDate: string | Date;
  }) {
    const onDate = await this.findOpenCheckinForAssetOnDate(params);
    if (onDate) return onDate;

    return this.findLatestOpenCheckinForAsset({
      contractId: params.contractId,
      equipmentTypeId: params.equipmentTypeId,
      ativoPlaca: params.ativoPlaca,
    });
  }

  async createGuestOperation(dto: CreateOperationDto, photo: Express.Multer.File) {
    try {
      if (dto.ativo_placa) {
        dto.ativo_placa = this.normalizeAtivoPlaca(dto.ativo_placa);
      }

      if (!dto.equipment_type_id || !dto.ativo_placa) {
        throw new BadRequestException('Dados do ativo incompletos.');
      }

      const contract = await this.prisma.contracts.findUnique({ where: { id: dto.contract_id } });
      if (!contract) {
        throw new BadRequestException('Contract not found');
      }

      const equipmentType = await this.prisma.equipment_types.findFirst({
        where: { id: dto.equipment_type_id, active: true },
      });
      if (!equipmentType) {
        throw new BadRequestException('Tipo de equipamento não encontrado');
      }

      const operationDateTime = new Date(dto.operation_datetime);
      if (Number.isNaN(operationDateTime.getTime())) {
        throw new BadRequestException('Data/hora da operação inválida');
      }

      const openCheckin = await this.resolveOpenCheckinForAsset({
        contractId: dto.contract_id,
        equipmentTypeId: dto.equipment_type_id,
        ativoPlaca: dto.ativo_placa,
        operationDate: operationDateTime,
      });

      if (dto.operation_type === OperationType.checkin) {
        if (openCheckin) {
          throw new BadRequestException(
            'Já existe uma abertura em aberto para este ativo. Registre o fechamento na mesma tela.',
          );
        }
      } else if (dto.operation_type === OperationType.checkout) {
        if (!openCheckin) {
          throw new BadRequestException('Não existe abertura em aberto para este ativo nesta data.');
        }
        if (Number(dto.horimeter) <= Number(openCheckin.horimeter)) {
          throw new BadRequestException('O horímetro do fechamento deve ser maior que o da abertura.');
        }
      }

      return this.persistOperation(dto, photo, null);
    } catch (error) {
      this.logger.error('Error creating guest operation', error);
      throw error;
    }
  }

  async createOperation(dto: CreateOperationDto, photo: Express.Multer.File, createdByUserId?: string) {
    try {
      if (dto.ativo_placa) {
        dto.ativo_placa = this.normalizeAtivoPlaca(dto.ativo_placa);
      }
      this.logger.log(
        `Creating ${dto.operation_type} operation for type ${dto.equipment_type_id} / ativo_placa ${dto.ativo_placa}`,
      );

      const contract = await this.prisma.contracts.findUnique({ where: { id: dto.contract_id } });
      if (!contract) {
        throw new BadRequestException('Contract not found');
      }

      const equipmentType = await this.prisma.equipment_types.findFirst({
        where: { id: dto.equipment_type_id, active: true },
      });
      if (!equipmentType) {
        throw new BadRequestException('Tipo de equipamento não encontrado');
      }

      if (!createdByUserId) {
        throw new BadRequestException('Usuário não identificado (token obrigatório)');
      }
      const operationDateTime = new Date(dto.operation_datetime);
      if (Number.isNaN(operationDateTime.getTime())) {
        throw new BadRequestException('Data/hora da operação inválida');
      }

      this.logger.log(`Validating ${dto.operation_type} for user_id=${createdByUserId}`);
      const hasAssetContext = Boolean(dto.equipment_type_id && dto.ativo_placa);
      const openCheckin = hasAssetContext
        ? await this.findOpenCheckinForUserAssetOnDate({
            userId: createdByUserId,
            contractId: dto.contract_id,
            equipmentTypeId: dto.equipment_type_id!,
            ativoPlaca: dto.ativo_placa!,
            operationDate: operationDateTime,
          })
        : null;
      const lastOpenCheckin = await this.findLastCheckinByUser(createdByUserId);
      const lastOperation = await this.prisma.check_operations.findFirst({
        where: { created_by_user_id: createdByUserId },
        orderBy: [{ operation_datetime: 'desc' }, { created_at: 'desc' }],
      });

      if (dto.operation_type === OperationType.checkin) {
        if (lastOpenCheckin) {
          throw new BadRequestException(
            `Você possui uma abertura em aberto para o ativo ${lastOpenCheckin.ativo_placa ?? 'anterior'}. Faça o fechamento antes de registrar outra abertura.`,
          );
        }
        if (hasAssetContext && openCheckin) {
          this.logger.warn(`Blocked checkin: user ${createdByUserId} already has open checkin for ativo ${dto.ativo_placa} (op id=${openCheckin.id})`);
          throw new BadRequestException('Já existe uma abertura em aberto para este ativo nesta data. Leia o QR code novamente para fazer o fechamento.');
        }
        if (!hasAssetContext && lastOperation?.operation_type === OperationType.checkin) {
          throw new BadRequestException('Você já possui uma abertura em aberto. Faça o fechamento antes de abrir outra.');
        }
      } else if (dto.operation_type === OperationType.checkout) {
        if (lastOpenCheckin && hasAssetContext && !this.isSameAssetContext(lastOpenCheckin, {
          contractId: dto.contract_id,
          equipmentTypeId: dto.equipment_type_id ?? null,
          ativoPlaca: dto.ativo_placa ?? null,
        })) {
          throw new BadRequestException(
            `Existe um fechamento pendente para o ativo ${lastOpenCheckin.ativo_placa ?? 'da última abertura'}. Leia o QR code deste mesmo ativo para concluir.`,
          );
        }

        if (hasAssetContext) {
          const referenceCheckin =
            lastOpenCheckin && this.isSameAssetContext(lastOpenCheckin, {
              contractId: dto.contract_id,
              equipmentTypeId: dto.equipment_type_id ?? null,
              ativoPlaca: dto.ativo_placa ?? null,
            })
              ? lastOpenCheckin
              : openCheckin;

          if (!referenceCheckin) {
            throw new BadRequestException('Não existe abertura em aberto para este ativo nesta data.');
          }
          if (
            referenceCheckin.contract_id !== dto.contract_id ||
            referenceCheckin.equipment_type_id !== dto.equipment_type_id ||
            this.normalizeAtivoPlaca(referenceCheckin.ativo_placa ?? '') !== dto.ativo_placa
          ) {
            throw new BadRequestException('O fechamento deve usar o mesmo ativo da última abertura em aberto.');
          }
          if (Number(dto.horimeter) <= Number(referenceCheckin.horimeter)) {
            throw new BadRequestException('O horímetro do fechamento deve ser maior que o da abertura.');
          }
        } else {
          const referenceCheckin = lastOpenCheckin ?? (lastOperation?.operation_type === OperationType.checkin ? lastOperation : null);
          if (!referenceCheckin) {
            throw new BadRequestException('Não há abertura em aberto na sua conta para fechar.');
          }
          if (Number(dto.horimeter) <= Number(referenceCheckin.horimeter)) {
            throw new BadRequestException('O horímetro do fechamento deve ser maior que o da abertura.');
          }
        }
      }

      return this.persistOperation(dto, photo, createdByUserId);
    } catch (error) {
      this.logger.error('Error creating operation', error);
      throw error;
    }
  }

  private async persistOperation(
    dto: CreateOperationDto,
    photo: Express.Multer.File,
    createdByUserId: string | null,
  ) {
    try {
      const photoUrl = await this.saveOperationPhoto(photo);
      const municipio = await this.resolveMunicipio(dto.latitude, dto.longitude);

      const created = await this.prisma.check_operations.create({
        data: {
          contract_id: dto.contract_id,
          equipment_id: dto.equipment_id ?? undefined,
          equipment_type_id: dto.equipment_type_id,
          ativo_placa: dto.ativo_placa,
          operation_type: dto.operation_type,
          horimeter: dto.horimeter,
          photo_url: photoUrl,
          latitude: dto.latitude,
          longitude: dto.longitude,
          municipio: municipio ?? `${dto.latitude}, ${dto.longitude}`,
          observation: dto.observation,
          device_id: dto.device_id,
          operation_datetime: new Date(dto.operation_datetime),
          synced: true,
          created_by_user_id: createdByUserId ?? undefined,
        },
      });

      this.logger.log(`Operation created successfully with ID: ${created.id}`);
      const operation = await this.prisma.check_operations.findUnique({
        where: { id: created.id },
        include: this.operationInclude,
      });
      return operation
        ? this.mapOperationWithUserName(operation)
        : this.mapOperationWithUserName({ ...created, created_by_user: null });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const prismaCode = (error as { code?: string })?.code;
      if (prismaCode === 'P2003') {
        throw new BadRequestException('Dados do equipamento ou contrato inválidos.');
      }
      if (prismaCode === 'P2002') {
        throw new BadRequestException('Operação duplicada. Atualize a página e tente novamente.');
      }
      this.logger.error('Failed to persist operation', error);
      throw new InternalServerErrorException('Não foi possível registrar a operação. Tente novamente.');
    }
  }

  async syncOperations(operations: any[], createdByUserId?: string) {
    const results = [];
    let synced = 0;
    let failed = 0;

    for (const op of operations) {
      try {
        if (op.ativo_placa) {
          op.ativo_placa = this.normalizeAtivoPlaca(op.ativo_placa);
        }
        this.logger.log(
          `Syncing queued operation for type ${op.equipment_type_id ?? '-'} / equipment ${op.equipment_id ?? '-'} / ativo_placa ${op.ativo_placa ?? '-'}`,
        );

        const operationDateTime = new Date(op.operation_datetime);
        if (Number.isNaN(operationDateTime.getTime())) {
          throw new BadRequestException('Data/hora da operação inválida no sync');
        }

        // Idempotência do sync: evita gravar operação duplicada em reenvios.
        const existing = await this.prisma.check_operations.findFirst({
          where: {
            created_by_user_id: createdByUserId ?? null,
            contract_id: op.contract_id,
            equipment_type_id: op.equipment_type_id,
            ativo_placa: op.ativo_placa,
            operation_type: op.operation_type,
            device_id: op.device_id,
            operation_datetime: operationDateTime,
            horimeter: op.horimeter,
          },
          select: { id: true },
        });
        if (existing) {
          synced++;
          results.push({ success: true, id: existing.id, deduplicated: true });
          this.logger.warn(`Skipped duplicate operation during sync (existing id=${existing.id})`);
          continue;
        }

        const contract = await this.prisma.contracts.findUnique({ where: { id: op.contract_id } });
        if (!contract) {
          throw new BadRequestException('Contract not found');
        }

        const equipmentType = await this.prisma.equipment_types.findFirst({
          where: { id: op.equipment_type_id, active: true },
        });
        if (!equipmentType) {
          throw new BadRequestException('Tipo de equipamento não encontrado');
        }

        const municipio = await this.resolveMunicipio(op.latitude, op.longitude);

        // Decode base64 photo
        const base64Data = op.photo_base64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const filename = `${randomUUID()}.jpg`;

        let photoUrl: string;
        if (this.storageService.isConfigured()) {
          photoUrl = await this.storageService.uploadOperation(buffer, filename, 'image/jpeg');
        } else {
          const filepath = path.join(this.uploadsDir, filename);
          fs.writeFileSync(filepath, buffer as any);
          photoUrl = `/uploads/operations/${filename}`;
        }

        try {
          // Validação por usuário (mesma regra do createOperation)
          if (createdByUserId) {
            const lastOp = await this.prisma.check_operations.findFirst({
              where: { created_by_user_id: createdByUserId },
              orderBy: [{ operation_datetime: 'desc' }, { created_at: 'desc' }],
            });

            // Pendência antiga não pode sobrescrever estado atual do usuário.
            // Marcamos como "sucesso ignorado" para limpar fila local e evitar loop.
            if (
              lastOp &&
              operationDateTime.getTime() < lastOp.operation_datetime.getTime()
            ) {
              synced++;
              results.push({
                success: true,
                id: lastOp.id,
                ignored_stale: true,
              });
              this.logger.warn(
                `Ignored stale operation during sync (incoming=${op.operation_datetime}, latest=${lastOp.operation_datetime.toISOString()})`,
              );
              continue;
            }

            if (op.operation_type === OperationType.checkin && lastOp?.operation_type === OperationType.checkin) {
              throw new BadRequestException('Já existe abertura em aberto para este usuário');
            }
            if (op.operation_type === OperationType.checkout && lastOp?.operation_type !== OperationType.checkin) {
              throw new BadRequestException('Não há abertura em aberto para fechar');
            }
            if (
              op.operation_type === OperationType.checkout &&
              lastOp?.operation_type === OperationType.checkin &&
              Number(op.horimeter) <= Number(lastOp.horimeter)
            ) {
              throw new BadRequestException('O horímetro do fechamento deve ser maior que o da abertura');
            }
          }

          const operation = await this.prisma.check_operations.create({
            data: {
              contract_id: op.contract_id,
              equipment_type_id: op.equipment_type_id,
              ativo_placa: op.ativo_placa,
              operation_type: op.operation_type,
              horimeter: op.horimeter,
              photo_url: photoUrl,
              latitude: op.latitude,
              longitude: op.longitude,
              municipio: municipio ?? `${op.latitude}, ${op.longitude}`,
              observation: op.observation,
              device_id: op.device_id,
              operation_datetime: new Date(op.operation_datetime),
              synced: true,
              created_by_user_id: createdByUserId ?? undefined,
            },
          });

          synced++;
          results.push({ success: true, id: operation.id });
          this.logger.log(`Synced operation with ID: ${operation.id}`);
        } catch (dbError) {
          // If DB fails and we saved to disk (not bucket), delete the file
          if (!this.storageService.isConfigured()) {
            const filepath = path.join(this.uploadsDir, filename);
            if (fs.existsSync(filepath)) {
              fs.unlinkSync(filepath);
              this.logger.warn(`Deleted orphaned file ${filepath} due to DB error`);
            }
          }
          throw dbError;
        }
      } catch (error) {
        failed++;
        results.push({ success: false, error: error.message });
        this.logger.error('Error syncing operation', error);
      }
    }

    return { synced, failed, results };
  }

  /**
   * Exclui as operações cujos IDs forem informados (ex.: selecionadas no BI).
   * Retorna quantas foram excluídas.
   */
  async deleteMany(ids: string[]): Promise<{ deleted: number }> {
    if (!ids.length) {
      return { deleted: 0 };
    }
    const result = await this.prisma.check_operations.deleteMany({
      where: { id: { in: ids } },
    });
    this.logger.log(`Deleted ${result.count} operations: ${ids.join(', ')}`);
    return { deleted: result.count };
  }

  async updateOperation(id: string, dto: UpdateOperationDto) {
    const existing = await this.prisma.check_operations.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Operação não encontrada');
    }

    const data: {
      operation_datetime?: Date;
      horimeter?: number;
      observation?: string | null;
    } = {};

    if (dto.operation_datetime !== undefined) {
      data.operation_datetime = new Date(dto.operation_datetime);
    }
    if (dto.horimeter !== undefined) {
      data.horimeter = dto.horimeter;
    }
    if (dto.observation !== undefined) {
      data.observation = dto.observation?.trim() ? dto.observation.trim() : null;
    }

    const updated = await this.prisma.check_operations.update({
      where: { id },
      data,
      include: this.operationInclude,
    });

    this.logger.log(`Updated operation ${id}`);
    return this.mapOperationWithUserName(updated);
  }
}
