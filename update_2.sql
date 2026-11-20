-- Uruchom PO schema.sql: SQL Editor -> New query -> Run
-- Uczestnicy: dla zgrupowań i wyścigów state='in' (jedzie), dla treningów state='out' (odznaczony)
create table event_players(event_id uuid references events on delete cascade, user_id uuid references profiles(id) on delete cascade,
  state text not null check(state in('in','out')), primary key(event_id,user_id));
create table kits(id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(id) on delete cascade,
  item text not null, size text, note text, given boolean not null default true, created_at timestamptz default now());
alter table event_players enable row level security; alter table kits enable row level security;

create policy ep_sel on event_players for select to authenticated using(is_coach() or user_id=auth.uid());
create policy ep_ins on event_players for insert to authenticated with check(is_coach());
create policy ep_upd on event_players for update to authenticated using(is_coach());
create policy ep_del on event_players for delete to authenticated using(is_coach());
create policy k_sel on kits for select to authenticated using(true);
create policy k_ins on kits for insert to authenticated with check(is_coach());
create policy k_upd on kits for update to authenticated using(is_coach());
create policy k_del on kits for delete to authenticated using(is_coach());

-- zawodnik widzi: treningi (chyba że odznaczony) oraz zgrupowania/wyścigi tylko jeśli został zaznaczony
drop policy e_sel on events;
create policy e_sel on events for select to authenticated using(
  is_coach()
  or (type='trening' and not exists(select 1 from event_players p where p.event_id=events.id and p.user_id=auth.uid() and p.state='out'))
  or (type<>'trening' and exists(select 1 from event_players p where p.event_id=events.id and p.user_id=auth.uid() and p.state='in')));
drop policy r_sel on rsvps;
create policy r_sel on rsvps for select to authenticated using(exists(select 1 from events e where e.id=rsvps.event_id));

alter publication supabase_realtime add table event_players, kits;
