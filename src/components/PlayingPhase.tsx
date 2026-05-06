import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { ChevronRight, Music, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import YTPlayer from './YTPlayer';
import type { Room, Player, Song, Vote, VoteState } from '../types/game';

interface Props {
  room: Room;
  players: Player[];
  currentPlayer: Player;
  isAdmin: boolean;
  songs: Song[];          // already sorted by created_at in Room.tsx
  votes: Vote[];
  myVotes: Record<number, VoteState>;
  onVoteChange: (songIdx: number, field: keyof VoteState, value: string | boolean) => void;
}

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('?')[0];
    return u.searchParams.get('v');
  } catch { return null; }
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

const DURATION = 30;

export default function PlayingPhase({
  room, players, currentPlayer, isAdmin, songs, myVotes, onVoteChange,
}: Props) {
  const currentSongIdx = room.current_song_index; // 1-based
  const currentSong = songs[currentSongIdx - 1] ?? null;
  const videoId = currentSong ? extractVideoId(currentSong.youtube_url) : null;

  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [volume, setVolume] = useState<number>(() => {
    const saved = localStorage.getItem('yt-volume');
    return saved !== null ? parseInt(saved) : 80;
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    setElapsed(0);
    setPlaying(true);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setElapsed(e => {
        if (e >= DURATION) {
          clearInterval(intervalRef.current!);
          setPlaying(false);
          return DURATION;
        }
        return e + 1;
      });
    }, 1000);
  }, []);

  // Auto-start when song changes
  useEffect(() => {
    setElapsed(0);
    setPlaying(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    const t = setTimeout(startTimer, 800);
    return () => { clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSongIdx]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  async function nextSong() {
    const next = currentSongIdx + 1;
    if (next > songs.length) {
      await supabase.from('rooms')
        .update({ status: 'results', current_song_index: 1 })
        .eq('id', room.id);
    } else {
      await supabase.from('rooms')
        .update({ current_song_index: next })
        .eq('id', room.id);
    }
  }

  const progress = songs.length > 0 ? Math.min((elapsed / DURATION) * 100, 100) : 0;
  const isLastSong = currentSongIdx >= songs.length;

  return (
    <div style={{ width: '100%', maxWidth: 980, margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

        {/* LEFT — Player */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Music size={18} color="var(--accent)" />
              <span style={{ fontWeight: 800, fontSize: 16 }}>
                Nutka {currentSongIdx} / {songs.length}
              </span>
              {currentSong && (
                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 12 }}>
                  {formatTime(currentSong.start_seconds)} → {formatTime(currentSong.start_seconds + 30)}
                </span>
              )}
            </div>

            {videoId && currentSong ? (
              <YTPlayer
                key={`${videoId}-${currentSong.start_seconds}`}
                videoId={videoId}
                startSeconds={currentSong.start_seconds}
                playing={playing}
                volume={volume}
              />
            ) : (
              <div style={{
                height: 160, display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: 'var(--text-muted)',
                background: 'var(--bg3)', borderRadius: 12,
              }}>
                {songs.length === 0 ? 'Ładowanie nutek…' : 'Nieprawidłowy link YouTube'}
              </div>
            )}

            {/* Progress bar */}
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                <span>{elapsed}s</span>
                <span>{DURATION}s</span>
              </div>
              <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 99, overflow: 'hidden' }}>
                <motion.div
                  style={{
                    height: '100%',
                    background: 'linear-gradient(90deg, var(--accent), var(--accent2))',
                    borderRadius: 99,
                  }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>

            {/* Volume slider */}
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>{volume === 0 ? '🔇' : volume < 40 ? '🔈' : volume < 75 ? '🔉' : '🔊'}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={volume}
                onChange={e => {
                  const v = parseInt(e.target.value);
                  setVolume(v);
                  localStorage.setItem('yt-volume', String(v));
                }}
                style={{
                  flex: 1,
                  accentColor: 'var(--accent)',
                  cursor: 'pointer',
                  height: 4,
                }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 28, textAlign: 'right' }}>
                {volume}%
              </span>
            </div>
          </div>

          {/* Admin controls */}
          {isAdmin && (
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={nextSong}
              disabled={songs.length === 0}
            >
              <ChevronRight size={16} />
              {isLastSong
                ? 'Pokaż wyniki'
                : `Kolejna nutka (${currentSongIdx + 1}/${songs.length})`}
            </button>
          )}
        </div>

        {/* RIGHT — Voting panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Trophy size={16} color="var(--accent2)" />
            <span style={{ fontWeight: 800, fontSize: 15 }}>Głosowanie</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>· zmień kiedy chcesz</span>
          </div>

          {songs.map((_, i) => {
            const idx = i + 1;
            const vote = myVotes[idx] ?? { voted_for_id: '', is_impostor_guess: false, impostor_target_id: '' };
            const isImpostorMode = room.game_mode === 'impostor';
            const amImpostor = currentPlayer.is_impostor;
            const impostorAlreadyGuessed = isImpostorMode && Object.entries(myVotes).some(
              ([k, v]) => parseInt(k) !== idx && v.is_impostor_guess
            );

            return (
              <motion.div
                key={idx}
                className="card"
                style={{
                  border: `1px solid ${idx === currentSongIdx ? 'rgba(124,108,252,0.4)' : 'var(--border)'}`,
                  background: idx === currentSongIdx ? 'rgba(124,108,252,0.06)' : 'var(--bg2)',
                  padding: '16px',
                }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                {/* Song number badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 8,
                    background: idx === currentSongIdx
                      ? 'linear-gradient(135deg, var(--accent), var(--accent2))'
                      : 'var(--bg3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 800, color: idx === currentSongIdx ? '#fff' : 'var(--text-muted)',
                    border: idx !== currentSongIdx ? '1px solid var(--border)' : 'none',
                  }}>
                    {idx}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>
                    Nutka {idx}
                    {idx === currentSongIdx && (
                      <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>
                        ▶ TERAZ GRA
                      </span>
                    )}
                  </span>
                </div>

                {/* Who added it */}
                <label className="label" style={{ marginBottom: 4 }}>Kto dodał?</label>
                <select
                  className="input"
                  style={{ fontSize: 13, padding: '9px 12px' }}
                  value={vote.voted_for_id}
                  onChange={e => onVoteChange(idx, 'voted_for_id', e.target.value)}
                >
                  <option value="">— wybierz gracza —</option>
                  {players.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>

                {/* Impostor guess */}
                {isImpostorMode && !amImpostor && vote.voted_for_id && !impostorAlreadyGuessed && (
                  <div style={{ marginTop: 10 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 8 }}>
                      <input
                        type="checkbox"
                        checked={vote.is_impostor_guess}
                        onChange={e => onVoteChange(idx, 'is_impostor_guess', e.target.checked)}
                        style={{ accentColor: 'var(--danger)', width: 15, height: 15 }}
                      />
                      <span style={{ fontSize: 12, color: '#fb7185', fontWeight: 600 }}>🕵️ To Impostor!</span>
                    </label>

                    {vote.is_impostor_guess && (
                      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
                        <label className="label" style={{ marginBottom: 4, color: '#fb7185' }}>Pod kogo się podszywa?</label>
                        <select
                          className="input"
                          style={{ fontSize: 13, padding: '9px 12px' }}
                          value={vote.impostor_target_id}
                          onChange={e => onVoteChange(idx, 'impostor_target_id', e.target.value)}
                        >
                          <option value="">— wybierz ofiarę —</option>
                          {players.filter(p => p.id !== vote.voted_for_id).map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </motion.div>
                    )}
                  </div>
                )}

                {isImpostorMode && !amImpostor && impostorAlreadyGuessed && !vote.is_impostor_guess && (
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                    Już wskazałeś impostora w innej nutce
                  </p>
                )}
              </motion.div>
            );
          })}

          <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
            Głosy zapisują się automatycznie
          </p>
        </div>
      </div>
    </div>
  );
}
