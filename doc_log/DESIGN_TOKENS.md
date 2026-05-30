# Design Tokens — Hug App
> Leia este arquivo antes de criar ou editar qualquer CSS, componente ou página.
> Todas as cores, tipografia, espaçamentos e bordas do sistema estão definidos aqui.
> NUNCA use cores hardcoded — sempre use as variáveis CSS definidas abaixo.

---

## Paleta de Cores

### Cores Principais

| Nome | Variável | Hex | Uso |
|---|---|---|---|
| Polaris Purple | `--primary` | `#9156F1` | Botões, links, destaques, ativo |
| Polaris Purple Dark | `--primary-dark` | `#7340D4` | Hover de botões |
| Polaris Purple Light | `--primary-light` | `#EDE5FF` | Backgrounds suaves, badges |
| Polaris Purple 10% | `--primary-10` | `rgba(145, 86, 241, 0.1)` | Fundos muito sutis |
| Lightyear Lavender | `--lavender` | `#D4A3E2` | Badges informativos, destaques suaves |
| Lightyear Lavender Light | `--lavender-light` | `#F5EEFF` | Background de seções roxas |

### Cores Neutras

| Nome | Variável | Hex | Uso |
|---|---|---|---|
| Blackhole Burgundy | `--dark` | `#201E4B` | Sidebar, fundos escuros, títulos |
| Carbon | `--carbon` | `#1C1C1C` | Textos principais |
| Nebula Neutral | `--background` | `#ECE9E7` | Fundo das páginas |
| White | `--white` | `#FFFFFF` | Cards, inputs, modais |

### Escala de Cinzas

| Nome | Variável | Hex | Uso |
|---|---|---|---|
| Gray 100 | `--gray-100` | `#F5F3F0` | Bordas suaves, fundos alternativos |
| Gray 200 | `--gray-200` | `#E8E5E2` | Divisórias, bordas de cards |
| Gray 300 | `--gray-300` | `#D1CEC9` | Bordas de inputs |
| Gray 400 | `--gray-400` | `#9E9B96` | Ícones inativos |
| Gray 500 | `--gray-500` | `#7A7772` | Labels, placeholders |
| Gray 600 | `--gray-600` | `#5C5955` | Textos secundários |
| Gray 900 | `--gray-900` | `#1C1C1C` | Textos principais |

### Cores Funcionais (Status)

| Nome | Variável | Hex | Uso |
|---|---|---|---|
| Galactic Green | `--success` | `#C6E7A3` | Concluído, ativo, confirmado |
| Galactic Green Dark | `--success-dark` | `#5A9E2F` | Texto sobre fundo verde |
| Galactic Green Light | `--success-light` | `#F0FAE8` | Background de sucesso |
| Amber | `--warning` | `#F59E0B` | Pendente, atenção, em andamento |
| Amber Dark | `--warning-dark` | `#B45309` | Texto sobre fundo amarelo |
| Amber Light | `--warning-light` | `#FEF9C3` | Background de atenção |
| Rose Red | `--danger` | `#E85D6A` | Excluir, erro, recusado |
| Rose Red Dark | `--danger-dark` | `#C0394A` | Texto sobre fundo vermelho |
| Rose Red Light | `--danger-light` | `#FEE8EA` | Background de erro |

---

## Variáveis CSS Completas

Cole isso no `:root` de todas as páginas ou em um arquivo CSS global:

```css
:root {
  /* === CORES PRINCIPAIS === */
  --primary:          #9156F1;
  --primary-dark:     #7340D4;
  --primary-light:    #EDE5FF;
  --primary-10:       rgba(145, 86, 241, 0.1);
  --lavender:         #D4A3E2;
  --lavender-light:   #F5EEFF;

  /* === NEUTROS === */
  --dark:             #201E4B;
  --carbon:           #1C1C1C;
  --background:       #ECE9E7;
  --white:            #FFFFFF;

  /* === CINZAS === */
  --gray-100:         #F5F3F0;
  --gray-200:         #E8E5E2;
  --gray-300:         #D1CEC9;
  --gray-400:         #9E9B96;
  --gray-500:         #7A7772;
  --gray-600:         #5C5955;
  --gray-900:         #1C1C1C;

  /* === TEXTOS === */
  --text-primary:     #1C1C1C;
  --text-secondary:   #5C5955;
  --text-muted:       #9E9B96;
  --text-inverse:     #FFFFFF;

  /* === BORDAS === */
  --border:           #E8E5E2;
  --border-light:     #F5F3F0;
  --border-input:     #D1CEC9;

  /* === STATUS === */
  --success:          #C6E7A3;
  --success-dark:     #5A9E2F;
  --success-light:    #F0FAE8;

  --warning:          #F59E0B;
  --warning-dark:     #B45309;
  --warning-light:    #FEF9C3;

  --danger:           #E85D6A;
  --danger-dark:      #C0394A;
  --danger-light:     #FEE8EA;

  /* === SIDEBAR === */
  --sidebar-bg:       #201E4B;
  --sidebar-icon:     #9E9B96;
  --sidebar-active:   #9156F1;
  --sidebar-text:     #FFFFFF;
  --sidebar-width:    72px;

  /* === BORDAS ARREDONDADAS === */
  --radius-xs:        4px;
  --radius-sm:        8px;
  --radius-md:        12px;
  --radius-lg:        20px;
  --radius-xl:        28px;
  --radius-pill:      100px;

  /* === SOMBRAS === */
  --shadow-xs:        0 1px 3px rgba(0,0,0,0.04);
  --shadow-sm:        0 2px 8px rgba(0,0,0,0.06);
  --shadow-md:        0 4px 16px rgba(0,0,0,0.08);
  --shadow-lg:        0 8px 32px rgba(0,0,0,0.12);
  --shadow-xl:        0 16px 48px rgba(0,0,0,0.16);

  /* === TIPOGRAFIA === */
  --font-family:      'Plus Jakarta Sans', sans-serif;
  --font-xs:          11px;
  --font-sm:          12px;
  --font-base:        14px;
  --font-md:          16px;
  --font-lg:          18px;
  --font-xl:          24px;
  --font-2xl:         32px;

  /* === ESPAÇAMENTOS === */
  --space-1:          4px;
  --space-2:          8px;
  --space-3:          12px;
  --space-4:          16px;
  --space-5:          20px;
  --space-6:          24px;
  --space-8:          32px;
  --space-10:         40px;
  --space-12:         48px;

  /* === Z-INDEX === */
  --z-dropdown:       100;
  --z-sticky:         200;
  --z-modal:          300;
  --z-toast:          400;
  --z-loader:         9999;
}
```

