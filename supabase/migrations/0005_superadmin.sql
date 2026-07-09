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
