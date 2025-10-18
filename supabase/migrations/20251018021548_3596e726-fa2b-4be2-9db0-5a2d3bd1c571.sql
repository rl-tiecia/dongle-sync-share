-- Criar enum para tipos de claim (futuro uso)
CREATE TYPE public.claim_status AS ENUM ('pending', 'used', 'expired');

-- Tabela para gerenciar códigos de vinculação
CREATE TABLE public.device_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  claim_code TEXT UNIQUE NOT NULL,
  is_used BOOLEAN DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  used_at TIMESTAMP WITH TIME ZONE
);

-- Habilitar RLS
ALTER TABLE public.device_claims ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para device_claims
CREATE POLICY "Users can view their own claims"
ON public.device_claims
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own claims"
ON public.device_claims
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own claims"
ON public.device_claims
FOR UPDATE
USING (auth.uid() = user_id);

-- Adicionar colunas à tabela devices para suportar claim system
ALTER TABLE public.devices
ADD COLUMN claim_code TEXT,
ADD COLUMN is_claimed BOOLEAN DEFAULT false,
ADD COLUMN claimed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN device_token TEXT UNIQUE;

-- Criar índice para melhorar performance
CREATE INDEX idx_device_claims_code ON public.device_claims(claim_code);
CREATE INDEX idx_device_claims_user ON public.device_claims(user_id);
CREATE INDEX idx_devices_token ON public.devices(device_token);

-- Função para limpar claims expirados (pode ser chamada por um cron job)
CREATE OR REPLACE FUNCTION public.cleanup_expired_claims()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.device_claims
  WHERE expires_at < now() AND is_used = false;
END;
$$;