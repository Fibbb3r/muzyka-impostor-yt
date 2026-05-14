import type { Player, Vote } from '../types/game';

export type DetectiveImpostorStatus = 'correct' | 'wrong' | 'not_yet';

/**
 * Status wskazania impostora dla gracza (nie-impostora), wg głosów z nutek 1..throughSongIndex.
 * `throughSongIndex === null` — cała runda (wszystkie nutki).
 */
export function detectiveImpostorStatusForPlayer(
  votes: Vote[],
  voterId: string,
  impostorIds: Set<string>,
  throughSongIndex: number | null,
): DetectiveImpostorStatus {
  if (impostorIds.size === 0 || impostorIds.has(voterId)) return 'not_yet';

  const scoped =
    throughSongIndex === null
      ? votes
      : votes.filter(v => v.song_index <= throughSongIndex);

  const guessVote = scoped.find(v => v.voter_id === voterId && v.is_impostor_guess);
  if (!guessVote) return 'not_yet';
  if (impostorIds.has(guessVote.voted_for_id)) return 'correct';
  return 'wrong';
}

export function groupPlayersByDetectiveImpostorStatus(
  players: Player[],
  votes: Vote[],
  impostorIds: Set<string>,
  throughSongIndex: number | null,
): { correct: Player[]; wrong: Player[]; notYet: Player[] } {
  const detectives = players.filter(p => !impostorIds.has(p.id));
  const correct: Player[] = [];
  const wrong: Player[] = [];
  const notYet: Player[] = [];

  const byName = (a: Player, b: Player) => a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' });

  for (const p of detectives) {
    const s = detectiveImpostorStatusForPlayer(votes, p.id, impostorIds, throughSongIndex);
    if (s === 'correct') correct.push(p);
    else if (s === 'wrong') wrong.push(p);
    else notYet.push(p);
  }
  correct.sort(byName);
  wrong.sort(byName);
  notYet.sort(byName);
  return { correct, wrong, notYet };
}
