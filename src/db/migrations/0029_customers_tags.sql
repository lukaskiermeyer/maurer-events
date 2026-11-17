-- Add tags to customers
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS customer_tags_idx ON public.customers USING GIN (tags);