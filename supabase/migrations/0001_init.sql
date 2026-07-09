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
