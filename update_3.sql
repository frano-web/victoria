-- Uruchom PO update_2.sql. Wszyscy widzą wszystkie wydarzenia; aplikacja pokazuje przy nich "Dotyczy" / "Nie dotyczy".
drop policy e_sel on events;
create policy e_sel on events for select to authenticated using(true);
drop policy r_sel on rsvps;
create policy r_sel on rsvps for select to authenticated using(true);
