# PRD — Dummy Live | Plataforma de Transmissão ao Vivo White-Label

**Produto:** Dummy Live (nome de trabalho)
**Versão do documento:** 2.0
**Autor:** Dummy Filmes
**Status:** Draft para desenvolvimento
**Última atualização:** Julho de 2026
**Stakeholders:** Direção Dummy · Rafael (tech/dev) · Maria (conteúdo/estratégia) · Produção

---

## 0. Sumário Executivo

Dummy Live é uma plataforma proprietária de transmissão ao vivo (live) da Dummy Filmes, arquitetada como **white-label multi-tenant**: um único código-base atende N clientes distintos, onde cada cliente recebe uma instância visualmente customizada (KV — Key Visual) apenas trocando um arquivo de configuração JSON — sem tocar em código.

A plataforma entrega: (1) uma tela de entrada gated com email + senha única; (2) uma sala de transmissão com player Vimeo + chat ao vivo; (3) moderação por papéis (admin/moderador); (4) **rastreamento granular do comportamento do espectador** (tempo online, consumo real de vídeo, drop-off, interações); e (5) dashboard + exportação de dados para relatório ao cliente.

**Por que existe:** plataformas abertas (YouTube, Zoom, Vimeo público) não entregam controle de marca total nem os dados granulares de audiência que a Dummy precisa para provar resultado e alimentar seu ecossistema de dados (Dummy Lab / Analytics). Esta plataforma fecha esse gap e vira um produto reaplicável a cada cliente de evento/live.

**Decisões já tomadas (fechadas):**
- Banco de dados: **Supabase (Postgres)**.
- White-label: **config por arquivo JSON por cliente**.
- Acesso do espectador: **email + senha única para todos**.

---

## 1. Visão Geral do Produto

### 1.1. Objetivos

| # | Objetivo | Métrica de sucesso |
|---|---|---|
| O1 | Ambiente de live 100% controlado pela Dummy | Zero dependência de plataforma aberta durante a transmissão |
| O2 | Capturar dados granulares de audiência | 100% das lives com relatório de tempo/consumo/interação exportável |
| O3 | Reaplicável a clientes distintos com esforço mínimo | Setup de novo cliente ≤ 1 dia útil |
| O4 | Marca do cliente 100% respeitada | Nenhuma marca "Dummy" ou terceiros visível ao espectador final (white-label real) |
| O5 | Estável sob carga de evento ao vivo | Zero downtime na janela de transmissão |

### 1.2. Não-Objetivos (fora de escopo da v1)

- Ingestão/encoding do sinal (segue sendo feito pela infra de transmissão da Dummy → Vimeo Live).
- Pagamento/paywall (gating é só email + senha).
- App mobile nativo (v1 é web responsiva/PWA-friendly).
- CDN de vídeo próprio (o Vimeo é o CDN de vídeo).
- Edição de vídeo dentro da plataforma.

### 1.3. Princípios de Design

1. **Um código, N clientes.** Nada específico de cliente vive no código — vive no JSON.
2. **White-label de verdade.** O espectador nunca vê "Dummy". Vê a marca do cliente.
3. **Dado é produto.** Cada segundo assistido e cada interação são capturados e exportáveis.
4. **Evento ao vivo não perdoa.** Robustez e degradação graciosa acima de features.
5. **LGPD desde o início.** Consentimento e minimização de dados por padrão.
6. **Mobile é o cenário principal, não o secundário.** A maioria dos espectadores de uma live corporativa entra pelo celular. A experiência precisa ser impecável em desktop, Android e iPhone — com paridade real entre iOS Safari e Android Chrome. Nenhuma funcionalidade (vídeo, chat, tracking) pode degradar em nenhuma dessas plataformas.

---

## 2. Personas e Papéis

### 2.1. Personas

- **Espectador (viewer):** convidado do cliente. Entra com email + senha única, assiste, interage no chat. Não sabe que a Dummy está por trás.
- **Moderador:** operador (Dummy ou cliente) que cuida do chat durante a live. Credencial individual.
- **Administrador:** gestor da live. Configura, acompanha dados em tempo real, exporta relatórios, gerencia staff. Credencial individual.
- **Operador Dummy (super-admin, interno):** cria clientes/lives, sobe JSONs, gerencia infra. Papel interno, acima do admin do cliente.

### 2.2. Matriz de Permissões

| Ação | Espectador | Moderador | Admin | Super-admin |
|---|:---:|:---:|:---:|:---:|
| Entrar com senha única | ✅ | ✅ | ✅ | ✅ |
| Assistir vídeo | ✅ | ✅ | ✅ | ✅ |
| Enviar mensagem no chat | ✅ | ✅ | ✅ | ✅ |
| Apagar mensagem | ❌ | ✅ | ✅ | ✅ |
| Silenciar/banir usuário | ❌ | ✅ | ✅ | ✅ |
| Fixar mensagem | ❌ | ✅ | ✅ | ✅ |
| Enviar mensagem oficial | ❌ | ✅ | ✅ | ✅ |
| Mudar status da live | ❌ | ❌ | ✅ | ✅ |
| Ver dashboard de dados | ❌ | ❌ | ✅ | ✅ |
| Exportar relatório | ❌ | ❌ | ✅ | ✅ |
| Promover staff | ❌ | ❌ | ✅ | ✅ |
| Criar/editar cliente e JSON | ❌ | ❌ | ❌ | ✅ |
| Acessar todas as lives | ❌ | ❌ | ❌ | ✅ |

