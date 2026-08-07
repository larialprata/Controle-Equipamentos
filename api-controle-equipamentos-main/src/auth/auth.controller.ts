import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { AuthService } from './auth.service';
import { StorageService } from '../storage/storage.service';
import { UsersService } from '../users/users.service';
import { AuthGuard } from './guards/auth.guard';
import { Admin } from './decorators/admin.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateUserDto } from '../users/dto/update-user.dto';

const DOCUMENTS_DIR = join(process.cwd(), 'uploads', 'documents');

@ApiTags('Auth')
@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly storageService: StorageService,
    private readonly usersService: UsersService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user with CNH photo (inactive by default)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['full_name', 'phone', 'cpf', 'email', 'address', 'password', 'cnh_photo'],
      properties: {
        full_name: { type: 'string' },
        phone: { type: 'string' },
        cpf: { type: 'string' },
        email: { type: 'string', format: 'email' },
        address: { type: 'string' },
        password: { type: 'string', minLength: 6 },
        cnh_photo: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Validation error or missing CNH photo' })
  @ApiResponse({ status: 409, description: 'Email or CPF already registered' })
  @UseInterceptors(
    FileInterceptor('cnh_photo', {
      storage: memoryStorage(),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png)$/)) {
          return cb(
            new BadRequestException('Apenas imagens (jpg, jpeg, png) são permitidas para a CNH'),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  async register(
    @Body() body: RegisterDto,
    @UploadedFile() cnhPhoto: Express.Multer.File,
  ) {
    if (!cnhPhoto) {
      throw new BadRequestException('A foto da CNH é obrigatória');
    }

    const filename = `${randomUUID()}${extname(cnhPhoto.originalname)}`;
    let cnhPhotoUrl: string;

    if (this.storageService.isConfigured()) {
      cnhPhotoUrl = await this.storageService.uploadCnh(
        cnhPhoto.buffer,
        filename,
        cnhPhoto.mimetype,
      );
    } else {
      if (!existsSync(DOCUMENTS_DIR)) {
        mkdirSync(DOCUMENTS_DIR, { recursive: true });
      }
      const filepath = join(DOCUMENTS_DIR, filename);
      writeFileSync(filepath, cnhPhoto.buffer);
      cnhPhotoUrl = `/uploads/documents/${filename}`;
    }

    const user = await this.authService.register(body, cnhPhotoUrl);

    return {
      message: 'Usuário cadastrado com sucesso. Aguarde ativação.',
      user,
    };
  }

  @Post('login')
  @ApiOperation({ summary: 'Authenticate user with nome, CPF ou e-mail e senha' })
  @ApiResponse({ status: 201, description: 'User authenticated successfully' })
  @ApiResponse({ status: 401, description: 'Invalid credentials or inactive user' })
  async login(@Body() body: LoginDto) {
    const user = await this.authService.validateUser(
      body.identifier,
      body.password,
    );
    
    const result = await this.authService.login(user);
    
    return {
      message: 'Authenticated',
      ...result,
    };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retorna o usuário autenticado (email e full_name) a partir do token Bearer' })
  @ApiResponse({ status: 200, description: 'Dados do usuário logado' })
  @ApiResponse({ status: 401, description: 'Token inválido ou ausente' })
  me(
    @CurrentUser()
    user: { email: string; full_name: string },
  ) {
    return {
      user: {
        email: user.email,
        full_name: user.full_name,
      },
    };
  }

  @Patch('users/:id')
  @Admin()
  @ApiOperation({ summary: 'Atualizar usuário (ex.: dar permissão de admin). Mesmo que PATCH /api/users/:id' })
  @ApiParam({ name: 'id', description: 'User ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Usuário atualizado' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  async updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    const result = await this.usersService.updateUser(id, dto);
    return {
      message: result.message,
      user: result.user,
    };
  }
}
