-- Dodanie kolumny na wylosowane słowo
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS current_word text;

-- Kolumna na strzał impostora (co wytypował za tajne słowo)
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS impostor_word_guess text;

-- Kolumna na krok finału word_impostor (0 = wybór słowa, 1..N = recap nutek, N+1 = werdykt)
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS word_finale_step integer NOT NULL DEFAULT 0;

-- Aktualizacja constraintu na game_mode (jeśli masz CHECK)
-- ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_game_mode_check;
-- ALTER TABLE rooms ADD CONSTRAINT rooms_game_mode_check CHECK (game_mode IN ('normal', 'impostor', 'word_impostor'));

-- Aktualizacja constraintu na status (jeśli masz CHECK na kolumnie status)
-- Aplikacja używa statusu 'word_finale' po ostatniej nutce w trybie word_impostor
-- ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_status_check;
-- ALTER TABLE rooms ADD CONSTRAINT rooms_status_check
--   CHECK (status IN ('lobby', 'picking', 'playing', 'results', 'word_finale'));
