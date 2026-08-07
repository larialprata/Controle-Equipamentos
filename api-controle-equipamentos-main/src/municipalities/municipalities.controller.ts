import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/guards/auth.guard';
import { MunicipalitiesService } from './municipalities.service';
import { CreateMunicipalityDto } from './dto/create-municipality.dto';
import { UpdateMunicipalityDto } from './dto/update-municipality.dto';

@ApiTags('Municipalities')
@Controller('api/municipalities')
export class MunicipalitiesController {
  constructor(private readonly service: MunicipalitiesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista municípios por obra. Use ?obraId=UUID' })
  @ApiQuery({ name: 'obraId', required: true, description: 'UUID da obra' })
  @ApiResponse({ status: 200, description: 'Lista de municípios da obra' })
  async getByObra(@Query('obraId') obraId: string) {
    return this.service.findByObra(obraId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retorna um município por ID' })
  @ApiParam({ name: 'id', description: 'UUID do município' })
  @ApiResponse({ status: 200, description: 'Município com obra' })
  @ApiResponse({ status: 404, description: 'Município não encontrado' })
  async getOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cria um município vinculado a uma obra' })
  @ApiResponse({ status: 201, description: 'Município criado' })
  @ApiResponse({ status: 400, description: 'Obra não encontrada' })
  async create(@Body() dto: CreateMunicipalityDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualiza um município' })
  @ApiParam({ name: 'id', description: 'UUID do município' })
  @ApiResponse({ status: 200, description: 'Município atualizado' })
  async update(@Param('id') id: string, @Body() dto: UpdateMunicipalityDto) {
    return this.service.update(id, dto);
  }
}
