-- HomeFin: detalhamento financeiro dos pagamentos aprovados do Mercado Pago.
-- Executar no Supabase SQL Editor antes de testar o checkout atualizado.
ALTER TABLE public.homefin_payments
  ADD COLUMN IF NOT EXISTS fee_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  ADD COLUMN IF NOT EXISTS net_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (net_amount >= 0),
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS provider_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS provider_status_detail text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS provider_fee_details jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.homefin_payments.amount IS 'Valor bruto cobrado do cliente, antes das tarifas do provedor.';
COMMENT ON COLUMN public.homefin_payments.fee_amount IS 'Tarifas efetivamente informadas pelo Mercado Pago em fee_details.';
COMMENT ON COLUMN public.homefin_payments.net_amount IS 'Valor líquido efetivamente informado pelo Mercado Pago; não é estimado quando o provedor o informa.';
COMMENT ON COLUMN public.homefin_payments.provider_fee_details IS 'Detalhamento de tarifas retornado pelo Mercado Pago, sem dados pessoais do pagador.';
