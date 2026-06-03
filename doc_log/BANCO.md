# BANCO DE DADOS — Hug App
> Leia este arquivo antes de criar qualquer tabela, rota ou migration.
> Siga exatamente o modelo definido aqui — não adicione campos extras, não mude nomes de tabelas, não altere os status definidos.

---

## Regras Gerais

- **Toda tabela tem `church_id`** — `uuid NOT NULL REFERENCES db_church(id) ON DELETE CASCADE`
- **Toda tabela tem `created_at`** — `timestamptz NOT NULL DEFAULT now()`
- **Toda tabela tem `updated_at`** com trigger `set_updated_at()` (exceto tabelas sem UPDATE)
- **RLS ativo em todas as tabelas**
- **Policy padrão:** `USING (church_id = get_my_church_id())`
- **Inserções sempre incluem `church_id` vindo do backend via `db_user`**, nunca do body da requisição
- **Exclusão lógica** via `is_active = false` — nunca DELETE físico em tabelas principais

---

## Hierarquia do Sistema

```
db_church
└── db_ministry
    ├── db_ministry_lider → db_user
    └── db_department
        ├── db_department_lider → db_user
        └── db_funcao_dept
└── db_member
    ├── db_member_dept → db_department + db_funcao_dept
    ├── db_disponibilidade
    └── db_indisponibilidade → db_department
└── db_template_event
    ├── db_template_dept → db_department
    └── db_template_funcao → db_department + db_funcao_dept
└── db_event
    ├── db_escala → db_department
    │   └── db_escala_item → db_member + db_funcao_dept
    ├── db_cronograma
    │   └── db_cronograma_item → db_musica
    └── db_checkin → db_member + db_local_checkin
└── db_local_checkin
└── db_musica
└── db_notificacao → db_user
└── db_notificacao_tipo
└── db_config
└── db_perfil
    └── db_perfil_permissao → db_permissao
└── db_permissao
└── db_log → db_user
└── db_contrato → db_church
    └── db_contrato_modulo → db_modulo
└── db_modulo
```

---

## Tabelas

### `db_church` — Igrejas
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid PK | — |
| name | text | Nome da igreja |
| slug | text | Identificador URL |
| logo_url | text | URL da logo |
| cnpj | text | CNPJ |
| email | text | E-mail |
| phone | text | Telefone |
| website | text | Site |
| instagram | text | Instagram |
| youtube | text | YouTube |
| address | text | Logradouro |
| number | text | Número |
| complement | text | Complemento |
| neighborhood | text | Bairro |
| city | text | Cidade |
| state | char(2) | Estado (UF) |
| zip_code | text | CEP |
| is_active | boolean | Igreja ativa |
| created_at | timestamptz | — |

---

### `db_user` — Usuários do sistema (admins, líderes)
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid PK | — |
| user_id | uuid FK | ID no Supabase Auth |
| church_id | uuid FK | Igreja vinculada |
| perfil_id | uuid FK | → db_perfil |
| nickname | text | Apelido |
| full_name | text | Nome completo |
| email | text | E-mail |
| phone | text | Telefone |
| avatar_url | text | URL do avatar |
| genero_id | uuid FK | → db_genero |
| status_civil_id | uuid FK | → db_status_civil |
| birth_date | date | — |
| is_active | boolean | — |
| created_at | timestamptz | — |
| updated_at | timestamptz | — |

---

### `db_ministry` — Ministérios
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid PK | — |
| church_id | uuid FK | → db_church |
| name | text NOT NULL | Nome do ministério |
| description | text | Descrição |
| is_active | boolean DEFAULT true | Ativo/arquivado |
| created_at | timestamptz | — |
| updated_at | timestamptz | — |

---

### `db_ministry_lider` — Líderes de Ministério
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid PK | — |
| church_id | uuid FK | → db_church |
| ministry_id | uuid FK | → db_ministry |
| user_id | uuid FK | → db_user |
| created_at | timestamptz | — |
| UNIQUE | — | (ministry_id, user_id) |

