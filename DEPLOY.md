# Guia de Deploy — NEXUS AGENT

> Checklist completo para levar o projeto de desenvolvimento local para produção.
> Siga os passos na ordem — cada seção depende da anterior.

---

## Pré-requisitos

- [ ] Conta Vercel (vercel.com) — plano Hobby ou Pro
- [ ] Projeto Supabase já existente (`zgyryrranrshtnfiqbob`)
- [ ] Conta Resend (resend.com) — plano Free cobre até 3.000 emails/mês
- [ ] Conta OpenAI (platform.openai.com) — para o Assistente IA e WhatsApp IA
- [ ] Repositório no GitHub (necessário para deploy Vercel)
- [ ] Node.js 18+ e npm instalados localmente
- [ ] Supabase CLI instalado: `npm install -g supabase`

---

## 1. Preparar o repositório GitHub

```bash
# Se ainda não tem remote configurado:
git remote add origin https://github.com/SEU-USER/nexus-agent.git
git push -u origin master
```

> O Vercel faz deploy automático a cada push no branch configurado.

---

## 2. Aplicar todas as migrations no Supabase de produção

As 23 migrations devem estar aplicadas. Verifique via Supabase Dashboard → Database → Migrations, ou:

```bash
npx supabase db push --linked
```

Se der erro de versioning collision (conhecido neste projeto), aplique individualmente:

```bash
# Liste migrations ainda não aplicadas e rode uma a uma:
npx supabase db query --linked -f supabase/migrations/20260420_0021_automacoes_schema.sql
npx supabase db query --linked -f supabase/migrations/20260420_0022_automacoes_rls.sql
```

**Verificar que as 3 tabelas de automações existem:**
```sql
-- Rodar no SQL Editor do Supabase Dashboard
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('webhook_configs', 'webhook_logs', 'email_templates');
-- Deve retornar 3 linhas
```

---

## 3. Configurar o Custom Access Token Hook no Supabase

Este hook injeta `tenant_id`, `role` e `slug` no JWT — sem ele, o RLS não funciona.

**No Supabase Dashboard:**
1. Acesse **Authentication → Hooks**
2. Crie um hook do tipo **Custom Access Token**
3. Aponte para a Edge Function: `custom-access-token`
4. Copie o **Signing Secret** gerado

O valor do signing secret já está no `.env.local`:
```
CUSTOM_ACCESS_TOKEN_SECRET=v1,whsec_y2HP767lGZS6Tpbv4zio7YuuACnLSE9xEUQHbmSMO1o=
```

Esse valor deve ser configurado na Vercel (passo 5).

---

## 4. Deploy das Edge Functions no Supabase

```bash
# Login na Supabase CLI
npx supabase login

# Linkar ao projeto de produção
npx supabase link --project-ref zgyryrranrshtnfiqbob

# Deploy das 2 Edge Functions
npx supabase functions deploy custom-access-token
npx supabase functions deploy automation-cron
```

**Verificar no Dashboard:**
Supabase Dashboard → Edge Functions → deve listar `custom-access-token` e `automation-cron` como deployed.

---

## 5. Configurar Secrets da Edge Function automation-cron

Gere valores seguros para os 3 secrets (use `openssl rand -base64 32` ou qualquer gerador UUID):

```bash
# Definir os secrets da Edge Function (visíveis apenas no runtime Deno)
npx supabase secrets set CRON_SHARED_SECRET="GERE_UM_UUID_ALEATORIO"
npx supabase secrets set INTERNAL_EMAIL_SECRET="GERE_OUTRO_UUID_ALEATORIO"
npx supabase secrets set NEXTJS_APP_URL="https://SEU-APP.vercel.app"
```

> **Importante:** `INTERNAL_EMAIL_SECRET` precisa ser o mesmo valor que você vai colocar na Vercel no passo seguinte. É o shared secret entre a Edge Function (Deno) e o Route Handler Next.js.

---

## 6. Configurar pg_cron para disparar a Edge Function

O cron precisa de 3 valores do Vault do Supabase para chamar a Edge Function. Execute no **SQL Editor do Supabase Dashboard**:

