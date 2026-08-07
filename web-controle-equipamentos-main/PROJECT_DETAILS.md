# Detalhes do Projeto - Equipment Check-In/Out API

## Visão Geral

Backend **NestJS** em TypeScript para gerenciamento de **check-in** e **check-out** de equipamentos em contratos. A aplicação web operacional usa essa API para registrar movimentações, autenticação e evidências com foto.

---

## Stack Tecnológica

| Tecnologia       | Versão   | Uso                         |
|------------------|----------|-----------------------------|
| Node.js          | >= 18.18 | Runtime                     |
| NestJS           | ^11.x    | Framework backend           |
| TypeScript       | 5.6.x    | Linguagem                   |
| Prisma           | 6.7.0    | ORM / migrations            |
| PostgreSQL       | -        | Banco de dados              |
| Passport + JWT   | ^11.x    | Autenticação                |
| Swagger          | ^11.x    | Documentação da API         |
| class-validator  | ^0.14    | Validação de DTOs           |
| bcrypt           | ^6.x     | Hash de senhas              |
| multer           | (via Nest) | Upload de arquivos        |

---

## Estrutura do Projeto

```
nodejs_space/
├── prisma/
│   ├── schema.prisma      # Modelos e migrations
│   └── seed.ts            # Seeds iniciais (admin, contratos, equipamentos)
├── src/
│   ├── app.module.ts
│   ├── app.controller.ts
│   ├── app.service.ts
│   ├── main.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   ├── prisma/
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── dto/
│   │   │   ├── login.dto.ts
│   │   │   ├── register.dto.ts
│   │   │   └── toggle-user-status.dto.ts
│   │   ├── decorators/
│   │   │   ├── admin.decorator.ts
│   │   │   └── current-user.decorator.ts
│   │   ├── guards/
│   │   │   ├── auth.guard.ts
│   │   │   └── admin.guard.ts
│   │   └── strategies/
│   │       └── jwt.strategy.ts
│   ├── contracts/
│   │   ├── contracts.module.ts
│   │   ├── contracts.controller.ts
│   │   └── contracts.service.ts
│   ├── equipments/
│   │   ├── equipments.module.ts
│   │   ├── equipments.controller.ts
│   │   └── equipments.service.ts
│   ├── check-operations/
│   │   ├── check-operations.module.ts
│   │   ├── check-operations.controller.ts
│   │   ├── check-operations.service.ts
│   │   └── dto/
│   │       ├── create-operation.dto.ts
│   │       └── sync-operations.dto.ts
│   └── health/
│       ├── health.module.ts
│       └── health.controller.ts
├── uploads/               # Arquivos enviados (criado em runtime)
│   ├── documents/         # Fotos CNH
│   └── operations/        # Fotos das operações
├── .env
├── package.json
└── nest-cli.json
```

---

## Modelo de Dados (Prisma)

### users
| Campo      | Tipo    | Descrição                         |
|------------|---------|-----------------------------------|
| id         | UUID    | Chave primária                    |
| full_name  | String  | Nome completo                     |
| phone      | String  | Telefone                          |
| cpf        | String  | CPF (11 dígitos, único)           |
| email      | String  | E-mail (único)                    |
| address    | String  | Endereço                          |
| password   | String  | Senha (hash bcrypt)               |
| cnh_photo  | String  | URL da foto da CNH                |
| is_active  | Boolean | Usuário ativo (default: false)    |
| is_admin   | Boolean | Administrador (default: false)    |
| created_at | DateTime| Data de criação                   |

### contracts
| Campo       | Tipo   | Descrição              |
|-------------|--------|------------------------|
| id          | UUID   | Chave primária         |
| name        | String | Nome do contrato       |
| active      | Boolean| Ativo (default: true)  |
| created_at  | DateTime | Data de criação     |

