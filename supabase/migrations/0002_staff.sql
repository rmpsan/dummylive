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