---

## 3. Fluxos de Usuário

### 3.1. Fluxo do Espectador

```
1. Acessa URL da live (slug/subdomínio do cliente)
2. [Tela de Entrada] — vê o KV do cliente
3. Preenche EMAIL + SENHA ÚNICA (+ campos extras se configurados)
4. Aceita consentimento LGPD (checkbox)
5. Submete
   ├─ Senha incorreta → erro, permanece
   ├─ Email banido → mensagem de bloqueio
   ├─ Live "aguardando" → tela de espera (countdown/mensagem)
   ├─ Live "encerrada" → tela de encerramento
   └─ OK → cria participante + sessão → [Sala de Transmissão]
6. [Sala de Transmissão]
   ├─ Player Vimeo (área principal)
   ├─ Chat ao vivo (lateral/inferior)
   ├─ Tracking rodando (heartbeat + eventos de vídeo + interações)
   └─ Ao sair/fechar aba → fecha sessão, grava tempo_online
```

### 3.2. Fluxo do Moderador

```
1. Acessa URL da live + rota /staff (ou toggle de login staff)
2. [Login Staff] — email + SENHA INDIVIDUAL (Supabase Auth)
3. [Sala de Transmissão + Painel de Moderação]
   ├─ Vê chat com controles (apagar, mutar, banir, fixar)
   ├─ Badge de moderador visível
   └─ Pode enviar mensagem oficial
```

### 3.3. Fluxo do Administrador

```
1. [Login Staff] — email + senha individual (papel = admin)
2. [Sala de Transmissão + Painel de Moderação + acesso ao Dashboard]
3. [Dashboard de Dados]
   ├─ Tempo real: online agora, pico, msgs/min, curva de audiência
   ├─ Controle: mudar status da live (aguardando → ao vivo → encerrada)
   ├─ Pós-evento: tabela de participantes, retenção, ranking de trechos
   └─ Exportar CSV/XLSX
```

### 3.4. Fluxo de Setup (Super-admin / Operador Dummy)

```
1. Cria registro do cliente/live no banco
2. Sobe o JSON de config (KV + settings) — via painel ou repositório
3. Define senha única de espectador
4. Cadastra emails de staff (admin/moderador) e envia convites
5. Testa a URL do cliente
6. Entrega o link ao cliente
```

---

## 4. Requisitos Funcionais

### 4.1. Tela de Entrada (Gate)

| ID | Requisito | Prioridade |
|---|---|:---:|
| RF-01 | Campo de **email** obrigatório, validado (regex + normalização lowercase/trim) | P0 |
| RF-02 | Campo de **senha única** (mesma para todos os espectadores da live; por cliente) | P0 |
| RF-03 | Ao submeter: valida senha → registra/recupera participante → verifica papel → cria sessão → redireciona | P0 |
| RF-04 | Emails de staff usam login próprio (rota separada), não a senha única | P0 |
| RF-05 | Tela exibe KV do cliente (logo, cores, fundo, textos) lido do JSON | P0 |
| RF-06 | Mensagens de erro claras: senha incorreta, email inválido, banido, live não iniciada/encerrada | P0 |
| RF-07 | Campos extras opcionais (nome, empresa, cargo…) configuráveis via JSON | P1 |
| RF-08 | Checkbox de consentimento LGPD com link para política de privacidade | P0 |
| RF-09 | Persistência de sessão (o espectador que recarrega não precisa logar de novo enquanto a sessão é válida) | P1 |
| RF-10 | Anti-abuso: limite de tentativas de senha por IP (ex.: 10/min) | P1 |

### 4.2. Sala de Transmissão

| ID | Requisito | Prioridade |
|---|---|:---:|
| RF-11 | Player **Vimeo** embarcado via Vimeo Player SDK, área principal | P0 |
| RF-12 | Chat ao vivo ao lado (desktop) / abaixo (mobile) | P0 |
| RF-13 | Layout responsivo (desktop, tablet, mobile) | P0 |
| RF-14 | Estados da live: `aguardando` / `ao_vivo` / `encerrada`, controlados pelo admin, refletidos em tempo real | P0 |
| RF-15 | Toda a página respeita o KV (cores via CSS variables, logo, fontes, favicon, título da aba) | P0 |
| RF-16 | Contador de espectadores online (opcional/exibível por config) | P1 |
| RF-17 | Reações rápidas (emojis flutuantes) — feature toggle | P2 |
| RF-18 | Enquetes ao vivo lançadas pelo admin — feature toggle | P2 |
| RF-19 | CTA configurável (botão/banner com link) — feature toggle, e clique é rastreado | P1 |
| RF-20 | Modo "somente vídeo" (chat desligado) por config | P2 |

### 4.3. Chat ao Vivo

| ID | Requisito | Prioridade |
|---|---|:---:|
| RF-21 | Mensagens em tempo real via Supabase Realtime | P0 |
| RF-22 | Exibe identificação do usuário + timestamp | P0 |
| RF-23 | Badge visual distinto para moderador/admin | P0 |
| RF-24 | Rate limiting anti-spam (ex.: 1 msg / X seg, configurável) | P0 |
| RF-25 | Filtro de palavras proibidas (lista por cliente) | P1 |
| RF-26 | Mensagens fixadas (pinned) aparecem destacadas no topo | P1 |
| RF-27 | Auto-scroll com pausa ao rolar para cima; botão "novas mensagens" | P1 |
| RF-28 | Limite de caracteres por mensagem (ex.: 280) | P1 |
| RF-29 | Sanitização de input (anti-XSS, sem HTML injetável) | P0 |
| RF-30 | Emojis suportados; links renderizados com segurança (rel=noopener) | P2 |

