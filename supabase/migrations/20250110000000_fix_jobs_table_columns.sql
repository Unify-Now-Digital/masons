-- Ensure jobs table has all required columns
-- This migration is idempotent and safe to run multiple times

-- Add customer_name if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'jobs' 
    AND column_name = 'customer_name'
  ) THEN
    ALTER TABLE public.jobs ADD COLUMN customer_name text;
  END IF;
END $$;

-- Add location_name if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'jobs' 
    AND column_name = 'location_name'
  ) THEN
    ALTER TABLE public.jobs ADD COLUMN location_name text;
  END IF;
END $$;

-- Add address if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'jobs' 
    AND column_name = 'address'
  ) THEN
    ALTER TABLE public.jobs ADD COLUMN address text;
  END IF;
END $$;

-- Add latitude if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'jobs' 
    AND column_name = 'latitude'
  ) THEN
    ALTER TABLE public.jobs ADD COLUMN latitude decimal(10,8);
  END IF;
END $$;

-- Add longitude if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'jobs' 
    AND column_name = 'longitude'
  ) THEN
    ALTER TABLE public.jobs ADD COLUMN longitude decimal(11,8);
  END IF;
END $$;

-- Add status if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'jobs' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE public.jobs ADD COLUMN status text DEFAULT 'scheduled';
    ALTER TABLE public.jobs ADD CONSTRAINT jobs_status_check 
      CHECK (status IN ('scheduled', 'in_progress', 'ready_for_installation', 'completed', 'cancelled'));
  END IF;
END $$;

-- Add scheduled_date if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'jobs' 
    AND column_name = 'scheduled_date'
  ) THEN
    ALTER TABLE public.jobs ADD COLUMN scheduled_date date;
  END IF;
END $$;

-- Add estimated_duration if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'jobs' 
    AND column_name = 'estimated_duration'
  ) THEN
    ALTER TABLE public.jobs ADD COLUMN estimated_duration text;
  END IF;
END $$;

-- Add priority if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'jobs' 
    AND column_name = 'priority'
  ) THEN
    ALTER TABLE public.jobs ADD COLUMN priority text DEFAULT 'medium';
    ALTER TABLE public.jobs ADD CONSTRAINT jobs_priority_check 
      CHECK (priority IN ('low', 'medium', 'high'));
  END IF;
END $$;

-- Add notes if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'jobs' 
    AND column_name = 'notes'
  ) THEN
    ALTER TABLE public.jobs ADD COLUMN notes text;
  END IF;
END $$;

-- Make customer_name, location_name, and address NOT NULL if they're nullable
DO $$ 
BEGIN
  -- Only alter if column exists and is nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'jobs' 
    AND column_name = 'customer_name'
    AND is_nullable = 'YES'
  ) THEN
    -- Set default for existing NULL values first
    UPDATE public.jobs SET customer_name = '' WHERE customer_name IS NULL;
    ALTER TABLE public.jobs ALTER COLUMN customer_name SET NOT NULL;
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'jobs' 
    AND column_name = 'location_name'
    AND is_nullable = 'YES'
  ) THEN
    UPDATE public.jobs SET location_name = '' WHERE location_name IS NULL;
    ALTER TABLE public.jobs ALTER COLUMN location_name SET NOT NULL;
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'jobs' 
    AND column_name = 'address'
    AND is_nullable = 'YES'
  ) THEN
    UPDATE public.jobs SET address = '' WHERE address IS NULL;
    ALTER TABLE public.jobs ALTER COLUMN address SET NOT NULL;
  END IF;
END $$;

