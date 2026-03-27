-- Create profiles table
-- Stores user profile data, linked to Supabase auth.users
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  email text not null unique,
  default_initials text check (char_length(default_initials) <= 5),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Enable RLS immediately (policies defined in 00004)
alter table public.profiles enable row level security;
