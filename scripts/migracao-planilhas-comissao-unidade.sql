BEGIN;

ALTER TABLE public.homefin_spreadsheets
  ADD COLUMN IF NOT EXISTS unit_commission_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unit_commission_column_id text,
  ADD COLUMN IF NOT EXISTS unit_commission_amount numeric(14,2) NOT NULL DEFAULT 0;

ALTER TABLE public.homefin_spreadsheets
  DROP CONSTRAINT IF EXISTS homefin_unit_commission_amount_check;

ALTER TABLE public.homefin_spreadsheets
  ADD CONSTRAINT homefin_unit_commission_amount_check
  CHECK (unit_commission_amount >= 0);

COMMIT;