**Regras:**
- Um ministério pode ter mais de um líder
- O líder do ministério pode ser também líder de departamento
- Ao vincular como líder → verificar se user tem perfil `lider`

---

### `db_department` — Departamentos
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid PK | — |
| church_id | uuid FK | → db_church |
| ministry_id | uuid FK | → db_ministry |
| name | text NOT NULL | Nome do departamento |
| description | text | Descrição |
| is_active | boolean DEFAULT true | Ativo/arquivado |
| created_at | timestamptz | — |
| updated_at | timestamptz | — |

---

### `db_department_lider` — Líderes de Departamento
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid PK | — |
| church_id | uuid FK | → db_church |
| department_id | uuid FK | → db_department |
| user_id | uuid FK | → db_user |
| created_at | timestamptz | — |
| UNIQUE | — | (department_id, user_id) |

**Regras:**
- Um departamento pode ter mais de um líder
- O líder do ministério pode ser líder de departamentos dentro dele
- Ao vincular como líder → verificar se user tem perfil `lider`

---

### `db_funcao_dept` — Funções por Departamento
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid PK | — |
| church_id | uuid FK | → db_church |
| department_id | uuid FK | → db_department |
| name | text NOT NULL | Nome da função |
| description | text | Descrição |
| is_active | boolean DEFAULT true | Ativa |
| created_at | timestamptz | — |
| updated_at | timestamptz | — |

---

### `db_member` — Membros e Voluntários
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid PK | — |
| church_id | uuid FK | → db_church |
| full_name | text NOT NULL | Nome completo |
| apelido | text | Apelido |
| email | text | E-mail |
| phone | text | Telefone |
| whatsapp | text | WhatsApp |
| birth_date | date | Data de nascimento |
| photo_url | text | URL da foto |
| genero_id | uuid FK | → db_genero |
| status_civil_id | uuid FK | → db_status_civil |
| cpf | text | CPF (membresia) |
| rg | text | RG (membresia) |
| address | text | Logradouro |
| number | text | Número |
| complement | text | Complemento |
| neighborhood | text | Bairro |
| city | text | Cidade |
| state | char(2) | Estado (UF) |
| zip_code | text | CEP |
| emergency_contact_name | text | Contato de emergência |
| emergency_contact_phone | text | Telefone emergência |
| is_baptized | boolean DEFAULT false | Batizado (membresia) |
| baptism_date | date | Data do batismo |
| baptism_church | text | Igreja do batismo |
| membership_date | date | Data de membresia |
| is_member | boolean DEFAULT false | Módulo membresia ativo |
| is_volunteer | boolean DEFAULT false | Módulo voluntário ativo |
| is_active | boolean DEFAULT true | Ativo |
| notes | text | Observações |
| created_at | timestamptz | — |
| updated_at | timestamptz | — |

---

### `db_member_dept` — Vínculo Membro ↔ Departamento ↔ Função
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid PK | — |
| church_id | uuid FK | → db_church |
| member_id | uuid FK | → db_member |
| department_id | uuid FK | → db_department |
| funcao_id | uuid FK nullable | → db_funcao_dept |
| status | text DEFAULT 'ativo' | ativo \| inativo \| pendente |
| joined_at | date DEFAULT current_date | Data de entrada |
| created_at | timestamptz | — |
| updated_at | timestamptz | — |

---

### `db_template_event` — Templates de Evento
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid PK | — |
| church_id | uuid FK | → db_church |
| name | text NOT NULL | Nome do template |
| tags | text[] DEFAULT '{}' | Tags (array nativo PG) |
| is_active | boolean DEFAULT true | Ativo |
| created_at | timestamptz | — |
| updated_at | timestamptz | — |

---

### `db_template_dept` — Departamentos do Template
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid PK | — |
| church_id | uuid FK | → db_church |
| template_id | uuid FK | → db_template_event |
| department_id | uuid FK | → db_department |
| created_at | timestamptz | — |
| UNIQUE | — | (template_id, department_id) |

