import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ChevronRight, RotateCcw, Trophy, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Room, Player, Song, Vote } from '../types/game';
import { formatPointsPts, scoreSongPoints, cumulativeScoresThroughSong } from '../lib/scoringSong';
import WordImpostorDetectiveList from './WordImpostorDetectiveList';

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

  const pointsThisSong =
    song && trueAuthorId
      ? scoreSongPoints({
          gameMode: room.game_mode,
          songIndex: idx,
          votes,
          players,
          trueAuthorId,
        })
      : Object.fromEntries(players.map(p => [p.id, 0]));

  const showPodium = room.game_mode !== 'word_impostor' && Boolean(song && trueAuthorId);

  const rankedByPoints = useMemo(() => {
    if (!showPodium || songs.length === 0) return [];
    const totals = cumulativeScoresThroughSong({
      gameMode: room.game_mode,
      votes,
      players,
      songs,
      throughSongIndex: idx,
    });
    return [...players]
      .map(p => ({ player: p, points: totals[p.id] ?? 0 }))
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return a.player.name.localeCompare(b.player.name, 'pl', { sensitivity: 'base' });
      });
  }, [showPodium, songs, idx, votes, players, room.game_mode]);

  async function next() {
    setRevealing(true);
    const next = room.current_song_index + 1;
    if (next > songs.length) {
      if (room.game_mode === 'word_impostor') {
        await supabase
          .from('rooms')
          .update({
            status: 'word_finale',
            word_finale_step: 0,
            impostor_word_guess: null,
          })
          .eq('id', room.id);
      } else {
        await supabase.from('song_skip_votes').delete().eq('room_id', room.id);
        await supabase.from('rooms').update({ status: 'lobby', current_song_index: 0 }).eq('id', room.id);
      }
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

              {isImpostorSong && room.game_mode === 'impostor' && victim && (
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
              {isImpostorSong && room.game_mode === 'word_impostor' && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ marginTop: 12 }}
                >
                  <span className="badge badge-red" style={{ fontSize: 12, padding: '6px 14px' }}>
                    🕵️ SŁOWO IMPOSTOR — nie znał tajnego słowa
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
            const pts = room.game_mode === 'word_impostor' ? null : (pointsThisSong[voter.id] ?? 0);
            const highlights =
              room.game_mode !== 'word_impostor' &&
              (isCorrect ||
                perfectGuess ||
                (guessedImpostor && !guessedVictim) ||
                (pts !== null && pts > 0));

            return (
              <div key={voter.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 14px', borderRadius: 12,
                background: highlights ? 'rgba(34,211,160,0.07)' : 'var(--bg3)',
                border: `1px solid ${highlights ? 'rgba(34,211,160,0.25)' : 'var(--border)'}`,
              }}>
                <div className="avatar" style={{ width: 34, height: 34, fontSize: 13 }}>
                  {voter.name[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{voter.name}</div>
                  {vote ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {room.game_mode !== 'word_impostor' && (
                        <>Wskazał: <strong style={{ color: 'var(--text)' }}>{votedFor?.name ?? '?'}</strong></>
                      )}
                      {vote.is_impostor_guess && (
                        <span style={{ color: '#fb7185', marginLeft: room.game_mode === 'word_impostor' ? 0 : 6 }}>
                          {room.game_mode === 'word_impostor' ? 'Wskazał jako Impostora' : '· jako Impostor'}{room.game_mode === 'impostor' ? ` pod ${players.find(p => p.id === vote.impostor_target_id)?.name ?? '?'}` : ''}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nie zagłosował</div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                  <span style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: pts === null ? 'var(--text-muted)' : pts > 0 ? 'var(--accent2)' : 'var(--text-muted)',
                  }}>
                    {pts === null ? '—' : formatPointsPts(pts)}
                  </span>
                  {room.game_mode !== 'word_impostor' && isCorrect && (!vote?.is_impostor_guess || !guessedImpostor) && (
                    <span className="badge badge-green">✓ Trafił!</span>
                  )}
                  {room.game_mode !== 'word_impostor' && perfectGuess && (
                    <span className="badge badge-red">🎯 Idealny traf!</span>
                  )}
                  {guessedImpostor && !guessedVictim && (
                    <span className="badge badge-orange">🕵️ Wykrył impostora</span>
                  )}
                  {room.game_mode !== 'word_impostor' && !isCorrect && !guessedImpostor && vote && (
                    <span className="badge badge-gray">✗ Pudło</span>
                  )}
                  {room.game_mode === 'word_impostor' && vote?.is_impostor_guess && !guessedImpostor && (
                    <span className="badge badge-gray">✗ Błędny strzał</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {room.game_mode === 'word_impostor' && impostor && (
        <div style={{ marginBottom: 20 }}>
          <WordImpostorDetectiveList
            players={players}
            votes={votes}
            impostor={impostor}
            throughSongIndex={idx}
          />
        </div>
      )}

      {/* Podium — suma punktów od nutki 1 do bieżącej */}
      {showPodium && rankedByPoints.length > 0 && (
        <motion.div
          key={`podium-${idx}`}
          className="card"
          style={{ marginBottom: 20, overflow: 'hidden' }}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut', delay: 0.12 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 }}>
            <Trophy size={20} color="var(--warn)" />
            <span style={{ fontWeight: 900, fontSize: 17 }}>Podium — suma nutek 1–{idx}</span>
          </div>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, marginBottom: 18 }}>
            Ranking zlicza wszystkie nutki pokazane do tego momentu
          </p>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              gap: 10,
              minHeight: 168,
              marginBottom: rankedByPoints.length > 3 ? 16 : 0,
            }}
          >
            {[1, 0, 2].map(slot => {
              const row = rankedByPoints[slot];
              if (!row) return <div key={`empty-${slot}`} style={{ flex: 1, maxWidth: 120 }} />;
              const medals = ['🥇', '🥈', '🥉'] as const;
              const h = slot === 0 ? 132 : slot === 1 ? 104 : 84;
              const grad =
                slot === 0
                  ? 'linear-gradient(180deg, #fbbf24 0%, #b45309 100%)'
                  : slot === 1
                    ? 'linear-gradient(180deg, #94a3b8 0%, #475569 100%)'
                    : 'linear-gradient(180deg, #d97757 0%, #9a3412 100%)';

              return (
                <motion.div
                  key={row.player.id}
                  style={{ flex: 1, maxWidth: 130, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                  initial={{ opacity: 0, y: 28, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.38, delay: 0.06 * (slot === 0 ? 1 : slot === 1 ? 0 : 2) }}
                >
                  <span style={{ fontSize: 26, lineHeight: 1, marginBottom: 6 }}>{medals[slot]}</span>
                  <div style={{
                    fontSize: 13, fontWeight: 800, textAlign: 'center', lineHeight: 1.25,
                    marginBottom: 6, maxWidth: '100%', wordBreak: 'break-word',
                  }}>
                    {row.player.name}
                  </div>
                  <div style={{
                    fontSize: 13, fontWeight: 900, color: row.points > 0 ? 'var(--accent2)' : 'var(--text-muted)',
                    marginBottom: 8,
                  }}>
                    {formatPointsPts(row.points)}
                  </div>
                  <div
                    style={{
                      width: '100%',
                      height: h,
                      borderRadius: '12px 12px 6px 6px',
                      background: grad,
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 12px 28px rgba(0,0,0,0.35)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                      paddingBottom: 8,
                      color: '#fff',
                      fontWeight: 900,
                      fontSize: 15,
                    }}
                  >
                    {slot + 1}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {rankedByPoints.length > 3 && (
            <div style={{
              paddingTop: 12,
              borderTop: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.03em' }}>
                POZOSTALI
              </span>
              {rankedByPoints.slice(3).map((row, i) => (
                <div
                  key={row.player.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', borderRadius: 10, background: 'var(--bg3)',
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', width: 22 }}>{4 + i}</span>
                  <span style={{ flex: 1, fontWeight: 700, fontSize: 13 }}>{row.player.name}</span>
                  <span style={{
                    fontSize: 12, fontWeight: 800,
                    color: row.points > 0 ? 'var(--accent2)' : 'var(--text-muted)',
                  }}>
                    {formatPointsPts(row.points)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Admin navigation */}
      {isAdmin && (
        <button
          className="btn btn-primary btn-lg"
          style={{ width: '100%' }}
          onClick={next}
          disabled={revealing}
        >
          {isLastSong
            ? room.game_mode === 'word_impostor'
              ? <><ChevronRight size={16} /> Finał — wybór słowa</>
              : <><RotateCcw size={16} /> Powrót do lobby</>
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
