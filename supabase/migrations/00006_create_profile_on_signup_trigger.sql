-- Trigger function: auto-create profile when user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  name_parts text[];
  initials text;
begin
  -- Extract full_name from user metadata
  name_parts := string_to_array(
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    ' '
  );

  -- Generate initials from first letter of each non-empty name part (max 5)
  initials := '';
  for i in 1..least(coalesce(array_length(name_parts, 1), 0), 5) loop
    if length(trim(name_parts[i])) > 0 then
      initials := initials || upper(left(trim(name_parts[i]), 1));
    end if;
  end loop;

  insert into public.profiles (id, full_name, email, default_initials)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    initials
  );
  return new;
end;
$$;

-- Trigger: fires after a new user is created in auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