---

### `db_template_funcao` — Funções e Vagas do Template
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid PK | — |
| church_id | uuid FK | → db_church |
| template_id | uuid FK | → db_template_event |
| department_id | uuid FK | → db_department |
| funcao_id | uuid FK | → db_funcao_dept |
| vagas | int DEFAULT 1 | Número de vagas |
| created_at | timestamptz | — |
| UNIQUE | — | (template_id, department_id, funcao_id) |

---

### `db_event` — Eventos
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid PK | — |
| church_id | uuid FK | → db_church |
| template_id | uuid FK nullable | → db_template_event |
| parent_event_id | uuid FK nullable | → db_event (recorrência) |
| name | text NOT NULL | Nome do evento |
| description | text | Descrição |
| location | text[] DEFAULT '{}' | Locais (array) |
| start_date | date NOT NULL | Data de início |
| end_date | date | Data de término |
| start_time | time | Horário de início |
| end_time | time | Horário de término |
| has_setlist | boolean DEFAULT false | Precisa de setlist |
| has_cronograma | boolean DEFAULT false | Tem cronograma |
| recurrence_type | text | null \| semanal \| quinzenal \| mensal_dia \| mensal_semana \| personalizado |
| recurrence_end_date | date | Até quando a recorrência vale |
| recurrence_config | jsonb | Config da recorrência (ver abaixo) |
| status | text DEFAULT 'agendado' | agendado \| concluido \| cancelado \| rascunho |
| is_active | boolean DEFAULT true | Ativo |
| created_at | timestamptz | — |
| updated_at | timestamptz | — |

**recurrence_config:**
```json
// semanal:       { "dia_semana": 1 }
// mensal_dia:    { "dia_mes": 15 }
// mensal_semana: { "semana": 1, "dia_semana": 5 }
// personalizado: { "datas": ["2026-05-17", "2026-05-24"] }
```

---

### `db_musica` — Repertório de Músicas
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid PK | — |
| church_id | uuid FK | → db_church |
| title | text NOT NULL | Título |
| artist | text | Artista/Banda |
| tom | text | Tom (C, D, E...) |
| bpm | int | BPM |
| duration | interval | Duração |
| deezer_url | text | Link Deezer |
| youtube_url | text | Link YouTube |
| cifra_url | text | Link cifra |
| is_active | boolean DEFAULT true | Ativa |
| created_at | timestamptz | — |
| updated_at | timestamptz | — |

---

### `db_cronograma` — Cronograma do Evento
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid PK | — |
| church_id | uuid FK | → db_church |
| event_id | uuid FK | → db_event |
| name | text NOT NULL | Nome do cronograma |
| created_at | timestamptz | — |
| updated_at | timestamptz | — |

---

### `db_cronograma_item` — Itens do Cronograma
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid PK | — |
| church_id | uuid FK | → db_church |
| event_id | uuid FK | → db_event |
| cronograma_id | uuid FK | → db_cronograma |
| musica_id | uuid FK nullable | → db_musica |
| type | text DEFAULT 'tarefa' | tarefa \| musica \| secao |
| title | text NOT NULL | Título do item |
| description | text | Descrição/observação |
| duration | interval | Duração (ex: '00:05:00') |
| ordem | int DEFAULT 0 | Ordem de exibição |
| created_at | timestamptz | — |
| updated_at | timestamptz | — |

---

### `db_escala` — Escala por Departamento num Evento
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid PK | — |
| church_id | uuid FK | → db_church |
| event_id | uuid FK | → db_event |
| department_id | uuid FK | → db_department |
| created_at | timestamptz | — |
| updated_at | timestamptz | — |
| UNIQUE | — | (event_id, department_id) |

---

### `db_escala_item` — Voluntários Escalados
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid PK | — |
| church_id | uuid FK | → db_church |
| escala_id | uuid FK | → db_escala |
| member_id | uuid FK | → db_member |
| funcao_id | uuid FK nullable | → db_funcao_dept |
| status | text DEFAULT 'pendente' | pendente \| confirmado \| recusado \| substituido \| ausente |
| notes | text | Observação do voluntário |
| created_at | timestamptz | — |
| updated_at | timestamptz | — |