### 4.4. Moderação

| ID | Requisito | Prioridade |
|---|---|:---:|
| RF-31 | Apagar qualquer mensagem (soft-delete: marca `apagada`, some para todos) | P0 |
| RF-32 | Silenciar usuário por tempo determinado ou permanente | P0 |
| RF-33 | Banir usuário (remove da live + bloqueia reentrada pelo email) | P0 |
| RF-34 | Fixar/desafixar mensagem | P1 |
| RF-35 | Enviar mensagem oficial (destaque de staff) | P1 |
| RF-36 | Painel lateral de moderação com lista de usuários online e ações rápidas | P1 |
| RF-37 | Log de ações de moderação (quem apagou/baniu o quê e quando) | P1 |

### 4.5. Rastreamento de Dados (Tracking) — NÚCLEO DE VALOR

| ID | Requisito | Prioridade |
|---|---|:---:|
| RF-38 | **Tempo total online** por sessão: entrada → saída, via heartbeat a cada 20s | P0 |
| RF-39 | Detecção de queda/abandono: sem heartbeat por > 60s = sessão encerrada automaticamente | P0 |
| RF-40 | **Consumo real de vídeo** via Vimeo SDK: eventos `play`, `pause`, `seeked`, `timeupdate`, `ended` | P0 |
| RF-41 | **Aba em foco vs. segundo plano** via Page Visibility API (distingue "aba aberta" de "assistindo de fato") | P0 |
| RF-42 | **Watch-through / drop-off:** registrar por marcos (0/10/25/50/75/90/100%) quais o participante atingiu | P0 |
| RF-43 | **Trechos consumidos vs. não consumidos:** mapa de quais segundos/minutos do vídeo foram efetivamente vistos | P1 |
| RF-44 | **Interações:** contagem de mensagens no chat, cliques em CTA, reações, respostas de enquete | P0 |
| RF-45 | **Metadados de sessão:** dispositivo, SO, navegador, resolução de tela, timezone, horário entrada/saída | P1 |
| RF-46 | Todos os eventos gravados no Supabase com timestamp, associados a participante + sessão + live | P0 |
| RF-47 | Envio de eventos em batch (buffer client-side, flush a cada N seg ou N eventos) para não sobrecarregar | P1 |
| RF-48 | `sendBeacon` no unload para garantir gravação do fechamento da sessão | P1 |

**Eventos de tracking (catálogo):**

| Evento | Quando dispara | Payload |
|---|---|---|
| `session_start` | Entra na sala | dispositivo, navegador, resolução, timezone |
| `heartbeat` | A cada 20s | aba_visivel (bool), video_playing (bool), video_time |
| `video_play` | Play no player | video_time |
| `video_pause` | Pause | video_time |
| `video_seek` | Seek/scrub | de → para |
| `video_milestone` | Atinge 10/25/50/75/90/100% | percentual |
| `tab_hidden` | Aba vai a 2º plano | video_time |
| `tab_visible` | Aba volta ao foco | video_time |
| `chat_message` | Envia mensagem | tamanho_texto |
| `cta_click` | Clica no CTA | cta_id, url |
| `reaction` | Reação | tipo |
| `poll_answer` | Responde enquete | poll_id, opção |
| `session_end` | Sai/fecha aba | tempo_online_seg, motivo (saiu/queda) |

### 4.6. Autenticação de Staff (Admin/Moderador)

| ID | Requisito | Prioridade |
|---|---|:---:|
| RF-49 | Staff usa **credencial individual** (email + senha própria) via Supabase Auth | P0 |
| RF-50 | Admin promove email a moderador/admin pelo painel | P1 |
| RF-51 | Distinção clara entre "senha única da live" (espectador) e "senha individual" (staff) | P0 |
| RF-52 | Recuperação de senha de staff (fluxo Supabase Auth) | P1 |
| RF-53 | Sessão de staff expira e exige reautenticação após período configurável | P1 |

### 4.7. Dashboard de Dados (Admin)

| ID | Requisito | Prioridade |
|---|---|:---:|
| RF-54 | **Tempo real:** espectadores online agora, pico de audiência, mensagens/minuto | P0 |
| RF-55 | **Curva de audiência** ao longo do tempo (entradas/saídas → retenção) | P0 |
| RF-56 | **Tabela de participantes** pós-evento: email, nome, tempo online, % de vídeo assistido, nº de interações | P0 |
| RF-57 | **Ranking de trechos** mais assistidos e pontos de maior abandono | P1 |
| RF-58 | **Exportação** CSV e XLSX (por participante e agregado) | P0 |
| RF-59 | Controle de status da live pelo dashboard | P0 |
| RF-60 | Filtros por período, por papel, por dispositivo | P2 |
| RF-61 | Cartões-resumo (KPIs): total de participantes únicos, tempo médio, % conclusão médio, total de mensagens | P1 |

### 4.8. Configuração White-Label (KV) — via JSON

