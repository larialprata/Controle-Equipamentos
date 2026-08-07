import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { operationPhotoMulterOptions } from '../common/multer-image.options';
import { EquipmentsService } from '../equipments/equipments.service';
import { CheckOperationsService } from './check-operations.service';
import { CreateOperationDto } from './dto/create-operation.dto';
import { StripPhotoFromBodyInterceptor } from './strip-photo-from-body.interceptor';

const operationPhotoInterceptor = FileInterceptor('photo', operationPhotoMulterOptions);

@ApiTags('Public Movimentações')
@Controller('api/public/movimentacoes')
export class PublicMovimentacoesController {
  private readonly logger = new Logger(PublicMovimentacoesController.name);

  constructor(
    private readonly equipmentsService: EquipmentsService,
    private readonly checkOperationsService: CheckOperationsService,
  ) {}

  @Get('equipamento/:qrCode')
  @ApiOperation({ summary: 'Resolve equipamento pelo QR (sem autenticação)' })
  @ApiResponse({ status: 200, description: 'Equipamento encontrado' })
  async getEquipmentByQr(@Param('qrCode') qrCode: string) {
    this.logger.log(`GET /api/public/movimentacoes/equipamento/${qrCode}`);
    const equipment = await this.equipmentsService.findByQrCodePublic(qrCode);
    return { equipment };
  }

  @Get('contexto/:qrCode')
  @ApiOperation({ summary: 'Equipamento + abertura em aberto em uma única chamada' })
  async getMovimentacaoContext(@Param('qrCode') qrCode: string) {
    this.logger.log(`GET /api/public/movimentacoes/contexto/${qrCode}`);
    const equipment = await this.equipmentsService.findByQrCodePublic(qrCode);
    const openCheckin = await this.checkOperationsService.resolveOpenCheckinForAsset({
      contractId: equipment.contract_id!,
      equipmentTypeId: equipment.equipment_type_id!,
      ativoPlaca: equipment.ativo_placa!,
      operationDate: new Date(),
    });
    return { equipment, openCheckin };
  }

  @Get('open-checkin')
  @ApiOperation({ summary: 'Abertura em aberto do ativo na data (sem autenticação)' })
  async getOpenCheckinForAsset(
    @Query('contractId') contractId?: string,
    @Query('equipmentTypeId') equipmentTypeId?: string,
    @Query('ativoPlaca') ativoPlaca?: string,
    @Query('date') date?: string,
  ) {
    if (!contractId || !equipmentTypeId || !ativoPlaca || !date) {
      throw new BadRequestException('contractId, equipmentTypeId, ativoPlaca e date são obrigatórios');
    }

    return this.checkOperationsService.findOpenCheckinForAssetOnDate({
      contractId,
      equipmentTypeId,
      ativoPlaca,
      operationDate: date,
    });
  }

  @Post()
  @ApiOperation({ summary: 'Registrar abertura/fechamento via QR (sem autenticação)' })
  @UseInterceptors(operationPhotoInterceptor, StripPhotoFromBodyInterceptor)
  async createGuestOperation(@Body() dto: CreateOperationDto, @UploadedFile() photo: Express.Multer.File) {
    this.logger.log('POST /api/public/movimentacoes');

    if (!photo) {
      throw new BadRequestException('Photo is required');
    }

    const operation = await this.checkOperationsService.createGuestOperation(dto, photo);
    return {
      id: operation.id,
      message: 'Operação registrada com sucesso',
      operation,
    };
  }
}
