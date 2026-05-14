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

/** Punkty detektywa (nie-impostora) w trybie muzycznym `impostor`. */
function impostorModeNonImpostorPoints(
  vote: Vote | undefined,
  songImpostor: Player | undefined,
  victimId: string | null,
  trueAuthorId: string,
): number {
  if (!songImpostor) {
    return vote?.voted_for_id === trueAuthorId ? 3 : 0;
  }

  const fullDetective =
    Boolean(vote?.is_impostor_guess) &&
    vote?.voted_for_id === songImpostor.id &&
    victimId !== null &&
    vote.impostor_target_id === victimId;

  if (fullDetective) return 8;
  if (vote?.voted_for_id === songImpostor.id) return 5;
  return 0;
}

/** Punkty impostora, który NIE jest autorem tej nutki (+3 / 0 jak przy zwykłej nutce). */
function impostorModeOtherImpostorPoints(vote: Vote | undefined, trueAuthorId: string): number {
  return vote?.voted_for_id === trueAuthorId ? 3 : 0;
}

/**
 * Punkty autora-nutki (impostora) za własną nutkę: +2 / −2 wg wskazań na autora,
 * +3 za każdego, kto wskazał wyłącznie „ofiarę” (podszywkę) — bez dodatkowego +2 za „nie trafili w impostora”.
 */
function impostorOwnSongAuthorPoints(
  songImpostor: Player,
  victimId: string | null,
  players: Player[],
  voteByVoter: Map<string, Vote | undefined>,
): number {
  let pts = 0;
  for (const p of players) {
    if (p.id === songImpostor.id) continue;
    const v = voteByVoter.get(p.id);
    const vf = v?.voted_for_id;
    if (victimId && vf === victimId) {
      pts += 3;
    } else if (vf === songImpostor.id) {
      pts -= 2;
    } else {
      pts += 2;
    }
  }
  return pts;
}

/**
 * Punkty dla każdego gracza za jedną nutkę (`songIndex`).
 * Tryb `normal` — +3 za autora; autor +1 za każdego, kto go nie wskazał.
 * Tryb `impostor` — osobna tabela (detektywi / impostorzy / nutka impostora), patrz funkcje pomocnicze.
 * Tryb `word_impostor` — brak punktacji nutek (wszystkie 0).
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

  const trueAuthor = players.find(p => p.id === trueAuthorId);
  const songImpostor =
    trueAuthor?.is_impostor ? trueAuthor : undefined;
  const isImpostorSong = Boolean(songImpostor);
  const victimId =
    isImpostorSong && songImpostor?.impersonates_id ? songImpostor.impersonates_id : null;

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
      if (p.is_impostor && songImpostor && p.id === songImpostor.id) continue;
      if (p.is_impostor) {
        out[p.id] += impostorModeOtherImpostorPoints(voteByVoter.get(p.id), trueAuthorId);
      } else {
        out[p.id] += impostorModeNonImpostorPoints(
          voteByVoter.get(p.id),
          songImpostor,
          victimId,
          trueAuthorId,
        );
      }
    }
    if (songImpostor) {
      out[songImpostor.id] += impostorOwnSongAuthorPoints(
        songImpostor,
        victimId,
        players,
        voteByVoter,
      );
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