| ID | Requisito | Prioridade |
|---|---|:---:|
| RF-62 | Cada cliente tem **um JSON de config** que define toda a camada visual e comportamental | P0 |
| RF-63 | Nenhuma mudança de código para novo cliente — só novo JSON + registro no banco | P0 |
| RF-64 | O JSON controla identidade, cores, tipografia, textos, configurações e feature toggles (ver §4.9) | P0 |
| RF-65 | Troca de cliente por slug de URL ou subdomínio | P0 |
| RF-66 | Validação de schema do JSON no carregamento (erro claro se inválido) | P1 |
| RF-67 | Fallback para tema default se um campo estiver ausente | P1 |
| RF-68 | (Fase 4) Editor visual do tema no painel admin, gravando de volta no JSON/DB | P2 |

### 4.9. Schema do JSON de Cliente (completo)

```json
{
  "cliente": "nome-do-cliente",
  "slug": "cliente-2026",
  "evento": {
    "nome": "Convenção Anual 2026",
    "subtitulo": "Transmissão exclusiva ao vivo",
    "vimeo_video_id": "123456789",
    "vimeo_is_live": true,
    "status": "aguardando",
    "data_inicio": "2026-08-15T20:00:00-03:00"
  },
  "acesso": {
    "senha_unica_espectador": "SENHA2026",
    "campos_extras": [
      { "id": "nome", "label": "Nome completo", "obrigatorio": true },
      { "id": "empresa", "label": "Empresa", "obrigatorio": false },
      { "id": "cargo", "label": "Cargo", "obrigatorio": false }
    ],
    "consentimento_lgpd_texto": "Autorizo a coleta de dados de participação conforme a Política de Privacidade.",
    "link_politica_privacidade": "https://cliente.com/privacidade"
  },
  "kv": {
    "logo": "https://cdn.dummy.com/cliente/logo.svg",
    "logo_escuro": "https://cdn.dummy.com/cliente/logo-dark.svg",
    "favicon": "https://cdn.dummy.com/cliente/favicon.png",
    "imagem_fundo_entrada": "https://cdn.dummy.com/cliente/bg.jpg",
    "cores": {
      "primaria": "#FF6B00",
      "secundaria": "#0A0A0A",
      "fundo": "#111111",
      "superficie": "#1A1A1A",
      "texto": "#FFFFFF",
      "texto_secundario": "#A0A0A0",
      "destaque": "#B8FF57",
      "erro": "#FF1477",
      "sucesso": "#B8FF57"
    },
    "tipografia": {
      "titulo": "Inter",
      "corpo": "DM Sans",
      "mono": "JetBrains Mono",
      "google_fonts_url": "https://fonts.googleapis.com/..."
    },
    "layout": {
      "posicao_chat": "direita",
      "tema": "escuro",
      "raio_borda": "12px"
    }
  },
  "textos": {
    "titulo_entrada": "Bem-vindo à transmissão",
    "boas_vindas": "Insira seus dados para acessar.",
    "aguardando": "A transmissão começa em breve.",
    "ao_vivo_label": "AO VIVO",
    "encerrada": "A transmissão foi encerrada. Obrigado por participar.",
    "erro_senha": "Senha incorreta. Tente novamente.",
    "rodape": "© Cliente 2026 — Todos os direitos reservados"
  },
  "features": {
    "chat": true,
    "reacoes": true,
    "enquetes": false,
    "cta": {
      "ativo": true,
      "texto": "Saiba mais",
      "url": "https://cliente.com/oferta",
      "posicao": "abaixo_do_video"
    },
    "contador_online": true,
    "rate_limit_segundos": 5,
    "limite_caracteres_msg": 280,
    "palavras_proibidas": []
  },
  "tracking": {
    "heartbeat_seg": 20,
    "milestones_percentuais": [10, 25, 50, 75, 90, 100],
    "granularidade_trecho_seg": 5
  }
}
```

---

## 5. Requisitos Não-Funcionais

| ID | Requisito |
|---|---|
| RNF-01 | **Escalabilidade:** suportar picos de audiência simultânea (alvo a definir por evento — ver §10). Realtime + connection pooling do Supabase; considerar Realtime dedicado para lives grandes. |
| RNF-02 | **Performance:** carregamento inicial da sala < 3s; latência do chat < 1s. |
| RNF-03 | **Disponibilidade:** zero downtime na janela de transmissão; página de fallback se o Vimeo cair. |
| RNF-04 | **Responsividade / multiplataforma (crítico):** experiência de primeira classe em **desktop, tablet e mobile**, com paridade funcional entre **Android (Chrome)** e **iOS (Safari)**. Nada pode "só funcionar no desktop" ou "só no Android". Ver §7.5 para a especificação completa de mobile e a matriz de compatibilidade. |
| RNF-05 | **Segurança:** senhas de staff com hash (gerenciado pelo Supabase Auth); senha única com hash no banco; RLS (Row Level Security) no Postgres; validação server-side; sanitização anti-XSS no chat; rate limit em endpoints sensíveis. |
| RNF-06 | **LGPD:** consentimento explícito na entrada; minimização de dados; política de retenção; direito de exclusão/exportação; dados hospedados com base legal clara. |
| RNF-07 | **Manutenibilidade:** código-base único; clientes diferenciados só por config; testes automatizados dos fluxos críticos. |
| RNF-08 | **Observabilidade:** logs de erro, monitoramento de sessões ativas, alertas em falha de gravação de eventos. |
| RNF-09 | **Degradação graciosa:** se o tracking falhar, o espectador continua assistindo; se o chat cair, o vídeo segue. |
| RNF-10 | **Acessibilidade:** contraste mínimo AA, navegação por teclado, legendas do Vimeo respeitadas. |
| RNF-11→18 | **Adequação à Vercel:** o sistema deve rodar na Vercel. Regras de arquitetura serverless (Realtime no Supabase direto, endpoints stateless, tenant via Edge Middleware, Cron em vez de worker, segredos em env vars). Detalhamento completo em §6.5. |