```sql
-- 1. Salvar a URL do projeto no Vault
SELECT vault.create_secret(
  'https://zgyryrranrshtnfiqbob.supabase.co',
  'project_url'
);

-- 2. Salvar a ANON KEY no Vault (chave pública, ok)
SELECT vault.create_secret(
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpneXJ5cnJhbnJzaHRuZmlxYm9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3ODIxNTUsImV4cCI6MjA5MjM1ODE1NX0.vAo9nixFYY31NY2fzJz3wUsfl98P6ecz-79gjukKy-s',
  'cron_publishable_key'
);

-- 3. Salvar o CRON_SHARED_SECRET no Vault (o mesmo valor do passo 5)
SELECT vault.create_secret(
  'O_MESMO_CRON_SHARED_SECRET_DO_PASSO_5',
  'cron_shared_secret'
);

-- 4. Verificar que os 3 secrets foram criados
SELECT name FROM vault.decrypted_secrets
WHERE name IN ('project_url', 'cron_publishable_key', 'cron_shared_secret');
-- Deve retornar 3 linhas
```

**Depois, reagendar o cron** (necessário pois o schedule foi criado antes dos Vault secrets):

```sql
-- Remover schedule antigo e recriar com Vault ativo
SELECT cron.unschedule('automation-cron-daily');

SELECT cron.schedule(
  'automation-cron-daily',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
           || '/functions/v1/automation-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_publishable_key'),
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret')
    ),
    body := jsonb_build_object('triggered_at', NOW()),
    timeout_milliseconds := 30000
  ) AS request_id;
  $$
);

-- Verificar que o job está agendado
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'automation-cron-daily';
```

---

## 7. Configurar o Resend

