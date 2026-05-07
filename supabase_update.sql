-- Dodanie kolumny na wylosowane słowo
ALTER TABLE rooms ADD COLUMN current_word text;

-- Aktualizacja constraintu (jeśli masz check na game_mode)
-- Jeśli tworzyłeś tabelę z CHECK (game_mode IN ('normal', 'impostor')), musisz to zaktualizować:
-- ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_game_mode_check;
-- ALTER TABLE rooms ADD CONSTRAINT rooms_game_mode_check CHECK (game_mode IN ('normal', 'impostor', 'word_impostor', 'third'));
