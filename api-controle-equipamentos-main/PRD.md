# PRD - Product Requirements Document  
## Equipment Check-In/Out API

**Versão:** 1.0  
**Data:** 13/02/2026  
**Status:** Em uso

---

## 1. Visão do Produto

### 1.1 Objetivo

API backend para **gerenciamento de check-in e check-out de equipamentos** em contratos de operação. O sistema atende a aplicação web operacional, usada no celular via navegador, para registrar movimentações de entrada e saída de equipamentos em campo com foto e geolocalização.

### 1.2 Proposta de Valor

- Controle de entrada/saída de equipamentos por contrato  
- Registro com geolocalização e foto como evidência  
- Gestão de usuários operadores com aprovação administrativa  
- Documentação automática via Swagger  

---

## 2. Stakeholders e Usuários

### 2.1 Personas

| Persona | Descrição | Acesso |
|---------|-----------|--------|
| **Administrador** | Gerencia usuários, ativa/desativa operadores | Painel admin / API admin |
| **Operador** | Realiza check-in/check-out de equipamentos em campo | Web operacional |
| **Sistema externo** | Integrações com ERPs ou dashboards | API pública/autenticada |

### 2.2 Usuários do Sistema

- **Usuários comuns:** operadores que fazem check-in/check-out; precisam estar ativos (`is_active`)
- **Usuários admin:** podem listar usuários, ativar/desativar operadores, consultar documentos

---

## 3. Requisitos Funcionais

### 3.1 Autenticação e Usuários

| ID | Requisito | Prioridade | Status |
|----|-----------|------------|--------|
| RF-A01 | Registrar operador web com nome, CPF e senha | Alta | ✅ Implementado |
| RF-A02 | Login com nome, CPF ou email e senha; retornar JWT | Alta | ✅ Implementado |
| RF-A03 | Usuário novo criado como inativo até aprovação do admin | Alta | ✅ Implementado |
| RF-A04 | Bloquear login de usuário inativo | Alta | ✅ Implementado |
| RF-A05 | Listar todos os usuários (apenas admin) | Alta | ✅ Implementado |
| RF-A06 | Obter usuário por ID (apenas admin) | Média | ✅ Implementado |
| RF-A07 | Ativar/desativar usuário (apenas admin) | Alta | ✅ Implementado |
| RF-A08 | Servir foto do documento (CNH) por filename (autenticado) | Média | ✅ Implementado |

### 3.2 Contratos e Equipamentos

| ID | Requisito | Prioridade | Status |
|----|-----------|------------|--------|
| RF-C01 | Listar contratos ativos | Alta | ✅ Implementado |
| RF-C02 | Listar equipamentos ativos (global) | Alta | ✅ Implementado |
| RF-C03 | Buscar equipamentos por contrato (serviço) | Média | ✅ Implementado (não exposto na API) |

### 3.3 Operações de Check-In/Check-Out

| ID | Requisito | Prioridade | Status |
|----|-----------|------------|--------|
| RF-O01 | Registrar operação de check-in com foto, geolocalização, horímetro | Alta | ✅ Implementado |
| RF-O02 | Registrar operação de check-out (requer check-in prévio para o device) | Alta | ✅ Implementado |
| RF-O03 | Validar sequência: não permitir check-in duplicado sem checkout | Alta | ✅ Implementado |
| RF-O04 | Validar existência de contrato e equipamento | Alta | ✅ Implementado |
| RF-O05 | Sincronizar operações em lote (múltiplas, com foto em base64) | Alta | ✅ Implementado |
| RF-O06 | Servir foto da operação por filename | Média | ✅ Implementado |

### 3.4 Infraestrutura e Utilidades

| ID | Requisito | Prioridade | Status |
|----|-----------|------------|--------|
| RF-I01 | Endpoint de health check | Alta | ✅ Implementado |
| RF-I02 | Documentação OpenAPI (Swagger) | Alta | ✅ Implementado |
| RF-I03 | Tratamento global de exceções | Alta | ✅ Implementado |
| RF-I04 | Validação de entrada (DTOs) | Alta | ✅ Implementado |
| RF-I05 | CORS configurável | Média | ✅ Implementado |

---

## 4. Requisitos Não Funcionais

### 4.1 Segurança

