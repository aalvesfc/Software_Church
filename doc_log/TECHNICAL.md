# Documentação Técnica — Hug App
**Data:** 10/05/2026  
**Commit de referência:** `b311b9c`  
**Stack:** Node.js · Express 5 · Supabase (PostgreSQL + Auth) · HTML/CSS/JS vanilla

---

## 1. Visão geral do projeto

O **Hug App** é um sistema web de gestão de voluntários e eventos para igrejas. O backend é um servidor Express que serve arquivos HTML estáticos e expõe uma API REST autenticada via JWT (Supabase Auth). O frontend é HTML/CSS/JS puro, sem framework, comunicando-se com o backend via `fetch`.

### Estrutura de arquivos relevantes

```
hug_app/
├── server.js                  # Entry point — Express + rotas
├── lib/
│   └── supabase.js            # Clientes Supabase (admin e auth)
├── middleware/
│   └── auth.js                # Middleware JWT (valida token Supabase)
├── routes/
│   ├── auth.js                # /api/auth — login, me, logout
│   ├── user.js                # /api/user — perfil, gêneros, estados civis
│   └── church.js              # /api/church — dados da igreja (NOVO)
└── public/
    ├── login.html
    ├── dashboard.html
    ├── editar-perfil.html
    ├── configuracoes.html      # (NOVO)
    └── IMG/
        └── logo.png            # (NOVO)
```

---

## 2. Alterações realizadas

### 2.1 Identidade visual — logo e branding

**Problema:** O menu lateral exibia um ícone SVG genérico (estrela) e o texto fixo "ZIONAPP", sem relação com a identidade do cliente.

**Solução:**

**Arquivos alterados:** `public/dashboard.html`, `public/editar-perfil.html`

#### Remoção do texto "ZIONAPP"
O elemento `<div class="logo-text">ZION<span>APP</span></div>` foi removido de ambas as páginas.

#### Substituição do ícone SVG pela logo real
O bloco `.logo-mark` que continha um SVG de estrela foi substituído por uma tag `<img>`:

```html
<!-- Antes -->
<div class="logo-mark">
  <svg viewBox="0 0 24 24" ...>
    <polygon points="12 2 15.09 8.26 ..." />
  </svg>
</div>

<!-- Depois -->
<div class="logo-mark">
  <img src="/IMG/logo.png" alt="Logo" style="width:52px;height:52px;object-fit:contain;">
</div>
```

A imagem `logo.png` foi adicionada em `public/IMG/` e é servida estaticamente pelo Express via `express.static`.

#### Ajustes de tamanho
O tamanho da logo foi ajustado progressivamente: `36px → 48px → 52px` (tamanho final).  
O `border-radius: 50%` foi removido para não criar borda circular sobre a logo.

---

### 2.2 Nome dinâmico da igreja na sidebar

**Problema:** O nome da instituição não aparecia no menu lateral após a remoção do texto estático "ZIONAPP".

**Solução:** O nome da igreja já era retornado pelo endpoint de login (`/api/auth/login`) e salvo no `localStorage` como `igreja.nome`. Bastou adicionar um elemento HTML e populá-lo via JS.

**HTML adicionado** (dashboard e editar-perfil):
```html
<div class="logo-text" id="churchName"></div>
```

**JS adicionado** (dashboard):
```js
const igreja = JSON.parse(localStorage.getItem('igreja') || '{}');
const churchNameEl = document.getElementById('churchName');
if (churchNameEl && igreja.nome) churchNameEl.textContent = igreja.nome;
```

**JS adicionado** (editar-perfil — dentro da função `preencherPagina`):
```js
const churchNameEl = document.getElementById('churchName');
if (churchNameEl && igreja && igreja.nome) churchNameEl.textContent = igreja.nome;
```

**Origem do dado:** `db_church.name` → retornado em `/api/auth/login` → salvo em `localStorage` como `igreja.nome`.

---

### 2.3 Favicon e títulos das páginas

**Problema:** As abas do navegador exibiam o ícone padrão do browser (globo) e o nome "Hug App".

**Solução:** Adicionado `<link rel="icon">` apontando para a logo e títulos atualizados em todos os HTMLs.

**Alteração aplicada** nos três arquivos (`login.html`, `dashboard.html`, `editar-perfil.html`):

```html
<!-- Antes -->
<title>Hug App — Dashboard</title>

<!-- Depois -->
<title>Hug Software — Dashboard</title>
<link rel="icon" type="image/png" href="/IMG/logo.png">
```

