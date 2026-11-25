-- Uruchom w Supabase: SQL Editor -> New query -> Run
create table profiles(id uuid primary key references auth.users on delete cascade,
  name text not null, role text not null default 'zawodnik' check(role in('zawodnik','trener')));
create table events(id uuid primary key default gen_random_uuid(),
  type text not null check(type in('trening','zgrupowanie','wyscig')),
  title text not null, start_at timestamptz not null, end_at timestamptz not null,
  place text, extra text, descr text, created_by uuid default auth.uid() references profiles(id));
create table rsvps(event_id uuid references events on delete cascade, user_id uuid default auth.uid() references profiles(id) on delete cascade,
  status text not null check(status in('yes','no')), primary key(event_id,user_id));
create table messages(id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  body text not null check(length(body) between 1 and 2000), created_at timestamptz default now());

create function is_coach() returns boolean language sql security definer stable set search_path=public
as $$ select exists(select 1 from profiles where id=auth.uid() and role='trener') $$;

-- nowe konto ZAWSZE dostaje rolę zawodnik
create function handle_new_user() returns trigger language plpgsql security definer set search_path=public
as $$ begin insert into profiles(id,name) values(new.id,coalesce(nullif(new.raw_user_meta_data->>'name',''),split_part(new.email,'@',1))); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- rolę zmienia tylko trener
create function set_role(uid uuid, r text) returns void language plpgsql security definer set search_path=public
as $$ begin if not is_coach() then raise exception 'Brak uprawnień'; end if; update profiles set role=r where id=uid; end $$;

alter table profiles enable row level security; alter table events enable row level security;
alter table rsvps enable row level security; alter table messages enable row level security;
revoke update on profiles from authenticated, anon; grant update(name) on profiles to authenticated;

create policy p_sel on profiles for select to authenticated using(true);
create policy p_upd on profiles for update to authenticated using(id=auth.uid());
create policy e_sel on events for select to authenticated using(true);
create policy e_ins on events for insert to authenticated with check(is_coach());
create policy e_upd on events for update to authenticated using(is_coach());
create policy e_del on events for delete to authenticated using(is_coach());
create policy r_sel on rsvps for select to authenticated using(true);
create policy r_ins on rsvps for insert to authenticated with check(user_id=auth.uid());
create policy r_upd on rsvps for update to authenticated using(user_id=auth.uid());
create policy r_del on rsvps for delete to authenticated using(user_id=auth.uid());
create policy m_sel on messages for select to authenticated using(true);
create policy m_ins on messages for insert to authenticated with check(user_id=auth.uid());

alter publication supabase_realtime add table events, rsvps, messages;