---

## 6. Arquitetura Técnica

### 6.1. Stack Recomendada

- **Frontend:** Next.js (React) — SSR para a tela de entrada, client-side para a sala; tema dirigido por CSS variables injetadas do JSON.
- **Backend/BD:** **Supabase** — Postgres + Auth + Realtime + Storage + Edge Functions.
  - **Postgres:** dados relacionais (lives, participantes, sessões, eventos, mensagens).
  - **Realtime:** chat + contador de audiência.
  - **Auth:** credenciais de staff.
  - **Storage:** assets de KV (ou CDN externo).
  - **Edge Functions:** validação de senha, ingestão de eventos em batch, agregações do dashboard, exportações.
- **Player:** Vimeo Player SDK (`@vimeo/player`).
- **Hospedagem:** **Vercel** (frontend Next.js + API Routes/Edge Functions) + **Supabase** (Postgres, Auth, Realtime, Storage gerenciados). Ver §6.5 para as implicações de rodar na Vercel.
- **Fila de tracking (opcional para escala):** buffer client-side + endpoint de ingestão em batch (Route Handler na Vercel).

### 6.2. Modelo de Dados (SQL — Supabase/Postgres)

```sql
-- Clientes/eventos
create table lives (
  id uuid primary key default gen_random_uuid(),
  cliente_slug text unique not null,
  nome text not null,
  vimeo_video_id text not null,
  senha_unica_hash text not null,
  status text not null default 'aguardando'
    check (status in ('aguardando','ao_vivo','encerrada')),
  config_json jsonb not null,
  data_inicio timestamptz,
  created_at timestamptz default now()
);

-- Participantes (espectadores)
create table participantes (
  id uuid primary key default gen_random_uuid(),
  live_id uuid references lives(id) on delete cascade,
  email text not null,
  nome text,
  campos_extras jsonb default '{}',
  papel text not null default 'espectador'
    check (papel in ('espectador','moderador','admin')),
  banido boolean default false,
  silenciado_ate timestamptz,
  created_at timestamptz default now(),
  unique (live_id, email)
);

-- Sessões de presença
create table sessoes (
  id uuid primary key default gen_random_uuid(),
  participante_id uuid references participantes(id) on delete cascade,
  live_id uuid references lives(id) on delete cascade,
  entrou_em timestamptz default now(),
  saiu_em timestamptz,
  tempo_online_seg integer default 0,
  tempo_video_assistido_seg integer default 0,
  percentual_concluido integer default 0,
  dispositivo text,
  sistema_operacional text,
  navegador text,
  resolucao text,
  timezone text
);

-- Eventos granulares de tracking
create table eventos_tracking (
  id bigint generated always as identity primary key,
  sessao_id uuid references sessoes(id) on delete cascade,
  live_id uuid references lives(id) on delete cascade,
  tipo text not null,
  payload jsonb default '{}',
  video_time numeric,
  aba_visivel boolean,
  ts timestamptz default now()
);
create index on eventos_tracking (live_id, ts);
create index on eventos_tracking (sessao_id, tipo);

-- Chat
create table mensagens_chat (
  id bigint generated always as identity primary key,
  live_id uuid references lives(id) on delete cascade,
  participante_id uuid references participantes(id) on delete cascade,
  texto text not null,
  fixada boolean default false,
  apagada boolean default false,
  is_staff boolean default false,
  created_at timestamptz default now()
);
create index on mensagens_chat (live_id, created_at);

-- Log de moderação
create table log_moderacao (
  id bigint generated always as identity primary key,
  live_id uuid references lives(id) on delete cascade,
  staff_email text not null,
  acao text not null,
  alvo text,
  detalhe jsonb default '{}',
  ts timestamptz default now()
);

-- Staff (complementa Supabase Auth)
create table staff (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid,
  email text not null,
  live_id uuid references lives(id) on delete cascade,
  papel text not null check (papel in ('moderador','admin','super_admin')),
  created_at timestamptz default now(),
  unique (live_id, email)
);
```

**Row Level Security (RLS):** ativar em todas as tabelas. Espectadores só leem/escrevem no escopo da própria live e sessão; staff tem policies conforme papel; exportações e agregações passam por Edge Functions com service role.

### 6.3. Multi-tenant / White-label

- **Estratégia:** um deploy, roteamento por **slug** (`live.dummyfilmes.com.br/cliente-2026`) ou **subdomínio** (`cliente.live.dummyfilmes.com.br`).
- No load, o app resolve o slug → busca `lives.config_json` → injeta CSS variables + textos + feature toggles em runtime.
- Novo cliente = novo registro em `lives` + novo JSON. Zero deploy.
- **Isolamento de dados:** toda query filtra por `live_id`; RLS garante que um cliente não vê dados de outro.

### 6.4. Ingestão de Tracking em Escala

- Client acumula eventos num buffer e faz flush a cada 10s ou 25 eventos.
- Endpoint (Edge Function) recebe em batch e insere em `eventos_tracking`.
- `navigator.sendBeacon` no `beforeunload`/`visibilitychange=hidden` garante o `session_end`.
- Job periódico (cron) fecha sessões órfãs (sem heartbeat > 60s) e recalcula agregados em `sessoes`.