- Senhas armazenadas com **bcrypt** (10 salt rounds)  
- Autenticação via **JWT** (Bearer token)  
- Rotas admin protegidas por `AdminGuard` (usuário `is_admin`)  
- Validação de filenames para evitar path traversal (`..`, `/`, `\`)  
- Limite de tamanho de arquivo: 10MB para uploads individuais  
- Limite de body: 50MB para operações em lote com imagens base64  

### 4.2 Performance e Escalabilidade

- Suporte a body grande (50MB) para operações em lote com imagens base64  
- Uso de Prisma ORM com conexão poolável ao PostgreSQL  

### 4.3 Disponibilidade

- Health check em `/api/health`  
- Tratamento de erros com filtro global  

### 4.4 Usabilidade da API

- Respostas em português quando aplicável  
- Padrão REST  
- Swagger em `/api-docs`  

---

## 5. Especificação da API

### 5.1 Base URL

- Desenvolvimento: `http://localhost:3000`  
- Documentação: `http://localhost:3000/api-docs`  

### 5.2 Endpoints

#### Auth (`/api/auth`)

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/api/auth/register` | Registrar usuário (multipart: full_name, phone, cpf, email, address, password, cnh_photo) | Pública |
| POST | `/api/auth/login` | Login (email, password) → access_token | Pública |

#### Users (`/api/users`)

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET | `/api/users` | Listar usuários | Admin |
| GET | `/api/users/:id` | Obter usuário por ID | Admin |
| GET | `/api/users/document/:filename` | Obter foto do documento (CNH) | Bearer |
| PATCH | `/api/users/:id/toggle-status` | Ativar/desativar usuário | Admin |

#### Contracts (`/api/contracts`)

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET | `/api/contracts` | Listar contratos ativos | Pública |

#### Equipments (`/api/equipments`)

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET | `/api/equipments` | Listar equipamentos ativos | Pública |

#### Check Operations (`/api/check-operations`)

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/api/check-operations` | Criar operação (multipart: contract_id, equipment_id, operation_type, horimeter, latitude, longitude, operation_datetime, photo, device_id, observation?) | Pública |
| POST | `/api/check-operations/sync` | Sincronizar operações em lote (JSON: operations[]) | Pública |
| GET | `/api/check-operations/photo/:filename` | Obter foto da operação | Pública |

#### Health (`/api/health`)

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET | `/api/health` | Health check | Pública |

### 5.3 Autenticação

- Header: `Authorization: Bearer <access_token>`  
- JWT inclui: `sub` (user id), `email`, `is_admin`  

---

## 6. Modelo de Dados

### 6.1 Diagrama Conceitual

```
users
  - id, full_name, phone, cpf, email, address, password, cnh_photo
  - is_active, is_admin, created_at

contracts
  - id, name, active, created_at
  - 1:N equipments
  - 1:N check_operations

equipments
  - id, name, contract_id, active, created_at
  - N:1 contracts
  - 1:N check_operations

check_operations
  - id, contract_id, equipment_id, operation_type (checkin|checkout)
  - horimeter, photo_url, latitude, longitude, observation
  - operation_datetime, synced, device_id, created_at
  - N:1 contracts, N:1 equipments
```

### 6.2 Regras de Negócio – Operações

1. **Check-in:** não pode haver check-in aberto para o mesmo `device_id`.  
2. **Check-out:** exige check-in prévio para o mesmo `device_id`.  
3. Sequência é determinada pela última operação por `device_id` (por `operation_datetime` desc).  

---

## 7. Configuração e Deploy

### 7.1 Variáveis de Ambiente

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| DATABASE_URL | Sim | URL PostgreSQL |
| ADMIN_EMAIL | Não | Email do admin (seed, padrão: `admin@exemplo.com`) |
| ADMIN_PASSWORD | Não | Senha do admin (seed, padrão: `admin123`) |
| ADMIN_CPF | Não | CPF do admin (seed, 11 dígitos) |
| JWT_SECRET | Não | Chave JWT (padrão interno) |
| JWT_EXPIRES_IN | Não | Validade do token (ex: 7d) |
| APP_ORIGIN | Não | Origem CORS |

### 7.2 Scripts

- `npm run start` – Iniciar servidor  
- `npm run start:dev` – Modo watch (desenvolvimento)  
- `npm run build` – Build de produção  
- `npm run db:seed` – Seed do banco  
- `npm test` – Testes unitários  
- `npm run test:cov` – Cobertura de testes  

### 7.3 Seed

- Usuário admin (ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_CPF)  
- Contratos: ATA, LimpaRio, ECO Barreira  
- Equipamentos por contrato: Retroescavadeira, Escavadeira Hidráulica, Anfíbia, Caminhão Basculante Truck, Caminhão Basculante Toco, Pá Carregadeira, Moto Niveladora, Carreta, Vacol  

---

## 8. Stack Tecnológica

| Componente | Tecnologia |
|------------|------------|
| Runtime | Node.js >= 18.18 |
| Framework | NestJS 11 |
| Linguagem | TypeScript 5.6 |
| ORM | Prisma 6.7 |
| Banco | PostgreSQL |
| Auth | Passport + JWT |
| Documentação | Swagger (OpenAPI) |
| Validação | class-validator |
| Hash | bcrypt |

---

## 9. Estrutura de Módulos

```
AppModule
├── ConfigModule (global)
├── PrismaModule
├── AuthModule (JWT, Guards, AuthService)
├── UsersModule (UsersController, UsersService)
├── ContractsModule
├── EquipmentsModule
├── CheckOperationsModule
└── HealthModule
```

---

## 10. Escopo Futuro (Backlog)

- Endpoint GET `/api/equipments?contract_id=xxx` para filtrar por contrato  
- Testes E2E  
- Refresh token  
- Logs estruturados (ex.: Pino)  
- Upload de fotos para storage externo (S3, etc.)  
- Rate limiting  

---

## 11. Critérios de Sucesso

- [x] Registro, login e gestão de usuários funcionando  
- [x] Check-in/check-out com validação de sequência  
- [x] Sincronização em lote com múltiplas operações  
- [x] Documentação Swagger disponível  
- [x] Testes unitários cobrindo serviços principais  

---

## 12. Referências

- NestJS: https://nestjs.com  
- Prisma: https://prisma.io  
- Swagger: https://swagger.io  
