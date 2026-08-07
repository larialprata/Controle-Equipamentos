import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

const JwtAuthGuard = AuthGuard('jwt');

/**
 * Igual ao AuthGuard, mas não dispara 401 quando não há token.
 * Coloca req.user = null quando não autenticado, para o handler decidir.
 */
@Injectable()
export class OptionalAuthGuard extends JwtAuthGuard {
  handleRequest<TUser>(err: Error | null, user: TUser | false, _info: unknown, context: ExecutionContext): TUser | null {
    const request = context.switchToHttp().getRequest();
    if (err || !user) {
      request.user = null;
      return null;
    }
    return user as TUser;
  }
}
