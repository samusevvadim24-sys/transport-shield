-- Enable realtime updates for the customer balance and transaction history.
-- The customer cabinet listens to both tables so balance and history update
-- without a page refresh.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'customers'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'customer_balance_transactions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_balance_transactions;
    END IF;
END $$;
