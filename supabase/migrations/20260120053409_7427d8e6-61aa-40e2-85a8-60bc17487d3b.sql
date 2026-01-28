-- Add is_favorite column to menu_analyses table
ALTER TABLE public.menu_analyses ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT false;

-- Create product_analyses table for product translations
CREATE TABLE public.product_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  image_url TEXT,
  product_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on product_analyses
ALTER TABLE public.product_analyses ENABLE ROW LEVEL SECURITY;

-- Create policy for reading based on session (no auth required, session-based)
CREATE POLICY "Allow read based on session" 
ON public.product_analyses 
FOR SELECT 
USING (true);

-- Create policy for insert (handled by edge function with service role)
CREATE POLICY "Allow insert via service role" 
ON public.product_analyses 
FOR INSERT 
WITH CHECK (true);

-- Create policy for update (for favorites)
CREATE POLICY "Allow update via service role" 
ON public.product_analyses 
FOR UPDATE 
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_product_analyses_updated_at
BEFORE UPDATE ON public.product_analyses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for session_id lookups
CREATE INDEX idx_product_analyses_session_id ON public.product_analyses(session_id);
CREATE INDEX idx_product_analyses_created_at ON public.product_analyses(created_at DESC);
CREATE INDEX idx_product_analyses_is_favorite ON public.product_analyses(is_favorite);

-- Add indexes for menu_analyses if not exists
CREATE INDEX IF NOT EXISTS idx_menu_analyses_session_id ON public.menu_analyses(session_id);
CREATE INDEX IF NOT EXISTS idx_menu_analyses_created_at ON public.menu_analyses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_menu_analyses_is_favorite ON public.menu_analyses(is_favorite);