DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'orders_quote_id_fkey'
    AND table_name = 'orders'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_quote_id_fkey 
      FOREIGN KEY (quote_id) REFERENCES public.quotes(id) 
      ON DELETE SET NULL;
  END IF;
END $$;