### 6.5. Adequação à Vercel (requisito de plataforma)

O sistema **deve** rodar na Vercel. Isso é uma restrição de arquitetura, não um detalhe de deploy — muda como algumas peças precisam ser construídas.

**O que a Vercel resolve bem (e vamos usar):**
- **Hospedagem do Next.js** (SSR na tela de entrada, cliente na sala) com deploy automático via Git.
- **API Routes / Route Handlers** para endpoints: validar senha única, ingerir tracking em batch, servir config do cliente, exportações.
- **Edge Middleware** para resolver o cliente por **slug ou subdomínio** e injetar o contexto do tenant (ideal para o white-label multi-tenant).
- **Vercel Cron Jobs** para fechar sessões órfãs e recalcular agregados (substitui um worker persistente).
- **CDN global + cache** para os assets de KV e a config, deixando a tela de entrada rápida em 4G.
- **Preview Deploys** por branch para validar um KV de cliente novo antes de ir ao ar.

**O que a Vercel NÃO faz (e por isso vai para o Supabase):**
- **Conexões persistentes / WebSocket.** Funções serverless da Vercel são efêmeras e têm timeout — **não seguram** um socket de chat aberto por horas. Por isso o **chat em tempo real e o contador de audiência rodam no Supabase Realtime**, com o cliente conectando **direto** ao Supabase (WebSocket), sem passar por função da Vercel. A Vercel serve o app; o Supabase serve o tempo real.
- **Processos de longa duração.** Nada de worker "sempre ligado" na Vercel — trabalho contínuo vira Cron (Vercel) ou função agendada/trigger (Supabase).

**Regras de engenharia para conformidade com Vercel:**

| ID | Regra | Motivo |
|---|---|:---:|
| RNF-11 | Realtime (chat + online agora) via **Supabase Realtime direto do cliente**, nunca via socket na função Vercel | Serverless não mantém conexão persistente |
| RNF-12 | Respeitar o **timeout de função** (manter endpoints rápidos; exportação pesada em background/streaming) | Limite de execução serverless |
| RNF-13 | Ingestão de tracking **stateless e idempotente** (retry seguro; cada função é efêmera) | Sem estado entre invocações |
| RNF-14 | Segredos (service role do Supabase, chaves) via **Environment Variables da Vercel**, nunca no client | Segurança |
| RNF-15 | Resolução de tenant (slug/subdomínio) via **Edge Middleware** | Multi-tenant performático |
| RNF-16 | Tarefas agendadas via **Vercel Cron** ou trigger do Supabase, não worker persistente | Sem processo long-running |
| RNF-17 | Uploads de assets de KV para **Supabase Storage / CDN externo**, não para o filesystem da Vercel (efêmero) | Filesystem serverless não persiste |
| RNF-18 | Config wildcard de subdomínio no domínio (`*.live.dummyfilmes.com.br`) suportada no projeto Vercel | White-label por subdomínio |

**Divisão de responsabilidades (resumo):**

```
Cliente (browser desktop/mobile)
   │
   ├─ HTTP ──────────────►  VERCEL (Next.js)
   │                         • Tela de entrada (SSR) + Sala (client)
   │                         • Edge Middleware: resolve o cliente (slug/subdomínio)
   │                         • API Routes: valida senha, ingere tracking (batch), exporta
   │                         • Cron: fecha sessões órfãs, recalcula agregados
   │
   └─ WebSocket ────────►  SUPABASE
                             • Realtime: chat + contador online (conexão direta)
                             • Postgres + RLS: dados, sessões, eventos, mensagens
                             • Auth: staff
                             • Storage: assets de KV
```

**Custos/limites a validar:** plano da Vercel adequado ao volume de invocações de tracking (heartbeat de milhares de espectadores gera muitas requisições — o batch de eventos em §6.4 existe justamente para reduzir isso) e limites de execução de função. Dimensionar junto com o alvo de audiência simultânea (§10, item 1).

---

## 7. Especificação de Telas

### 7.1. Tela de Entrada
- Fundo: `imagem_fundo_entrada` ou cor de fundo do KV.
- Logo centralizado.
- Card com: título de entrada, campos (email, senha, extras), checkbox LGPD, botão de acesso.
- Estados: idle, carregando, erro (senha/email/banido), aguardando (countdown), encerrada.
- Link discreto "Sou da equipe" → login de staff.

### 7.2. Sala de Transmissão
- **Desktop:** grid 70/30 — vídeo à esquerda, chat à direita. CTA abaixo do vídeo se ativo. Badge "AO VIVO" + contador online no topo do vídeo.
- **Mobile:** vídeo no topo (sticky), chat abaixo em tela cheia rolável.
- Header: logo do cliente + status da live.
- Footer: rodapé configurável.

### 7.3. Painel de Moderação (overlay/lateral no staff)
- Lista de mensagens com botões (apagar, fixar, mutar autor, banir autor).
- Lista de usuários online + busca.
- Campo de "mensagem oficial".

### 7.4. Dashboard (Admin)
- Linha de KPIs (participantes únicos, online agora, pico, tempo médio, % conclusão médio, total mensagens).
- Gráfico de curva de audiência (linha temporal).
- Gráfico de retenção de vídeo (barras por marco 0→100%).
- Tabela de participantes (ordenável/filtrável) + botão Exportar.
- Controle de status da live.

