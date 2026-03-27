-- Create updated_at auto-trigger function
-- Automatically sets updated_at to now() on row updates
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply trigger to profiles table
create trigger profiles_updated_at before update on profiles
  for each row execute function update_updated_at();

-- Apply trigger to usage_tracking table
create trigger usage_tracking_updated_at before update on usage_tracking
  for each row execute function update_updated_at();
