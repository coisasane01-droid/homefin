-- HOMEFIN - CAMPOS ADICIONAIS DO CADASTRO DE ESTOQUE
-- Migração complementar e não destrutiva.
-- NÃO executar antes de revisar a integração completa.

BEGIN;

ALTER TABLE public.homefin_inventory_products
    ADD COLUMN IF NOT EXISTS barcode text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS measure text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'UN',
    ADD COLUMN IF NOT EXISTS ncm text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS promotional_price numeric(14,2)
        NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS average_monthly_sales numeric(14,3)
        NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS favorite boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS photo_storage_path text NOT NULL DEFAULT '';

-- Restrições de tamanho e valores.
-- Criadas somente quando ainda não existem.
DO $block$
DECLARE
    item record;
BEGIN
    FOR item IN
        SELECT *
        FROM (VALUES
            ('homefin_inventory_barcode_length_check',
             'char_length(barcode) <= 100'),
            ('homefin_inventory_measure_length_check',
             'char_length(measure) <= 120'),
            ('homefin_inventory_unit_length_check',
             'char_length(unit) BETWEEN 1 AND 30'),
            ('homefin_inventory_ncm_length_check',
             'char_length(ncm) <= 20'),
            ('homefin_inventory_promotional_price_check',
             'promotional_price >= 0'),
            ('homefin_inventory_average_sales_check',
             'average_monthly_sales >= 0'),
            ('homefin_inventory_notes_length_check',
             'char_length(notes) <= 10000'),
            ('homefin_inventory_photo_path_length_check',
             'char_length(photo_storage_path) <= 1024')
        ) AS checks(nome, expressao)
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = item.nome
              AND conrelid =
                  'public.homefin_inventory_products'::regclass
        ) THEN
            EXECUTE format(
                'ALTER TABLE public.homefin_inventory_products ADD CONSTRAINT %I CHECK (%s)',
                item.nome,
                item.expressao
            );
        END IF;
    END LOOP;
END;
$block$;

COMMIT;
