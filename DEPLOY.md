# Deploy na Vercel — Dummy Live

Guia para publicar a plataforma. Método: **GitHub → Vercel** (deploy automático a cada push).

---

## 1. Variáveis de ambiente (obrigatórias)

Configure em **Vercel → Project → Settings → Environment Variables** (marque *Production* e *Preview*).
Os valores estão no seu `.env.local` (que **não** vai para o Git).

| Variável | O que é | Exposta ao browser? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase | Sim (pública) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anon do Supabase | Sim (pública) |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service_role (ignora RLS) | **NÃO — segredo** |
| `GATE_COOKIE_SECRET` | Segredo p/ assinar o cookie de sessão do espectador e os tokens de canal do chat | **NÃO — segredo** |
| `CRON_SECRET` | Segredo que a Vercel envia no cron de limpeza de sessões | **NÃO — segredo** |

> **Gerar segredos fortes** (`GATE_COOKIE_SECRET`, `CRON_SECRET`):
> `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
> Use valores **diferentes** para cada um. Guarde-os; se trocar o `GATE_COOKIE_SECRET` depois, todas as sessões de espectador logadas caem.

`CRON_SECRET` não precisa ser referenciado manualmente no header — a Vercel injeta `Authorization: Bearer <CRON_SECRET>` automaticamente ao disparar o cron.

---

## 2. Banco de dados (Supabase)

O deploy usa o **mesmo projeto Supabase** já em uso. As migrations `supabase/migrations/0001…0005` já foram aplicadas. Nada a rodar de novo.

Se um dia criar um Supabase novo, rode `supabase/setup.sql` (consolidado) no SQL Editor, depois `0003_security.sql` para revogar as RPCs do anon.

---

## 3. Cron (limpeza de sessões órfãs)

`vercel.json` agenda `/api/cron/close-orphans` para **1x/dia** (`0 6 * * *` UTC ≈ 03h BRT) — compatível com o plano **Hobby**.

A contagem de "online agora" **não depende** desse cron (a query já filtra heartbeats < 60s); o cron é só faxina de dados. Se assinar o **Pro**, pode trocar para `*/5 * * * *` ou `* * * * *` para consolidar `tempo_online` com mais frequência.

---

## 4. Subir para o GitHub

O repositório já está com `git init` e o primeiro commit feito. Falta só apontar para o seu GitHub:

```bash
# crie um repositório vazio em github.com/new (ex.: dummy-live-plataforma), depois:
git remote add origin https://github.com/SEU_USUARIO/dummy-live-plataforma.git
git branch -M main
git push -u origin main
```

---

## 5. Importar na Vercel

1. **vercel.com → Add New → Project → Import** o repositório do GitHub.
2. Framework detectado automaticamente: **Next.js**. Build/Output: **deixe o padrão**.
3. Em **Environment Variables**, cole as 5 variáveis da seção 1.
4. **Deploy**.

Ao terminar, você recebe uma URL `*.vercel.app`. O evento fica em `https://SEU-PROJETO.vercel.app/imperio`.

---

## 6. Pós-deploy (conferir)

- [ ] Abrir `/imperio` → login com um inscrito de teste → sala carrega e o vídeo toca.
- [ ] Chat e reações funcionam (Realtime).
- [ ] `/imperio/staff` → login de equipe (Supabase Auth) abre a moderação/dashboard.
- [ ] (Opcional) Domínio próprio: **Vercel → Settings → Domains**.

---

## Não sobe para o Git (por `.gitignore`)

`node_modules/`, `.next/`, `.env*` (segredos), `.vercel/`, screenshots da raiz (`*.png`), `manual_cliente.html` e PDFs do manual. Os assets do evento em `public/imperio/*.png` **sobem normalmente**.
