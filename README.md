# Controle de Equipamentos

<p align="center">
  <img src="web-controle-equipamentos-main/public/logo-dimensional.png" alt="Dimensional Engenharia" width="180" />
</p>

<p align="center">
  <strong>Sistema de check-in e check-out de equipamentos por contrato</strong><br />
  Interface Web + API para a <a href="https://dimensionalengenharia.com.br">Dimensional Engenharia</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/NestJS-11-E0234E?style=flat-square&logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/PostgreSQL-Prisma-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Licença-Interno-6B7280?style=flat-square" alt="Licença" />
</p>

---

## Visão geral

O **Controle de Equipamentos** resolve a rastreabilidade de ativos em campo: quem retirou ou devolveu, em qual contrato, com horímetro, foto e localização GPS.

| Camada | Pasta | Descrição |
|--------|-------|-----------|
| **API** | [`api-controle-equipamentos-main`](./api-controle-equipamentos-main) | Backend NestJS + Prisma + PostgreSQL |
| **Web** | [`web-controle-equipamentos-main`](./web-controle-equipamentos-main) | Frontend React (Vite) — painel admin e operação mobile |

```mermaid
flowchart LR
  A[Operador / Admin] --> B[Web — React + Vite]
  B --> C[API — NestJS]
  C --> D[(PostgreSQL)]
  C --> E[Storage S3]
  B --> F[Google Maps — BI]
```

---

## Funcionalidades

- **Autenticação JWT** — login por e-mail, CPF ou nome
- **Contratos e equipamentos** — vínculo por obra, tipo e ativo, com QR Code
- **Movimentações** — abertura/fechamento com horímetro, foto e GPS
- **Leitura de QR** — fluxo otimizado para celular no navegador
- **BI** — filtros, tabela, mapa e exportação Excel
- **Gestão de usuários** — ativar/desativar e permissões de administrador
- **Tema claro/escuro** — identidade visual Dimensional (cinza e vermelho)
- **Operação offline** — fila local com sincronização posterior

---

## Stack

| Camada | Tecnologias |
|--------|-------------|
| **Frontend** | React 18, TypeScript, Vite, React Router 7, Zustand, Axios, Tailwind CSS, ExcelJS, Recharts |
| **Backend** | NestJS 11, Prisma, PostgreSQL, Passport JWT, Swagger, Multer, AWS S3 |
| **Infra** | Docker Compose (Postgres local), GitHub Actions (deploy VPS), PM2 |

---

## Estrutura do repositório

Clique nas pastas abaixo para expandir (no GitHub) e ver o que cada parte faz.

<details open>
<summary><strong>Controle-Equipamentos/</strong> — monorepo (API + Web)</summary>
<br />

<details open>
<summary><code>api-controle-equipamentos-main/</code> — Backend NestJS</summary>

```text
api-controle-equipamentos-main/
├── prisma/                 # Schema, migrations e seeds (PostgreSQL)
├── src/
│   ├── auth/               # Login, JWT, guards (auth/admin)
│   ├── check-operations/   # Abertura/fechamento + foto + GPS
│   ├── equipments/         # Vínculos e QR do ativo
│   ├── contracts/          # Contratos
│   ├── users/              # Operadores e administradores
│   ├── storage/            # Upload de fotos (S3)
│   ├── equipment-types/    # Tipos de equipamento
│   ├── municipalities/     # Municípios
│   ├── companies/          # Empresas vinculadas
│   ├── health/             # Health check
│   └── main.ts             # Bootstrap da API
├── test/                   # Testes e2e
├── docker-compose.yml      # Postgres local
└── .env.example
```

</details>

<details open>
<summary><code>web-controle-equipamentos-main/</code> — Frontend React</summary>

```text
web-controle-equipamentos-main/
├── src/
│   ├── api/                # Cliente Axios → endpoints da API
│   ├── pages/              # Telas (Login, Home, BI, Movimentações…)
│   ├── components/         # Rotas protegidas, mapa, captura de foto
│   ├── hooks/              # Tema e sync offline
│   ├── layouts/            # Sidebar / header
│   ├── store/              # authStore (Zustand + JWT)
│   ├── lib/                # QR, PDF, imagem, offline
│   └── types/
├── public/                 # Logo e favicon
└── .env                    # VITE_API_BASE_URL (local, não versionado)
```

</details>

</details>

### Como os pedaços se conectam

```mermaid
sequenceDiagram
  participant O as Operador
  participant W as Web (React)
  participant A as API (NestJS)
  participant S as Storage
  participant DB as PostgreSQL

  O->>W: Login
  W->>A: POST /auth/login
  A-->>W: JWT
  O->>W: Escaneia QR + foto + GPS
  W->>A: POST check-operations
  A->>S: Upload da foto
  A->>DB: Grava movimentação
  A-->>W: OK
  Note over W,DB: Admin consulta no BI e exporta Excel
```

