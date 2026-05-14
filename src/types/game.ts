export type GameMode = 'normal' | 'impostor' | 'word_impostor';
export type RoomStatus = 'lobby' | 'picking' | 'playing' | 'results' | 'word_finale';

export interface Room {
  id: string;
  code: string;
  status: RoomStatus;
  game_mode: GameMode;
  current_song_index: number;
  current_word?: string | null;
  /** Wspólne słowo-dekoy dla roli Szpont (tryb word_impostor), inne niż `current_word`. */
  szpont_word?: string | null;
  impostor_word_guess?: string | null;
  /** Strzały słowa w finale (player_id → słowo), gdy jest więcej niż jeden impostor. */
  impostor_word_guesses?: Record<string, string> | null;
  word_finale_step?: number | null;
}

export interface Player {
  id: string;
  room_id: string;
  name: string;
  is_admin: boolean;
  is_impostor: boolean;
  /** Rola „Szpont” — wspólne inne słowo niż lojalistów; tylko tryb word_impostor. */
  is_szpont?: boolean;
  impersonates_id: string | null;
}

export interface Song {
  id: string;
  room_id: string;
  player_id: string;
  youtube_url: string;
  start_seconds: number;
  submitted: boolean;
  song_order?: number;
  created_at?: string;
}

export interface Vote {
  id: string;
  room_id: string;
  voter_id: string;
  song_index: number;         // 1-based, który numer nutki
  voted_for_id: string;       // kto wg mnie dodał tę nutkę
  is_impostor_guess: boolean;
  impostor_target_id: string | null; // pod kogo się podszywał
}

export interface VoteState {
  voted_for_id: string;
  is_impostor_guess: boolean;
  impostor_target_id: string;
}

export interface SkipVote {
  id: string;
  room_id: string;
  song_index: number;
  voter_id: string;
  created_at?: string;
}
