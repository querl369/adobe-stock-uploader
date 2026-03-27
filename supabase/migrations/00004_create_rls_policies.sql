-- RLS is enabled in each table's migration (00001-00003)
-- This migration defines the access policies

-- Profiles: users can only read/update their own profile
create policy "Users can view own profile" on profiles
  for select to authenticated using (auth.uid() = id);
create policy "Users can update own profile" on profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Processing batches: users can read/insert their own batches
create policy "Users can view own batches" on processing_batches
  for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own batches" on processing_batches
  for insert to authenticated with check (auth.uid() = user_id);

-- Usage tracking: users can read/upsert their own usage
create policy "Users can view own usage" on usage_tracking
  for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own usage" on usage_tracking
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update own usage" on usage_tracking
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
