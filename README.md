# Moja drużyna

Treningi (z zapisami), zgrupowania, wyścigi (z wyborem uczestników), stroje, czat i powiadomienia. Statyczna strona (GitHub Pages) + Supabase.

## Uruchomienie
1. Załóż projekt na supabase.com. W **SQL Editor** uruchom po kolei `supabase/schema.sql`, a potem `supabase/update_2.sql` (uczestnicy wydarzeń i stroje).
2. W **Project Settings → API** skopiuj `Project URL` i klucz `anon public` do `config.js`.
3. Zarejestruj się w aplikacji, potem w SQL Editor nadaj sobie rolę trenera:
   `update profiles set role='trener' where id=(select id from auth.users where email='TWOJ@EMAIL');`
   Dalej role zmieniasz w aplikacji (Profil). Zawodnik nie ma jak zmienić swojej roli: blokuje to baza (RLS).
4. GitHub: wgraj pliki → **Settings → Pages** → gałąź `main`, folder `/ (root)`.
5. W Supabase **Authentication → URL Configuration** ustaw Site URL na adres z GitHub Pages.

## Uwagi
- Każdy, kto zna adres, może założyć konto. Dla zamkniętej drużyny wyłącz *Allow new users to sign up* po rejestracji składu.
- Powiadomienia przychodzą, gdy aplikacja jest otwarta w tle. Push przy zamkniętej aplikacji wymaga Service Workera i Edge Function (nie zrobione).
- Wszyscy widzą wszystkie wydarzenia. Przy każdym zawodnik widzi „Dotyczy” lub „Nie dotyczy” (trener zaznacza uczestników w formularzu). Treningi domyślnie dotyczą wszystkich, zgrupowania i wyścigi nikogo, dopóki trener nie zaznaczy.
- Kolejność SQL: `schema.sql`, `update_2.sql`, `update_3.sql`.
- Stroje: trener dodaje wiersze przy każdym zawodniku (strój, rozmiar, notatka, „wydany"). Zawodnicy mają wgląd tylko do odczytu.
- Ikona ✌️ (folder `icons/`): na telefonie otwórz stronę i wybierz „Dodaj do ekranu głównego". Jeśli ikona się nie zmieniła, usuń skrót i dodaj go ponownie.
