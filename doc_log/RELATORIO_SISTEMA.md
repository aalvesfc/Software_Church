# Relatório Técnico Completo — Hug App
**Data de geração:** 2026-05-14  
**Versão:** 1.0.0  
**Ambiente:** Node.js + Supabase (PostgreSQL)

---

## 1. Visão Geral do Sistema

**Hug App** é uma plataforma de gestão eclesiástica multi-tenant voltada para igrejas. Permite que cada igreja gerencie sua própria estrutura organizacional (ministérios, departamentos, funções), voluntários e modelos de escalas (templates de eventos).

### Características Principais
- Multi-tenant: cada igreja possui dados completamente isolados por `church_id`
- Autenticação via Supabase Auth com JWT
- Backend REST em Node.js/Express 5
- Frontend em HTML/CSS/JS puro (sem framework)
- Banco de dados PostgreSQL gerenciado pelo Supabase
- Upload de fotos de voluntários no Supabase Storage

---

## 2. Stack Tecnológica

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Runtime | Node.js | LTS atual |
| Framework HTTP | Express | ^5.2.1 |
| Banco de dados | PostgreSQL (Supabase) | — |
| SDK Supabase | @supabase/supabase-js | ^2.105.4 |
| Autenticação | Supabase Auth + JWT | — |
| Criptografia | bcryptjs | ^3.0.3 |
| Tokens JWT | jsonwebtoken | ^9.0.3 |
| CORS | cors | ^2.8.6 |
| Variáveis de ambiente | dotenv | ^17.4.2 |
| Dev server | nodemon | ^3.1.14 |
| Frontend | HTML5 + CSS3 + Vanilla JS | — |

---

## 3. Estrutura de Diretórios

```
hug_app/
├── server.js               # Ponto de entrada — Express + rotas
├── package.json
├── .env                    # Variáveis de ambiente (não versionado)
├── lib/
│   └── supabase.js         # Clientes Supabase (admin + auth)
├── middleware/
│   └── auth.js             # Middleware JWT — valida token em toda rota protegida
├── routes/
│   ├── auth.js             # Login, me, refresh, logout
│   ├── user.js             # Perfil, gêneros, estados civis
│   ├── church.js           # Dados da igreja
│   ├── ministry.js         # CRUD de ministérios
│   ├── department.js       # CRUD de departamentos
│   ├── funcao.js           # CRUD de funções por departamento
│   ├── voluntario.js       # CRUD de voluntários + vínculos
│   └── template.js         # CRUD de templates de evento
├── scripts/
│   └── criar_admin.js      # Script utilitário para criar usuário admin
└── public/                 # Frontend estático
    ├── login.html
    ├── dashboard.html
    ├── editar-perfil.html
    ├── configuracoes.html
    ├── ministerios.html
    ├── ministerio-detalhe.html
    ├── departamentos.html
    ├── departamento-detalhe.html
    ├── voluntarios.html
    ├── voluntario-detalhe.html
    ├── templates.html
    └── template-detalhe.html
```

---

## 4. Configuração do Servidor (`server.js`)

```
PORT: 3000 (padrão, sobreponível por variável de ambiente)
Payload JSON: até 10 MB
Arquivos estáticos: /public
```

### Rotas Registradas
| Prefixo API | Arquivo de rota |
|-------------|----------------|
| /api/auth | routes/auth.js |
| /api/user | routes/user.js |
| /api/church | routes/church.js |
| /api/ministry | routes/ministry.js |
| /api/department | routes/department.js |
| /api/funcao | routes/funcao.js |
| /api/voluntario | routes/voluntario.js |
| /api/template | routes/template.js |

