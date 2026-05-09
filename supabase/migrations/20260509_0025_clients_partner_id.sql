-- UAT Issue #1: adiciona partner_id em clients
-- UAT Issue #2: assigned_to torna-se nullable (cliente pode ser atribuído a parceiro)

ALTER TABLE public.clients
  ADD COLUMN partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL;

-- assigned_to pode ser NULL quando partner_id estiver preenchido
ALTER TABLE public.clients
  ALTER COLUMN assigned_to DROP NOT NULL;

-- Constraint: pelo menos um dos dois deve estar preenchido
ALTER TABLE public.clients
  ADD CONSTRAINT clients_broker_or_partner_check CHECK (
    assigned_to IS NOT NULL OR partner_id IS NOT NULL
  );

CREATE INDEX idx_clients_partner_id ON public.clients(partner_id) WHERE partner_id IS NOT NULL;

-- RLS clients_select: corretor vê seus próprios clientes (assigned_to = uid).
-- Quando partner_id está preenchido e assigned_to é NULL, apenas admin/financeiro/visualizador veem.
-- Nenhuma alteração na clients_select policy necessária — comportamento correto por design.

-- RLS clients_update: admin já cobre tudo; corretor só atualiza assigned_to = uid.
-- Quando assigned_to é NULL (cliente de parceiro), admin é o único que pode atualizar via updateClientBrokerAction.
-- Nenhuma alteração na clients_update policy necessária.
