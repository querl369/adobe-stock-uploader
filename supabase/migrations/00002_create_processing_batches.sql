-- Create processing_batches table
-- Tracks image processing batches per user with session linkage
create table public.processing_batches (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  session_id text not null,
  image_count integer not null default 0,
  status text not null default 'completed' check (status in ('processing', 'completed', 'failed')),
  csv_filename text,
  created_at timestamptz default now() not null,
  expires_at timestamptz default (now() + interval '30 days') not null
);

-- Index on user_id for efficient lookups (PostgreSQL does not auto-index FK columns)
create index idx_processing_batches_user_id on processing_batches(user_id);

-- Enable RLS immediately (policies defined in 00004)
alter table public.processing_batches enable row level security;
