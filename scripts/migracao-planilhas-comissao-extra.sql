BEGIN;
ALTER TABLE public.homefin_spreadsheets
  ADD COLUMN IF NOT EXISTS extra_commission_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS extra_commission_original_column_id text,
  ADD COLUMN IF NOT EXISTS extra_commission_sale_column_id text,
  ADD COLUMN IF NOT EXISTS extra_commission_quantity_column_id text,
  ADD COLUMN IF NOT EXISTS extra_commission_mode text NOT NULL DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS extra_commission_rate numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE public.homefin_spreadsheets DROP CONSTRAINT IF EXISTS homefin_extra_commission_mode_check;
ALTER TABLE public.homefin_spreadsheets ADD CONSTRAINT homefin_extra_commission_mode_check
  CHECK (extra_commission_mode IN ('percentage','fixed'));
ALTER TABLE public.homefin_spreadsheets DROP CONSTRAINT IF EXISTS homefin_extra_commission_rate_check;
ALTER TABLE public.homefin_spreadsheets ADD CONSTRAINT homefin_extra_commission_rate_check
  CHECK (extra_commission_rate >= 0 AND (extra_commission_mode <> 'percentage' OR extra_commission_rate <= 100));
COMMIT;