### 7.5. Mobile & Multiplataforma (Desktop · Android · iPhone)

A live precisa funcionar **muito bem** nos três ambientes, com **paridade funcional** entre Android (Chrome) e iOS (Safari). Mobile é tratado como cenário principal — não como adaptação do desktop.

**Layout mobile (portrait):**
- Vídeo no topo, **sticky** ao rolar (permanece visível enquanto o chat rola por baixo).
- Chat ocupa a área abaixo do vídeo, rolável, com input fixo no rodapé.
- Área de toque dos botões ≥ 44×44px (padrão de acessibilidade de toque).
- Sem hover-dependência: toda interação funciona por toque.
- Suporte a landscape: vídeo em tela cheia + chat sobreposto/oculto opcional.

**Requisitos funcionais adicionais:**

| ID | Requisito | Prioridade |
|---|---|:---:|
| RF-69 | Layout mobile-first: vídeo sticky no topo + chat rolável + input fixo no rodapé | P0 |
| RF-70 | Paridade funcional Android Chrome ↔ iOS Safari (vídeo, chat, tracking idênticos) | P0 |
| RF-71 | Player Vimeo com `playsinline` (evita fullscreen forçado no iPhone ao dar play) | P0 |
| RF-72 | Tratamento de autoplay: iOS/Android exigem play iniciado por gesto do usuário; exibir botão de "Assistir" claro (não depender de autoplay com som) | P0 |
| RF-73 | Input do chat respeita o teclado virtual (viewport encolhe, input não fica escondido) — usar `dvh`/`svh`, não `100vh` | P0 |
| RF-74 | Tracking confiável em mobile: `visibilitychange` cobre troca de app, tela bloqueada e mudança de aba (iOS não dispara `beforeunload` de forma confiável) | P0 |
| RF-75 | `sendBeacon` no `visibilitychange=hidden` para gravar `session_end` mesmo quando o usuário troca de app ou bloqueia a tela | P0 |
| RF-76 | Safe areas do iPhone (notch/Dynamic Island/home indicator) respeitadas via `env(safe-area-inset-*)` | P1 |
| RF-77 | Consumo de bateria/dados controlado: heartbeat e batch de eventos otimizados em mobile | P1 |
| RF-78 | Reconexão automática do chat (Realtime) ao voltar de segundo plano / troca de rede (Wi-Fi ↔ 4G/5G) | P0 |
| RF-79 | Fontes e imagens do KV com `font-display: swap` e formatos leves (WebP/SVG) para carga rápida em 4G | P1 |
| RF-80 | Testado em telas pequenas (≥ 320px de largura) sem quebra de layout | P1 |

**Armadilhas conhecidas de mobile a tratar (notas de engenharia):**
- **iOS não dispara `beforeunload` de forma confiável.** O fechamento de sessão e o flush final de tracking devem depender de `visibilitychange` + `pagehide` + `sendBeacon`, nunca só de `beforeunload`.
- **`100vh` é bugado no mobile** (barra de endereço do navegador). Usar `100dvh`/`100svh` para evitar que o input do chat ou o vídeo fiquem cortados.
- **Autoplay com som é bloqueado** em iOS e Android. O play precisa de gesto do usuário; a UI deve deixar isso natural (botão grande "Assistir ao vivo").
- **`playsinline` obrigatório** no embed do Vimeo, senão o iPhone joga o vídeo em fullscreen nativo e quebra o layout da sala + o chat.
- **Teclado virtual** empurra/encolhe o viewport de forma diferente em iOS e Android — testar o input do chat com teclado aberto nos dois.
- **Troca de rede e segundo plano:** o Realtime do chat precisa reconectar sozinho; o tracking precisa costurar a sessão (não contar como abandono uma troca rápida de app).

**Matriz de compatibilidade (alvo de teste):**

| Plataforma | Navegador | Status alvo |
|---|---|---|
| Desktop Windows | Chrome, Edge, Firefox | Suporte total |
| Desktop macOS | Safari, Chrome | Suporte total |
| Android (celular/tablet) | Chrome | Suporte total |
| iPhone / iPad | Safari | Suporte total |
| iPhone | Chrome (motor WebKit) | Suporte total |

**Critérios de aceite mobile:** ver §9 (bloco "Mobile & Multiplataforma").

---

## 8. LGPD e Privacidade

- **Base legal:** consentimento (checkbox obrigatório na entrada) + legítimo interesse para métricas agregadas.
- **Minimização:** coletar só o necessário (email + campos configurados + comportamento na live).
- **Transparência:** link para política de privacidade do cliente no gate.
- **Retenção:** definir prazo (ex.: dados brutos por 90 dias, agregados por 12 meses) — configurável.
- **Direitos do titular:** rotina de exportação e de exclusão por email a pedido.
- **Segurança:** dados criptografados em trânsito (TLS) e em repouso (Supabase); acesso restrito por RLS.
- **Responsabilidade:** definir controlador (cliente) vs. operador (Dummy) em contrato.

---

## 9. Critérios de Aceite (por épico)

**Gate**
- Dado um email válido + senha única correta, o espectador entra na sala e um registro em `participantes` + `sessoes` é criado.
- Dado senha incorreta, exibe erro e não cria sessão.
- Dado email banido, bloqueia entrada.

**Sala + Vídeo**
- O player Vimeo carrega o `vimeo_video_id` do JSON e reproduz.
- O KV do cliente é aplicado (cores, logo, fonte, favicon, título da aba).

