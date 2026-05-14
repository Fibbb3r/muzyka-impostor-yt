import type { Player, Room } from '../types/game';

/** Strzały słowa (player_id → słowo); uwzględnia starsze `impostor_word_guess` przy jednym impostorze. */
export function wordGuessesMap(room: Room, players: Player[]): Record<string, string> {
  const raw = room.impostor_word_guesses;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === 'string' && v.length > 0) out[k] = v;
    }
    if (Object.keys(out).length > 0) return out;
  }
  const imps = players.filter(p => p.is_impostor);
  if (imps.length === 1 && room.impostor_word_guess) return { [imps[0].id]: room.impostor_word_guess };
  return {};
}

export function allImpostorsSubmittedWord(room: Room, players: Player[]): boolean {
  const imps = players.filter(p => p.is_impostor);
  if (imps.length === 0) return false;
  const g = wordGuessesMap(room, players);
  return imps.every(p => Boolean(g[p.id]?.length));
}
