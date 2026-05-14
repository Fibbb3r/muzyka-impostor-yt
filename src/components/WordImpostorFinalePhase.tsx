import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ChevronRight, Music, RotateCcw, User, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Room, Player, Song, Vote } from '../types/game';
import WordImpostorDetectiveList from './WordImpostorDetectiveList';
import words from '../data/words.json';
import { allImpostorsSubmittedWord, wordGuessesMap } from '../lib/wordImpostorGuesses';

interface Props {
  room: Room;
  players: Player[];
  songs: Song[];
  votes: Vote[];
  currentPlayer: Player;
  isAdmin: boolean;
}

export default function WordImpostorFinalePhase({
  room,
  players,
  songs,
  votes,
  currentPlayer,
  isAdmin,
}: Props) {
  const [busy, setBusy] = useState(false);
  const step = room.word_finale_step ?? 0;
  const n = songs.length;
  const impostors = players.filter(p => p.is_impostor);
  const impostorIds = new Set(impostors.map(p => p.id));
  const isImpostorMe = currentPlayer.is_impostor;
  const finalStep = n + 1;
  const guessSet = allImpostorsSubmittedWord(room, players);
  const myWordGuess = wordGuessesMap(room, players)[currentPlayer.id];

  async function setGuess(word: string) {
    if (!isImpostorMe || busy) return;
    setBusy(true);
    const prev = (room.impostor_word_guesses as Record<string, string> | null | undefined) ?? {};
    const merged = { ...prev, [currentPlayer.id]: word };
    await supabase
      .from('rooms')
      .update({
        impostor_word_guesses: merged,
        impostor_word_guess: impostors.length === 1 ? word : null,
      })
      .eq('id', room.id);
    setBusy(false);
  }

  async function incrementStep() {
    if (!isAdmin || busy) return;
    setBusy(true);
    const s = room.word_finale_step ?? 0;
    await supabase.from('rooms').update({ word_finale_step: s + 1 }).eq('id', room.id);
    setBusy(false);
  }

  async function goLobby() {
    if (!isAdmin || busy) return;
    setBusy(true);
    await supabase.from('song_skip_votes').delete().eq('room_id', room.id);
    await supabase
      .from('rooms')
      .update({
        status: 'lobby',
        current_song_index: 0,
        current_word: null,
        impostor_word_guess: null,
        impostor_word_guesses: {},
        word_finale_step: 0,
        szpont_word: null,
      })
      .eq('id', room.id);
    setBusy(false);
  }

  const waitAdmin = (
    <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, marginTop: 16 }}>
      <User size={14} style={{ display: 'inline', marginRight: 6 }} />
      Czekaj aż admin przejdzie dalej…
    </div>
  );

  // ── Krok 0: wybór słowa przez impostora ─────────────────────
  if (step === 0) {
    return (
      <div style={{ width: '100%', maxWidth: 680, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 }}>
            <Sparkles size={20} color="var(--accent2)" />
            <h2 style={{ fontSize: 22, fontWeight: 900 }}>Finał — strzał słowa</h2>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            {isImpostorMe
              ? 'Wybierz słowo, które twoim zdaniem było tajemnicą dla reszty pokoju.'
              : impostors.length > 1
                ? 'Impostorzy wybierają słowo z listy…'
                : 'Impostor wybiera słowo z listy…'}
          </p>
        </div>

        {isImpostorMe && (
          <div className="card" style={{ marginBottom: 16 }}>
            <p className="section-title" style={{ marginBottom: 12 }}>Twoja typowana odpowiedź</p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                gap: 8,
              }}
            >
              {words.map(w => {
                const selected = myWordGuess === w;
                return (
                  <button
                    key={w}
                    type="button"
                    className="btn"
                    disabled={busy}
                    onClick={() => setGuess(w)}
                    style={{
                      padding: '10px 8px',
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#fff',
                      border: `2px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                      background: selected ? 'rgba(124,108,252,0.35)' : 'var(--bg3)',
                    }}
                  >
                    {w}
                  </button>
                );
              })}
            </div>
            {guessSet && (
              <p style={{ marginTop: 12, fontSize: 13, textAlign: 'center', color: 'var(--accent2)' }}>
                Zapisano: <strong>{myWordGuess}</strong>
              </p>
            )}
          </div>
        )}

        {!isImpostorMe && (
          <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 28 }}>
            {impostors.length > 0 ? (
              <p style={{ fontSize: 15 }}>
                {impostors.length === 1 ? (
                  <>
                    <strong style={{ color: 'var(--text)' }}>{impostors[0].name}</strong> wybiera jedno słowo z puli.
                  </>
                ) : (
                  <>
                    <strong style={{ color: 'var(--text)' }}>{impostors.map(i => i.name).join(', ')}</strong> — każdy wybiera jedno słowo z puli.
                  </>
                )}
              </p>
            ) : (
              <p>Brak impostora w danych pokoju.</p>
            )}
          </div>
        )}

        {isAdmin ? (
          <>
            {!guessSet && (
              <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                Przycisk odblokuje się, gdy {impostors.length > 1 ? 'wszyscy impostorzy' : 'impostor'} wybiorą słowo.
              </p>
            )}
            <button
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
              onClick={incrementStep}
              disabled={busy || !guessSet}
            >
              <ChevronRight size={16} /> Dalej — podsumowanie nutek
            </button>
          </>
        ) : (
          waitAdmin
        )}
      </div>
    );
  }

  // ── Kroki 1..N: recap nutki ─────────────────────────────────
  if (step >= 1 && step <= n) {
    const k = step;
    const song = songs[k - 1];
    const trueAuthorId = song?.player_id;
    const trueAuthor = players.find(p => p.id === trueAuthorId);
    const isImpostorSong = Boolean(trueAuthor?.is_impostor);
    const isSzpontSong = Boolean(trueAuthor?.is_szpont && !trueAuthor?.is_impostor);
    const songVotes = votes.filter(v => v.song_index === k);

    return (
      <div style={{ width: '100%', maxWidth: 680, margin: '0 auto', paddingBottom: 24 }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 }}>
            <Music size={20} color="var(--accent)" />
            <h2 style={{ fontSize: 22, fontWeight: 900 }}>Podsumowanie — Nutka {k}/{n}</h2>
          </div>
        </div>

        <motion.div
          key={k}
          className="card"
          style={{ textAlign: 'center', marginBottom: 16, padding: '24px 20px' }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="section-title" style={{ marginBottom: 12 }}>Piosenkę dodał</p>
          {trueAuthor ? (
            <>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: isImpostorSong
                    ? 'linear-gradient(135deg, #f43f5e, #fb923c)'
                    : isSzpontSong
                      ? 'linear-gradient(135deg, #f59e0b, #fbbf24)'
                      : 'linear-gradient(135deg, var(--accent), var(--accent2))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  fontWeight: 900,
                  color: '#fff',
                  margin: '0 auto 10px',
                }}
              >
                {trueAuthor.name[0].toUpperCase()}
              </div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{trueAuthor.name}</div>
              {isImpostorSong && (
                <span className="badge badge-red" style={{ fontSize: 11, padding: '6px 12px', marginTop: 10, display: 'inline-block' }}>
                  🕵️ To był impostor
                </span>
              )}
              {isSzpontSong && (
                <span
                  className="badge"
                  style={{
                    fontSize: 11,
                    padding: '6px 12px',
                    marginTop: 10,
                    display: 'inline-block',
                    background: 'rgba(245,158,11,0.12)',
                    color: '#d97706',
                    border: '1px solid rgba(245,158,11,0.4)',
                  }}
                >
                  🎭 Szpont
                </span>
              )}
              {!isImpostorSong && !isSzpontSong && (
                <span className="badge badge-green" style={{ fontSize: 11, padding: '6px 12px', marginTop: 10, display: 'inline-block' }}>
                  Nie impostor
                </span>
              )}
            </>
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>Brak danych</p>
          )}
        </motion.div>

        <div className="card" style={{ marginBottom: 16 }}>
          <p className="section-title" style={{ marginBottom: 12 }}>Głosy przy tej nutce (impostor)</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {players
              .filter(p => !impostorIds.has(p.id))
              .map(voter => {
                const vote = songVotes.find(v => v.voter_id === voter.id);
                const votedFor = players.find(p => p.id === vote?.voted_for_id);
                const pointedAsImpostor = Boolean(vote?.is_impostor_guess);
                const hitImpostor = pointedAsImpostor && Boolean(vote?.voted_for_id && impostorIds.has(vote.voted_for_id));

                let line: string;
                if (!vote) line = 'Nie zagłosował';
                else if (pointedAsImpostor) {
                  line = `Użył „To Impostor!” — wskazał: ${votedFor?.name ?? '?'}${hitImpostor ? ' (to impostor)' : ' (to nie impostor)'}`;
                } else line = 'Nie użył „To Impostor!” na tej nutce';

                return (
                  <div
                    key={voter.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: 'var(--bg3)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 13 }}>{voter.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{line}</div>
                  </div>
                );
              })}
          </div>
        </div>

        <WordImpostorDetectiveList
          players={players}
          votes={votes}
          impostors={impostors}
          throughSongIndex={k}
          sticky
        />

        {isAdmin ? (
          <button
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: 16 }}
            onClick={incrementStep}
            disabled={busy}
          >
            <ChevronRight size={16} /> Dalej
          </button>
        ) : (
          waitAdmin
        )}
      </div>
    );
  }

  // ── Krok N+1: strzał słowa + werdykt ─────────────────────────
  if (step === finalStep) {
    const guesses = wordGuessesMap(room, players);
    const truth = room.current_word ?? '';
    const hits = impostors.map(i => guesses[i.id]).filter((g): g is string => Boolean(g?.length));
    const won = hits.some(g => g.length > 0 && truth.length > 0 && g === truth);

    return (
      <div style={{ width: '100%', maxWidth: 680, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <h2 style={{ fontSize: 22, fontWeight: 900 }}>Strzał impostora</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>Oto wytypowane słowa</p>
        </div>

        <motion.div
          className="card"
          style={{ textAlign: 'center', padding: '32px 24px', marginBottom: 16 }}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <p className="section-title" style={{ marginBottom: 10 }}>Impostorzy wytypowali</p>
          {impostors.length === 0 ? (
            <div style={{ fontSize: 22, fontWeight: 800 }}>—</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px', textAlign: 'left' }}>
              {impostors.map(i => (
                <li
                  key={i.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '10px 0',
                    borderBottom: '1px solid var(--border)',
                    fontSize: 15,
                    fontWeight: 700,
                  }}
                >
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{i.name}</span>
                  <span style={{ color: 'var(--accent)' }}>{guesses[i.id] || '—'}</span>
                </li>
              ))}
            </ul>
          )}
          <p style={{ marginTop: 20, fontSize: 13, color: 'var(--text-muted)' }}>Tajne słowo rundy było</p>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>{truth || '—'}</div>
          {won ? (
            <div style={{ marginTop: 20 }}>
              <span className="badge badge-red" style={{ fontSize: 14, padding: '8px 16px' }}>
                Impostor wygrał — trafił słowo
              </span>
            </div>
          ) : (
            <div style={{ marginTop: 20 }}>
              <span className="badge badge-gray" style={{ fontSize: 14, padding: '8px 16px' }}>
                Żaden impostor nie trafił słowa
              </span>
            </div>
          )}
        </motion.div>

        <WordImpostorDetectiveList
          players={players}
          votes={votes}
          impostors={impostors}
          throughSongIndex={null}
        />

        {isAdmin ? (
          <button
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: 16 }}
            onClick={goLobby}
            disabled={busy}
          >
            <RotateCcw size={16} /> Powrót do lobby
          </button>
        ) : (
          waitAdmin
        )}
      </div>
    );
  }

  // Fallback — zły step (np. stary cache)
  return (
    <div className="card" style={{ textAlign: 'center', padding: 24 }}>
      <p>Nieznany krok finału ({step}).</p>
      {isAdmin && (
        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={goLobby} disabled={busy}>
          Powrót do lobby
        </button>
      )}
    </div>
  );
}
