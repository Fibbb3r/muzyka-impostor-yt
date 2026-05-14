import { scoreSongPoints } from '../src/lib/scoringSong';
import type { Player, Vote } from '../src/types/game';

const mkP = (id: string, name: string, imp: boolean, victim: string | null): Player => ({
  id,
  name,
  room_id: 'r',
  is_admin: false,
  is_impostor: imp,
  impersonates_id: victim,
});

const mkV = (voter_id: string, voted_for_id: string, song_index = 1): Vote => ({
  id: `vote-${voter_id}`,
  room_id: 'r',
  voter_id,
  song_index,
  voted_for_id,
  is_impostor_guess: false,
  impostor_target_id: null,
});

const mkVImp = (
  voter_id: string,
  voted_for_id: string,
  is_impostor_guess: boolean,
  impostor_target_id: string | null,
  song_index = 1,
): Vote => ({
  id: `vote-${voter_id}`,
  room_id: 'r',
  voter_id,
  song_index,
  voted_for_id,
  is_impostor_guess,
  impostor_target_id,
});

const imp = mkP('i', 'Impo', true, 'v');
const vic = mkP('v', 'Victim', false, null);
const alice = mkP('a', 'Alice', false, null);
const players = [imp, vic, alice];

// Nutka Alice — impostor i reszta trafiają
const pts1 = scoreSongPoints({
  gameMode: 'impostor',
  songIndex: 1,
  votes: [mkV('i', 'a'), mkV('v', 'a'), mkV('a', 'a')],
  players,
  trueAuthorId: 'a',
});
if (pts1.i !== 3) throw new Error(`impostor +3 expected, got ${pts1.i}`);
if (pts1.v !== 3 || pts1.a !== 3) throw new Error(`others: ${JSON.stringify(pts1)}`);
console.log('pass: impostor +3 when correct author (non-impostor song)');

const ptsWrong = scoreSongPoints({
  gameMode: 'impostor',
  songIndex: 1,
  votes: [mkV('i', 'v')],
  players,
  trueAuthorId: 'a',
});
if (ptsWrong.i !== 0) throw new Error(`impostor wrong guess should be 0, got ${ptsWrong.i}`);
console.log('pass: impostor 0 when wrong');

// Nutka impostora „i”, ofiara „v”: pełne +8 i bonus autora
const ptsImSong = scoreSongPoints({
  gameMode: 'impostor',
  songIndex: 1,
  votes: [mkVImp('v', 'i', true, 'v'), mkV('a', 'v')],
  players,
  trueAuthorId: 'i',
});
if (ptsImSong.v !== 8) throw new Error(`victim full detective +8 expected, got ${ptsImSong.v}`);
if (ptsImSong.a !== 0) throw new Error(`alice wrong author on imp song should be 0, got ${ptsImSong.a}`);
// v: -2 (wskazała i), alice: tylko +3 (wskazała v jako ofiarę — bez +2)
if (ptsImSong.i !== 1) throw new Error(`imp own-song bonus expected 1, got ${ptsImSong.i}`);
console.log('pass: impostor song +8 full / author bonus');

// +5: trafiony impostor jako autor, bez pełnego detektywa
const pts5 = scoreSongPoints({
  gameMode: 'impostor',
  songIndex: 1,
  votes: [mkVImp('v', 'i', true, 'a'), mkV('a', 'i')],
  players,
  trueAuthorId: 'i',
});
if (pts5.v !== 5) throw new Error(`v +5 expected, got ${pts5.v}`);
if (pts5.a !== 5) throw new Error(`alice +5 (hit impostor as author), got ${pts5.a}`);
// vic: -2, alice: -2 → imp -4
if (pts5.i !== -4) throw new Error(`imp own-song both pointed at imp, expected -4, got ${pts5.i}`);
console.log('pass: +5 partial / imp -4 when both vote impostor as author');

console.log('verify-scoring: all OK');
