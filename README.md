# Moja drużyna

Treningi (z zapisami), zgrupowania, wyścigi, czat i powiadomienia. Statyczna strona (GitHub Pages) + Supabase.

## Uruchomienie
1. Załóż projekt na supabase.com. W **SQL Editor** wklej i uruchom `supabase/schema.sql`.
2. W **Project Settings → API** skopiuj `Project URL` i klucz `anon public` do `config.js`.
3. Zarejestruj się w aplikacji, potem w SQL Editor nadaj sobie rolę trenera:
   `update profiles set role='trener' where id=(select id from auth.users where email='TWOJ@EMAIL');`
   Dalej role zmieniasz w aplikacji (Profil). Zawodnik nie ma jak zmienić swojej roli: blokuje to baza (RLS).
4. GitHub: wgraj pliki → **Settings → Pages** → gałąź `main`, folder `/ (root)`.
5. W Supabase **Authentication → URL Configuration** ustaw Site URL na adres z GitHub Pages.

## Uwagi
- Każdy, kto zna adres, może założyć konto. Dla zamkniętej drużyny wyłącz *Allow new users to sign up* po rejestracji składu.
- Powiadomienia przychodzą, gdy aplikacja jest otwarta w tle. Push przy zamkniętej aplikacji wymaga Service Workera i Edge Function (nie zrobione).