### equipments
| Campo       | Tipo   | Descrição                        |
|-------------|--------|----------------------------------|
| id          | UUID   | Chave primária                   |
| name        | String | Nome do equipamento              |
| contract_id | UUID   | FK → contracts                   |
| active      | Boolean| Ativo (default: true)            |
| created_at  | DateTime | Data de criação                |

### check_operations
| Campo            | Tipo      | Descrição                        |
|------------------|-----------|----------------------------------|
| id               | UUID      | Chave primária                   |
| contract_id      | UUID      | FK → contracts                   |
| equipment_id     | UUID      | FK → equipments                  |
| operation_type   | Enum      | `checkin` \| `checkout`          |
| horimeter        | Decimal   | Leitura do horímetro             |
| photo_url        | String    | URL da foto                      |
| latitude         | Decimal   | Coordenada                       |
| longitude        | Decimal   | Coordenada                       |
| observation      | String?   | Observação opcional              |
| operation_datetime | DateTime | Data/hora da operação         |
| synced           | Boolean   | Sincronizado (default: true)     |
| device_id        | String    | ID do dispositivo                |
| created_at       | DateTime  | Data de criação                  |

---

## API Endpoints

### Rota Base
- **URL:** `http://localhost:3000`
- **Documentação Swagger:** `http://localhost:3000/api-docs`

### Autenticação (`/api/auth`)
| Método | Rota                         | Descrição                     | Proteção   |
|--------|------------------------------|-------------------------------|------------|
| POST   | `/api/auth/register`         | Registrar novo usuário        | Pública    |
| POST   | `/api/auth/login`            | Login (retorna JWT)           | Pública    |
| GET    | `/api/auth/users`            | Listar usuários               | Admin      |
| PATCH  | `/api/auth/users/:id/toggle-status` | Ativar/desativar usuário | Admin      |
| PATCH  | `/api/users/:id` ou `/api/auth/users/:id` | Atualizar usuário (body: `{ "is_admin": true \| false }`) — para "Dar ADM" / "Remover ADM" | Admin      |

### Contratos (`/api/contracts`)
| Método | Rota              | Descrição              | Proteção   |
|--------|-------------------|------------------------|------------|
| GET    | `/api/contracts`  | Listar contratos ativos| Pública    |

### Equipamentos (`/api/equipments`)
| Método | Rota               | Descrição               | Proteção   |
|--------|--------------------|-------------------------|------------|
| GET    | `/api/equipments`  | Listar equipamentos ativos | Pública |

### Operações de Check (`/api/check-operations`)
| Método | Rota                               | Descrição                    | Proteção   |
|--------|------------------------------------|------------------------------|------------|
| POST   | `/api/check-operations`            | Criar operação (check-in/out)| Pública    |
| POST   | `/api/check-operations/sync`       | Sincronizar operações em lote| Pública    |
| GET    | `/api/check-operations/photo/:filename` | Obter foto da operação | Pública    |
| DELETE | `/api/check-operations/:id`        | Excluir operação (usado na página BI) | Admin/Auth |

### Saúde (`/api/health`)
| Método | Rota           | Descrição        |
|--------|----------------|------------------|
| GET    | `/api/health`  | Health check     |

---

## Configuração de Ambiente

### Variáveis de Ambiente (`.env`)

| Variável       | Obrigatório | Descrição                          |
|----------------|-------------|------------------------------------|
| DATABASE_URL   | Sim         | URL de conexão PostgreSQL          |
| ADMIN_EMAIL    | Não         | E-mail do admin (seed)             |
| ADMIN_PASSWORD | Não         | Senha do admin (seed)              |
| ADMIN_CPF      | Não         | CPF do admin (seed, 11 dígitos)    |
| JWT_SECRET     | Não         | Chave secreta JWT (padrão interno) |
| JWT_EXPIRES_IN | Não         | Validade do token (ex: 7d)         |
| APP_ORIGIN     | Não         | Origem CORS permitida              |

### Exemplo de `.env`

