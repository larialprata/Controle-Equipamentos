# Controle de Equipamentos — Web

Aplicação web para **controle de check-in e check-out de equipamentos** vinculados a contratos. Permite registrar operações com foto e localização, consultar contratos e equipamentos, e (para administradores) gerenciar usuários e visualizar o BI das movimentações.

---

## O que o sistema faz

- **Login** — Autenticação via e-mail e senha (JWT).
- **Início** — Dashboard com atalhos para Contratos, Equipamentos e Nova Operação.
- **Contratos** — Listagem de contratos ativos em cards.
- **Equipamentos** — Listagem de equipamentos por contrato.
- **Nova Operação** — Registro de check-in ou check-out com:
  - Contrato e equipamento
  - Data/hora e horímetro
  - Foto de comprovação
  - Localização (GPS)
- **Usuários** *(apenas admin)* — Listar usuários, ativar/desativar, conceder ou remover permissão de administrador.
- **BI** — Consulta de movimentações com filtros, tabela, mapa (Google Maps) e exportação para Excel.
- **Modo escuro / claro** — Tema baseado na identidade visual (cinza e vermelho), com opção no topo da página.

---

## Tecnologias

| Tecnologia       | Uso                    |
|------------------|------------------------|
| **React 18**     | Interface e componentes |
| **TypeScript**   | Tipagem estática       |
| **Vite**         | Build e servidor de desenvolvimento |
| **React Router 7** | Roteamento SPA       |
| **Zustand**      | Estado global (autenticação) |
| **Axios**        | Requisições HTTP à API |
| **Tailwind CSS** | Estilos e tema (dark mode) |
| **Lucide React** | Ícones                 |
| **ExcelJS**      | Exportação Excel (BI)  |

A aplicação consome uma **API backend** (NestJS). O backend precisa estar rodando e a URL configurada no `.env`.

---

## Pré-requisitos

- **Node.js** 18 ou superior  
- **npm** (ou yarn/pnpm)  
- Backend da API em execução (veja documentação do backend para subir o servidor)

---

## Instalação

1. **Clone o repositório** (se ainda não tiver):

   ```bash
   git clone https://github.com/dimensionalengenharia/web-controle-equipamentos.git
   cd web-controle-equipamentos
   ```

2. **Instale as dependências:**

   ```bash
   npm install
   ```

3. **Configure o ambiente** — crie um arquivo `.env` na raiz do projeto (veja seção [Variáveis de ambiente](#variáveis-de-ambiente)).

4. **Inicie o servidor de desenvolvimento:**

   ```bash
   npm run dev
   ```

   A aplicação abre em **http://localhost:5173** (ou na porta que o Vite indicar no terminal).

---

## Variáveis de ambiente

Crie um arquivo **`.env`** na raiz do projeto com as variáveis abaixo. O arquivo `.env` não é commitado (está no `.gitignore`).

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `VITE_API_BASE_URL` | Sim* | URL base da API (ex.: `http://localhost:3000`). Se não existir, o front usa um padrão. |
| `VITE_GOOGLE_MAPS_API_KEY` | Para o mapa no BI | Chave da API do Google Maps. Crie em [Google Cloud Console](https://console.cloud.google.com/apis/credentials) e ative a **Maps JavaScript API**. Sem ela, o mapa na página BI não carrega. |

\* Consulte o backend ou a documentação do projeto para a URL correta da API.

**Exemplo de `.env`:**

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_GOOGLE_MAPS_API_KEY=sua_chave_aqui
```

---

## Scripts disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Sobe o servidor de desenvolvimento (hot reload). |
| `npm run build` | Gera a build de produção em `dist/`. |
| `npm run preview` | Serve a pasta `dist/` localmente (testar build). |
| `npm run lint` | Roda o ESLint. |
| `npm run check` | Verifica tipos TypeScript (`tsc --noEmit`). |

---

## Estrutura do projeto (resumo)

```
src/
├── api/           # Cliente HTTP e chamadas à API (auth, contracts, equipments, operations)
├── components/    # Componentes reutilizáveis (ProtectedRoute, Empty, etc.)
├── hooks/         # Hooks (ex.: useTheme para modo escuro/claro)
├── layouts/       # Layout principal (DashboardLayout com sidebar e header)
├── pages/         # Páginas: Home, Login, Contracts, Equipments, Operations, Users, BI
├── store/         # Estado global (Zustand) — authStore
├── types/         # Tipos TypeScript
├── lib/            # Utilitários (ex.: cn para classes CSS)
├── App.tsx
├── main.tsx
└── index.css      # Estilos globais e Tailwind
```

---

## Modo escuro

O sistema oferece **modo claro** e **modo escuro** (tema em cinza e vermelho, alinhado à identidade do BI). A preferência é salva no `localStorage` e aplicada em todas as páginas.

- **Onde alternar:** no topo da sidebar (desktop) ou no header mobile, botões **Claro** e **Escuro**.

---

## Papéis de usuário

| Papel | Acesso |
|-------|--------|
| **Administrador** | Dashboard, Contratos, Equipamentos, Usuários, BI e gerenciamento completo do sistema. |
| **Operador** | Acesso exclusivo à página `Movimentações`, feita para uso no celular via navegador. |

---

## Documentação adicional

- **PRD.md** — Especificação detalhada do produto (requisitos, fluxos, telas).
- **PROJECT_DETAILS.md** — Detalhes do backend (API NestJS, banco, autenticação).

---

## Desenvolvedores

- **[larialprata](https://github.com/larialprata)** — Larissa Prata  
- **[Lucas-ns](https://github.com/Lucas-ns)** — Lucas Nascimento  

---

## Licença

Projeto interno — Dimensional Engenharia.
