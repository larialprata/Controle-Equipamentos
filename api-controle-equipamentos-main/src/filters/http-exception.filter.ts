import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { MulterError } from 'multer';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | object =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    if (exception instanceof MulterError) {
      if (exception.code === 'LIMIT_FILE_SIZE') {
        status = HttpStatus.PAYLOAD_TOO_LARGE;
        message = 'Arquivo muito grande. O limite é 10 MB.';
      } else {
        status = HttpStatus.BAD_REQUEST;
        message = exception.message || 'Erro no envio do arquivo.';
      }
    } else if (exception instanceof Error && !(exception instanceof HttpException)) {
      const path = request.url || '';
      if (path.includes('/horimeter/') || path.includes('/movimentacoes') || path.includes('/check-operations')) {
        status = HttpStatus.BAD_REQUEST;
        message = exception.message || 'Erro no envio do arquivo.';
      }
    }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: typeof message === 'string' ? message : (message as any).message || message,
    };

    this.logger.error(
      `${request.method} ${request.url} - Status: ${status} - Error: ${JSON.stringify(errorResponse.message)}`,
      exception instanceof Error ? exception.stack : '',
    );

    response.status(status).json(errorResponse);
  }
}
