-- =====================================================================
-- Dummy Live — SETUP COMPLETO (Supabase → SQL Editor). Idempotente.
-- 0001 schema · 0002 staff · 0003 segurança · 0004 multi-tenant · 0005 super-admin · seed
-- =====================================================================

-- ###### 1) SCHEMA (0001) ######
-- =====================================================================
-- Dummy Live — Schema inicial (F1 MVP)
-- Modelo de dados do §6.2 do PRD + RLS (§6.2 / RNF-05) + índices + RPCs.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Clientes / eventos (uma linha por live white-label)
-- ---------------------------------------------------------------------
create table if not exists public.lives (
  id uuid primary key default gen_random_uuid(),
  cliente_slug text unique not null,
  nome text not null,
  vimeo_video_id text not null,
  senha_unica_hash text not null,          -- bcrypt (extensions.crypt)
  status text not null default 'aguardando'
    check (status in ('aguardando','ao_vivo','encerrada')),
  config_json jsonb not null,
  data_inicio timestamptz,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------
-- Participantes (espectadores)
-- ---------------------------------------------------------------------
create table if not exists public.participantes (
  id uuid primary key default gen_random_uuid(),
  live_id uuid references public.lives(id) on delete cascade,
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

-- ---------------------------------------------------------------------
-- Sessões de presença
-- ---------------------------------------------------------------------
create table if not exists public.sessoes (
  id uuid primary key default gen_random_uuid(),
  participante_id uuid references public.participantes(id) on delete cascade,
  live_id uuid references public.lives(id) on delete cascade,
  entrou_em timestamptz default now(),
  ultimo_heartbeat timestamptz default now(),
  saiu_em timestamptz,
  encerrada boolean default false,
  tempo_online_seg integer default 0,
  tempo_video_assistido_seg integer default 0,
  percentual_concluido integer default 0,
  dispositivo text,
  sistema_operacional text,
  navegador text,
  resolucao text,
  timezone text
);
create index if not exists idx_sessoes_live on public.sessoes (live_id);
create index if not exists idx_sessoes_ativas
  on public.sessoes (live_id, encerrada, ultimo_heartbeat);

-- ---------------------------------------------------------------------
-- Eventos granulares de tracking
-- ---------------------------------------------------------------------
create table if not exists public.eventos_tracking (
  id bigint generated always as identity primary key,
  sessao_id uuid references public.sessoes(id) on delete cascade,
  live_id uuid references public.lives(id) on delete cascade,
  tipo text not null,
  payload jsonb default '{}',
  video_time numeric,
  aba_visivel boolean,
  ts timestamptz default now()
);
create index if not exists idx_eventos_live_ts on public.eventos_tracking (live_id, ts);
create index if not exists idx_eventos_sessao_tipo on public.eventos_tracking (sessao_id, tipo);

-- ---------------------------------------------------------------------
-- Chat
-- ---------------------------------------------------------------------
create table if not exists public.mensagens_chat (
  id bigint generated always as identity primary key,
  live_id uuid references public.lives(id) on delete cascade,
  participante_id uuid references public.participantes(id) on delete cascade,
  autor_nome text,
  texto text not null,
  fixada boolean default false,
  apagada boolean default false,
  is_staff boolean default false,
  created_at timestamptz default now()
);
create index if not exists idx_chat_live_created on public.mensagens_chat (live_id, created_at);

-- ---------------------------------------------------------------------
-- Log de moderação (F2, tabela já criada)
-- ---------------------------------------------------------------------
create table if not exists public.log_moderacao (
  id bigint generated always as identity primary key,
  live_id uuid references public.lives(id) on delete cascade,
  staff_email text not null,
  acao text not null,
  alvo text,
  detalhe jsonb default '{}',
  ts timestamptz default now()
);

-- ---------------------------------------------------------------------
-- Staff (complementa Supabase Auth — F2)
-- ---------------------------------------------------------------------
create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid,
  email text not null,
  live_id uuid references public.lives(id) on delete cascade,
  papel text not null check (papel in ('moderador','admin','super_admin')),
  created_at timestamptz default now(),
  unique (live_id, email)
);

-- =====================================================================
-- RLS — ativar em todas as tabelas (RNF-05)
-- =====================================================================
alter table public.lives            enable row level security;
alter table public.participantes    enable row level security;
alter table public.sessoes          enable row level security;
alter table public.eventos_tracking enable row level security;
alter table public.mensagens_chat   enable row level security;
alter table public.log_moderacao    enable row level security;
alter table public.staff            enable row level security;

-- Espectadores (chave anon) só PODEM LER o chat não-apagado via Realtime.
-- Escrita de chat/tracking e leitura de dados sensíveis passam SEMPRE pelo
-- service role (rotas de servidor), que ignora RLS. Nada de escrita anon.
drop policy if exists chat_anon_select on public.mensagens_chat;
create policy chat_anon_select on public.mensagens_chat
  for select
  to anon, authenticated
  using (apagada = false);

-- Nenhuma policy de escrita/leitura para anon em `lives`: a tabela guarda o
-- hash da senha e NÃO pode ser exposta ao browser. O status em tempo real
-- vai por uma tabela-espelho segura (`live_estado`), abaixo.

-- Espelho seguro do status da live (sem segredos) para Realtime (RF-14).
create table if not exists public.live_estado (
  live_id uuid primary key references public.lives(id) on delete cascade,
  status text not null,
  atualizado_em timestamptz default now()
);
alter table public.live_estado enable row level security;

drop policy if exists live_estado_anon_select on public.live_estado;
create policy live_estado_anon_select on public.live_estado
  for select to anon, authenticated using (true);

-- Mantém o espelho em sincronia com lives.status.
create or replace function public.sync_live_estado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.live_estado (live_id, status, atualizado_em)
  values (new.id, new.status, now())
  on conflict (live_id) do update
    set status = excluded.status, atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists trg_sync_live_estado on public.lives;
create trigger trg_sync_live_estado
  after insert or update of status on public.lives
  for each row execute function public.sync_live_estado();

-- Nenhuma policy de escrita para anon em nenhuma tabela: negado por padrão.
-- (F2 adiciona policies para staff autenticado via Supabase Auth.)

-- Realtime: publica as tabelas que o browser assina direto (RNF-11).
-- Chat (novas mensagens / soft-delete) e status da live via espelho seguro.
do $$
begin
  begin
    alter publication supabase_realtime add table public.mensagens_chat;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.live_estado;
  exception when duplicate_object then null; end;
end $$;

-- =====================================================================
-- RPCs
-- =====================================================================

-- Verifica a senha única de uma live sem trafegar o hash para fora do banco.
-- SECURITY DEFINER: lê a coluna de hash sob RLS restrita.
create or replace function public.verificar_senha_unica(
  p_live_id uuid,
  p_senha text
) returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.lives
    where id = p_live_id
      and senha_unica_hash = extensions.crypt(p_senha, senha_unica_hash)
  );