---

### `db_indisponibilidade` — Bloqueios do Voluntário
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid PK | — |
| church_id | uuid FK | → db_church |
| member_id | uuid FK | → db_member |
| department_id | uuid FK nullable | → db_department |
| type | text NOT NULL | data_unica \| periodo \| departamento |
| start_date | date NOT NULL | Data início do bloqueio |
| end_date | date nullable | Data fim (null se data_unica) |
| notes | text | Observação |
| created_at | timestamptz | — |

**Regras:**
```
data_unica   → start_date = dia bloqueado, end_date = null, department_id = null
periodo      → start_date + end_date, department_id = null
departamento → start_date + end_date + department_id obrigatórios
```

---

### `db_disponibilidade` — Disponibilidade Semanal do Voluntário
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid PK | — |
| church_id | uuid FK | → db_church |
| member_id | uuid FK | → db_member |
| dia_semana | int NOT NULL | 0=dom, 1=seg, 2=ter, 3=qua, 4=qui, 5=sex, 6=sab |
| turno | text NOT NULL | manha \| tarde \| noite \| dia_todo |
| created_at | timestamptz | — |
| UNIQUE | — | (member_id, dia_semana, turno) |

**Turnos:**
```
manha    → 06:00 — 12:00
tarde    → 12:00 — 18:00
noite    → 18:00 — 00:00
dia_todo → 06:00 — 00:00
```

**Exemplo:**
```
Terça   → noite    (serve toda terça à noite)
Sábado  → manha   (serve todo sábado de manhã)
Domingo → dia_todo (serve domingo o dia todo)
```

**Uso na escalação:**
O sistema verifica db_disponibilidade antes de sugerir o voluntário.
Se o evento for numa terça às 19h e o voluntário só tem terça → noite cadastrado, ele aparece como disponível.
Se não tiver nenhum registro em db_disponibilidade, considera disponível sempre.

---

### `db_notificacao_tipo` — Tipos de Notificação
| id | code | name |
|---|---|---|
| 1 | escalado | Voluntário escalado |
| 2 | confirmou | Voluntário confirmou presença |
| 3 | recusou | Voluntário recusou escala |
| 4 | substituicao | Voluntário substituído |
| 5 | conflito_escala | Conflito de escala |
| 6 | novo_cadastro | Novo cadastro aguardando aprovação |

---

### `db_notificacao` — Notificações
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid PK | — |
| church_id | uuid FK | → db_church |
| user_id | uuid FK | → db_user (quem recebe) |
| tipo_id | int FK | → db_notificacao_tipo |
| title | text NOT NULL | Título |
| body | text NOT NULL | Conteúdo |
| event_id | uuid FK nullable | → db_event |
| member_id | uuid FK nullable | → db_member |
| escala_id | uuid FK nullable | → db_escala |
| is_read | boolean DEFAULT false | Lida |
| is_archived | boolean DEFAULT false | Arquivada pelo usuário |
| action_url | text nullable | Link direto para a origem |
| created_at | timestamptz | — |

**Polling:** verificar notificações não lidas a cada 30 segundos via `GET /api/notificacao/nao-lidas`
**Dropdown:** exibe as últimas 5 não lidas com link "Ver todas" → `/notificacoes`

---

### `db_log` — Log de Ações do Sistema
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid PK | — |
| church_id | uuid FK | → db_church |
| user_id | uuid FK nullable | → db_user (quem fez a ação) |
| action | text NOT NULL | created \| updated \| deleted \| published \| approved \| rejected |
| entity | text NOT NULL | member \| escala \| evento \| voluntario \| template \| ministerio |
| entity_id | uuid nullable | ID do registro afetado |
| description | text | Descrição legível da ação |
| metadata | jsonb nullable | Dados extras ex: `{ before: {...}, after: {...} }` |
| ip_address | text nullable | IP do usuário |
| created_at | timestamptz | — |

