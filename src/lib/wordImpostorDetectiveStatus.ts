import type { Player, Vote } from '../types/game';

export type DetectiveImpostorStatus = 'correct' | 'wrong' | 'not_yet';

/**
 * Status wskazania impostora dla gracza (nie-impostora), wg głosów z nutek 1..throughSongIndex.
 * `throughSongIndex === null` — cała runda (wszystkie nutki).
 */
export function detectiveImpostorStatusForPlayer(
  votes: Vote[],
  voterId: string,
  impostorId: string | undefined,
  throughSongIndex: number | null,
): DetectiveImpostorStatus {
  if (!impostorId || voterId === impostorId) return 'not_yet';

  const scoped =
    throughSongIndex === null
      ? votes
      : votes.filter(v => v.song_index <= throughSongIndex);

  const guessVote = scoped.find(v => v.voter_id === voterId && v.is_impostor_guess);
  if (!guessVote) return 'not_yet';
  if (guessVote.voted_for_id === impostorId) return 'correct';
  return 'wrong';
}

export function groupPlayersByDetectiveImpostorStatus(
  players: Player[],
  votes: Vote[],
  impostor: Player | undefined,
  throughSongIndex: number | null,
): { correct: Player[]; wrong: Player[]; notYet: Player[] } {
  const impostorId = impostor?.id;
  const detectives = players.filter(p => p.id !== impostorId);
  const correct: Player[] = [];
  const wrong: Player[] = [];
  const notYet: Player[] = [];

  const byName = (a: Player, b: Player) => a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' });

  for (const p of detectives) {
    const s = detectiveImpostorStatusForPlayer(votes, p.id, impostorId, throughSongIndex);
    if (s === 'correct') correct.push(p);
    else if (s === 'wrong') wrong.push(p);
    else notYet.push(p);
  }
  correct.sort(byName);
  wrong.sort(byName);
  notYet.sort(byName);
  return { correct, wrong, notYet };
}
