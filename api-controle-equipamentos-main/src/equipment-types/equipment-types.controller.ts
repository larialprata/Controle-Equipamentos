import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { EquipmentTypesService } from './equipment-types.service';

@ApiTags('Equipment Types')
@Controller('api/equipment-types')
export class EquipmentTypesController {
  constructor(private readonly service: EquipmentTypesService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista tipos de equipamento (um por nome). Mobile: usuário seleciona um; o ativo/placa é digitado em campo livre.',
  })
  @ApiQuery({ name: 'contractId', required: false })
  @ApiQuery({ name: 'obraId', required: false })
  async getTypes(
    @Query('contractId') contractId?: string,
    @Query('obraId') obraId?: string,
  ) {
    const filters =
      contractId || obraId ? { contractId, obraId } : undefined;
    return this.service.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Um tipo por ID' })
  @ApiParam({ name: 'id', description: 'UUID do tipo' })
  async getOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
}
