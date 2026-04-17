-- Create products catalog table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC NOT NULL DEFAULT 0,
  payment_type TEXT NOT NULL DEFAULT 'unico',
  installments INTEGER,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can view products (shared catalog)
CREATE POLICY "Authenticated users can view products"
ON public.products
FOR SELECT
TO authenticated
USING (true);

-- Only Managers can insert
CREATE POLICY "Managers can create products"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (public.is_manager(auth.uid()) AND created_by = auth.uid());

-- Only Managers can update
CREATE POLICY "Managers can update products"
ON public.products
FOR UPDATE
TO authenticated
USING (public.is_manager(auth.uid()))
WITH CHECK (public.is_manager(auth.uid()));

-- Only Managers can delete
CREATE POLICY "Managers can delete products"
ON public.products
FOR DELETE
TO authenticated
USING (public.is_manager(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Manual quotes table
CREATE TABLE public.manual_quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  lead_id UUID,
  client_name TEXT NOT NULL,
  company_name TEXT,
  phone TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.manual_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own manual quotes"
ON public.manual_quotes
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_manager(auth.uid()));

CREATE POLICY "Users can create their own manual quotes"
ON public.manual_quotes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own manual quotes"
ON public.manual_quotes
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own manual quotes"
ON public.manual_quotes
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_manual_quotes_updated_at
BEFORE UPDATE ON public.manual_quotes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();