-- HomeFin: controle independente de notificações de vencimento.
-- Não altera nem remove dados de homefin_data.

CREATE TABLE IF NOT EXISTS public.homefin_push_due_notices (
  id bigserial PRIMARY KEY,
  family_id text NOT NULL,
  bill_id text NOT NULL,
  due_date date NOT NULL,
  notice_type text NOT NULL CHECK (notice_type IN ('due_today', 'due_tomorrow')),
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'sent')),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  CONSTRAINT homefin_push_due_notices_unique
    UNIQUE (family_id, bill_id, due_date, notice_type)
);

ALTER TABLE public.homefin_push_due_notices ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.homefin_push_due_notices FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.homefin_push_due_notices TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.homefin_push_due_notices_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.homefin_claim_push_due_bill(
  p_family_id text,
  p_bill_id text,
  p_due_date date,
  p_notice_type text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  IF p_family_id IS NULL OR p_bill_id IS NULL
     OR p_notice_type NOT IN ('due_today', 'due_tomorrow') THEN
    RAISE EXCEPTION 'Parâmetros inválidos';
  END IF;

  INSERT INTO public.homefin_push_due_notices (
    family_id, bill_id, due_date, notice_type, status, claimed_at, sent_at
  )
  VALUES (
    p_family_id, p_bill_id, p_due_date, p_notice_type, 'processing', now(), NULL
  )
  ON CONFLICT (family_id, bill_id, due_date, notice_type)
  DO UPDATE SET
    status = 'processing',
    claimed_at = now(),
    sent_at = NULL
  WHERE public.homefin_push_due_notices.status <> 'sent'
    AND (
      public.homefin_push_due_notices.status <> 'processing'
      OR public.homefin_push_due_notices.claimed_at < now() - interval '20 minutes'
    );

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.homefin_claim_push_due_bill(text, text, date, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.homefin_claim_push_due_bill(text, text, date, text)
  TO service_role;