1. Acesse [resend.com](https://resend.com) → crie uma conta
2. **Domains** → adicione e verifique o seu domínio (ex: `suacorretora.com.br`)
   - Adicione os registros DNS que o Resend solicitar no seu provedor de domínio
3. **API Keys** → crie uma API Key com permissão de envio
4. Anote: `RESEND_API_KEY` e o endereço remetente verificado (ex: `NEXUS AGENT <noreply@suacorretora.com.br>`)

> Sem domínio verificado o Resend só envia para o email da sua conta (modo sandbox).

---

## 8. Deploy na Vercel

### 8.1 Criar o projeto

1. Acesse [vercel.com/new](https://vercel.com/new)
2. Importe o repositório GitHub `nexus-agent`
3. Framework: **Next.js** (detectado automaticamente)
4. Root directory: deixe vazio (`.`)
5. Não faça deploy ainda — configure as variáveis primeiro

### 8.2 Configurar variáveis de ambiente

Na Vercel: **Settings → Environment Variables**. Adicione todas abaixo para os ambientes **Production** e **Preview**:

| Variável | Valor | Visibilidade |
|----------|-------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://zgyryrranrshtnfiqbob.supabase.co` | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGci...` (do .env.local) | Public |
| `NEXT_PUBLIC_APP_URL` | `https://SEU-APP.vercel.app` | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGci...` (do .env.local) | Secret |
| `CUSTOM_ACCESS_TOKEN_SECRET` | `v1,whsec_y2HP767...` (do .env.local) | Secret |
| `RESEND_API_KEY` | `re_...` (do Resend) | Secret |
| `RESEND_FROM_EMAIL` | `NEXUS AGENT <noreply@seudominio.com.br>` | Secret |
| `INTERNAL_EMAIL_SECRET` | O mesmo valor do passo 5 | Secret |
| `OPENAI_API_KEY` | `sk-...` (da OpenAI) | Secret |
| `WHATSAPP_WEBHOOK_SECRET` | UUID aleatório (compartilhar com n8n) | Secret |

> `NEXT_PUBLIC_*` são visíveis no bundle do cliente — só coloque valores não-sensíveis.

### 8.3 Fazer o primeiro deploy

```bash
# Via CLI (opcional — a Vercel também faz deploy automático via GitHub)
npm install -g vercel
vercel --prod
```

Ou faça um push no branch principal — a Vercel detecta e inicia o deploy automaticamente.

---

## 9. Verificar o deploy

Após o deploy completar:

```bash
# Testar que a aplicação responde
curl -I https://SEU-APP.vercel.app
# Esperado: HTTP 200 ou 307 (redirect para /login)

# Testar que o endpoint WhatsApp retorna 401 sem secret
curl -X POST https://SEU-APP.vercel.app/api/SEU-SLUG/ai/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"message": "teste"}'
# Esperado: {"error":"Unauthorized"}

# Testar que o endpoint interno rejeita sem secret
curl -X POST https://SEU-APP.vercel.app/api/internal/send-automation-email \
  -H "Content-Type: application/json" \
  -d '{}'
# Esperado: {"error":"Forbidden"}
```

---

## 10. Criar o primeiro tenant (corretora)

Neste momento não há UI de auto-registro — o primeiro tenant precisa ser criado manualmente via SQL:

```sql
-- 1. Criar o tenant
INSERT INTO public.tenants (id, name, slug, cnpj, plan)
VALUES (
  gen_random_uuid(),
  'Nome da Corretora',
  'nome-da-corretora',  -- slug único, minúsculas, sem espaço
  '00.000.000/0001-00', -- CNPJ formatado
  'trial'
)
RETURNING id;
-- Guarde o UUID retornado como TENANT_ID

-- 2. Criar o usuário admin no Supabase Auth
-- Fazer via Dashboard: Authentication → Users → Add user
-- Email: admin@suacorretora.com.br, Senha: temporária forte

-- 3. Depois de criar o usuário, pegar o UUID dele e criar o profile:
INSERT INTO public.profiles (id, tenant_id, full_name, role)
VALUES (
  'UUID-DO-USUARIO-AUTH',  -- id do auth.users
  'UUID-DO-TENANT',        -- id do passo 1
  'Nome do Admin',
  'admin'
);

-- 4. Setar app_metadata no usuário (para o JWT ter tenant_id, role e slug)
-- Via Supabase Dashboard → Authentication → Users → clique no usuário → Edit
-- Em "User Metadata" (app_metadata), adicionar:
-- { "tenant_id": "UUID-DO-TENANT", "role": "admin", "slug": "nome-da-corretora" }
```

> Após o login, o Custom Access Token Hook injeta esses valores no JWT automaticamente.

---

## 11. Configurar n8n para WhatsApp (opcional)

Se quiser ativar o atendimento WhatsApp via IA:

1. No n8n, crie um webhook que recebe mensagens da Evolution API / WhatsApp Business
2. Configure um nó HTTP que chama:
   ```
   POST https://SEU-APP.vercel.app/api/SLUG-DA-CORRETORA/ai/whatsapp
   Headers:
     Content-Type: application/json
     x-webhook-secret: O_MESMO_WHATSAPP_WEBHOOK_SECRET_DA_VERCEL
   Body:
     { "message": "{{$json.message}}", "clientPhone": "{{$json.from}}" }
   ```
3. Use a resposta `{ "response": "...", "escalated": false }` para responder ao cliente

---

## 12. Checklist final

### Infraestrutura
- [ ] Migrations aplicadas (23 arquivos)
- [ ] Edge Functions deployadas (`custom-access-token`, `automation-cron`)
- [ ] Hook de Custom Access Token ativo no Supabase
- [ ] pg_cron agendado com Vault secrets configurados

### Vercel
- [ ] Projeto criado e linkado ao GitHub
- [ ] 10 variáveis de ambiente configuradas
- [ ] Deploy bem-sucedido (sem erros de build)

### Resend
- [ ] Domínio verificado
- [ ] API Key criada e configurada na Vercel

### OpenAI
- [ ] API Key configurada na Vercel
- [ ] Billing habilitado na conta OpenAI (necessário para gpt-4o-mini)

### Primeiro tenant
- [ ] Tenant criado via SQL
- [ ] Usuário admin criado no Supabase Auth
- [ ] Profile criado com role='admin'
- [ ] app_metadata configurado com tenant_id, role, slug

### Testes manuais pós-deploy
- [ ] Login como admin → dashboard carrega
- [ ] Sidebar mostra todos os módulos
- [ ] `/configuracoes/automacoes` abre para admin, redireciona para corretor
- [ ] `/assistente` abre e chat responde (requer OPENAI_API_KEY)
- [ ] WhatsApp endpoint retorna 401 sem secret
- [ ] Cron dispara às 08h BRT e aparece em `webhook_logs` no dia seguinte

---

## Troubleshooting rápido

| Sintoma | Causa provável | Solução |
|---------|---------------|---------|
| Login funciona mas sidebar vazia / sem tenant | app_metadata não configurado | Setar tenant_id, role, slug no usuário |
| 403 em todas as queries | Custom Access Token Hook inativo | Ativar o hook no Dashboard → Auth → Hooks |
| Email não enviado | RESEND_API_KEY ausente ou domínio não verificado | Verificar variável na Vercel + domínio no Resend |
| Chat IA retorna erro | OPENAI_API_KEY ausente ou sem crédito | Verificar variável + billing na OpenAI |
| Cron não dispara | Vault secrets não configurados | Executar SQL do passo 6 |
| Edge Function retorna 401 | CRON_SHARED_SECRET não corresponde | `supabase secrets set` + recriar cron schedule |