```env
DATABASE_URL="postgresql://myuser:mypassword@localhost:5432/mydatabase"
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin123
ADMIN_CPF=00000000000
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d
```

---

## Fluxos Principais

### 1. Registro de Usuário
1. Cliente envia `POST /api/auth/register` com multipart/form-data
2. Campos: `full_name`, `phone`, `cpf`, `email`, `address`, `password`, `cnh_photo` (arquivo)
3. Foto CNH aceita: jpg, jpeg, png (máx 10MB)
4. Usuário criado com `is_active: false` até ativação pelo admin

### 2. Login
1. `POST /api/auth/login` com `email` e `password`
2. Retorna `access_token` (JWT) e mensagem
3. Token no header: `Authorization: Bearer <token>`

### 3. Operação de Check-In/Check-Out
1. `POST /api/check-operations` com multipart/form-data
2. Campos: `contract_id`, `equipment_id`, `operation_type` (checkin/checkout), `horimeter`, `latitude`, `longitude`, `operation_datetime`, `photo`, `device_id`, `observation` (opcional)
3. Regras: check-in exige que não exista check-in aberto; check-out exige check-in prévio

### 4. Sincronização Offline
1. `POST /api/check-operations/sync` com JSON
2. Body: `{ operations: [{ contract_id, equipment_id, operation_type, horimeter, photo_base64, latitude, longitude, operation_datetime, device_id, observation? }] }`
3. Limite de body: 50MB (para imagens base64)

---

## Seed do Banco

Comando: `npm run db:seed` ou `yarn db:seed`

O seed cria:
- **Usuário admin** (usando ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_CPF)
- **Contratos:** ATA, LimpaRio, ECO Barreira
- **Equipamentos por contrato:** Retroescavadeira, Escavadeira Hidráulica, Anfíbia, Caminhão Basculante, Pá Carregadeira, Moto Niveladora, Carreta, Vacol

---

## Testes

### Comandos
```bash
npm test           # Executar testes unitários
npm run test:watch # Modo watch
npm run test:cov   # Cobertura
npm run test:debug # Debug
```

### Módulos com testes
- AppController, AppService
- AuthController, AuthService
- ContractsController, ContractsService
- EquipmentsController, EquipmentsService
- CheckOperationsController, CheckOperationsService

Ver `TEST_COVERAGE.md` para detalhes da cobertura.

---

## Segurança

- **Senhas:** hash bcrypt com 10 salt rounds
- **JWT:** validação via Passport e JwtStrategy
- **Guards:** `AuthGuard` (autenticação) e `AdminGuard` (admin)
- **Validação:** ValidationPipe global (whitelist, forbidNonWhitelisted, transform)
- **CORS:** configurável via `APP_ORIGIN`

---

## Scripts NPM

| Script        | Comando              | Descrição                 |
|---------------|----------------------|---------------------------|
| build         | `nest build`         | Compilar                  |
| start         | `nest start`         | Iniciar (produção)        |
| start:dev     | `nest start --watch` | Modo desenvolvimento      |
| start:debug   | `nest start --debug --watch` | Debug           |
| start:prod    | `node dist/main`     | Iniciar build compilado   |
| db:seed       | `prisma db seed`     | Executar seed             |
| test          | `jest`               | Testes unitários          |
| test:cov      | `jest --coverage`    | Cobertura                 |
| lint          | `eslint ...`         | Lint                      |
| format        | `prettier --write`   | Formatar código           |

---

## Observações

1. **Erro 401 em `/api/auth/users`:** a rota requer token JWT válido e usuário admin. Faça login primeiro e envie o header `Authorization: Bearer <token>`.
2. **Uploads:** as pastas `uploads/documents` e `uploads/operations` são criadas automaticamente.
3. **Fotos de operações:** a sincronização em lote usa `photo_base64`; as fotos são salvas em disco e referenciadas em `photo_url`.
