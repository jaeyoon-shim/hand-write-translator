-- Create table for storing menu analysis history
CREATE TABLE public.menu_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  image_url TEXT,
  drive_file_id TEXT,
  sheet_row_id TEXT,
  menu_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.menu_analyses ENABLE ROW LEVEL SECURITY;

-- Create policy for public read/write (no auth required for this service)
CREATE POLICY "Allow public read access" 
ON public.menu_analyses 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert access" 
ON public.menu_analyses 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update access" 
ON public.menu_analyses 
FOR UPDATE 
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_menu_analyses_updated_at
BEFORE UPDATE ON public.menu_analyses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();