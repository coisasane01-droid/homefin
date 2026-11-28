-- HomeFin: habilita deduplicação de notificações da Agenda.
-- Execute no SQL Editor do Supabase após publicar o código.
-- Não altera nem remove eventos ou dados familiares.

ALTER TABLE public.homefin_push_due_notices
  DROP CONSTRAINT IF EXISTS homefin_push_due_notices_notice_type_check;

ALTER TABLE public.homefin_push_due_notices
  ADD CONSTRAINT homefin_push_due_notices_notice_type_check
  CHECK (notice_type IN ('due_today', 'due_tomorrow', 'event_today', 'event_tomorrow'));

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
     OR p_notice_type NOT IN ('due_today', 'due_tomorrow', 'event_today', 'event_tomorrow') THEN
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
