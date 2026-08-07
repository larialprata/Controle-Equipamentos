import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Request } from 'express';

/**
 * Remove do req.body qualquer campo que seja arquivo (photo, file, ou o que vier em req.files).
 * Assim o ValidationPipe global (forbidNonWhitelisted: true) não dispara "property X should not exist".
 */
@Injectable()
export class StripPhotoFromBodyInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { files?: Express.Multer.File[] }>();
    if (req.body && typeof req.body === 'object') {
      delete req.body.photo;
      delete req.body.file;
      if (Array.isArray(req.files)) {
        req.files.forEach((f) => {
          if (f.fieldname) delete req.body[f.fieldname];
        });
      }
    }
    return next.handle();
  }
}
