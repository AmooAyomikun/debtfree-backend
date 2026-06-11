ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS credit_score_updated_at timestamp with time zone DEFAULT now();
