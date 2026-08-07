import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { Request } from 'express';
import { operationPhotoMulterOptions } from '../common/multer-image.options';
import { join } from 'path';
import { existsSync } from 'fs';

const OPERATIONS_DIR = join(process.cwd(), 'uploads', 'operations');
import { AuthGuard } from '../auth/guards/auth.guard';
import { Admin } from '../auth/decorators/admin.decorator';
import { CheckOperationsService } from './check-operations.service';
import { CreateOperationDto } from './dto/create-operation.dto';
import { SyncOperationsDto } from './dto/sync-operations.dto';
import { DeleteOperationsDto } from './dto/delete-operations.dto';
import { UpdateOperationDto } from './dto/update-operation.dto';
import { StripPhotoFromBodyInterceptor } from './strip-photo-from-body.interceptor';

type AuthUser = {
  id: string;
  is_admin: boolean;
  contract_id: string | null;
};

@ApiTags('Check Operations')
@Controller('api/check-operations')
export class CheckOperationsController {
  private readonly logger = new Logger(CheckOperationsController.name);

  constructor(private readonly checkOperationsService: CheckOperationsService) {}

  private assertCanAccessContract(user: AuthUser, contractId: string): void {
    if (user.is_admin) {
      return;
    }
    if (user.contract_id === contractId) {
      return;
    }
    throw new ForbiddenException('Sem permissão para acessar operações deste contrato');
  }

  private assertCanAccessOperation(
    user: AuthUser,
    op: { contract_id: string; created_by_user_id: string | null },
  ): void {
    if (user.is_admin) {
      return;
    }
    if (op.created_by_user_id === user.id) {
      return;
    }
    if (user.contract_id && op.contract_id === user.contract_id) {
      return;
    }
    throw new ForbiddenException('Sem permissão para acessar esta operação');
  }

  @Get()
  @Admin()
  @ApiOperation({ summary: 'Lista todas as operações (apenas admin)' })
  @ApiResponse({ status: 200, description: 'List of all operations' })
  @ApiResponse({ status: 403, description: 'Apenas administradores' })
  async getAllOperations() {
    this.logger.log('GET /api/check-operations');
    return this.checkOperationsService.findAll();
  }