---

## Uso por Componente

### Botões

```css
/* Primário */
.btn-primary {
  background: var(--primary);
  color: var(--white);
  border-radius: var(--radius-pill);
}
.btn-primary:hover {
  background: var(--primary-dark);
}

/* Perigo (excluir) */
.btn-danger {
  background: var(--danger-light);
  color: var(--danger-dark);
  border-radius: var(--radius-pill);
}
.btn-danger:hover {
  background: var(--danger);
  color: var(--white);
}

/* Ghost */
.btn-ghost {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
}
```

### Badges de Status

```css
/* Ativo / Concluído */
.badge-success {
  background: var(--success-light);
  color: var(--success-dark);
  border-radius: var(--radius-pill);
}

/* Pendente / Em andamento */
.badge-warning {
  background: var(--warning-light);
  color: var(--warning-dark);
  border-radius: var(--radius-pill);
}

/* Erro / Excluído / Recusado */
.badge-danger {
  background: var(--danger-light);
  color: var(--danger-dark);
  border-radius: var(--radius-pill);
}

/* Informativo */
.badge-info {
  background: var(--primary-light);
  color: var(--primary-dark);
  border-radius: var(--radius-pill);
}

/* Neutro */
.badge-neutral {
  background: var(--gray-100);
  color: var(--gray-600);
  border-radius: var(--radius-pill);
}
```

### Cards

```css
.card {
  background: var(--white);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  padding: var(--space-6);
}

/* Card de destaque (roxo) */
.card-primary {
  background: var(--primary);
  color: var(--white);
  border-radius: var(--radius-lg);
}

/* Card de destaque escuro */
.card-dark {
  background: var(--dark);
  color: var(--white);
  border-radius: var(--radius-lg);
}
```

### Inputs

```css
.input {
  background: var(--white);
  border: 1px solid var(--border-input);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-family: var(--font-family);
  font-size: var(--font-base);
}
.input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-10);
  outline: none;
}
```

### Alertas

```css
/* Borda colorida à esquerda */
.alert {
  background: var(--white);
  border-radius: var(--radius-md);
  border-left: 4px solid;
  padding: var(--space-4);
}
.alert-warning { border-color: var(--warning); }
.alert-danger   { border-color: var(--danger); }
.alert-success  { border-color: var(--success-dark); }
.alert-info     { border-color: var(--primary); }
```

---

## Mapeamento de Status do Sistema

| Situação | Cor | Variável |
|---|---|---|
| Ativo / Confirmado / Concluído | Verde | `--success` / `--success-dark` |
| Pendente / Em andamento / Atenção | Amarelo | `--warning` / `--warning-dark` |
| Excluído / Erro / Recusado / Perigo | Rosa-vermelho | `--danger` / `--danger-dark` |
| Informação / Destaque | Roxo | `--primary` / `--primary-light` |
| Neutro / Inativo / Arquivado | Cinza | `--gray-400` / `--gray-100` |
| Lavanda / Suave | Lavanda | `--lavender` / `--lavender-light` |

---

## Regras de Uso

1. **NUNCA** use cores hardcoded — sempre `var(--nome-da-variavel)`
2. **Botão primário** → sempre `--primary` com texto branco
3. **Botão de excluir** → sempre `--danger` ou `--danger-light`
4. **Status pendente** → sempre `--warning` ou `--warning-light`
5. **Textos sobre fundo escuro** → sempre `--white` ou `--text-inverse`
6. **Bordas de cards** → sempre `--border` (nunca mais escuro)
7. **Sidebar** → sempre `--dark` (`#201E4B`) como fundo
8. **Fundo das páginas** → sempre `--background` (`#ECE9E7`)
9. **Cards** → sempre `--white` como fundo
10. **Fonte** → sempre `'Plus Jakarta Sans'` via `--font-family`
