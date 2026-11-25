-- Uruchom PO update_3.sql. Dodaje rolę "rodzic" (tylko podgląd) i jednorazowy wybór zawodnik/rodzic przy pierwszym logowaniu.
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check(role in('zawodnik','rodzic','trener'));
alter table profiles add column chosen boolean not null default false;
update profiles set chosen = true;  -- dotychczasowe konta nie muszą wybierać

-- jednorazowy wybór; trenerem nie da się zostać tą drogą
create or replace function choose_role(r text) returns void language plpgsql security definer set search_path=public
as $$ begin
  if r not in('zawodnik','rodzic') then raise exception 'Niedozwolona rola'; end if;
  update profiles set role=r, chosen=true where id=auth.uid() and chosen=false and role<>'trener';
  if not found then raise exception 'Rola została już wybrana'; end if;
end $$;

create or replace function set_role(uid uuid, r text) returns void language plpgsql security definer set search_path=public
as $$ begin if not is_coach() then raise exception 'Brak uprawnień'; end if; update profiles set role=r, chosen=true where id=uid; end $$;

create function can_act() returns boolean language sql security definer stable set search_path=public
as $$ select exists(select 1 from profiles where id=auth.uid() and role in('zawodnik','trener')) $$;
create function is_viewer() returns boolean language sql security definer stable set search_path=public
as $$ select exists(select 1 from profiles where id=auth.uid() and role in('trener','rodzic')) $$;

-- rodzic nie może zapisywać się na wydarzenia ani pisać na czacie
drop policy r_ins on rsvps; create policy r_ins on rsvps for insert to authenticated with check(user_id=auth.uid() and can_act());
drop policy r_upd on rsvps; create policy r_upd on rsvps for update to authenticated using(user_id=auth.uid() and can_act());
drop policy r_del on rsvps; create policy r_del on rsvps for delete to authenticated using(user_id=auth.uid() and can_act());
drop policy m_ins on messages; create policy m_ins on messages for insert to authenticated with check(user_id=auth.uid() and can_act());
-- rodzic widzi, kogo dotyczy każde wydarzenie
drop policy ep_sel on event_players; create policy ep_sel on event_players for select to authenticated using(is_viewer() or user_id=auth.uid());
