import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Res,
  Req,
  UseGuards,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import type { Request } from 'express';
import { join } from 'path';
import { existsSync } from 'fs';
import { UsersService } from './users.service';
import { Admin } from '../auth/decorators/admin.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateOperatorDto } from './dto/create-operator.dto';

const DOCUMENTS_DIR = join(process.cwd(), 'uploads', 'documents');

@ApiTags('Users')
@Controller('api/users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Admin()
  @ApiOperation({ summary: 'List all users (Admin only)' })
  @ApiResponse({ status: 200, description: 'Lista de usuários' })
  async listUsers() {
    this.logger.log('GET /api/users');
    const users = await this.usersService.findAll();
    return {
      message: 'Lista de usuários',
      users,
    };
  }

  @Post()
  @Admin()
  @ApiOperation({ summary: 'Cadastrar operador web com nome, CPF e senha' })
  @ApiResponse({ status: 201, description: 'Operador cadastrado com sucesso' })
  @ApiResponse({ status: 409, description: 'CPF já cadastrado' })
  async createOperator(@Body() dto: CreateOperatorDto) {
    this.logger.log('POST /api/users');
    const user = await this.usersService.createOperator(dto);
    return {
      message: 'Operador cadastrado com sucesso.',
      user,
    };
  }

  @Get('document/:filename')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user document (CNH) photo by filename' })
  @ApiParam({ name: 'filename', description: 'Document filename (e.g. uuid.jpg)' })
  @ApiResponse({ status: 200, description: 'Arquivo da foto do documento' })
  @ApiResponse({ status: 400, description: 'Filename inválido' })
  @ApiResponse({ status: 403, description: 'Sem permissão para este documento' })
  @ApiResponse({ status: 404, description: 'Documento não encontrado' })
  async getDocumentPhoto(
    @Req() req: Request & { user: { id: string; is_admin: boolean; cnh_photo: string } },
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    this.logger.log(`GET /api/users/document/${filename}`);

    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new BadRequestException('Filename inválido');
    }

    if (!req.user.is_admin) {
      const allowedName = req.user.cnh_photo?.split('/').pop()?.split('?')[0];
      if (!allowedName || allowedName !== filename) {
        throw new ForbiddenException('Sem permissão para este documento');
      }
    }

    const filepath = join(DOCUMENTS_DIR, filename);

    if (!existsSync(filepath)) {
      const isExpectedPlaceholder = filename === 'admin-placeholder.jpg';
      if (!isExpectedPlaceholder) {
        this.logger.warn(`Documento não encontrado: ${filename}. Retornando placeholder.`);
      }
      const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200"><rect width="320" height="200" fill="#e5e7eb"/><circle cx="160" cy="78" r="28" fill="#9ca3af"/><rect x="104" y="120" width="112" height="44" rx="8" fill="#9ca3af"/><text x="160" y="185" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#4b5563">Sem documento</text></svg>`;
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      return res.status(200).send(placeholderSvg);
    }

    return res.sendFile(filepath);
  }

  @Patch(':id/toggle-status')
  @Admin()
  @ApiOperation({ summary: 'Toggle user active status (Admin only)' })
  @ApiParam({ name: 'id', description: 'User ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Status do usuário atualizado' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  async toggleUserStatus(@Param('id') id: string) {
    this.logger.log(`PATCH /api/users/${id}/toggle-status`);
    const user = await this.usersService.toggleUserStatus(id);
    return {
      message: `Usuário ${user.is_active ? 'ativado' : 'desativado'} com sucesso`,
      user,
    };
  }

  @Patch(':id')
  @Admin()
  @ApiOperation({ summary: 'Atualizar usuário (ex.: dar permissão de admin). Body: is_admin e/ou is_active.' })
  @ApiParam({ name: 'id', description: 'User ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Usuário atualizado' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  async updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    this.logger.log(`PATCH /api/users/${id}`);
    const result = await this.usersService.updateUser(id, dto);
    return {
      message: result.message,
      user: result.user,
    };
  }

  @Delete(':id')
  @Admin()
  @ApiOperation({ summary: 'Excluir usuário (Admin only)' })
  @ApiParam({ name: 'id', description: 'User ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Usuário excluído com sucesso' })
  @ApiResponse({ status: 400, description: 'Não é permitido excluir o próprio usuário' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  async deleteUser(
    @Req() req: Request & { user: { id: string } },
    @Param('id') id: string,
  ) {
    this.logger.log(`DELETE /api/users/${id}`);
    return this.usersService.deleteUser(id, req.user.id);
  }

  @Get(':id')
  @Admin()
  @ApiOperation({ summary: 'Get user by ID (Admin only)' })
  @ApiParam({ name: 'id', description: 'User ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Usuário encontrado' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  async getUser(@Param('id') id: string) {
    this.logger.log(`GET /api/users/${id}`);
    const user = await this.usersService.findOne(id);
    return {
      message: 'Usuário encontrado',
      user,
    };
  }
}