### Rotas de Página (SPA-like)
| URL | Arquivo HTML |
|-----|-------------|
| / | login.html |
| /dashboard | dashboard.html |
| /editar-perfil | editar-perfil.html |
| /configuracoes | configuracoes.html |
| /ministerios | ministerios.html |
| /ministerio/:id | ministerio-detalhe.html |
| /departamentos | departamentos.html |
| /departamento/:id | departamento-detalhe.html |
| /voluntarios | voluntarios.html |
| /voluntario/:id | voluntario-detalhe.html |
| /templates | templates.html |
| /template/:id | template-detalhe.html |

---

## 5. Autenticação e Segurança

### Fluxo de Autenticação
1. `POST /api/auth/login` — credenciais enviadas ao Supabase Auth
2. Supabase retorna `access_token` (JWT) + `refresh_token`
3. Tokens armazenados no `localStorage` do frontend
4. Cada requisição autenticada envia `Authorization: Bearer <access_token>`
5. `authMiddleware` valida o token via `supabaseAdmin.auth.getUser(token)`
6. `req.authUser` fica disponível com `{ id, email, ... }` do usuário autenticado

### Renovação Automática de Token (Frontend)
O helper `authFetch` no frontend detecta resposta `401` e automaticamente chama `POST /api/auth/refresh` com o `refresh_token` antes de retentar a requisição original.

### Isolamento Multi-tenant
Todo route handler chama `getChurchId(req.authUser.id)` antes de qualquer operação no banco. Todas as queries incluem `.eq('church_id', churchId)`, garantindo que dados de uma igreja nunca vazem para outra.

### Clientes Supabase (`lib/supabase.js`)
| Cliente | Chave usada | Propósito |
|---------|------------|-----------|
| `supabaseAdmin` | `SUPABASE_SERVICE_KEY` | Todas as queries de banco (ignora RLS) |
| `supabaseAuth` | `SUPABASE_ANON_KEY` | Login e refresh de sessão em nome do usuário |

### Variáveis de Ambiente Necessárias
```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
PORT=3000 (opcional)
```

---

## 6. API Endpoints Completos

### 6.1 Autenticação — `/api/auth`

| Método | Rota | Autenticação | Descrição |
|--------|------|-------------|-----------|
| POST | /api/auth/login | Não | Login com email + senha |
| GET | /api/auth/me | Sim | Retorna dados do usuário logado |
| POST | /api/auth/refresh | Não | Renova access_token via refresh_token |
| POST | /api/auth/logout | Sim | Invalida a sessão |

