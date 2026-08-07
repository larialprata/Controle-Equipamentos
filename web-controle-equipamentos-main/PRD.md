# PRD – Controle de Equipamentos (Web)

## 1. Visão do produto

Aplicação web em React para **controle de check-in e check-out de equipamentos** vinculados a contratos. Usuários autenticados (e opcionalmente apenas administradores) acessam um dashboard para visualizar contratos, equipamentos e operações, registrar novas operações com foto e localização, e (para admins) gerenciar usuários e consultar BI das movimentações.

O sistema resolve o problema de rastreabilidade de equipamentos em campo: quem retirou, quando, em qual contrato/equipamento, com horímetro e foto como comprovação.

---

## 2. Stack e dependências

| Tecnologia        | Uso                          |
|-------------------|------------------------------|
| React 18          | UI e componentes             |
| TypeScript        | Tipagem estática            |
| Vite              | Build e dev server          |
| React Router 7    | Roteamento SPA              |
| Zustand            | Estado global (auth)         |
| Axios              | Cliente HTTP para a API     |
| Tailwind CSS       | Estilos                     |
| Lucide React       | Ícones                      |
| ExcelJS            | Exportação Excel (BI)       |

A API backend é NestJS (documentada em `PROJECT_DETAILS.md`), exposta em `http://localhost:3000` por padrão.

---

## 3. Papéis e permissões

| Papel              | Como entra        | Permissões principais                                                                 |
|--------------------|-------------------|----------------------------------------------------------------------------------------|
| **Administrador**  | Login na API      | Dashboard, Contratos, Equipamentos, **Usuários**, BI, Movimentações e logout.          |
| **Operador**       | Login na API      | Apenas a página `Movimentações`, com leitura de QR, horímetro e foto.                  |
| **Visitante**      | Sem login         | Apenas `/login`. Redirecionamento para login em rotas protegidas.                    |

---

## 4. Módulos e páginas

### 4.1 Login (`/login`)

- **Objetivo:** Autenticar o usuário na API e armazenar o JWT.
- **Campos:** Nome, CPF ou e-mail (obrigatório), Senha (obrigatório).
- **Comportamento:**
  - POST para `/api/auth/login` com `identifier` e `password`.
  - Em sucesso: guarda `access_token` no localStorage, decodifica o JWT para obter `full_name`, `is_admin` etc., atualiza o store (Zustand) e redireciona admin para `/` e operador para `/movimentacoes`.
  - Em erro: exibe mensagem da API ou “Falha no login. Verifique suas credenciais.”
- **UI:** Card centralizado, botão “Entrar” com estado de loading e mensagens de erro.

### 4.2 Home / Início (`/`)

- **Objetivo:** Dashboard de boas-vindas e atalhos.
- **Conteúdo:**
  - Saudação com nome do usuário.
  - Cards e indicadores administrativos.
  - Bloco “Dicas rápidas” para uso do sistema.

### 4.3 Contratos (`/contracts`)

- **Objetivo:** Listar contratos ativos (somente leitura).
- **Dados:** GET `/api/contracts`. Exibição em grid de cards: nome, status (Ativo/Inativo), data de criação.
- **Estados:** Loading, erro (mensagem amigável), lista vazia (“Nenhum contrato encontrado”).

### 4.4 Equipamentos (`/equipments`)

- **Objetivo:** Cadastrar e listar os vínculos operacionais entre contrato, obra, tipo de equipamento e ativo.
- **Dados:** GET `/api/equipments`, GET `/api/contracts`, GET `/api/contracts/:contractId/obras`, GET `/api/equipment-types`, POST `/api/equipments`.
- **Funcionalidades:** botão de cadastro, geração e exibição de QR por ativo e listagem dos vínculos já criados.
- **Estados:** Loading, erro, lista vazia, sucesso ao gerar vínculo.

### 4.5 Movimentações (`/movimentacoes`)

