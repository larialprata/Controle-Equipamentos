import { Body, Controller, Get, Logger, Param, Patch, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import type { Request } from 'express';
import { Admin } from '../auth/decorators/admin.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractStatusDto } from './dto/update-contract-status.dto';

@ApiTags('Contracts')
@Controller('api/contracts')
export class ContractsController {
  private readonly logger = new Logger(ContractsController.name);

  constructor(private readonly contractsService: ContractsService) {}

  @Post()
  @Admin()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cadastra um novo contrato (admin)' })
  @ApiResponse({ status: 201, description: 'Contrato cadastrado com sucesso' })
  async createContract(@Body() dto: CreateContractDto) {
    this.logger.log('POST /api/contracts');
    const contract = await this.contractsService.create(dto);
    return {
      message: 'Contrato cadastrado com sucesso.',
      contract,
    };
  }

  @Patch(':contractId/status')
  @Admin()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualiza status de um contrato (apenas admin)' })
  @ApiParam({ name: 'contractId', description: 'UUID do contrato' })
  @ApiResponse({ status: 200, description: 'Status do contrato atualizado' })
  async updateContractStatus(
    @Param('contractId') contractId: string,
    @Body() dto: UpdateContractStatusDto,
  ) {
    this.logger.log(`PATCH /api/contracts/${contractId}/status`);
    const contract = await this.contractsService.updateStatus(contractId, dto.active);
    return {
      message: `Contrato ${dto.active ? 'ativado' : 'desativado'} com sucesso.`,
      contract,
    };
  }

  @Get()
  @UseGuards(OptionalAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lista contratos. Com ?mine=true e token: só o contrato vinculado ao operador autenticado.' })
  @ApiQuery({ name: 'mine', required: false, description: 'Se true e usuário autenticado, retorna só o contrato do usuário' })
  @ApiResponse({ status: 200, description: 'Lista de contratos (todos ou só o do usuário)' })
  async getContracts(
    @Query('mine') mine: string | undefined,
    @Req() req: Request & { user?: { id: string } | null },
  ) {
    if (mine === 'true' || mine === '1') {
      if (!req.user) {
        throw new UnauthorizedException('Envie o token para usar ?mine=true');
      }
      this.logger.log('GET /api/contracts?mine=true');
      const contract = await this.contractsService.findMyContract(req.user.id);
      return { contracts: contract ? [contract] : [] };
    }
    this.logger.log('GET /api/contracts');
    const contracts = await this.contractsService.findAllActive();
    return { contracts };
  }

  @Get('my-contract')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Contrato vinculado ao usuário logado para uso na tela de movimentações' })
  @ApiResponse({ status: 200, description: 'Retorna o contrato do usuário ou contract: null se não tiver vínculo' })
  async getMyContract(@Req() req: Request & { user: { id: string } }) {
    this.logger.log('GET /api/contracts/my-contract');
    const contract = await this.contractsService.findMyContract(req.user.id);
    return { contract };
  }

  @Get(':contractId/obras')
  @ApiOperation({ summary: 'Lista obras do contrato (ATA → 242-247, Limpa Rio → 232, ECO Barreira → 229)' })
  @ApiParam({ name: 'contractId', description: 'UUID do contrato' })
  @ApiResponse({ status: 200, description: 'Lista de obras ativas do contrato' })
  async getObrasByContract(@Param('contractId') contractId: string) {
    const obras = await this.contractsService.findObrasByContract(contractId);
    return { obras };
  }
}