---

### 2.4 Link de Configurações no menu lateral

**Problema:** O item "Configurações" no sidebar não navegava para lugar nenhum (`href="#"`).

**Solução:** Atualizado o `href` para `/configuracoes` em `dashboard.html` e `editar-perfil.html`:

```html
<a class="nav-item" href="/configuracoes">
  ...
  <span>Configurações</span>
</a>
```

---

### 2.5 Página de Configurações

**Arquivo criado:** `public/configuracoes.html`  
**Rota criada:** `GET /configuracoes` em `server.js`

#### Layout
A página segue exatamente o mesmo design system do `dashboard.html`:
- Sidebar lateral idêntica (colapsável, com logo e navegação)
- Topbar com busca, notificações e avatar dropdown
- Grid de conteúdo principal + aside direito

#### Design system aplicado
Baseado no `appleclone/DESIGN.md` (design system inspirado na Apple):
- Fonte: `SF Pro Display / SF Pro Text`
- Cores: `--primary: #008f8c`, `--primary-dark: #005451`, `--primary-light: #00d17a`
- Radius: `--radius-lg: 18px` nos cards, `--radius-sm: 8px` nos inputs
- Cards com `border: 1px solid var(--hairline)` e `box-shadow` sutil no hover
- Sem gradientes decorativos — apenas o hero banner usa gradiente

#### Hero banner
```html
<div class="hero"> <!-- gradiente teal -->
  <div class="hero-icon"> <!-- ícone de engrenagem --> </div>
  <div class="hero-text">
    <div class="hero-title">Configurações</div>
    <div class="hero-sub">Personalize o sistema da sua instituição</div>
  </div>
</div>
```

#### Cards de configuração
11 itens implementados como cards clicáveis com ícone, título e descrição:

| Item | Descrição |
|---|---|
| Geral | Informações da instituição *(acordeão)* |
| Permissões e Acessos | Controle de acesso dos usuários |
| Perguntas do Voluntário | Configure perguntas customizadas |
| Link de Cadastro Geral | URL de cadastro com botão Copiar |
| Check-in e Check-out | Configurações de presença |
| Escalas | Regras de escalação |
| Gamificação | Sistema de pontos e badges |
| Notificações | Alertas e comunicações |
| Personalização Visual | Logo, cores e tema |
| Administradores | Gerenciar admins do sistema |
| Convites | Gerenciar convites de usuários |

#### Aside direito
- Bloco **Resumo** com âncoras de navegação rápida para cada seção
- Bloco **Precisa de ajuda?** com botão "Abrir Suporte"

---

### 2.6 Acordeão "Geral" com formulário da instituição

**Funcionalidade:** O card Geral expande/colapsa ao clique, revelando um formulário com os dados da igreja.

#### CSS do acordeão
```css
.accordion-card.open .accordion-body { display: block; }
.accordion-card.open .setting-arrow  { transform: rotate(90deg); }
```

#### Campos do formulário

**Dados da instituição:**
- Nome da Igreja
- CNPJ *(com máscara automática: `00.000.000/0000-00`)*
- E-mail
- Telefone / Contato *(com máscara: `(00) 00000-0000`)*
- Website

**Redes sociais:**
- Instagram
- YouTube

**Endereço:**
- Logradouro · Número · Complemento · Cidade · Estado · CEP *(com máscara: `00000-000`)*

#### Carregamento de dados
Os campos são populados automaticamente via `GET /api/church` quando o acordeão é aberto pela primeira vez (flag `churchLoaded` evita requisições duplicadas):

```js
async function carregarIgreja() {
  if (churchLoaded) return;
  const token = localStorage.getItem('access_token');
  const res   = await fetch('/api/church', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const { church } = await res.json();
  document.getElementById('gNome').value  = church.name  || '';
  document.getElementById('gCnpj').value  = church.cnpj  || '';
  // ... demais campos
  churchLoaded = true;
}
```

---

### 2.7 Rota `/api/church`

**Arquivo criado:** `routes/church.js`  
**Registrada em:** `server.js` como `app.use('/api/church', require('./routes/church'))`

#### `GET /api/church`
Retorna todos os dados da igreja do usuário autenticado.

**Fluxo:**
1. Valida o token JWT via `authMiddleware`
2. Busca o `church_id` do usuário em `db_user`
3. Busca o registro completo em `db_church` pelo `church_id`
4. Retorna `{ church: { ...todosOsCampos } }`

