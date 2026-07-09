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