$$;

-- Define/atualiza a senha única de uma live (uso do super-admin/seed).
create or replace function public.definir_senha_unica(
  p_live_id uuid,
  p_senha text
) returns void
language sql
security definer
set search_path = public, extensions
as $$
  update public.lives
  set senha_unica_hash = extensions.crypt(p_senha, extensions.gen_salt('bf'))
  where id = p_live_id;
$$;

-- Fecha sessões órfãs: sem heartbeat há mais de p_timeout_seg (RF-39).
-- Chamada pelo Vercel Cron. Calcula tempo_online a partir dos timestamps.
create or replace function public.fechar_sessoes_orfas(
  p_timeout_seg integer default 60
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with fechadas as (
    update public.sessoes
    set encerrada = true,
        saiu_em = ultimo_heartbeat,
        tempo_online_seg = greatest(
          tempo_online_seg,
          extract(epoch from (ultimo_heartbeat - entrou_em))::integer
        )
    where encerrada = false
      and ultimo_heartbeat < now() - make_interval(secs => p_timeout_seg)
    returning 1
  )
  select count(*) into v_count from fechadas;
  return v_count;
end;
$$;

-- ###### 2) STAFF (0002) ######
-- =====================================================================
-- Dummy Live — Fase 2 (Moderação): autenticação de staff + RLS por papel
-- RF-31→37, 49→53. Staff usa Supabase Auth (credencial individual).
-- =====================================================================

create index if not exists idx_staff_email on public.staff (email);
create index if not exists idx_staff_auth_user on public.staff (auth_user_id);

-- ---------------------------------------------------------------------
-- Helper: o usuário autenticado é staff desta live?
-- Casa por auth_user_id OU por email (permite promover antes do 1º login).
-- ---------------------------------------------------------------------
create or replace function public.is_staff(p_live_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff s
    where s.live_id = p_live_id
      and (
        s.auth_user_id = auth.uid()
        or lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  );
$$;

-- Papel do usuário autenticado nesta live (null se não for staff).
create or replace function public.papel_staff(p_live_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select s.papel from public.staff s
  where s.live_id = p_live_id
    and (
      s.auth_user_id = auth.uid()
      or lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  order by case s.papel
    when 'super_admin' then 0 when 'admin' then 1 else 2 end
  limit 1;
$$;

-- ---------------------------------------------------------------------
-- Policies de leitura para staff autenticado (PRD §6.2: "staff tem
-- policies conforme papel"). Escritas de moderação passam por rotas de
-- servidor com service role, após autorização na aplicação + log.
-- ---------------------------------------------------------------------

-- Staff lê a própria linha (para descobrir seu papel).
drop policy if exists staff_self_select on public.staff;
create policy staff_self_select on public.staff
  for select to authenticated
  using (
    auth_user_id = auth.uid()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- Staff lê participantes/sessões/mensagens/log da SUA live.
drop policy if exists participantes_staff_select on public.participantes;
create policy participantes_staff_select on public.participantes
  for select to authenticated
  using (public.is_staff(live_id));

drop policy if exists sessoes_staff_select on public.sessoes;
create policy sessoes_staff_select on public.sessoes
  for select to authenticated
  using (public.is_staff(live_id));

-- Staff enxerga também mensagens apagadas (moderação); anon continua só
-- com apagada=false (policy da 0001).
drop policy if exists chat_staff_select on public.mensagens_chat;
create policy chat_staff_select on public.mensagens_chat
  for select to authenticated
  using (public.is_staff(live_id));

drop policy if exists log_staff_select on public.log_moderacao;
create policy log_staff_select on public.log_moderacao
  for select to authenticated
  using (public.is_staff(live_id));

-- ###### 3) SEGURANÇA (0003) ######
-- =====================================================================
-- Dummy Live — Correções de segurança para produção (auditoria)
-- C1: RPCs SECURITY DEFINER estavam executáveis pelo anon (PostgREST).
-- A2: leitura anon do chat não era escopada por live (vazava entre tenants).
-- Rode no SQL Editor do Supabase. Idempotente.
-- =====================================================================

-- C1 — Revoga EXECUTE das funções sensíveis de PUBLIC/anon/authenticated.
-- Elas são chamadas APENAS pelo service role (rotas de servidor), que ignora
-- estes revokes. Impede reset/brute-force de senha e fechamento de sessões
-- por qualquer um com a chave anon (que é pública no browser).
revoke execute on function public.definir_senha_unica(uuid, text) from public, anon, authenticated;
revoke execute on function public.verificar_senha_unica(uuid, text) from public, anon, authenticated;
revoke execute on function public.fechar_sessoes_orfas(integer) from public, anon, authenticated;

-- A2 — O chat deixa de ser lido diretamente pelo anon. O histórico passa a
-- ser servido por rota de servidor (escopada por live + auth) e as novas
-- mensagens/moderação chegam por broadcast do Realtime (canal por live).
-- Assim nada vaza entre clientes e "apagar/fixar" reflete ao vivo.
drop policy if exists chat_anon_select on public.mensagens_chat;

-- (Opcional) O staff autenticado ainda pode ler o chat via RLS quando
-- necessário — a policy chat_staff_select da 0002 permanece.

-- ###### 4) MULTI-TENANT (0004) ######
-- =====================================================================
-- Dummy Live — Multi-tenant estruturado + banco como fonte da verdade
-- Hierarquia: cliente (marca) → job (trabalho) → live.
-- Promove campos operacionais críticos a COLUNAS de `lives` (o link do
-- vídeo deixa de viver só no JSON). Idempotente e com backfill seguro.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Clientes (a marca/empresa dona das lives)
-- ---------------------------------------------------------------------
create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  slug text unique,
  created_at timestamptz default now()
);
alter table public.clientes enable row level security;

-- ---------------------------------------------------------------------
-- Jobs (trabalho/projeto de um cliente; ex.: "Convenção 2026")
-- ---------------------------------------------------------------------
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  nome text not null,
  codigo text,
  created_at timestamptz default now(),
  unique (cliente_id, nome)
);
alter table public.jobs enable row level security;
create index if not exists idx_jobs_cliente on public.jobs (cliente_id);

-- ---------------------------------------------------------------------
-- Lives: vínculo com cliente/job + campos de vídeo como colunas próprias
-- ---------------------------------------------------------------------
alter table public.lives
  add column if not exists cliente_id uuid references public.clientes(id),
  add column if not exists job_id uuid references public.jobs(id),
  add column if not exists video_fonte text not null default 'vimeo',
  add column if not exists video_url text not null default '';

do $$ begin
  alter table public.lives
    add constraint lives_video_fonte_chk check (video_fonte in ('vimeo','youtube'));
exception when duplicate_object then null; end $$;

create index if not exists idx_lives_cliente on public.lives (cliente_id);
create index if not exists idx_lives_job on public.lives (job_id);

-- ---------------------------------------------------------------------
-- Backfill: cria cliente/job padrão, vincula lives órfãs e popula
-- video_fonte/video_url a partir do config_json existente.
-- ---------------------------------------------------------------------
do $$
declare
  v_cli uuid;
  v_job uuid;
begin
  insert into public.clientes (nome, slug)
    values ('Dummy Filmes', 'dummy')
    on conflict (nome) do nothing;
  select id into v_cli from public.clientes where nome = 'Dummy Filmes';

  insert into public.jobs (cliente_id, nome, codigo)
    values (v_cli, 'Geral', 'GERAL')
    on conflict (cliente_id, nome) do nothing;
  select id into v_job from public.jobs where cliente_id = v_cli and nome = 'Geral';

  update public.lives
     set cliente_id = coalesce(cliente_id, v_cli),
         job_id     = coalesce(job_id, v_job)
   where cliente_id is null or job_id is null;

  -- Popula colunas de vídeo a partir do JSON (link OU id legado).
  update public.lives
     set video_fonte = coalesce(
           nullif(config_json->'evento'->>'video_fonte', ''),
           video_fonte, 'vimeo'),
         video_url = coalesce(
           nullif(config_json->'evento'->>'video_url', ''),
           nullif(config_json->'evento'->>'vimeo_video_id', ''),
           nullif(video_url, ''), '')
   where coalesce(video_url, '') = '';
end $$;

-- ---------------------------------------------------------------------
-- RLS: clientes/jobs são internos (super-admin/service role). Sem policy
-- para anon/authenticated → negado por padrão (as rotas usam service role).
-- ---------------------------------------------------------------------
-- (nenhuma policy criada de propósito: deny-by-default)

-- ###### 5) SUPER-ADMIN (0005) ######
-- =====================================================================
-- Dummy Live — Super-admin da plataforma (gerencia clientes/jobs/lives)
-- Um super-admin NÃO é preso a uma live (diferente do staff por live).
-- =====================================================================

create table if not exists public.super_admins (
  email text primary key,
  created_at timestamptz default now()
);
alter table public.super_admins enable row level security;
-- Sem policy anon: deny-by-default. As rotas usam service role.

-- Primeiro super-admin (ajuste/adicione outros conforme necessário).
insert into public.super_admins (email) values ('rmpsan@gmail.com')
  on conflict (email) do nothing;

-- ###### 6) (OPCIONAL) LIVE DEMO ######
-- =====================================================================
-- Seed — live de demonstração (slug "demo", senha única "DEMO2026")
-- Aplicado por `supabase db reset`. A config_json espelha
-- config/clientes/demo.json.
-- =====================================================================

do $$
declare
  v_live_id uuid;
begin
  insert into public.lives (cliente_slug, nome, vimeo_video_id, senha_unica_hash, status, config_json, data_inicio)
  values (
    'demo',
    'Cliente Demonstração',
    '1084537',
    '',  -- definido abaixo via RPC (bcrypt)
    'ao_vivo',
    $json$
    {
      "cliente": "Cliente Demonstração",
      "slug": "demo",
      "evento": {
        "nome": "Convenção Anual 2026",
        "subtitulo": "Transmissão exclusiva ao vivo",
        "vimeo_video_id": "1084537",
        "vimeo_is_live": false,
        "status": "ao_vivo",
        "data_inicio": "2026-08-15T20:00:00-03:00"
      },
      "acesso": {
        "campos_extras": [
          { "id": "nome", "label": "Nome completo", "obrigatorio": true },
          { "id": "empresa", "label": "Empresa", "obrigatorio": false },
          { "id": "cargo", "label": "Cargo", "obrigatorio": false }
        ],
        "consentimento_lgpd_texto": "Autorizo a coleta de dados de participação conforme a Política de Privacidade.",
        "link_politica_privacidade": "https://example.com/privacidade"
      },
      "kv": {
        "cores": {
          "primaria": "#FF6B00", "secundaria": "#0A0A0A", "fundo": "#111111",
          "superficie": "#1A1A1A", "texto": "#FFFFFF", "texto_secundario": "#A0A0A0",
          "destaque": "#B8FF57", "erro": "#FF1477", "sucesso": "#B8FF57"
        },
        "tipografia": { "titulo": "Inter", "corpo": "Inter", "mono": "monospace" },
        "layout": { "posicao_chat": "direita", "tema": "escuro", "raio_borda": "12px" }
      },
      "textos": {
        "titulo_entrada": "Bem-vindo à transmissão",
        "boas_vindas": "Insira seus dados para acessar a live.",
        "aguardando": "A transmissão começa em breve. Fique por aqui.",
        "ao_vivo_label": "AO VIVO",
        "encerrada": "A transmissão foi encerrada. Obrigado por participar!",
        "erro_senha": "Senha incorreta. Tente novamente.",
        "rodape": "© Cliente Demonstração 2026 — Todos os direitos reservados"
      },
      "features": {
        "chat": true, "reacoes": true, "enquetes": false,
        "cta": { "ativo": true, "texto": "Saiba mais", "url": "https://example.com/oferta", "posicao": "abaixo_do_video" },
        "contador_online": true, "rate_limit_segundos": 5, "limite_caracteres_msg": 280, "palavras_proibidas": []
      },
      "tracking": { "heartbeat_seg": 20, "milestones_percentuais": [10,25,50,75,90,100], "granularidade_trecho_seg": 5 }
    }
    $json$::jsonb,
    '2026-08-15T20:00:00-03:00'
  )
  on conflict (cliente_slug) do update
    set config_json = excluded.config_json,
        status = excluded.status
  returning id into v_live_id;

  perform public.definir_senha_unica(v_live_id, 'DEMO2026');
end $$;