**Ações que DEVEM gerar log:**
```
✓ Aprovação/rejeição de cadastros de voluntários
✓ Publicação de escalas
✓ Exclusão de qualquer registro principal
✓ Alteração de escala após publicada
✓ Criação/edição de eventos
✓ Vinculação/remoção de líderes
```

**Exemplos de registros:**
```
action: 'approved'  entity: 'member'    → "Wallace aprovou cadastro de Lucas Cavalcanti"
action: 'published' entity: 'escala'    → "Ryan publicou escala da Recepção no evento Terça"
action: 'deleted'   entity: 'voluntario'→ "Wallace excluiu voluntário João Silva"
action: 'updated'   entity: 'escala'    → "Ryan alterou escala após publicação"
action: 'created'   entity: 'evento'    → "Wallace criou evento Culto da Família"
```

---

### `db_local_checkin` — Locais de Check-in
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid PK | — |
| church_id | uuid FK | → db_church |
| name | text NOT NULL | Nome do local (ex: "Templo Principal") |
| latitude | numeric(10,7) NOT NULL | Coordenada GPS |
| longitude | numeric(10,7) NOT NULL | Coordenada GPS |
| raio_metros | int DEFAULT 500 | Raio permitido em metros |
| is_active | boolean DEFAULT true | Ativo |
| created_at | timestamptz | — |
| updated_at | timestamptz | — |

---

### `db_checkin` — Registros de Presença
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid PK | — |
| church_id | uuid FK | → db_church |
| member_id | uuid FK | → db_member |
| event_id | uuid FK | → db_event |
| local_id | uuid FK nullable | → db_local_checkin |
| checkin_at | timestamptz | Horário do check-in |
| checkin_lat | numeric(10,7) | GPS no check-in |
| checkin_lng | numeric(10,7) | GPS no check-in |
| checkin_method | text DEFAULT 'gps' | gps \| qrcode \| manual |
| checkout_at | timestamptz | Horário do check-out |
| checkout_lat | numeric(10,7) | GPS no check-out |
| checkout_lng | numeric(10,7) | GPS no check-out |
| checkout_method | text | gps \| qrcode \| manual |
| status | text DEFAULT 'aguardando' | aguardando \| presente \| saiu \| atrasado |
| created_at | timestamptz | — |
| updated_at | timestamptz | — |
| UNIQUE | — | (member_id, event_id) |

**Fluxo:**
```
Voluntário escalado no evento → status: 'aguardando'
Faz check-in → status: 'presente', checkin_at = now()
Faz check-out → status: 'saiu', checkout_at = now()
Chegou após tolerância → status: 'atrasado'
```

**Configurações no db_config:**
```
checkin_geolocalizacao   → true | false (GPS obrigatório)
checkin_raio_metros      → int (raio permitido, default: 500)
checkin_radar_mapa       → true | false (exibir radar)
checkin_qrcode           → true | false (permitir QR Code)
checkin_checkout_manual  → true | false (checkout manual)
checkin_antecedencia_min → int (minutos antes do evento, default: 60)
checkin_tolerancia_min   → int (tolerância de atraso, default: 15)
checkin_modo_offline     → true | false (cache offline)
checkin_painel_ao_vivo   → true | false (tempo real)
checkin_validar_precisao → true | false (rejeitar GPS impreciso)
```

---
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid PK | — |
| church_id | uuid FK | → db_church |
| key | text NOT NULL | Chave da configuração |
| value | text NOT NULL | Valor |
| created_at | timestamptz | — |
| updated_at | timestamptz | — |
| UNIQUE | — | (church_id, key) |

