# Dummy Live — Plataforma de Transmissão ao Vivo White-Label

Plataforma multi-tenant de live streaming. Um único código-base atende N
clientes; cada cliente é uma instância visualmente customizada por um arquivo
de configuração JSON — sem tocar em código.

PRD completo: [`docs/PRD_Dummy_Live_White_Label.md`](docs/PRD_Dummy_Live_White_Label.md).

> **Checklist antes de uma live real (produção):**
> 1. Rode **`supabase/setup.sql`** no SQL Editor (schema + RLS + segurança). Se
>    já rodou uma versão antiga, rode ao menos **`0003_security.sql`** — ele
>    revoga do público as funções de senha (crítico) e isola o chat por live.
> 2. Defina as env vars na Vercel: `NEXT_PUBLIC_SUPABASE_URL`,
>    `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
>    **`GATE_COOKIE_SECRET`** (obrigatório em produção — 32+ chars) e
>    **`CRON_SECRET`** (obrigatório: o cron recusa sem ele em produção).
> 3. Crie a live do cliente e o **admin** (email na tabela `staff` + usuário no
>    Auth). Use o painel `/admin` para o resto.
> 4. Ponha o **`vimeo_video_id`** real do cliente (com embed liberado para o
>    domínio). Teste o play antes.
> 5. Dimensione o **plano do Supabase** ao pico de audiência (conexões Realtime
>    simultâneas) — ver §10.1 do PRD; faça um teste de carga.
> 6. Ligue **acessibilidade/contraste** revisando as cores do cliente no `/admin`.
>
> **Status: Fases 1 (MVP) e 2 (Moderação) implementadas.** Gate, player
> Vimeo, chat em tempo real, tracking de audiência, white-label por JSON,
> mobile-first — e login de staff (Supabase Auth), papéis, apagar/mutar/banir,
> fixar, mensagem oficial, painel de moderação e log. Fases 3–4 (dashboard,
> extras) ainda não implementadas — ver [Roadmap](#roadmap).

---

## Stack

- **Next.js 16** (App Router, TypeScript) — hospedagem na **Vercel**.
- **Supabase** (Postgres + RLS + Realtime + Auth) — dados e tempo real.
- **@vimeo/player** — player de vídeo.
- **Tailwind CSS 4** — estilo; tema dirigido por CSS variables do JSON.
- **Zod** — validação do JSON de cliente.

Roteamento white-label por **slug de path**: `…/<slug>` (ex.: `/demo`).

---

## Estrutura

```
app/
  page.tsx                 Landing
  [slug]/
    layout.tsx             Resolve tenant → injeta KV (CSS vars, fontes, título)
    page.tsx               Tela de Entrada (Gate)
    gate-form.tsx          Formulário do gate (client)
    sala/page.tsx          Sala de transmissão
    staff/page.tsx         Login de staff (Supabase Auth)
    moderacao/page.tsx     Painel de moderação (staff)
  api/
    gate/route.ts          Valida senha única, cria participante + sessão
    chat/route.ts          Envio de mensagem (sanitiza, rate limit, ban/mute)
    track/route.ts         Ingestão de tracking em batch + agregados
    mod/route.ts           Ações de moderação (autz por papel + log)
    cron/close-orphans/    Fecha sessões órfãs (Vercel Cron)
components/                Sala, VimeoPlayer, Chat, ModPanel, LiveLogo
lib/
  config/                  Schema Zod + loader por slug
  supabase/                Clients (browser, server/auth, admin, env)
  tracking/                Hook de tracking + tipos de evento
  staff.ts                 Contexto de staff (auth + papel)
  theme.ts, session.ts, chat.ts, rate-limit.ts, device.ts
config/clientes/<slug>.json  Config white-label por cliente
supabase/
  migrations/0001_init.sql Schema + RLS + RPCs + Realtime
  seed.sql                 Live de demonstração
```

---

## Rodando localmente

### Opção A — Preview de UI sem banco (mais rápido)

Sem Supabase, a UI renderiza a partir do JSON local (`config/clientes/`). O
gate, o chat e o tracking ficam desativados (retornam 503), mas você vê o
white-label, o layout e o player.

```bash
npm install
npm run dev
# abra http://localhost:3000/demo
```

### Opção B — Local completo com Supabase (precisa de Docker)

```bash
# 1. Supabase CLI + stack local (requer Docker Desktop rodando)
npx supabase init      # se ainda não houver supabase/config.toml
npx supabase start     # sobe Postgres + Auth + Realtime; imprime as chaves

