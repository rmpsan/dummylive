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