**Chat**
- Mensagem enviada aparece para todos os participantes em < 1s.
- Rate limit bloqueia envio acima do configurado.
- Staff aparece com badge.

**Moderação**
- Moderador apaga mensagem e ela some para todos.
- Usuário banido não consegue reentrar.

**Tracking**
- Ao final, cada sessão tem `tempo_online_seg`, `tempo_video_assistido_seg` e `percentual_concluido` corretos.
- Marcos de vídeo (25/50/75/100%) são registrados.
- Fechar a aba grava `session_end`.

**Dashboard**
- Online agora reflete a realidade em tempo real.
- Exportação gera CSV/XLSX com uma linha por participante e os campos-chave.

**White-label**
- Trocar o JSON muda 100% do visual sem tocar em código.
- Dois clientes na mesma instância não veem dados um do outro.

**Mobile & Multiplataforma**
- A live abre, reproduz vídeo, permite chat e grava tracking de forma idêntica em Desktop, Android Chrome e iPhone Safari.
- Dar play no iPhone reproduz o vídeo **inline** (dentro da sala), sem entrar em fullscreen nativo forçado.
- Com o teclado virtual aberto, o input do chat permanece visível e utilizável em iOS e Android.
- Trocar de app / bloquear a tela / trocar de rede grava corretamente `session_end` (ou reconecta) e não corrompe o tempo online.
- Layout não quebra de 320px (celular pequeno) até desktop grande.
- Áreas de toque ≥ 44px; nenhuma ação depende de hover.

---

## 10. Perguntas em Aberto (decidir antes do dev)

1. **Alvo de audiência simultânea por evento** (500? 2.000? 10.000?) — define o tier de Supabase e se precisamos de Realtime dedicado.
2. **Granularidade do tracking de vídeo:** por marcos (25/50/75/100%) é suficiente, ou precisamos do mapa segundo-a-segundo (mais pesado)?
3. **Reações/enquetes/CTA:** MVP ou Fase posterior?
4. **Retenção de dados (LGPD):** por quanto tempo guardar dados brutos vs. agregados?
5. **Roteamento white-label:** subdomínio por cliente ou slug de path?
6. **Recuperação de queda de vídeo:** exibir fallback ou tela de "sinal instável"?
7. **Idioma:** só PT-BR ou multi-idioma por cliente (i18n via JSON)?

---

## 11. Roadmap por Fases

| Fase | Escopo | Requisitos |
|---|---|---|
| **F1 — MVP** | Gate (email + senha única), player Vimeo, chat básico, tracking de tempo online + heartbeat + marcos de vídeo, config JSON, KV aplicado, **mobile-first funcionando em Desktop + Android + iPhone** | RF-01→06, 08, 11→15, 21→24, 29, 38→42, 44, 46, 62→65, **69→75, 78** |
| **F2 — Moderação** | Login staff, papéis, apagar/mutar/banir, fixar, mensagem oficial, painel de moderação, log | RF-04, 23, 31→37, 49→53 |
| **F3 — Dados** | Tracking granular (drop-off, trechos), dashboard em tempo real + pós-evento, exportação CSV/XLSX | RF-43, 45, 47→48, 54→61 |
| **F4 — Extras** | Reações, enquetes, CTA rastreado, campos extras, editor visual de tema no admin, i18n | RF-07, 17→20, 66→68 |

---

## 12. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Pico de audiência acima do previsto derruba o Realtime | Alto | Definir alvo antes; tier adequado; teste de carga pré-evento |
| Vimeo cai durante a live | Alto | Player com fallback + link de contingência; monitorar |
| Perda de eventos de tracking no fechamento da aba | Médio | `sendBeacon` + reconciliação por heartbeat + cron de sessões órfãs |
| JSON de cliente malformado quebra a página | Médio | Validação de schema + fallback para tema default |
| Vazamento de dados entre clientes | Alto | RLS rigorosa + filtro por `live_id` em toda query + testes |
| Spam/abuso no chat | Médio | Rate limit + filtro de palavras + moderação ativa |
| Comportamento divergente iOS vs Android (autoplay, `beforeunload`, `100vh`, teclado) quebra vídeo/chat/tracking no celular | Alto | `playsinline` + gesto de play + `visibilitychange`/`sendBeacon` + `dvh` + teste real nos dois SOs antes de cada evento |
| Tentar segurar chat/WebSocket dentro de função serverless da Vercel (não suportado) | Alto | Chat e "online agora" via Supabase Realtime direto do cliente; Vercel só serve app e endpoints stateless (ver §6.5) |
| Volume de requisições de heartbeat estoura limites/custo da Vercel | Médio | Batch de eventos (flush a cada 10s/25 eventos) + heartbeat a cada 20s; dimensionar plano ao alvo de audiência |

---

## Anexo A — Glossário

- **KV (Key Visual):** identidade visual do cliente aplicada à instância.
- **White-label:** produto Dummy operando invisivelmente sob a marca do cliente.
- **Gate:** tela de entrada com controle de acesso.
- **Heartbeat:** sinal periódico que confirma que o espectador segue online.
- **Watch-through / drop-off:** proporção do vídeo assistida / ponto onde o público abandona.
- **RLS (Row Level Security):** controle de acesso a nível de linha no Postgres.
- **Multi-tenant:** múltiplos clientes num mesmo sistema, com dados isolados.