# 2. Aplica migrations + seed (cria a live "demo", senha DEMO2026)
npx supabase db reset

# 3. Configure o ambiente
cp .env.example .env.local
#   preencha NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e
#   SUPABASE_SERVICE_ROLE_KEY com os valores impressos por `supabase start`
#   gere GATE_COOKIE_SECRET: openssl rand -base64 32

npm run dev
# http://localhost:3000/demo  → entre com qualquer email + senha "DEMO2026"
```

### Opção C — Supabase Cloud (sem Docker)

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Rode o conteúdo de `supabase/migrations/0001_init.sql` e depois
   `supabase/seed.sql` no **SQL Editor** (ou `npx supabase db push` com o
   projeto linkado).
3. Preencha `.env.local` com URL + anon key + service role key (Project
   Settings → API).
4. `npm run dev`.

---

## Adicionar um novo cliente (white-label)

Zero deploy de código. Dois passos:

1. **Config visual** — crie `config/clientes/<slug>.json` (copie `demo.json`
   e ajuste cores, textos, logo, features, `vimeo_video_id`). O schema é
   validado no carregamento; campos ausentes caem no tema default.

2. **Registro no banco** — insira a live e defina a senha única:

   ```sql
   insert into public.lives (cliente_slug, nome, vimeo_video_id, senha_unica_hash, status, config_json)
   values ('<slug>', 'Nome do Cliente', '<vimeo_id>', '', 'aguardando', '<cole o JSON>'::jsonb)
   returning id;

   select public.definir_senha_unica('<id-retornado>', 'SENHA_DO_EVENTO');
   ```

Acesse `…/<slug>`. Trocar o JSON troca 100% do visual. Veja `config/clientes/acme.json`
para um segundo cliente com paleta, tipografia, raio e layout totalmente diferentes.

---

## Design & customização visual

O sistema foi desenhado para que **cada cliente fique premium com o mínimo de
config**. No JSON, o cliente normalmente só precisa de:

```jsonc
"kv": {
  "logo": "https://cdn.cliente.com/logo.svg",   // opcional (cai no nome)
  "cores": { "primaria": "#4F7CFF" },            // 1 cor já muda o tom todo
  "layout": { "raio_borda": "22px" }             // opcional
}
```

Tudo o mais — tints, bordas, sombras, glow, vidro (glass), estados de
hover/foco, superfícies elevadas — é **derivado em CSS** a partir dessas
poucas cores, com `color-mix()` (ver `app/globals.css`). Trocar `cores.primaria`
re-tinge botões, badges, focos, o fundo ambiente e o brilho do player.

**Tokens que o cliente pode definir** (todos opcionais, com fallback premium):

| Campo | Efeito |
|---|---|
| `kv.cores.primaria` | Cor de marca (botões, foco, glow, ambiente) |
| `kv.cores.fundo` / `superficie` / `texto` | Base do tema (escuro ou claro) |
| `kv.cores.destaque` | Realce de staff / acentos |
| `kv.cores.sobre_primaria` | Cor do texto sobre a primária (ajuste se a primária for clara) |
| `kv.tipografia.titulo` / `corpo` | Fontes (padrão Sora + Inter; use `google_fonts_url` p/ fontes próprias) |
| `kv.layout.raio_borda` | Escala de cantos arredondados de toda a UI |
| `kv.layout.posicao_chat` | Chat à `direita` ou `esquerda` no desktop |
| `kv.imagem_fundo_entrada` | Imagem de fundo do gate (com scrim automático) |
| `features.chat` / `reacoes` / `contador_online` / `cta.ativo` | Liga/desliga cada recurso |
| `features.emojis` | Emojis da barra de reações |

> Tudo isso é editável pelo próprio cliente no painel **`…/<slug>/admin`**
> (ver "Administração da live"), sem mexer no JSON.

**Componentes centralizados**: o look vive em classes utilitárias
(`.dl-card`, `.dl-glass`, `.dl-btn-primary`, `.dl-field`, `.dl-pill`,
`.dl-badge-live`, `.dl-badge-staff`, `.dl-ambient`, animações) em
`app/globals.css`. Ajustar o visual de todos os clientes de uma vez = editar
essas classes; ajustar um cliente = editar o JSON dele.

**Robustez & experiência** já embutidas:
- **Player resiliente** (RNF-03/RF-06): loading com skeleton e, em falha/timeout,
  fallback "não foi possível carregar" com botão de **tentar novamente**.
- **Reações flutuantes ao vivo** (RF-17/44): emojis sobem sobre o vídeo, trocados
  entre espectadores via Supabase Realtime *broadcast*; feature-toggle
  `features.reacoes`, cada reação vira evento de tracking.
- **Toasts** para feedback de envio/moderação; **404** e **loading** com marca.
- **Acessibilidade**: foco de teclado visível, `aria-live` no chat, alvos de
  toque ≥ 44px, `prefers-reduced-motion` respeitado.
- **Headers de segurança** (`next.config.ts`): nosniff, X-Frame-Options,
  Referrer-Policy, Permissions-Policy, HSTS.

---

## Acesso de staff (moderação) — Fase 2

Staff (moderador/admin) tem **credencial individual** via Supabase Auth e
acessa o painel em `…/<slug>/moderacao` (login em `…/<slug>/staff`).

### Criar o primeiro admin (bootstrap)

O primeiro admin precisa ser criado à mão (depois, um admin promove os demais
pelo painel). No **SQL Editor** do Supabase (ou local):

```sql
-- 1) Registre o papel de admin para o email
insert into public.staff (live_id, email, papel)
values ('<live-id>', 'admin@equipe.com', 'admin');
```

Depois crie a conta de Auth desse email: **Authentication → Users → Add user**
(email + senha, com "Auto Confirm" ligado). No primeiro login o `auth_user_id`
é vinculado automaticamente.

Com um admin logado, o painel permite **promover** novos moderadores/admins
(inclusive já criando o acesso de login, ao informar uma senha).

### O que o painel de moderação faz

- **Chat em modo moderação:** apagar (soft-delete), fixar/desafixar, mutar
  (10 min) e banir o autor — reflete para todos em tempo real.
- **Mensagem oficial:** comunicado destacado como staff.
- **Participantes:** lista com mutar/dessilenciar e banir/desbanir.
- **Status da live** (admin): aguardando / ao vivo / encerrada.
- **Promover equipe** (admin): novo moderador/admin por email.
- Toda ação é gravada em `log_moderacao` (RF-37).

### Administração da live pelo cliente — `…/<slug>/admin` (admin)

Painel visual onde o **cliente configura a própria live sem editar JSON**
(RF-68). Acessível pelo botão **⚙ Configurações** na moderação. Salva em
`lives.config_json` e vale para novos acessos. Permite ligar/desligar e
editar **tudo**:

- **Funcionalidades (toggles):** chat on/off, reações on/off, contador online,
  enquetes (em breve). Desligar o chat faz o vídeo ocupar a largura toda.
- **Reações:** quais emojis aparecem na barra.
- **Chat:** intervalo anti-spam, limite de caracteres, palavras proibidas.
- **CTA:** ativar, texto, URL.
- **Textos:** entrada, boas-vindas, rótulo "ao vivo", espera, encerramento,
  rodapé.
- **Aparência:** cores (com seletor), raio das bordas, posição do chat — muda
  o KV inteiro na hora do save.
- **Geral / Vídeo:** nome, **fonte do vídeo (Vimeo ou YouTube)**, **link do
  vídeo** (aceita URL do YouTube/Vimeo, ao vivo ou VOD), se é ao vivo (Live),
  status. O player certo é escolhido automaticamente e o tracking
  (play/pause/marcos) funciona igual nas duas fontes.
- **Acesso:** troca da senha única do espectador.

Exemplos de clientes prontos: `demo` (completo), `acme` (tema azul, chat à
esquerda), `semchat` (sem chat, vídeo full-width, emojis próprios).

---

## Deploy na Vercel

1. Importe o repositório na Vercel.
2. Configure as **Environment Variables** (as mesmas do `.env.example`;
   `SUPABASE_SERVICE_ROLE_KEY`, `GATE_COOKIE_SECRET` e `CRON_SECRET` são
   segredos de servidor).
3. O `vercel.json` já registra o **Cron** que fecha sessões órfãs a cada
   minuto (`/api/cron/close-orphans`).
4. Chat e contador online conectam **direto** ao Supabase Realtime (não
   passam por função serverless — ver §6.5 do PRD).

---

## O que foi implementado (Fase 1)

| Área | Requisitos | Status |
|---|---|---|
| Gate (email + senha única, campos extras, LGPD, estados, anti-abuso) | RF-01→06, 08, 10 | ✅ |
| Sala + player Vimeo (playsinline, play por gesto) + estados da live | RF-11→15 | ✅ |
| Chat Realtime (badge staff, rate limit, sanitização, reconexão) | RF-21→24, 29, 78 | ✅ |
| Tracking (heartbeat, visibility, eventos de vídeo, marcos, batch, sendBeacon) | RF-38→42, 44, 46, 47, 48 | ✅ |
| White-label por JSON (schema, loader por slug, CSS vars, fallback) | RF-62→67 | ✅ |
| Mobile-first (sticky video, dvh/svh, safe-area, autoplay por gesto, contador online) | RF-69→75, 16 | ✅ |
| Cron de sessões órfãs | RF-39 | ✅ |
| **F2** — Login de staff (Supabase Auth), papéis, recuperação de senha | RF-04, 49→53 | ✅ |
| **F2** — Moderação: apagar, mutar, banir, fixar, mensagem oficial | RF-31→35, 23 | ✅ |
| **F2** — Painel de moderação + log de ações | RF-36, 37 | ✅ |
| **F3** — Dashboard (KPIs, curva, retenção, trechos) + status | RF-54→61 | ✅ |
| **F3** — Exportação CSV + XLSX por participante | RF-58 | ✅ |

### Limitações conhecidas do F1 (fechadas nas próximas fases)

- **Rate limit do gate** é em memória (best-effort) — reinicia a frio em
  serverless. Para limite duro em escala, migrar para Postgres/Redis.
- **Chat isolado por live:** o histórico é servido por rota de servidor
  (escopada por `live_id` + auth) e as novas mensagens/moderação chegam por
  **Realtime broadcast** por live. O anon não lê a tabela de chat (nada vaza
  entre clientes) e apagar/fixar refletem ao vivo para todos.
- **RPCs de senha** (`definir/verificar_senha_unica`, `fechar_sessoes_orfas`)
  são revogadas do público (só service role) — ver `0003_security.sql`.
- **Cookie de sessão** exige `GATE_COOKIE_SECRET` forte em produção (falha
  dura se ausente). **Escritas** (chat, tracking, moderação) passam por rota
  de servidor com validação + service role + `log_moderacao`.
- **Realtime (chat/reações)** usa canais de broadcast com **tópico derivado
  de um token do servidor** (HMAC do `live_id`), não do UUID cru — nada vaza
  entre clientes mesmo sem RLS em broadcast.
- **CSP** ativo (`next.config.ts`) liberando só Vimeo/YouTube/Supabase/Fonts;
  sessão de staff renovada por `proxy.ts` (evita logout em lives longas).
- **Rate-limit do gate** ainda é em memória (best-effort). Para lives grandes,
  mover para Postgres/Upstash. Idempotência do tracking é best-effort.
- **Dashboard/export** usam agregação em JS com limites (5k–50k linhas) e
  **sinalizam truncamento**; para lives enormes, migrar para RPCs de agregação.

---

## Roadmap

| Fase | Escopo | Status |
|---|---|---|
| **F1 — MVP** | Gate, player, chat, tracking, white-label, mobile | ✅ Implementada |
| **F2 — Moderação** | Login staff (Supabase Auth), papéis, apagar/mutar/banir, painel, log | ✅ Implementada |
| **F3 — Dados** | Tracking granular, dashboard tempo real + pós-evento, export CSV/XLSX | ✅ Implementada |
| **F4 — Extras** | Reações ✅, CTA ✅, editor visual de config/tema ✅ (`/admin`); enquetes e i18n ⬜ | 🟡 Parcial |

---

## Scripts

```bash
npm run dev     # desenvolvimento
npm run build   # build de produção
npm run start   # servidor de produção
npm run lint    # eslint
```