  @Get('contract/:contractId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Operações por contrato. Admin vê qualquer contrato; operador só o contrato vinculado ao usuário.',
  })
  @ApiParam({ name: 'contractId', description: 'Contract UUID' })
  @ApiResponse({ status: 200, description: 'Operations for that contract' })
  @ApiResponse({ status: 403, description: 'Sem permissão para este contrato' })
  async getOperationsByContract(
    @Req() req: Request & { user: AuthUser },
    @Param('contractId') contractId: string,
    @Query('equipmentTypeId') equipmentTypeId?: string,
    @Query('ativoPlaca') ativoPlaca?: string,
  ) {
    this.assertCanAccessContract(req.user, contractId);
    this.logger.log(`GET /api/check-operations/contract/${contractId}`, {
      equipmentTypeId: equipmentTypeId ?? '-',
      ativoPlaca: ativoPlaca ?? '-',
    });
    const filters =
      equipmentTypeId || ativoPlaca
        ? { equipmentTypeId, ativoPlaca }
        : undefined;
    return this.checkOperationsService.findByContract(contractId, filters);
  }

  @Get('last-checkin')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Último checkin em aberto do usuário logado — use para preencher o formulário de checkout (por conta, não por dispositivo)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Dados do último checkin (contract_id, equipment_type_id, ativo_placa, horimeter, etc.) ou null se não houver abertura em aberto',
  })
  async getLastCheckinForCheckout(@Req() req: Request & { user: { id: string } }) {
    this.logger.log('GET /api/check-operations/last-checkin');
    const lastCheckin = await this.checkOperationsService.findLastCheckinByUser(req.user.id);
    return lastCheckin;
  }

  @Get('open-checkin')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Verifica se existe abertura em aberto para o ativo informado na data atual/operação do usuário logado',
  })
  @ApiResponse({
    status: 200,
    description:
      'Retorna a abertura em aberto do ativo para a data consultada ou null se não houver pendência',
  })
  async getOpenCheckinForAsset(
    @Req() req: Request & { user: AuthUser },
    @Query('contractId') contractId?: string,
    @Query('equipmentTypeId') equipmentTypeId?: string,
    @Query('ativoPlaca') ativoPlaca?: string,
    @Query('date') date?: string,
  ) {
    if (!contractId || !equipmentTypeId || !ativoPlaca || !date) {
      throw new BadRequestException('contractId, equipmentTypeId, ativoPlaca e date são obrigatórios');
    }

    this.assertCanAccessContract(req.user, contractId);
    this.logger.log('GET /api/check-operations/open-checkin', {
      contractId,
      equipmentTypeId,
      ativoPlaca,
      date,
    });

    return this.checkOperationsService.findOpenCheckinForUserAssetOnDate({
      userId: req.user.id,
      contractId,
      equipmentTypeId,
      ativoPlaca,
      operationDate: date,
    });
  }

  @Get('photo/:filename')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Foto da operação pelo nome do arquivo (autenticado)' })
  @ApiParam({ name: 'filename', description: 'Photo filename', example: 'a1b2c3d4-e5f6.jpg' })
  @ApiResponse({ status: 200, description: 'Photo file' })
  @ApiResponse({ status: 404, description: 'Photo not found' })
  async getPhoto(
    @Req() req: Request & { user: AuthUser },
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    this.logger.log(`GET /api/check-operations/photo/${filename}`);
    const operation = await this.checkOperationsService.findByPhotoFilename(filename);
    if (!operation) {
      throw new NotFoundException('Photo not found');
    }
    this.assertCanAccessOperation(req.user, {
      contract_id: operation.contract_id,
      created_by_user_id: operation.created_by_user_id,
    });
    const filepath = join(OPERATIONS_DIR, filename);
    if (!existsSync(filepath)) {
      throw new NotFoundException('Photo not found');
    }
    return res.sendFile(filepath);
  }

  @Get(':id/photo')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Redireciona ou envia a foto da operação (autenticado).',
  })
  @ApiParam({ name: 'id', description: 'Operation UUID' })
  @ApiResponse({ status: 302, description: 'Redirect to photo URL (Supabase or local)' })
  @ApiResponse({ status: 404, description: 'Operation not found' })
  async getPhotoByOperationId(
    @Req() req: Request & { user: AuthUser },
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    this.logger.log(`GET /api/check-operations/${id}/photo`);
    const operation = await this.checkOperationsService.findOne(id);
    if (!operation) {
      throw new NotFoundException('Operação não encontrada');
    }
    this.assertCanAccessOperation(req.user, {
      contract_id: operation.contract_id,
      created_by_user_id: operation.created_by_user_id,
    });
    const photoUrl = operation.photo_url;
    if (photoUrl.startsWith('http')) {
      return res.redirect(302, photoUrl);
    }
    const basename = photoUrl.replace(/^.*\//, '');
    if (
      !basename ||
      basename.includes('..') ||
      basename.includes('/') ||
      basename.includes('\\')
    ) {
      throw new NotFoundException('Foto não encontrada');
    }
    const filepath = join(OPERATIONS_DIR, basename);
    if (!existsSync(filepath)) {
      throw new NotFoundException('Foto não encontrada');
    }
    return res.sendFile(filepath);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Uma operação por ID (autenticado)' })
  @ApiParam({ name: 'id', description: 'Operation UUID' })
  @ApiResponse({ status: 200, description: 'Operation with photo_url (full URL if in bucket)' })
  @ApiResponse({ status: 404, description: 'Operation not found' })
  async getOperationById(@Req() req: Request & { user: AuthUser }, @Param('id') id: string) {
    this.logger.log(`GET /api/check-operations/${id}`);
    const operation = await this.checkOperationsService.findOne(id);
    if (!operation) {
      throw new NotFoundException('Operação não encontrada');
    }
    this.assertCanAccessOperation(req.user, {
      contract_id: operation.contract_id,
      created_by_user_id: operation.created_by_user_id,
    });
    return operation;
  }

  @Post()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create new check-in/check-out operation (logged user is saved as creator)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        contract_id: { type: 'string' },
        equipment_type_id: { type: 'string', description: 'UUID do tipo (GET /api/equipment-types)' },
        ativo_placa: { type: 'string', description: 'Ativo ou placa digitado pelo usuário' },
        operation_type: { type: 'string', enum: ['checkin', 'checkout'] },
        horimeter: { type: 'number' },
        latitude: { type: 'number' },
        longitude: { type: 'number' },
        operation_datetime: { type: 'string', format: 'date-time' },
        photo: { type: 'string', format: 'binary' },
        observation: { type: 'string', nullable: true },
        device_id: { type: 'string', nullable: false },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Operation created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @UseInterceptors(FileInterceptor('photo', operationPhotoMulterOptions), StripPhotoFromBodyInterceptor)
  async createOperation(
    @Req() req: Request & { user: AuthUser },
    @Body() dto: CreateOperationDto,
    @UploadedFile() photo: Express.Multer.File,
  ) {
    this.logger.log('POST /api/check-operations');

    if (!photo) {
      throw new BadRequestException('Photo is required');
    }

    this.assertCanAccessContract(req.user, dto.contract_id);
    const userId = req.user?.id;
    const operation = await this.checkOperationsService.createOperation(dto, photo, userId);

    return {
      id: operation.id,
      message: 'Operação registrada com sucesso',
      operation,
    };
  }

  @Post('sync')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sync multiple queued operations (logged user is saved as creator)' })
  @ApiResponse({ status: 200, description: 'Operations synced' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async syncOperations(
    @Req() req: Request & { user: AuthUser },
    @Body() dto: SyncOperationsDto,
  ) {
    this.logger.log(`POST /api/check-operations/sync - Syncing ${dto.operations.length} operations`);
    for (const operation of dto.operations) {
      this.assertCanAccessContract(req.user, operation.contract_id);
    }
    const userId = req.user?.id;
    const result = await this.checkOperationsService.syncOperations(dto.operations, userId);
    return result;
  }

  @Patch(':id')
  @Admin()
  @ApiOperation({ summary: 'Atualizar uma operação por ID (BI). Apenas admin.' })
  @ApiParam({ name: 'id', description: 'UUID da operação' })
  @ApiConsumes('application/json')
  @ApiBody({ type: UpdateOperationDto })
  @ApiResponse({ status: 200, description: 'Operação atualizada' })
  @ApiResponse({ status: 404, description: 'Operação não encontrada' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Apenas administradores' })
  async updateOperationById(@Param('id') id: string, @Body() dto: UpdateOperationDto) {
    this.logger.log(`PATCH /api/check-operations/${id}`);
    return this.checkOperationsService.updateOperation(id, dto);
  }

  @Delete(':id')
  @Admin()
  @ApiOperation({ summary: 'Excluir uma operação por ID (BI). Apenas admin.' })
  @ApiParam({ name: 'id', description: 'UUID da operação' })
  @ApiResponse({ status: 200, description: 'Operação excluída' })
  @ApiResponse({ status: 404, description: 'Operação não encontrada' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Apenas administradores' })
  async deleteOperationById(@Param('id') id: string) {
    this.logger.log(`DELETE /api/check-operations/${id}`);
    const result = await this.checkOperationsService.deleteMany([id]);
    if (result.deleted === 0) {
      throw new NotFoundException('Operação não encontrada');
    }
    return {
      message: 'Operação excluída.',
      deleted: result.deleted,
    };
  }

  @Delete()
  @Admin()
  @ApiOperation({ summary: 'Excluir operações em lote (body com ids). Apenas admin.' })
  @ApiConsumes('application/json')
  @ApiBody({ type: DeleteOperationsDto })
  @ApiResponse({ status: 200, description: 'Quantidade de operações excluídas' })
  @ApiResponse({ status: 400, description: 'ids inválidos ou vazios' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Apenas administradores' })
  async deleteOperations(@Body() dto: DeleteOperationsDto) {
    this.logger.log(`DELETE /api/check-operations - Deleting ${dto.ids.length} operations`);
    const result = await this.checkOperationsService.deleteMany(dto.ids);
    return {
      message: `${result.deleted} operação(ões) excluída(s).`,
      deleted: result.deleted,
    };
  }
}