**POST /api/auth/login — Request:**
```json
{ "email": "string", "senha": "string" }
```
**POST /api/auth/login — Response (200):**
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_at": 1234567890,
  "usuario": { "id", "nome", "email", "avatar", "role" },
  "igreja": { "id", "nome", "slug", "logo" }
}
```

---

### 6.2 Usuário — `/api/user`

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/user/generos | Lista todos os gêneros disponíveis |
| GET | /api/user/estados-civis | Lista todos os estados civis disponíveis |
| PUT | /api/user/profile | Atualiza perfil do usuário logado |

**PUT /api/user/profile — Request:**
```json
{ "nickname": "string*", "full_name", "phone", "genero_id", "status_civil_id", "birth_date" }
```

---

### 6.3 Igreja — `/api/church`

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/church | Retorna dados da igreja do usuário logado |

**Response:**
```json
{ "church": { "id", "name", "slug", "logo_url", "is_active", ... } }
```

---

### 6.4 Ministérios — `/api/ministry`

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/ministry | Lista ministérios da igreja |
| GET | /api/ministry/:id | Busca ministério por ID |
| POST | /api/ministry | Cria novo ministério |
| PUT | /api/ministry/:id | Atualiza ministério (nome, descrição, is_active) |
| DELETE | /api/ministry/:id | Remove ministério (bloqueado se tiver departamentos) |

**Comportamento especial PUT (is_active=false):** arquiva automaticamente todos os departamentos vinculados.

**DELETE — erro 409** se existir departamentos vinculados.

---

### 6.5 Departamentos — `/api/department`

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/department | Lista departamentos (suporta ?ministry_id=) |
| GET | /api/department/:id | Busca departamento por ID |
| POST | /api/department | Cria departamento (requer ministry_id) |
| PUT | /api/department/:id | Atualiza (nome, descrição, ministry_id, is_active) |
| DELETE | /api/department/:id | Remove departamento |

**GET /api/department — Response:**
```json
{ "departments": [{ ..., "db_ministry": { "id", "name" } }] }
```

---

### 6.6 Funções — `/api/funcao`

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/funcao | Lista funções (suporta ?department_id=) |
| POST | /api/funcao | Cria função (requer name + department_id) |
| PUT | /api/funcao/:id | Atualiza (nome, descrição, is_active) |
| DELETE | /api/funcao/:id | Remove função (erro 410 se tiver voluntário vinculado) |

---

### 6.7 Voluntários — `/api/voluntario`

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/voluntario | Lista todos os voluntários da igreja |
| GET | /api/voluntario/:id | Busca voluntário por ID |
| POST | /api/voluntario | Cria voluntário |
| PUT | /api/voluntario/:id | Atualiza voluntário |
| POST | /api/voluntario/:id/departamento | Vincula departamento/função ao voluntário |
| PUT | /api/voluntario/:id/funcao | Atualiza função de um vínculo específico |
| DELETE | /api/voluntario/:id/departamento/:linkId | Remove vínculo departamento/função |
| DELETE | /api/voluntario/:id | Remove voluntário e todos seus vínculos |

**Campos do voluntário:**
```json
{
  "name": "string*", "nickname", "email", "whatsapp", "birth_date",
  "gender" (genero_id), "status_civil_id", "address", "number",
  "complement", "neighborhood", "city", "state", "zip_code",
  "emergency_contact_name", "emergency_contact_phone",
  "department_ids": ["uuid"], "photo_base64": "data:image/..."
}
```

**Resposta inclui `db_member_dept`** com lista de vínculos (department_id, funcao_id, status).

**Upload de foto:** base64 → Supabase Storage bucket `voluntarios` → URL pública salva em `photo_url`.

---

### 6.8 Templates — `/api/template`

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/template | Lista templates ativos com estrutura de departamentos e funções |
| GET | /api/template/:id | Busca template por ID (com depts e funções) |
| POST | /api/template | Cria template com depts e funções |
| PUT | /api/template/:id | Atualiza template; substitui depts/funções se enviados |
| DELETE | /api/template/:id | Remove template e todos os registros filhos |

**Estrutura de payload (POST/PUT):**
```json
{
  "name": "string*",
  "tags": ["string"],
  "depts": [
    {
      "department_id": "uuid",
      "funcoes": [{ "funcao_id": "uuid", "vagas": 1 }]
    }
  ]
}
```

**Estrutura de resposta (GET):**
```json
{
  "templates": [
    {
      "id", "name", "tags", "is_active", "church_id", "created_at",
      "depts": [
        {
          "department_id": "uuid",
          "funcoes": [{ "funcao_id": "uuid", "vagas": 1 }]
        }
      ]
    }
  ]
}
```

**DELETE cascata manual:** deleta `db_template_funcao` → `db_template_dept` → `db_template_event`.

---

## 7. Banco de Dados

### 7.1 Tabelas Principais

#### `db_church` — Igrejas
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | Identificador único |
| name | text | Nome da igreja |
| slug | text | Identificador URL-friendly |
| logo_url | text | URL do logotipo |
| is_active | boolean | Igreja ativa |

#### `db_user` — Usuários do sistema
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | ID interno |
| user_id | uuid FK | ID do usuário no Supabase Auth |
| church_id | uuid FK | Igreja vinculada |
| nickname | text | Apelido / nome de exibição |
| full_name | text | Nome completo |
| email | text | E-mail |
| phone | text | Telefone |
| avatar_url | text | URL do avatar |
| role | text | Papel (admin, user, etc.) |
| genero_id | uuid FK | Referência a db_genero |
| status_civil_id | uuid FK | Referência a db_status_civil |
| birth_date | date | Data de nascimento |
| is_active | boolean | Conta ativa |
| last_sign_in | timestamptz | Último login |
| created_at | timestamptz | Criação |
| updated_at | timestamptz | Última atualização |

#### `db_genero` — Gêneros
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | — |
| name | text | Ex: "Masculino", "Feminino" |

#### `db_status_civil` — Estados Civis
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | — |
| name | text | Ex: "Solteiro", "Casado" |

#### `db_ministry` — Ministérios
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | — |
| church_id | uuid FK | Igreja dona |
| name | text | Nome do ministério |
| description | text | Descrição |
| is_active | boolean | Ativo/arquivado |
| created_at | timestamptz | — |

#### `db_department` — Departamentos
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | — |
| church_id | uuid FK | Igreja dona |
| ministry_id | uuid FK | Ministério pai |
| name | text | Nome do departamento |
| description | text | Descrição |
| is_active | boolean | Ativo/arquivado |
| created_at | timestamptz | — |

#### `db_funcao_dept` — Funções por Departamento
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | — |
| church_id | uuid FK | Igreja dona |
| department_id | uuid FK | Departamento pai |
| name | text | Nome da função |
| description | text | Descrição |
| is_active | boolean | Ativa |
| created_at | timestamptz | — |

#### `db_member` — Voluntários/Membros
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | — |
| church_id | uuid FK | Igreja dona |
| full_name | text | Nome completo |
| nickname | text | Apelido |
| email | text | E-mail |
| whatsapp | text | WhatsApp |
| birth_date | date | Data de nascimento |
| genero_id | uuid FK | Gênero |
| status_civil_id | uuid FK | Estado civil |
| address | text | Endereço (logradouro) |
| number | text | Número |
| complement | text | Complemento |
| neighborhood | text | Bairro |
| city | text | Cidade |
| state | char(2) | Estado (UF) |
| zip_code | text | CEP |
| emergency_contact_name | text | Contato de emergência (nome) |
| emergency_contact_phone | text | Contato de emergência (telefone) |
| photo_url | text | URL da foto |
| is_active | boolean | Voluntário ativo |
| is_volunteer | boolean | Marcado como voluntário |
| created_at | timestamptz | — |

#### `db_member_dept` — Vínculos Voluntário ↔ Departamento/Função
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | — |
| church_id | uuid FK | Igreja dona |
| member_id | uuid FK | Voluntário |
| department_id | uuid FK | Departamento |
| funcao_id | uuid FK (nullable) | Função atribuída (opcional) |
| status | text | "ativo", "inativo", etc. |
| joined_at | date | Data de entrada |

**Regra de unicidade:** mesma função no mesmo departamento para o mesmo voluntário não pode se repetir.

#### `db_template_event` — Templates de Evento
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | — |
| church_id | uuid FK | Igreja dona |
| name | text | Nome do template |
| tags | text[] | Tags para categorização |
| is_active | boolean | Ativo |
| created_at | timestamptz | — |

#### `db_template_dept` — Departamentos de um Template
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | — |
| church_id | uuid FK | Igreja dona |
| template_id | uuid FK | Template pai |
| department_id | uuid FK | Departamento incluído |

#### `db_template_funcao` — Funções + Vagas de um Template
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | — |
| church_id | uuid FK | Igreja dona |
| template_id | uuid FK | Template pai |
| department_id | uuid FK | Departamento da função |
| funcao_id | uuid FK | Função definida |
| vagas | integer | Número de vagas para essa função |

### 7.2 Relacionamentos

```
db_church (1)
  ├── db_user (N)
  ├── db_ministry (N)
  │     └── db_department (N)
  │           └── db_funcao_dept (N)
  ├── db_member (N)
  │     └── db_member_dept (N) ── db_department, db_funcao_dept
  └── db_template_event (N)
        ├── db_template_dept (N) ── db_department
        └── db_template_funcao (N) ── db_department, db_funcao_dept
