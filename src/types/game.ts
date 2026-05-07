export type GameMode = 'normal' | 'impostor' | 'word_impostor';
export type RoomStatus = 'lobby' | 'picking' | 'playing' | 'results';

export interface Room {
  id: string;
  code: string;
  status: RoomStatus;
  game_mode: GameMode;
  current_song_index: number;
  current_word?: string | null;
}

export interface Player {
  id: string;
  room_id: string;
  name: string;
  is_admin: boolean;
  is_impostor: boolean;
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
