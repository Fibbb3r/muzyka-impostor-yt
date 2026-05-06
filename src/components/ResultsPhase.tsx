import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ChevronRight, RotateCcw, Trophy, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Room, Player, Song, Vote } from '../types/game';

interface Props {
  room: Room;
  players: Player[];
  songs: Song[];
  votes: Vote[];
  isAdmin: boolean;
}

export default function ResultsPhase({ room, players, songs, votes, isAdmin }: Props) {
  const [revealing, setRevealing] = useState(false);

  const idx = room.current_song_index; // current song being shown
  const song = songs[idx - 1];
  const trueAuthorId = song?.player_id;
  const trueAuthor = players.find(p => p.id === trueAuthorId);

  // In impostor mode: if true author is impostor, actual song "label" is victim name
  const impostor = players.find(p => p.is_impostor);
  const isImpostorSong = impostor?.id === trueAuthorId;
  const victim = isImpostorSong ? players.find(p => p.id === impostor?.impersonates_id) : null;

  const songVotes = votes.filter(v => v.song_index === idx);

  async function next() {
    setRevealing(true);
    const next = room.current_song_index + 1;
    if (next > songs.length) {
      // back to lobby
      await supabase.from('rooms').update({ status: 'lobby', current_song_index: 0 }).eq('id', room.id);
    } else {
      await supabase.from('rooms').update({ current_song_index: next }).eq('id', room.id);
    }
    setRevealing(false);
  }

  const isLastSong = idx >= songs.length;

  return (
    <div style={{ width: '100%', maxWidth: 680, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 }}>
          <Trophy size={20} color="var(--accent2)" />
          <h2 style={{ fontSize: 22, fontWeight: 900 }}>Wyniki — Nutka {idx}/{songs.length}</h2>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Kto co wybrał i jak głosowali gracze</p>
      </div>

      {/* True author reveal */}
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          className="card"
          style={{ textAlign: 'center', marginBottom: 20, padding: '28px 24px' }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35 }}
        >
          <p className="section-title" style={{ marginBottom: 12 }}>Piosenkę dodał</p>
          {trueAuthor ? (
            <>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: isImpostorSong
                  ? 'linear-gradient(135deg, #f43f5e, #fb923c)'
                  : 'linear-gradient(135deg, var(--accent), var(--accent2))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, fontWeight: 900, color: '#fff', margin: '0 auto 12px',
                boxShadow: '0 8px 30px rgba(124,108,252,0.4)',
              }}>
                {trueAuthor.name[0].toUpperCase()}
              </div>
              <div style={{ fontSize: 28, fontWeight: 900 }}>{trueAuthor.name}</div>

              {isImpostorSong && victim && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ marginTop: 12 }}
                >
                  <span className="badge badge-red" style={{ fontSize: 12, padding: '6px 14px' }}>
                    🕵️ IMPOSTOR — podszywa się pod: {victim.name}
                  </span>
                </motion.div>
              )}
            </>
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>Brak danych</p>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Votes list */}
      <div className="card" style={{ marginBottom: 20 }}>
        <p className="section-title" style={{ marginBottom: 14 }}>Jak głosowali gracze</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {players.map(voter => {
            const vote = songVotes.find(v => v.voter_id === voter.id);
            const votedFor = players.find(p => p.id === vote?.voted_for_id);
            const isCorrect = vote?.voted_for_id === trueAuthorId;
            const guessedImpostor = vote?.is_impostor_guess && vote.voted_for_id === impostor?.id;
            const guessedVictim = guessedImpostor && vote?.impostor_target_id === victim?.id;
            const perfectGuess = guessedImpostor && guessedVictim;

            return (
              <div key={voter.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 14px', borderRadius: 12,
                background: isCorrect ? 'rgba(34,211,160,0.07)' : 'var(--bg3)',
                border: `1px solid ${isCorrect ? 'rgba(34,211,160,0.25)' : 'var(--border)'}`,
              }}>
                <div className="avatar" style={{ width: 34, height: 34, fontSize: 13 }}>
                  {voter.name[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{voter.name}</div>
                  {vote ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      Wskazał: <strong style={{ color: 'var(--text)' }}>{votedFor?.name ?? '?'}</strong>
                      {vote.is_impostor_guess && (
                        <span style={{ color: '#fb7185', marginLeft: 6 }}>
                          · jako Impostor pod {players.find(p => p.id === vote.impostor_target_id)?.name ?? '?'}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nie zagłosował</div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                  {isCorrect && !vote?.is_impostor_guess && (
                    <span className="badge badge-green">✓ Trafił!</span>
                  )}
                  {perfectGuess && (
                    <span className="badge badge-red">🎯 Idealny traf!</span>
                  )}
                  {guessedImpostor && !guessedVictim && (
                    <span className="badge badge-orange">🕵️ Wykrył impostora</span>
                  )}
                  {!isCorrect && !guessedImpostor && vote && (
                    <span className="badge badge-gray">✗ Pudło</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Admin navigation */}
      {isAdmin && (
        <button
          className="btn btn-primary btn-lg"
          style={{ width: '100%' }}
          onClick={next}
          disabled={revealing}
        >
          {isLastSong
            ? <><RotateCcw size={16} /> Powrót do lobby</>
            : <><ChevronRight size={16} /> Dalej — Nutka {idx + 1}/{songs.length}</>
          }
        </button>
      )}
      {!isAdmin && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
          <User size={14} style={{ display: 'inline', marginRight: 6 }} />
          Czekaj aż admin przejdzie dalej…
        </div>
      )}
    </div>
  );
}