---

## Pré-requisitos

- [Node.js](https://nodejs.org/) **18+**
- npm (ou yarn / pnpm)
- PostgreSQL (local via Docker ou remoto / Supabase)
- Conta/chave Google Maps (opcional — necessário para o mapa no BI)

---

## Começando

### 1. Clone

```bash
git clone https://github.com/larialprata/Controle-Equipamentos.git
cd Controle-Equipamentos
```

### 2. API

```bash
cd api-controle-equipamentos-main
cp .env.example .env
# Edite .env com DATABASE_URL, DIRECT_URL e JWT_SECRET

npm install
npx prisma generate
npx prisma migrate deploy   # ou: npx prisma migrate dev
npm run start:dev
```

A API sobe em **http://localhost:3000**.  
Swagger (se habilitado): `SWAGGER_ENABLED=true` no `.env`.

**Postgres local com Docker:**

```bash
docker compose up -d
```

Use no `.env` (exemplo do `.env.example`):

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/app_dev"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/app_dev"
JWT_SECRET=alterar-em-producao
```

### 3. Web

```bash
cd web-controle-equipamentos-main
```

Crie um `.env`:

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_GOOGLE_MAPS_API_KEY=sua_chave_aqui
```

```bash
npm install
npm run dev
```

A aplicação abre em **http://localhost:5173**.

---

## Variáveis de ambiente

### API (`api-controle-equipamentos-main/.env`)

| Variável | Obrigatória | Descrição |
|----------|:-----------:|-----------|
| `DATABASE_URL` | Sim | Connection string PostgreSQL (pooler, se houver) |
| `DIRECT_URL` | Sim | Connection string direta (migrations) |
| `JWT_SECRET` | Sim | Segredo para assinar tokens |
| `JWT_EXPIRES_IN` | Não | Expiração do token (padrão: `7d`) |
| `SWAGGER_ENABLED` | Não | `true` para expor Swagger em produção |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_CPF` | Não | Credenciais do admin inicial (seed) |
| `GEMINI_API_KEY` | Não | Leitura de horímetro por foto (Vision) |

### Web (`web-controle-equipamentos-main/.env`)

| Variável | Obrigatória | Descrição |
|----------|:-----------:|-----------|
| `VITE_API_BASE_URL` | Sim* | URL base da API |
| `VITE_GOOGLE_MAPS_API_KEY` | Para o BI | Chave da [Maps JavaScript API](https://console.cloud.google.com/apis/credentials) |

> Arquivos `.env` **não** são versionados. Nunca commite segredos.

---

## Papéis de acesso

| Papel | Acesso |
|-------|--------|
| **Administrador** | Dashboard, contratos, equipamentos, usuários, BI e movimentações |
| **Operador** | Página de movimentações (fluxo mobile via navegador) |
| **Visitante** | Apenas login |

---

## Scripts úteis

### API

| Comando | Descrição |
|---------|-----------|
| `npm run start:dev` | Desenvolvimento com hot reload |
| `npm run build` | Build de produção |
| `npm run start:prod` | Executa a build |
| `npm run test` | Testes unitários |
| `npm run test:e2e` | Testes end-to-end |
| `npm run db:seed` | Seed do banco |

### Web

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção (`dist/`) |
| `npm run preview` | Preview da build |
| `npm run lint` | ESLint |
| `npm run check` | Checagem de tipos TypeScript |

---

## Documentação adicional

| Documento | Conteúdo |
|-----------|----------|
| [`web-controle-equipamentos-main/README.md`](./web-controle-equipamentos-main/README.md) | Guia detalhado do frontend |
| [`web-controle-equipamentos-main/PRD.md`](./web-controle-equipamentos-main/PRD.md) | Requisitos, fluxos e telas |
| [`web-controle-equipamentos-main/PROJECT_DETAILS.md`](./web-controle-equipamentos-main/PROJECT_DETAILS.md) | Detalhes da integração com a API |
| [`api-controle-equipamentos-main/.env.example`](./api-controle-equipamentos-main/.env.example) | Modelo de variáveis da API |

---

## Deploy

- **API** — GitHub Actions via SSH no VPS (PM2). Secrets: `VPS_HOST`, `VPS_USER`, `VPS_PORT`, `VPS_SSH_KEY`. O `.env` do servidor **não** é sobrescrito no deploy.
- **Web** — workflow em [`web-controle-equipamentos-main/.github/workflows/deploy.yml`](./web-controle-equipamentos-main/.github/workflows/deploy.yml).

Detalhes em [`api-controle-equipamentos-main/README.md`](./api-controle-equipamentos-main/README.md).

---

## Autora

**[larialprata](https://github.com/larialprata)** — Larissa Prata

---

## Licença

Uso interno na **Dimensional Engenharia** e uso pessoal. Não autorizado para redistribuição ou uso comercial por terceiros. 
