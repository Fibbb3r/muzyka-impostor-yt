-- Finał trybu „Słowo Impostor”: strzał słowa przez impostora + kroki podsumowania
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS szpont_word text;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS impostor_word_guess text;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS impostor_word_guesses jsonb DEFAULT '{}'::jsonb;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS word_finale_step integer NOT NULL DEFAULT 0;

-- Jeśli masz CHECK na status, rozszerz o 'word_finale', np.:
-- ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_status_check;
-- ALTER TABLE rooms ADD CONSTRAINT rooms_status_check
--   CHECK (status IN ('lobby', 'picking', 'playing', 'results', 'word_finale'));