**Chaves disponíveis:**
```
indisponibilidade_abre        → dia do mês (default: 1)
indisponibilidade_fecha       → dia do mês (default: 20)
escala_abre                   → dia do mês (default: 21)
escala_fecha                  → dia do mês (default: 28)
escala_alteracao_abre         → dia do mês (default: 29)
escala_automatica             → true | false (default: false)
escala_limite_por_dia         → true | false (default: false)
escala_limite_evento_por_dia  → true | false (default: true)
escala_notificar              → true | false (default: true)
escala_permitir_troca         → true | false (default: true)
escala_antecedencia_criar     → dias (default: 7)
escala_antecedencia_cancelar  → horas (default: 24)
```

---

### `db_perfil` — Perfis de Acesso
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid PK | — |
| church_id | uuid FK | → db_church |
| name | text NOT NULL | Nome do perfil |
| slug | text NOT NULL | Identificador único |
| is_default | boolean DEFAULT false | Perfil padrão do sistema |
| is_active | boolean DEFAULT true | Ativo |
| created_at | timestamptz | — |
| updated_at | timestamptz | — |
| UNIQUE | — | (church_id, slug) |

**Perfis padrão (is_default = true, imutáveis):**
```
slug: owner      → name: Dono        — acesso total (wildcard *)
slug: admin      → name: Admin       — mesmas permissões do Dono
slug: lider      → name: Líder       — ver ministérios/departamentos, gerenciar voluntários do seu dept,
                                       eventos, escalação, cronograma, músicas, template (só vagas)
slug: secretario → name: Secretário  — membros, voluntários, eventos, templates, músicas
slug: voluntario → name: Voluntário  — evento:ver, musica:ver, musica:criar, escala:ver
```

**Permissões por perfil:**

| Módulo | Ação | Dono | Admin | Líder | Secretário | Voluntário |
|---|---|---|---|---|---|---|
| ministerio | ver | ✓ | ✓ | ✓ | ✗ | ✗ |
| ministerio | criar/editar/arquivar | ✓ | ✓ | ✗ | ✗ | ✗ |
| departamento | ver | ✓ | ✓ | ✓ | ✗ | ✗ |
| departamento | criar/editar/arquivar | ✓ | ✓ | ✗ | ✗ | ✗ |
| funcao | ver | ✓ | ✓ | ✓ | ✗ | ✗ |
| funcao | criar/editar/arquivar | ✓ | ✓ | ✗ | ✗ | ✗ |
| membro | ver/criar/editar | ✓ | ✓ | ✗ | ✓ | ✗ |
| membro | excluir | ✓ | ✓ | ✗ | ✗ | ✗ |
| voluntario | ver/editar | ✓ | ✓ | ✓ | ✓ | ✗ |
| voluntario | criar/excluir | ✓ | ✓ | ✗ | ✓ | ✗ |
| evento | ver | ✓ | ✓ | ✓ | ✓ | ✓ |
| evento | criar/editar | ✓ | ✓ | ✗ | ✓ | ✗ |
| evento | cancelar | ✓ | ✓ | ✗ | ✗ | ✗ |
| template | ver | ✓ | ✓ | ✓ | ✓ | ✗ |
| template | editar (só vagas) | ✓ | ✓ | ✓ | ✓ | ✗ |
| template | criar/excluir | ✓ | ✓ | ✗ | ✓ | ✗ |
| escala | ver/criar/editar | ✓ | ✓ | ✓ | ✗ | ✓ (só ver) |
| cronograma | ver/criar/editar | ✓ | ✓ | ✓ | ✗ | ✗ |
| musica | ver | ✓ | ✓ | ✓ | ✓ | ✓ |
| musica | criar/editar | ✓ | ✓ | ✓ | ✓ | ✓ (pendente aprovação) |
| musica | excluir | ✓ | ✓ | ✗ | ✗ | ✗ |
| relatorio | ver | ✓ | ✓ | ✓ | ✗ | ✗ |
| financeiro | ver/criar/editar | ✓ | ✗ | ✗ | ✗ | ✗ |
| configuracao | ver/editar | ✓ | ✗ | ✗ | ✗ | ✗ |
| perfil | ver/criar/editar/excluir | ✓ | ✗ | ✗ | ✗ | ✗ |

