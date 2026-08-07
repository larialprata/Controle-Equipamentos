import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiUnauthorizedResponse, ApiForbiddenResponse } from '@nestjs/swagger';
import { AuthGuard } from '../guards/auth.guard';
import { AdminGuard } from '../guards/admin.guard';

export function Admin() {
  return applyDecorators(
    UseGuards(AuthGuard, AdminGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Usuário não autenticado' }),
    ApiForbiddenResponse({ description: 'Acesso negado. Apenas administradores' }),
  );
}
