import type { GameMode, Player, Song, Vote } from '../types/game';

export function formatPointsPts(n: number): string {
  if (n === 0) return '0 pkt';
  return `+${n} pkt`;
}

/** Gracze (bez `authorId`), którzy przy tej nutce nie wskazali autora jako dodającego. */
function countDidNotPickAsAuthor(
  players: Player[],
  authorId: string,
  voteByVoter: Map<string, Vote | undefined>,
): number {
  let n = 0;
  for (const p of players) {
    if (p.id === authorId) continue;
    const v = voteByVoter.get(p.id);
    if (!v?.voted_for_id || v.voted_for_id !== authorId) n += 1;
  }
  return n;
}

/** Punkty za „detektywistyczne” głosowanie (bez bonusów za nutkę autora). */
function detectiveNormal(vote: Vote | undefined, trueAuthorId: string): number {
  if (vote?.voted_for_id === trueAuthorId) return 3;
  return 0;
}

function detectiveImpostor(
  voter: Player,
  impostor: Player | undefined,
  vote: Vote | undefined,
  trueAuthorId: string,
  isImpostorSong: boolean,
  victimId: string | null,
): number {
  if (!impostor) return 0;

  // Impostor nie może „zgadywać impostora” (UI), ale za trafnego autora nutki dostaje +3 jak reszta.
  if (voter.id === impostor.id) {
    if (vote?.voted_for_id === trueAuthorId) return 3;
    return 0;
  }

  const guessedImpostor = Boolean(vote?.is_impostor_guess && vote.voted_for_id === impostor.id);
  const guessedVictim =
    guessedImpostor && victimId !== null && vote?.impostor_target_id === victimId;

  if (isImpostorSong && guessedVictim) return 6;
  if (isImpostorSong && guessedImpostor && !guessedVictim) return 4;
  if (vote?.voted_for_id === trueAuthorId) return 3;
  return 0;
}

/**
 * Punkty dla każdego gracza za jedną nutkę (`songIndex`).
 * Tryb `word_impostor` — na razie brak wdrożonej punktacji (wszystkie 0).
 */
export function scoreSongPoints(opts: {
  gameMode: GameMode;
  songIndex: number;
  votes: Vote[];
  players: Player[];
  trueAuthorId: string | undefined | null;
}): Record<string, number> {
  const { gameMode, songIndex, votes, players, trueAuthorId } = opts;
  const out: Record<string, number> = {};
  for (const p of players) out[p.id] = 0;

  if (!trueAuthorId || gameMode === 'word_impostor') return out;

  const songVotes = votes.filter(v => v.song_index === songIndex);
  const voteByVoter = new Map<string, Vote | undefined>();
  for (const v of songVotes) voteByVoter.set(v.voter_id, v);

  const impostor = players.find(p => p.is_impostor);
  const isImpostorSong = Boolean(impostor && impostor.id === trueAuthorId);
  const victimId =
    isImpostorSong && impostor?.impersonates_id ? impostor.impersonates_id : null;

  if (gameMode === 'normal') {
    for (const p of players) {
      out[p.id] += detectiveNormal(voteByVoter.get(p.id), trueAuthorId);
    }
    const q = countDidNotPickAsAuthor(players, trueAuthorId, voteByVoter);
    out[trueAuthorId] = (out[trueAuthorId] ?? 0) + q * 1;
    return out;
  }

  if (gameMode === 'impostor') {
    for (const p of players) {
      out[p.id] += detectiveImpostor(
        p,
        impostor,
        voteByVoter.get(p.id),
        trueAuthorId,
        isImpostorSong,
        victimId,
      );
    }
    const hideBonus = countDidNotPickAsAuthor(players, trueAuthorId, voteByVoter);
    out[trueAuthorId] = (out[trueAuthorId] ?? 0) + hideBonus * 1;
    if (isImpostorSong && impostor) {
      out[impostor.id] = (out[impostor.id] ?? 0) + hideBonus * 2;
    }
  }

  return out;
}

/**
 * Suma punktów każdego gracza od nutki 1 do `throughSongIndex` (włącznie).
 * Używane m.in. przy podium pokazywanym na etapie wyników.
 */
export function cumulativeScoresThroughSong(opts: {
  gameMode: GameMode;
  votes: Vote[];
  players: Player[];
  songs: Song[];
  /** 1-based, włącznie (np. na ekranie nutki 3 — sumuj 1,2,3). */
  throughSongIndex: number;
}): Record<string, number> {
  const { gameMode, votes, players, songs, throughSongIndex } = opts;
  const totals: Record<string, number> = Object.fromEntries(players.map(p => [p.id, 0]));

  if (gameMode === 'word_impostor') return totals;

  const hi = Math.max(0, Math.min(Math.floor(throughSongIndex), songs.length));
  for (let i = 1; i <= hi; i++) {
    const tid = songs[i - 1]?.player_id ?? null;
    const perSong = scoreSongPoints({
      gameMode,
      songIndex: i,
      votes,
      players,
      trueAuthorId: tid,
    });
    for (const p of players) totals[p.id] += perSong[p.id] ?? 0;
  }

  return totals;
}
