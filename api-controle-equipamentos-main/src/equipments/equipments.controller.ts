import { Body, Controller, Delete, Get, Logger, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { Admin } from '../auth/decorators/admin.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { EquipmentsService } from './equipments.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';

@ApiTags('Equipments')
@Controller('api/equipments')
export class EquipmentsController {
  private readonly logger = new Logger(EquipmentsController.name);

  constructor(private readonly equipmentsService: EquipmentsService) {}

  @Get()
  @Admin()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lista equipamentos operacionais cadastrados (admin)' })
  @ApiResponse({ status: 200, description: 'Lista de equipamentos' })
  async getEquipments() {
    this.logger.log('GET /api/equipments');
    const equipments = await this.equipmentsService.findAllActive();
    return { equipments };
  }

  @Post()
  @Admin()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cadastrar vínculo operacional e gerar QR por ativo (admin)' })
  @ApiResponse({ status: 201, description: 'Equipamento cadastrado com sucesso' })
  async createEquipment(@Body() dto: CreateEquipmentDto) {
    this.logger.log('POST /api/equipments');
    const equipment = await this.equipmentsService.create(dto);
    return {
      message: 'Equipamento cadastrado com sucesso.',
      equipment,
    };
  }

  @Patch(':id')
  @Admin()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar vínculo operacional do equipamento (admin)' })
  @ApiParam({ name: 'id', description: 'UUID do equipamento' })
  @ApiResponse({ status: 200, description: 'Equipamento atualizado' })
  async updateEquipment(@Param('id') id: string, @Body() dto: UpdateEquipmentDto) {
    this.logger.log(`PATCH /api/equipments/${id}`);
    const equipment = await this.equipmentsService.update(id, dto);
    return {
      message: 'Equipamento atualizado com sucesso.',
      equipment,
    };
  }

  @Post(':id/regenerate-qr')
  @Admin()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gerar novo QR code para o equipamento (admin)' })
  @ApiParam({ name: 'id', description: 'UUID do equipamento' })
  @ApiResponse({ status: 200, description: 'Novo QR gerado' })
  async regenerateEquipmentQr(@Param('id') id: string) {
    this.logger.log(`POST /api/equipments/${id}/regenerate-qr`);
    const equipment = await this.equipmentsService.regenerateQr(id);
    return {
      message: 'Novo QR code gerado com sucesso. O QR anterior deixa de funcionar.',
      equipment,
    };
  }

  @Delete(':id')
  @Admin()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Excluir equipamento (desativa o vínculo) (admin)' })
  @ApiParam({ name: 'id', description: 'UUID do equipamento' })
  @ApiResponse({ status: 200, description: 'Equipamento excluído' })
  async deleteEquipment(@Param('id') id: string) {
    this.logger.log(`DELETE /api/equipments/${id}`);
    return this.equipmentsService.remove(id);
  }

  @Get('contract/:contractId')
  @Admin()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lista equipamentos do contrato (tabela legada)' })
  @ApiParam({ name: 'contractId', description: 'UUID do contrato' })
  @ApiResponse({ status: 200, description: 'Lista de equipamentos' })
  async getEquipmentsByContract(@Param('contractId') contractId: string) {
    this.logger.log(`GET /api/equipments/contract/${contractId}`);
    const equipments = await this.equipmentsService.findByContract(contractId);
    return { equipments };
  }

  @Get('qr/:qrCode')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resolve o QR code do ativo e retorna contrato, equipamento e ativo' })
  @ApiParam({ name: 'qrCode', description: 'Valor lido no QR code' })
  async getEquipmentByQrCode(
    @Req() req: Request & { user: { id: string } },
    @Param('qrCode') qrCode: string,
  ) {
    this.logger.log(`GET /api/equipments/qr/${qrCode}`);
    const equipment = await this.equipmentsService.findByQrCode(qrCode, req.user.id);
    return { equipment };
  }
}
