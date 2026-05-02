-- Adiciona tipo 'comentario' ao CHECK constraint de client_interactions
ALTER TABLE public.client_interactions
  DROP CONSTRAINT IF EXISTS client_interactions_type_check;

ALTER TABLE public.client_interactions
  ADD CONSTRAINT client_interactions_type_check
  CHECK (type IN ('ligacao','email','reuniao','whatsapp','visita','comentario'));