**Menu lateral por perfil:**
```
Dono/Admin   → tudo
Líder        → Dashboard, Ministérios, Departamentos, Voluntários,
               Eventos, Escalação, Cronograma, Músicas, Templates
Secretário   → Dashboard, Membros, Voluntários, Eventos, Templates, Músicas
Voluntário   → Dashboard, Eventos, Escalação, Músicas, Indisponibilidade
```

**Restrições do Líder:**
```
Departamentos → vê apenas os que é líder
Voluntários   → vê apenas os do seu departamento
Escalação     → faz escala apenas do seu departamento
Templates     → apenas ajusta quantidade de vagas por função
```

---

### `db_permissao` — Permissões do Sistema
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid PK | — |
| module | text NOT NULL | Módulo do sistema |
| action | text NOT NULL | Ação permitida |
| description | text | Descrição |
| UNIQUE | — | (module, action) |

**Módulos e ações disponíveis:**
```
ministerio    → ver, criar, editar, arquivar
departamento  → ver, criar, editar, arquivar
funcao        → ver, criar, editar, arquivar
membro        → ver, criar, editar, excluir
voluntario    → ver, criar, editar, excluir
evento        → ver, criar, editar, cancelar
template      → ver, criar, editar, excluir
escala        → ver, criar, editar
cronograma    → ver, criar, editar
musica        → ver, criar, editar, excluir
relatorio     → ver
financeiro    → ver, criar, editar
configuracao  → ver, editar
perfil        → ver, criar, editar, excluir
```

---

### `db_perfil_permissao` — Permissões por Perfil
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid PK | — |
| church_id | uuid FK | → db_church |
| perfil_id | uuid FK | → db_perfil |
| permissao_id | uuid FK | → db_permissao |
| created_at | timestamptz | — |
| UNIQUE | — | (perfil_id, permissao_id) |

---

## Regras de Negócio Importantes

### Escala
- Um voluntário **pode** ser escalado em mais de um departamento no mesmo evento
- Se escalado em dois departamentos → notificar o líder que escalou primeiro (tipo_id: 5)
- Verificar `db_indisponibilidade` antes de sugerir voluntário
- Verificar janela de tempo via `db_config` antes de permitir criar/editar escala
- Estados da escala por período do mês:
  - Dias `indisponibilidade_abre` a `indisponibilidade_fecha` → voluntário cadastra indisponibilidade
  - Dias `escala_abre` a `escala_fecha` → líder faz a escala completa
  - A partir de `escala_alteracao_abre` → só alterações individuais

### Indisponibilidade
```sql
-- Query para verificar se voluntário está disponível
SELECT * FROM db_indisponibilidade
WHERE member_id = 'uuid'
AND (
  (type = 'data_unica' AND start_date = 'data-do-evento')
  OR (type = 'periodo' AND start_date <= 'data-do-evento' AND end_date >= 'data-do-evento')
  OR (type = 'departamento' AND department_id = 'uuid-dept'
      AND start_date <= 'data-do-evento' AND end_date >= 'data-do-evento')
)
```

### Exclusão lógica
- Ministérios, departamentos, funções, membros, templates, eventos → `is_active = false`
- Nunca DELETE físico nessas tabelas

### Multi-tenant
- Toda query inclui `.eq('church_id', churchId)`
- `church_id` sempre vem do `db_user` no backend, nunca do body da requisição

### Perfis e Permissões
- Perfis padrão (`is_default = true`) não podem ser editados nem excluídos
- Slugs `owner` e `admin` têm acesso total — retornam wildcard `*` nas permissões
- Identificação sempre pelo `slug`, nunca pelo `name`
- Verificação de permissão no backend via `middleware/checkPermissao.js`

### Fluxo de Login com Permissões
O login retorna as permissões do usuário para o frontend controlar o menu:

