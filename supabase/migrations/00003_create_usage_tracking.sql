-- Create usage_tracking table
-- Tracks monthly image usage per user for quota enforcement
create table public.usage_tracking (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  month_year text not null,
  images_used integer not null default 0,
  updated_at timestamptz default now() not null,
  unique(user_id, month_year)
);

-- Enable RLS immediately (policies defined in 00004)
alter table public.usage_tracking enable row level security;
