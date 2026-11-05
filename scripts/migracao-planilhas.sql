-- Executar manualmente no Supabase SQL Editor antes de habilitar a funcionalidade.
CREATE TABLE IF NOT EXISTS public.homefin_spreadsheets (
    id uuid PRIMARY KEY,
    family_id text NOT NULL,
    name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
    reference_month integer NOT NULL CHECK (reference_month BETWEEN 1 AND 12),
    reference_year integer NOT NULL CHECK (reference_year BETWEEN 2000 AND 9999),
    "columns" jsonb NOT NULL CHECK (jsonb_typeof("columns") = 'array'),
    "rows" jsonb NOT NULL CHECK (jsonb_typeof("rows") = 'array'),
    notes text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS homefin_spreadsheets_family_id_idx
    ON public.homefin_spreadsheets (family_id);
CREATE INDEX IF NOT EXISTS homefin_spreadsheets_reference_year_idx
    ON public.homefin_spreadsheets (reference_year);
CREATE INDEX IF NOT EXISTS homefin_spreadsheets_reference_month_idx
    ON public.homefin_spreadsheets (reference_month);
CREATE INDEX IF NOT EXISTS homefin_spreadsheets_family_period_idx
    ON public.homefin_spreadsheets (family_id, reference_year DESC, reference_month DESC);

ALTER TABLE public.homefin_spreadsheets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.homefin_spreadsheets FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.homefin_spreadsheets TO service_role;