```js
// Backend — POST /api/auth/login retorna:
{
  access_token,
  refresh_token,
  usuario: {
    id, nome, email, avatar,
    perfil_slug,        // ex: 'voluntario', 'lider'
    permissions         // ex: ['evento:ver', 'musica:ver', 'musica:criar']
                        // owner/admin retornam ['*']
  },
  igreja: { id, nome, slug, logo }
}

// Frontend — salva no localStorage:
localStorage.setItem('permissions', JSON.stringify(usuario.permissions))
localStorage.setItem('perfil_slug', usuario.perfil_slug)

// Frontend — verifica permissão antes de exibir item do menu:
function temPermissao(module, action) {
  const permissions = JSON.parse(localStorage.getItem('permissions') || '[]')
  if (permissions.includes('*')) return true
  return permissions.includes(`${module}:${action}`)
}
```

### Menu lateral por perfil
```
Dono/Admin  → vee tudo
Líder       → Dashboard, Ministérios, Departamentos, Funções,
              Voluntários, Eventos, Escalação, Cronograma, Músicas
Secretário  → Dashboard, Membros, Voluntários, Eventos, Templates, Músicas
Voluntário  → Dashboard, Eventos (somente visualização), Músicas
```

---

### `db_modulo` — Módulos Disponíveis no Sistema
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid PK | — |
| name | text NOT NULL | Nome do módulo |
| slug | text UNIQUE | Identificador único |
| description | text | Descrição |
| is_active | boolean DEFAULT true | Ativo |
| created_at | timestamptz | — |

**Módulos cadastrados:**
```
voluntariado → Voluntariado
membresia    → Membresia
kids         → Kids
financeiro   → Financeiro
escalacao    → Escalação
cronograma   → Cronograma
musicas      → Músicas
```

---

### `db_contrato` — Contrato da Igreja
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid PK | — |
| church_id | uuid FK UNIQUE | → db_church |
| periodicidade | text DEFAULT 'mensal' | mensal \| trimestral \| anual |
| status | text DEFAULT 'trial' | trial \| ativo \| inadimplente \| bloqueado \| cancelado |
| inicio_em | date DEFAULT today | Início do contrato |
| vencimento_em | date NOT NULL | Data de vencimento |
| bloqueio_em | date | vencimento + 3 meses |
| valor | numeric(10,2) | Valor contratado |
| observacoes | text | Observações internas |
| created_by | uuid FK | → db_user (quem criou) |
| created_at | timestamptz | — |
| updated_at | timestamptz | — |

**Status do contrato:**
```
trial       → cadastrou mas ainda não assinou
ativo       → contrato ativo e em dia
inadimplente → passou do vencimento mas dentro dos 3 meses
bloqueado   → vencimento + 3 meses → acesso bloqueado automaticamente
cancelado   → contrato encerrado
```

---

### `db_contrato_modulo` — Módulos Contratados por Igreja
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid PK | — |
| contrato_id | uuid FK | → db_contrato |
| church_id | uuid FK | → db_church |
| modulo_id | uuid FK | → db_modulo |
| limite | int nullable | null = ilimitado, ex: 500 para voluntários |
| is_active | boolean DEFAULT true | Ativo |
| created_at | timestamptz | — |
| UNIQUE | — | (contrato_id, modulo_id) |

**Exemplo:**
```
Igreja X contratou:
└── voluntariado → limite: 500
└── membresia   → limite: null (ilimitado)
```

**Verificação de módulo no backend:**
```js
async function temModulo(churchId, moduloSlug) {
  const { data } = await supabaseAdmin
    .from('db_contrato_modulo')
    .select('limite, db_modulo(slug), db_contrato(status)')
    .eq('church_id', churchId)
    .eq('db_modulo.slug', moduloSlug)
    .eq('is_active', true)
    .single()

  if (!data) return false
  if (data.db_contrato.status === 'bloqueado') return false
  if (data.db_contrato.status === 'cancelado') return false
  return true
}
```

**Regras de inadimplência:**
```
vencimento_em < hoje → status: 'inadimplente'
vencimento_em + 3 meses < hoje → status: 'bloqueado' (automático)
Dono pode reativar manualmente a qualquer momento
```