```js
router.get('/', authMiddleware, async (req, res) => {
  const { data: dbUser } = await supabaseAdmin
    .from('db_user')
    .select('church_id')
    .eq('user_id', req.authUser.id)
    .single()

  const { data: church } = await supabaseAdmin
    .from('db_church')
    .select('*')
    .eq('id', dbUser.church_id)
    .single()

  res.json({ church })
})
```

**Autenticação:** Bearer token (Supabase JWT)  
**Autorização:** Usuário só acessa a igreja vinculada ao seu próprio `church_id`

---

## 3. Modelo de dados relevante

### `db_church` (campos utilizados)
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid | Chave primária |
| `name` | text | Nome da igreja |
| `slug` | text | Identificador URL |
| `logo_url` | text | URL da logo |
| `is_active` | boolean | Igreja ativa |
| `cnpj` | text | CNPJ *(se existir na tabela)* |
| `email` | text | E-mail *(se existir na tabela)* |
| `phone` | text | Telefone *(se existir na tabela)* |
| `website` | text | Site *(se existir na tabela)* |
| `instagram` | text | Instagram *(se existir na tabela)* |
| `youtube` | text | YouTube *(se existir na tabela)* |
| `address` | text | Logradouro *(se existir na tabela)* |
| `number` | text | Número *(se existir na tabela)* |
| `complement` | text | Complemento *(se existir na tabela)* |
| `city` | text | Cidade *(se existir na tabela)* |
| `state` | text | Estado *(se existir na tabela)* |
| `zip_code` | text | CEP *(se existir na tabela)* |

### Fluxo de autenticação e dados da igreja
```
Login (POST /api/auth/login)
  └─ Supabase Auth valida email/senha
  └─ Busca db_user JOIN db_church
  └─ Retorna { access_token, usuario, igreja }
       └─ Frontend salva no localStorage:
            localStorage.setItem('usuario', JSON.stringify(dados.usuario))
            localStorage.setItem('igreja',  JSON.stringify(dados.igreja))
```

---

## 4. Rotas da aplicação

### Páginas (HTML)
| Método | Rota | Arquivo |
|---|---|---|
| GET | `/` | `public/login.html` |
| GET | `/dashboard` | `public/dashboard.html` |
| GET | `/editar-perfil` | `public/editar-perfil.html` |
| GET | `/configuracoes` | `public/configuracoes.html` *(novo)* |

### API REST
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/api/auth/login` | ✗ | Login com email/senha |
| GET | `/api/auth/me` | ✓ | Dados do usuário logado |
| POST | `/api/auth/logout` | ✓ | Logout |
| PUT | `/api/user/profile` | ✓ | Atualizar perfil |
| GET | `/api/user/generos` | ✓ | Lista de gêneros |
| GET | `/api/user/estados-civis` | ✓ | Lista de estados civis |
| GET | `/api/church` | ✓ | Dados da igreja *(novo)* |

---

## 5. Pontos de atenção e próximos passos

### Colunas extras na `db_church`
Os campos `cnpj`, `email`, `phone`, `website`, `instagram`, `youtube`, `address`, `number`, `complement`, `city`, `state` e `zip_code` podem ainda não existir na tabela. Para adicioná-los, executar no Supabase SQL Editor:

```sql
ALTER TABLE db_church
  ADD COLUMN IF NOT EXISTS cnpj        text,
  ADD COLUMN IF NOT EXISTS email       text,
  ADD COLUMN IF NOT EXISTS phone       text,
  ADD COLUMN IF NOT EXISTS website     text,
  ADD COLUMN IF NOT EXISTS instagram   text,
  ADD COLUMN IF NOT EXISTS youtube     text,
  ADD COLUMN IF NOT EXISTS address     text,
  ADD COLUMN IF NOT EXISTS number      text,
  ADD COLUMN IF NOT EXISTS complement  text,
  ADD COLUMN IF NOT EXISTS city        text,
  ADD COLUMN IF NOT EXISTS state       text,
  ADD COLUMN IF NOT EXISTS zip_code    text;
```

### Rota PUT `/api/church` (salvar alterações)
O botão "Salvar alterações" do formulário Geral ainda não persiste os dados no banco. É necessário implementar `PUT /api/church` em `routes/church.js`.

### Demais seções de configuração
Os cards Permissões, Perguntas, Check-in, Escalas, Gamificação, Notificações, Personalização Visual, Administradores e Convites ainda não têm comportamento implementado.