- **Objetivo:** Registrar abertura ou fechamento de um equipamento pelo celular, via navegador.
- **Dados de entrada:**
  - QR code do ativo.
  - Tipo: abertura | fechamento.
  - Horímetro (número).
  - Foto do horímetro (obrigatória), aceita image/*, até 10MB.
  - Localização: obtida via `navigator.geolocation` (obrigatória).
- **Regras de negócio (front):**
  - O QR identifica automaticamente contrato, obra, equipamento e ativo.
  - O operador preenche apenas o horímetro e tira a foto.
  - O fechamento deve respeitar o mesmo ativo da última abertura em aberto do operador.
- **API:** GET `/api/equipments/qr/:qrCode` e POST `/api/check-operations` com multipart/form-data.
- **Estados:** leitura de QR, resolução do vínculo, localização, envio em progresso, sucesso/erro.

### 4.6 Usuários (`/users`) – apenas administrador

- **Objetivo:** Listar usuários, criar operadores web, ver detalhes, ativar/desativar e dar/remover permissão de admin.
- **Acesso:** Se o usuário não for admin, exibe “Acesso negado” e não chama a API.
- **Dados:** GET `/api/users` e POST `/api/users` (protegido por token e role admin).
- **Funcionalidades:**
  - Modal/botão para registrar operador com nome, CPF, senha e contrato opcional.
  - Tabela: nome, CPF, e-mail, telefone, perfil (Admin/Usuário), status (Ativo/Inativo), ações.
  - Clique na linha abre modal com detalhes (endereço, etc.) e mesmas ações.
  - **Ativar/Desativar:** PATCH toggle de status do usuário.
  - **Dar ADM / Remover ADM:** PATCH para atualizar `is_admin` (rota compatível com backend, ex.: PATCH `/api/users/:id` com `{ is_admin }`).
- **Estados:** Loading, erro (401/403 tratados com mensagem clara), lista vazia.

### 4.7 BI das Movimentações (`/bi`)

- **Objetivo:** Consultar movimentações (check-in/check-out), filtrar, exportar Excel, ver mapa e fotos, e (para admin) excluir operações.
- **Dados:** Contratos (GET `/api/contracts`), equipamentos (GET `/api/equipments`), usuários (GET `/api/auth/users`), operações (GET `/api/check-operations` com filtros: `contract_id`, `equipment_id`, `user_id`, `date_from`, `date_to`, `limit`).
- **Filtros:** Contrato, Equipamento, Usuário, Período (data de – até). Botão “Limpar filtros”.
- **Tabela:** Movimentações agrupadas por `device_id`, com pares check-in/check-out (colunas Abertura e Fechamento): Contrato, Usuário, Equipamento, tipo, horímetro, data/hora, foto, lat/long, observação. Fotos carregadas com token (axios blob) e exibidas em modal com zoom e rotação.
- **Exportar Excel:** Planilha “Movimentações” com cabeçalhos Abertura/Fechamento e download com nome `movimentacoes-YYYY-MM-DD.xlsx`.
- **Mapa:** Google Maps (requer `VITE_GOOGLE_MAPS_API_KEY`). Marcadores verde (check-in) e vermelho (check-out), busca por lugar/endereço (Places Autocomplete). Se não houver chave ou coordenadas, exibe mensagem adequada.
- **Excluir:** Checkboxes por linha (ou “selecionar todas”); botão “Excluir X selecionada(s)” chama DELETE `/api/check-operations/:id` para cada operação selecionada (ambos os IDs do par quando aplicável).
- **Estados:** Loading, erro de carregamento/delete, lista vazia, mapa sem dados.

---

## 5. Fluxos principais

### 5.1 Autenticação

1. Usuário acessa qualquer rota protegida → redirecionado para `/login`.
2. Informa nome, CPF ou e-mail e a senha.
3. Front envia POST `/api/auth/login`; em sucesso guarda token e dados do usuário (do body ou JWT).
4. Admin vai para `/`; operador vai para `/movimentacoes`.
5. Logout: limpa token e usuário no store, redireciona para `/login`.

### 5.2 Registro de movimentação (abertura → fechamento)

1. Operador abre `Movimentações` no celular e lê o QR do ativo.
2. O sistema resolve automaticamente contrato, obra, equipamento e ativo.
3. Operador escolhe abertura ou fechamento, preenche horímetro e tira foto.
4. Front captura localização e envia a operação com multipart; em sucesso mostra confirmação.

### 5.3 BI e exportação

1. Usuário acessa BI, aplica filtros (contrato, equipamento, usuário, período).
2. Front busca operações com os filtros e monta linhas “Abertura + Fechamento” por dispositivo.
3. Usuário pode abrir fotos no modal, usar o mapa e “Exportar Excel”.
4. (Admin) Pode selecionar linhas e excluir operações via DELETE.

---

## 6. Integração com a API

- **Base URL:** `http://localhost:3000` (definida em `src/api/client.ts`; idealmente configurável por env em produção).
- **Autenticação:** Header `Authorization: Bearer <token>` em todas as requisições autenticadas. Token obtido no login e armazenado no localStorage.
- **Endpoints utilizados:**
  - `POST /api/auth/login` – login.
  - `GET /api/users` – listar usuários (admin).
  - `POST /api/users` – cadastrar operador web.
  - `PATCH /api/users/:id/toggle-status` – ativar/desativar usuário.
  - `PATCH /api/users/:id` (ou equivalente) – atualizar `is_admin`.
  - `GET /api/contracts` – listar contratos.
  - `GET /api/equipments` – listar equipamentos.
  - `GET /api/equipments/qr/:qrCode` – resolver vínculo pelo QR.
  - `POST /api/equipments` – cadastrar vínculo e gerar QR por ativo.
  - `POST /api/check-operations` – criar operação (multipart).
  - `GET /api/check-operations` – listar com query params (contract_id, equipment_id, user_id, date_from, date_to, limit).
  - `GET /api/check-operations/:id/photo` – obter foto (com auth).
  - `DELETE /api/check-operations/:id` – excluir operação (admin).
- **Imagens autenticadas:** Fotos de usuário (CNH) e de operações são carregadas via cliente axios com token (ex.: `AuthenticatedImage` e request em blob no BI).

---

## 7. Variáveis de ambiente

| Variável                      | Obrigatória | Descrição                                                                 |
|------------------------------|------------|----------------------------------------------------------------------------|
| `VITE_GOOGLE_MAPS_API_KEY`    | Não (BI)   | Chave da API do Google Maps (Maps JavaScript API + Places) para o mapa no BI. |

A URL da API está fixa no código; em produção recomenda-se algo como `VITE_API_BASE_URL`.

---

## 8. UI/UX e acessibilidade

- **Layout:** Sidebar fixa no desktop e menu hambúrguer no celular. Operador vê apenas `Movimentações`; administrador vê as demais áreas.
- **Estilo:** Tailwind; cards com sombra e hover; cores semânticas (verde ativo/sucesso, vermelho inativo/erro, azul primário, roxo admin).
- **Feedback:** Loading spinners, mensagens de erro/sucesso, botões desabilitados durante submissão.
- **Acessibilidade:** Uso de `aria-label` em controles (ex.: checkboxes no BI), `role="dialog"` e `aria-modal` no modal de foto.

---

## 9. Requisitos não funcionais (resumo)

- **Compatibilidade:** Navegadores modernos com suporte a ES modules, Geolocation API e upload de arquivos.
- **Segurança:** Token JWT no header; não expor chaves no front (apenas variáveis VITE_).
- **Performance:** Listas renderizadas sem virtualização (BI com limite de 2000 itens); imagens sob demanda no modal de foto.

---

## 10. Glossário

- **Check-in:** Abertura de uso do equipamento (retirada).
- **Check-out:** Fechamento de uso (devolução).
- **Horímetro:** Leitura do contador de horas do equipamento.
- **Movimentação:** Par check-in + check-out do mesmo equipamento/contrato (agrupado por `device_id` no BI).
