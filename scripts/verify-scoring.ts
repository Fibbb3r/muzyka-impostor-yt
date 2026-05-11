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

console.log('verify-scoring: all OK');
