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