```

### 7.3 Storage (Supabase)

| Bucket | Acesso | Conteúdo |
|--------|--------|---------|
| voluntarios | Público | Fotos dos voluntários (`photos/<id>-<timestamp>.<ext>`) |

---

## 8. Middleware

### `middleware/auth.js`
Extrai o `Bearer` token do header `Authorization`, valida via `supabaseAdmin.auth.getUser(token)`. Em caso de erro ou ausência de token, retorna `401`. Em caso de sucesso, injeta `req.authUser` (objeto do usuário Supabase Auth) e chama `next()`.

### `getChurchId(userId)` — Helper por rota
Cada arquivo de rota define esta função que consulta `db_user.church_id` pelo `user_id` do Supabase Auth. Garantia de isolamento: se `church_id` não existir, a operação retorna `404`.

---

## 9. Frontend — Páginas

### 9.1 `login.html`
- Formulário de e-mail e senha
- Chama `POST /api/auth/login`
- Armazena tokens e dados no `localStorage`
- Redireciona para `/dashboard`

### 9.2 `dashboard.html`
- Exibe 4 cards de estatísticas em grid sempre de 4 colunas
- Dados carregados em paralelo via `Promise.all`:
  - Ministérios ativos (`is_active !== false`)
  - Departamentos ativos
  - Voluntários ativos
  - Templates ativos
- Cada card navega para a seção correspondente
- Ícones dos cards espelham os ícones do menu lateral

### 9.3 `ministerios.html`
- Lista de ministérios com visualização em Blocos ou Tabela
- CRUD inline: criar, editar, arquivar, excluir

### 9.4 `ministerio-detalhe.html`
- Detalhes de um ministério específico
- Lista de departamentos vinculados

### 9.5 `departamentos.html`
- Lista de departamentos com filtro por ministério
- CRUD inline

### 9.6 `departamento-detalhe.html`
- Detalhes de um departamento
- Lista de funções vinculadas ao departamento

### 9.7 `voluntarios.html`
- Lista de voluntários com:
  - Toggle Blocos/Tabela
  - Filtro por departamento (combo)
  - Filtro por função (combo)
  - Campo de busca por nome
- Todos os controles integrados no mesmo header da lista

### 9.8 `voluntario-detalhe.html`
- Perfil completo do voluntário
- Foto com upload via base64
- Dados pessoais, endereço, contato de emergência
- Gerenciamento de vínculos departamento/função

### 9.9 `templates.html`
- Lista de templates com toggle Blocos/Tabela
- Busca por nome
- Criar novo template via modal

### 9.10 `template-detalhe.html`
- Edição completa de um template
- **Seção "Lista de Funções":**
  - Exibe todas as funções da igreja
  - Toggle Grade / Por Ministério (accordion agrupado por departamento)
  - Funções ordenadas alfabeticamente (A→Z, pt-BR)
  - Busca por nome de função ou departamento
  - Clique/checkbox para selecionar funções
  - Contador de selecionadas no header
- **Ao salvar:** funções selecionadas são agrupadas por `department_id` para montar o payload da API

### 9.11 `editar-perfil.html`
- Edita nickname, nome completo, telefone, gênero, estado civil, data de nascimento

### 9.12 `configuracoes.html`
- Configurações da igreja: nome, slug, logo
- Chama `GET /api/church` e atualiza via Supabase direto (ou API)

---

## 10. Padrões de Desenvolvimento Frontend

### `authFetch(url, options)` — Wrapper de requisição
```javascript
// Presente em todas as páginas autenticadas
// 1. Adiciona Authorization: Bearer <token>
// 2. Se receber 401, tenta refresh automático do token
// 3. Após refresh bem-sucedido, retenta a requisição original
// 4. Se refresh falhar, redireciona para login
```

### Layout — Menu Lateral
Presente em todas as páginas pós-login. Ícones SVG personalizados:
- **Ministérios:** ícone de igreja com cruz
- **Departamentos:** ícone de maleta (briefcase)
- **Templates:** ícone de layout de blog (retângulo com divisão horizontal e vertical)

### Toggle de Visualização (Pill Style)
Padrão CSS usado em templates.html, voluntarios.html e template-detalhe.html:
```css
.view-toggle { display: flex; background: var(--canvas-input); border-radius: var(--radius-pill); padding: 3px; }
.view-btn { height: 32px; padding: 0 14px; border: none; border-radius: var(--radius-pill); font-size: 13px; font-weight: 500; cursor: pointer; background: none; display: flex; align-items: center; gap: 6px; }
.view-btn.active { background: var(--canvas); color: var(--ink); font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
```

### Ordenação Alfabética
Usada na lista de funções em template-detalhe.html:
```javascript
result.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'))
```

---

## 11. Scripts Utilitários

### `scripts/criar_admin.js`
Executado via `npm run criar-admin`. Cria um usuário administrador no sistema, vinculando-o a uma igreja existente.

---

## 12. Comandos NPM

| Comando | Descrição |
|---------|-----------|
| `npm start` | Inicia o servidor com `node server.js` |
| `npm run dev` | Inicia com `nodemon` (reinicia ao salvar) |
| `npm run criar-admin` | Executa script de criação de admin |

---

## 13. Considerações de Segurança

| Aspecto | Implementação |
|---------|--------------|
| Autenticação | JWT via Supabase Auth, verificado a cada requisição |
| Autorização | `church_id` em todas as queries garante isolamento multi-tenant |
| Service key | Usada apenas no backend; nunca exposta ao frontend |
| Injeção SQL | Supabase SDK usa queries parametrizadas; sem SQL raw |
| Upload de arquivos | Apenas base64 de imagens; bucket público mas com paths únicos por ID + timestamp |
| CORS | Habilitado globalmente (ambiente de desenvolvimento) |
| Token refresh | Frontend renova automaticamente antes de expirar |
| Conta inativa | Login bloqueado para `is_active = false` (usuário ou igreja) |

---

## 14. Limitações e Pontos de Melhoria

1. **CORS aberto:** `cors()` sem whitelist — recomendado restringir em produção
2. **Rate limiting:** Não há controle de taxa de requisições (sem `express-rate-limit`)
3. **Validação de entrada:** Básica nos routes — recomendado adicionar schema validation (Zod/Joi)
4. **Logs:** Apenas `console.error` — recomendado logger estruturado (Winston/Pino)
5. **Testes:** Sem cobertura de testes automatizados
6. **HTTPS:** Não configurado no servidor (depende de proxy reverso em produção)
7. **Soft delete:** Ministérios e departamentos usam `is_active`, mas voluntários são hard-deleted

---

## 15. Glossário

| Termo | Significado no sistema |
|-------|----------------------|
| Igreja (church) | Tenant do sistema; isola todos os dados |
| Ministério (ministry) | Agrupamento de alto nível (ex: Louvor, Jovens) |
| Departamento (department) | Subdivisão de um ministério (ex: Vocal, Instrumentistas) |
| Função (funcao) | Papel dentro de um departamento (ex: Guitarrista, Técnico de Som) |
| Voluntário (member) | Pessoa que serve na igreja, pode ter múltiplos vínculos |
| Vínculo (member_dept) | Associação voluntário ↔ departamento ↔ função |
| Template | Modelo de escala de evento com departamentos e funções definidos |
| Vagas | Quantidade de voluntários necessários para uma função num template |

---

*Relatório gerado automaticamente em 2026-05-14 a partir do código-fonte do repositório `hug_app`.*
