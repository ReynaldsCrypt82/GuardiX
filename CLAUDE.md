<!-- GSD:project-start source:PROJECT.md -->
## Project

**NEXUS AGENT — Plataforma SaaS para Corretoras de Seguros e Consórcio**

Plataforma SaaS multi-tenant para corretoras de seguros e consórcio de pequeno e médio porte. Centraliza a gestão completa do negócio: clientes, apólices, consórcio, comissões, financeiro e CRM — com automações via n8n e atendimento por IA (WhatsApp/chat). Cada corretora opera em ambiente isolado com seus próprios dados, usuários e plano de assinatura.

**Core Value:** Corretoras de pequeno e médio porte controlam todo o ciclo de vida de seguros e consórcio em um único sistema, substituindo planilhas e ferramentas dispersas, sem precisar contratar equipe de TI.

### Constraints

- **Tech Stack**: Next.js + Supabase + Vercel — decisão do usuário, não negociável
- **Multi-tenancy**: Row-Level Security (RLS) do Supabase — isolamento de dados por tenant sem infraestrutura separada
- **Mercado**: Brasil — datas em pt-BR, moeda BRL, LGPD aplicável
- **Escala v1**: Suporte a corretoras com até 5.000 clientes e 10.000 apólices por tenant
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | 15.x (stable) | Full-stack React framework | App Router + Server Components + Server Actions — elimina uma camada de API separada. Vercel-first deployment. Note: Next.js 16 existe mas 15.x é o ponto de estabilidade comprovado para produção. |
| TypeScript | 5.x | Type safety | Obrigatório para um domínio com regras de negócio complexas (apólices, comissões, vigências). Erros de tipo detectados em compile-time evitam bugs em produção. |
| React | 19.x | UI runtime | Incluído com Next.js 15. Server Components reduzem JS enviado ao cliente — importante para dashboards pesados de dados. |
### Backend & Database
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Supabase | Latest (gerenciado) | PostgreSQL + Auth + Storage + Realtime | Backend completo sem gerenciar infra. RLS nativo no PostgreSQL — isolamento de tenant sem código de aplicação. |
| PostgreSQL | 15+ (via Supabase) | Banco relacional | Relações complexas entre apólices, clientes, comissões e parcelas de consórcio se beneficiam de FK constraints reais e transações ACID. |
| Supabase Auth | — | Autenticação | Integração nativa com RLS. @supabase/ssr para SSR com Next.js App Router (substitui o deprecado @supabase/auth-helpers). |
| Supabase Storage | — | Arquivos (apólices PDF, documentos de contemplação) | Integra RLS diretamente nos buckets — controle de acesso a documentos por tenant sem lógica adicional. |
| Supabase Realtime | — | Notificações em tempo real | Alertas de vencimento, notificações de sinistro e atualizações de dashboard sem polling. Via WebSockets gerenciados. |
| Supabase Edge Functions | Deno runtime | Lógica serverless (webhooks, IA) | Para processamentos que não devem rodar no cliente (chamadas a LLMs, integrações n8n) sem expor chaves de API. |
### Multi-Tenancy: Padrão RLS com Supabase
- `user_metadata` pode ser modificado pelo próprio usuário
- `app_metadata` é controlado exclusivamente pelo servidor — imutável pelo usuário
- `service_role` bypassa RLS — NUNCA expor no cliente
- Usar apenas em Edge Functions e Server Actions para operações administrativas (onboarding de tenant, migrações, background jobs)
- No cliente: sempre usar `anon` key com RLS ativo
### Auth (Supabase Auth + @supabase/ssr)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @supabase/ssr | latest | SSR client para Next.js App Router | Pacote oficial. @supabase/auth-helpers está deprecado. Gerencia sessões via cookies (não localStorage) para compatibilidade com Server Components. |
| @supabase/supabase-js | latest | Cliente JavaScript | SDK principal para todas as operações do banco. |
### UI & Componentes
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS | 4.x | Utility-first CSS | Padrão da indústria com Next.js. Tailwind v4 usa CSS-based config, mais rápido. Zero CSS morto em produção. |
| shadcn/ui | latest (não versionado — copiado no repo) | Component library | Não é uma dependência, é código copiado para o projeto. Componentes acessíveis (Radix UI), customizáveis. Data Table (TanStack Table + shadcn) é essencial para listagens de apólices e clientes. Charts via Recharts integrado. |
| Lucide React | latest | Ícones | Padrão do shadcn/ui. Tree-shakeable, consistente. |
| Recharts | 2.x | Gráficos e dashboards | Incluído via shadcn/ui charts. Suficiente para dashboards executivos do projeto (receita, produção, inadimplência). |
### Formulários e Validação
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React Hook Form | 7.x | Gerenciamento de estado de formulários | Performance superior (não re-renderiza no onChange), integração nativa com Zod. Formulários de cadastro de apólice com 20+ campos se beneficiam muito. |
| Zod | 3.x | Schema validation | Compartilhamento de schemas entre client e server — validação idêntica no formulário e no Server Action. Tipagem TypeScript automática via `z.infer<>`. |
### Data Fetching & State
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| TanStack Query (React Query) | 5.x | Server state (listas, detalhes) em Client Components | Para páginas onde Client Components precisam de dados em tempo real ou paginação interativa. Caching, background refresh, optimistic updates. |
| Zustand | 4.x | Client state (UI state, seleções, filtros) | Lightweight, sem boilerplate. Para estado de UI que não vive no servidor (filtros de dashboard, estado de sidebar, modal state). |
### Billing & Pagamentos
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Stripe | latest | Subscription billing | Suporte nativo a Pix via EBANX (ativo em 2025). Pix Automático para assinaturas recorrentes. Suporte a CPF/CNPJ para verificação de contas brasileiras. Cards, boleto e Pix em um único provider. |
| stripe (npm) | latest | SDK server-side | Usar APENAS em Server Actions e Edge Functions, nunca exposto ao cliente. |
| @stripe/stripe-js | latest | SDK client-side (Stripe.js) | Para checkout elements e redirect seguro ao Stripe. |
### Email
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Resend | latest | Transactional email | Integração oficial com Supabase Auth hooks. API developer-friendly. O SMTP nativo do Supabase é rate-limited (apenas dev) — produção EXIGE provider externo. |
| React Email | latest | Email templates | Templates de email como componentes React — compartilha lógica e tipos com o app. Preview no browser durante desenvolvimento. |
### Automações & Integrações Externas
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| n8n | External (hosted separadamente) | Orquestrador de automações | Corretoras usam n8n próprio ou contratado. A plataforma expõe webhooks para receber/enviar dados ao n8n. Sem n8n embedded na infra do produto — reduz complexidade operacional. |
| Vercel AI SDK (ai) | latest | Integração com LLMs | SDK oficial da Vercel para streaming de respostas de LLMs em Next.js. Suporta OpenAI, Anthropic, etc. Abstraí a troca de provider. |
| OpenAI / Anthropic API | — | LLM para atendimento IA | Via Vercel AI SDK. Iniciar com GPT-4o-mini (custo-benefício) para chat de suporte ao corretor. Claude para tarefas de análise mais complexas. |
### Internacionalização & Localização Brasil
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| date-fns | 3.x | Manipulação de datas com locale pt-BR | Modular (importa apenas funções usadas), imutável, suporte completo a pt-BR locale. Mais tree-shakeable que day.js para uso intenso. |
| Intl API nativa | — | Formatação de moeda BRL | `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` — zero dependência adicional para formatar valores em real. |
### Observabilidade & Monitoramento
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vercel Analytics | — | Web vitals e performance | Incluído no plano Vercel — zero config, dados de Core Web Vitals em produção. |
| Vercel Speed Insights | — | Real User Monitoring | Complementa Analytics com dados de usuários reais. |
| Sentry | latest | Error tracking | Para capturar erros não tratados em produção (Server Actions, Edge Functions, Client Components). `@sentry/nextjs` com integração nativa. Plano free cobre o início. |
### Desenvolvimento & Tooling
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Supabase CLI | latest | Migrations locais e tipo geração | `supabase gen types typescript` gera tipos TypeScript a partir do schema — elimina casting manual. Migrations versionadas no repo. |
| ESLint | 9.x | Linting | Configuração Next.js padrão. Detecta erros comuns de App Router. |
| Prettier | 3.x | Formatação | Consistência de código. |
## Alternativas Consideradas e Descartadas
| Categoria | Recomendado | Alternativa | Por Que Não |
|-----------|-------------|-------------|-------------|
| Auth | Supabase Auth | NextAuth.js (Auth.js) | Supabase Auth se integra nativamente com RLS — claims JWT que alimentam policies. NextAuth.js exigiria sincronizar sessões com o Supabase manualmente. |
| ORM | Supabase JS client (direto) | Prisma, Drizzle | Prisma não funciona com RLS nativamente. Drizzle é excelente mas adiciona complexidade desnecessária — Supabase client + tipos gerados por `supabase gen types` é suficiente e idiomático. |
| UI Components | shadcn/ui | Radix UI direto, MUI | shadcn/ui já encapsula Radix com styling Tailwind. MUI/Ant Design: bundle pesado, customização trabalhosa para identidade visual própria. |
| Charts | Recharts (via shadcn) | Chart.js, Tremor | Recharts já integrado via shadcn/ui charts. Tremor está em reestruturação em 2025. Chart.js requer mais configuração sem ganho claro. |
| State Management | Zustand + TanStack Query | Redux Toolkit, Jotai | Redux: overkill para este escopo. Jotai: menor ecossistema. Zustand + TanStack Query é o padrão consolidado para Next.js App Router em 2025. |
| Email | Resend | SendGrid, Postmark | Resend é o provider oficial recomendado pelo Supabase. DX superior, preço competitivo, integração nativa via hooks. |
| Pagamentos | Stripe | Asaas, Abacate Pay, Pagar.me | Stripe tem Pix via EBANX em 2025, suporta CPF/CNPJ, trials, webhooks robustos. Providers locais têm APIs menos maduras e sem os recursos de subscription management necessários. |
| Date library | date-fns v3 | Day.js, Luxon | date-fns: modular (melhor tree-shaking), imutável, pt-BR locale maduro. Day.js: menor mas menos funcional para manipulações complexas de datas de vigência e assembleia. |
## Instalação Base
# Framework
# Supabase
# UI
# Components: button, input, form, table, dialog, sheet, card, badge, 
#             select, checkbox, calendar, date-picker, chart, data-table
# Formulários
# State
# Billing
# Email
# Dates
# AI
# Error Tracking
# Dev dependencies
## Variáveis de Ambiente (Estrutura)
# Supabase
# Stripe
# Email
# AI
# n8n
# App
## LGPD — Implicações de Stack
- Supabase precisa ter **região de dados configurada** — verificar disponibilidade de region `sa-east-1` (São Paulo) para manter dados no Brasil
- Implementar **cookie consent** antes de qualquer analytics (Vercel Analytics usa cookies)
- Supabase Storage: documentos com dados pessoais → buckets privados + signed URLs com expiração curta (nunca URLs públicas permanentes)
- Direito ao esquecimento: implementar mecanismo de exclusão de dados por tenant desde a fase de arquitetura
- Logs de auditoria: registrar quem acessou/modificou apólices e dados de clientes (tabela `audit_log` com trigger PostgreSQL)
## Diagrama de Dependências de Stack
## Fontes e Confiança por Área
| Área | Confiança | Razão |
|------|-----------|-------|
| Next.js 15 App Router | HIGH | Documentação oficial + changelog verificado |
| Supabase RLS + multi-tenancy | HIGH | Documentação oficial + múltiplas fontes concordantes (Makerkit, Antstack, Supabase docs) |
| @supabase/ssr (deprecação de auth-helpers) | HIGH | Confirmado na documentação oficial de migração |
| Stripe + Pix Brasil | HIGH | Anúncio oficial Stripe/EBANX + changelog Stripe 2025-04-30 |
| Resend como email provider | HIGH | Recomendação oficial Supabase docs |
| shadcn/ui como UI library | HIGH | Adoção massiva em starters Next.js oficiais (vercel/nextjs-subscription-payments) |
| TanStack Query + Zustand | HIGH | Múltiplas fontes 2025 concordando no padrão complementar |
| date-fns v3 pt-BR | MEDIUM | pt-BR locale verificado, histórico de issues corrigidos |
| LGPD compliance | MEDIUM | Fontes jurídicas e técnicas verificadas, mas requer revisão por advogado especializado |
| Vercel AI SDK para LLM | HIGH | SDK oficial Vercel, integração nativa com Next.js |
## Sources
- [Supabase Row Level Security Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Custom Claims & RBAC](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac)
- [Supabase Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)
- [Setting up Server-Side Auth for Next.js | Supabase Docs](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Makerkit — Supabase RLS Best Practices](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)
- [Stripe Pix Payments Docs](https://docs.stripe.com/payments/pix)
- [Stripe adds Pix to payment method configurations — Changelog 2025-04-30](https://docs.stripe.com/changelog/basil/2025-04-30/add_pix_to_payment_method_configuration)
- [Stripe + EBANX Pix Brazil announcement](https://www.prnewswire.com/news-releases/stripe-users-can-now-accept-pix-in-brazil-via-ebanx-302526007.html)
- [Supabase Auth Emails with React Email and Resend](https://supabase.com/docs/guides/functions/examples/auth-send-email-hook-react-email-resend)
- [Next.js 15 Blog](https://nextjs.org/blog/next-15)
- [Next.js SaaS Starter (official)](https://github.com/nextjs/saas-starter)
- [vercel/nextjs-subscription-payments](https://github.com/vercel/nextjs-subscription-payments)
- [Multi-Tenant Applications with RLS on Supabase — Antstack](https://www.antstack.com/blog/multi-tenant-applications-with-rls-on-supabase-postgress/)
- [Federated State with Zustand + TanStack Query](https://www.nextsteps.dev/en/posts/federated-state-done-righ/)
- [Supabase Realtime with Next.js](https://supabase.com/docs/guides/realtime/realtime-with-nextjs)
- [Supabase pgvector & AI](https://supabase.com/docs/guides/ai)
- [Brazil LGPD SaaS Compliance Guide](https://complydog.com/blog/brazil-lgpd-complete-data-protection-compliance-guide-saas)
- [2025 Stripe Brazil Verification Requirements](https://support.stripe.com/questions/2025-updates-to-brazil-verification-requirements)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

### Skills obrigatórias neste projeto

Sempre aplicar as seguintes skills em toda tarefa:

| Skill | Quando aplicar |
|-------|---------------|
| `/gsd` | Toda implementação de código — use `/gsd-quick`, `/gsd-execute-phase` ou `/gsd-debug` conforme o escopo |
| `/caveman` | Todo commit — use `/caveman-commit` para mensagens de commit |
| `/supabase-postgres-best-practices` | Toda migration SQL, query RLS, Server Action com Supabase, ou schema change |
| `/frontend-design` | Todo componente UI, página, formulário ou mudança visual |
| `/vercel:deploy` | Todo deploy para produção — verificar build, env vars e status do deployment |

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

| Skill | Description | Path |
|-------|-------------|------|
| ckm:banner-design | "Design banners for social media, ads, website heroes, creative assets, and print. Multiple art direction options with AI-generated visuals. Actions: design, create, generate banner. Platforms: Facebook, Twitter/X, LinkedIn, YouTube, Instagram, Google Display, website hero, print. Styles: minimalist, gradient, bold typography, photo-based, illustrated, geometric, retro, glassmorphism, 3D, neon, duotone, editorial, collage. Uses ui-ux-pro-max, frontend-design, ai-artist, ai-multimodal skills." | `.agents/skills/ckm-banner-design/SKILL.md` |
| ckm:brand | Brand voice, visual identity, messaging frameworks, asset management, brand consistency. Activate for branded content, tone of voice, marketing assets, brand compliance, style guides. | `.agents/skills/ckm-brand/SKILL.md` |
| ckm:design | "Comprehensive design skill: brand identity, design tokens, UI styling, logo generation (55 styles, Gemini AI), corporate identity program (50 deliverables, CIP mockups), HTML presentations (Chart.js), banner design (22 styles, social/ads/web/print), icon design (15 styles, SVG, Gemini 3.1 Pro), social photos (HTML→screenshot, multi-platform). Actions: design logo, create CIP, generate mockups, build slides, design banner, generate icon, create social photos, social media images, brand identity, design system. Platforms: Facebook, Twitter, LinkedIn, YouTube, Instagram, Pinterest, TikTok, Threads, Google Ads." | `.agents/skills/ckm-design/SKILL.md` |
| ckm:design-system | Token architecture, component specifications, and slide generation. Three-layer tokens (primitive→semantic→component), CSS variables, spacing/typography scales, component specs, strategic slide creation. Use for design tokens, systematic design, brand-compliant presentations. | `.agents/skills/ckm-design-system/SKILL.md` |
| ckm:slides | Create strategic HTML presentations with Chart.js, design tokens, responsive layouts, copywriting formulas, and contextual slide strategies. | `.agents/skills/ckm-slides/SKILL.md` |
| ckm:ui-styling | Create beautiful, accessible user interfaces with shadcn/ui components (built on Radix UI + Tailwind), Tailwind CSS utility-first styling, and canvas-based visual designs. Use when building user interfaces, implementing design systems, creating responsive layouts, adding accessible components (dialogs, dropdowns, forms, tables), customizing themes and colors, implementing dark mode, generating visual designs and posters, or establishing consistent styling patterns across applications. | `.agents/skills/ckm-ui-styling/SKILL.md` |
| ui-ux-pro-max | "UI/UX design intelligence for web and mobile. Includes 50+ styles, 161 color palettes, 57 font pairings, 161 product types, 99 UX guidelines, and 25 chart types across 10 stacks (React, Next.js, Vue, Svelte, SwiftUI, React Native, Flutter, Tailwind, shadcn/ui, and HTML/CSS). Actions: plan, build, create, design, implement, review, fix, improve, optimize, enhance, refactor, and check UI/UX code. Projects: website, landing page, dashboard, admin panel, e-commerce, SaaS, portfolio, blog, and mobile app. Elements: button, modal, navbar, sidebar, card, table, form, and chart. Styles: glassmorphism, claymorphism, minimalism, brutalism, neumorphism, bento grid, dark mode, responsive, skeuomorphism, and flat design. Topics: color systems, accessibility, animation, layout, typography, font pairing, spacing, interaction states, shadow, and gradient. Integrations: shadcn/ui MCP for component search and examples." | `.agents/skills/ui-ux-pro-max/SKILL.md` |
| web-design-guidelines | Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices". | `.agents/skills/web-design-guidelines/SKILL.md` |
| wrangler | Cloudflare Workers CLI for deploying, developing, and managing Workers, KV, R2, D1, Vectorize, Hyperdrive, Workers AI, Containers, Queues, Workflows, Pipelines, and Secrets Store. Load before running wrangler commands to ensure correct syntax and best practices. Biases towards retrieval from Cloudflare docs over pre-trained knowledge. | `.agents/skills/wrangler/SKILL.md` |
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
