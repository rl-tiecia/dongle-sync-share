-- Tornar user_id nullable na tabela devices
-- Isso permite que dispositivos não claimed tenham user_id = NULL
-- ao invés de usar UUIDs fake

ALTER TABLE public.devices 
ALTER COLUMN user_id DROP NOT NULL;

-- Atualizar dispositivos que usam UUID fake para NULL
UPDATE public.devices 
SET user_id = NULL 
WHERE user_id = '00000000-0000-0000-0000-000000000000';

-- Criar index para melhorar performance de queries por user_id
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON public.devices(user_id) WHERE user_id IS NOT NULL;

-- Criar index para claim_code (usado frequentemente em queries)
CREATE INDEX IF NOT EXISTS idx_devices_claim_code ON public.devices(claim_code) WHERE claim_code IS NOT NULL;