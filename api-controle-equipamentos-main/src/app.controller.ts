import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return `Hello World!`;
  }

  /** Navegadores pedem /favicon.ico automaticamente; sem rota vira 404 e polui logs. */
  @Get('favicon.ico')
  favicon(@Res() res: Response): void {
    res.status(204).end();
  }

  @Get()
  redirectToApiDocs(@Res() res: Response): void {
    res.redirect('/api-docs');
  }
}
