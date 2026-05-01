-- Phase 07 Plan 01 — Cron schedule para automation-cron Edge Function
-- D-01: 08h BRT diariamente = 11:00 UTC (pg_cron usa UTC exclusivamente — Pitfall 1)
-- Esta migration pode falhar em ambiente local (sem pg_cron); admin DEVE rodar manualmente em producao

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remover schedule existente (idempotente)
SELECT cron.unschedule('automation-cron-daily') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'automation-cron-daily'
);

-- Agendamento: 11:00 UTC = 08:00 BRT
-- Project URL e service role key sao injetados via Supabase secrets/vault.
-- Se vault nao estiver configurado, admin substitui inline as 2 strings abaixo no SQL Editor antes de executar.
SELECT cron.schedule(
  'automation-cron-daily',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := COALESCE(
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url'),
      current_setting('app.settings.project_url', true)
    ) || '/functions/v1/automation-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_publishable_key'),
        current_setting('app.settings.cron_publishable_key', true)
      ),
      'x-cron-secret', COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret'),
        'CHANGE_ME_IN_PRODUCTION'
      )
    ),
    body := jsonb_build_object('triggered_at', NOW()),
    timeout_milliseconds := 30000
  ) AS request_id;
  $$
);

-- Documentacao em SQL: para popular vault em producao, executar:
--   SELECT vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   SELECT vault.create_secret('<ANON_KEY>', 'cron_publishable_key');
--   SELECT vault.create_secret(gen_random_uuid()::text, 'cron_shared_secret');
