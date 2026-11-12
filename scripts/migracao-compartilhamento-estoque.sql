-- HomeFin: compartilhamento de Estoque entre famílias.
-- Migration aditiva: não copia, move ou apaga produtos e movimentações.
-- Execute manualmente somente depois de revisar e testar o código.

CREATE TABLE IF NOT EXISTS public.homefin_inventory_shares (
  shared_family_id text PRIMARY KEY
    CHECK (shared_family_id ~ '^[a-z0-9][a-z0-9-]{0,99}$'),
  owner_family_id text NOT NULL
    CHECK (owner_family_id ~ '^[a-z0-9][a-z0-9-]{0,99}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT homefin_inventory_shares_not_self
    CHECK (shared_family_id <> owner_family_id)
);

CREATE INDEX IF NOT EXISTS homefin_inventory_shares_owner_idx
  ON public.homefin_inventory_shares (owner_family_id);

ALTER TABLE public.homefin_inventory_shares ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.homefin_inventory_shares FROM PUBLIC;
REVOKE ALL ON TABLE public.homefin_inventory_shares FROM anon;
REVOKE ALL ON TABLE public.homefin_inventory_shares FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.homefin_inventory_shares TO service_role;

-- Impede compartilhamento em cadeia e corridas entre convites simultâneos.
-- O proprietário pode manter vários convidados; o convidado não pode participar
-- de outro vínculo como proprietário ou convidado.
CREATE OR REPLACE FUNCTION public.homefin_guard_inventory_share()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_first text;
  v_second text;
BEGIN
  IF NEW.owner_family_id = NEW.shared_family_id THEN
    RAISE EXCEPTION 'Uma família não pode compartilhar o Estoque consigo mesma.';
  END IF;

  v_first := LEAST(NEW.owner_family_id, NEW.shared_family_id);
  v_second := GREATEST(NEW.owner_family_id, NEW.shared_family_id);

  -- Ordem determinística para evitar deadlocks entre convites simultâneos.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_first, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended(v_second, 0));

  IF EXISTS (
    SELECT 1
    FROM public.homefin_inventory_shares s
    WHERE s.shared_family_id IN (NEW.owner_family_id, NEW.shared_family_id)
       OR s.owner_family_id = NEW.shared_family_id
  ) THEN
    RAISE EXCEPTION 'Família já participa de um compartilhamento. Compartilhamento em cadeia não permitido.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.homefin_guard_inventory_share() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.homefin_guard_inventory_share() FROM anon;
REVOKE ALL ON FUNCTION public.homefin_guard_inventory_share() FROM authenticated;

DROP TRIGGER IF EXISTS homefin_inventory_share_guard
  ON public.homefin_inventory_shares;

CREATE TRIGGER homefin_inventory_share_guard
BEFORE INSERT ON public.homefin_inventory_shares
FOR EACH ROW
EXECUTE FUNCTION public.homefin_guard_inventory_share();
