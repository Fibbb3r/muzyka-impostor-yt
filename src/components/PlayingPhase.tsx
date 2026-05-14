import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { ChevronRight, Music, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import YTPlayer from './YTPlayer';
import { extractVideoId, useYoutubeTitles } from '../lib/youtube';
import type { Room, Player, Song, Vote, VoteState, SkipVote } from '../types/game';

interface Props {
  room: Room;
  players: Player[];
  currentPlayer: Player;
  isAdmin: boolean;
  songs: Song[];          // already sorted by created_at in Room.tsx
  votes: Vote[];
  skipVotes: SkipVote[];
  myVotes: Record<number, VoteState>;
  onVoteChange: (songIdx: number, field: keyof VoteState, value: string | boolean) => void;
  onVoteSkip: (songIdx: number) => void;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

const DURATION = 30;

export default function PlayingPhase({
  room, players, currentPlayer, isAdmin, songs, skipVotes, myVotes, onVoteChange, onVoteSkip,
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
  /** Jedna straż na nutkę: koniec czasu OR vote-skip — inaczej oba efekty odpalały nextSong() (1→2→3). */
  const advancedFromSongRef = useRef<number | null>(null);
  const isAdvancingRef = useRef(false);
  /**
   * Po zmianie nutki `elapsed` potrafi być jeszcze 30 z poprzedniej — `elapsed >= DURATION` na nowym
   * indeksie odpalał drugi nextSong (2→3). Koniec timera liczymy dopiero po 800 ms (jak start nutki);
   * wczesny skip: tylko przy elapsed < DURATION.
   */
  const playbackReadyForTimerRef = useRef(false);

  // Titles keyed by youtube_url, fetched lazily for all songs via shared hook
  const allUrls = songs.map(s => s.youtube_url);
  const urlTitles = useYoutubeTitles(allUrls);
  // For backward-compat: revealedTitles[songIdx] -> title
  const revealedTitles: Record<number, string> = {};
  for (let i = 0; i < songs.length; i++) {
    const t = urlTitles[songs[i].youtube_url];
    if (t) revealedTitles[i + 1] = t;
  }

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

  // Zeruj czas natychmiast przy zmianie nutki — zanim efekty „auto-next” na elapsed
  // zobaczą złą kombinację (elapsed=30 + nowy currentSongIdx), co mogło pomijać nutkę.
  useLayoutEffect(() => {
    playbackReadyForTimerRef.current = false;
    setElapsed(0);
    setPlaying(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    advancedFromSongRef.current = null;
  }, [currentSongIdx]);

  useEffect(() => {
    const t = setTimeout(() => {
      playbackReadyForTimerRef.current = true;
      startTimer();
    }, 800);
    return () => { clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSongIdx]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  /** Jeden „krok”: tylko jeśli w DB nadal jest `fromIdx`; drugi konkurent dostanie 0 wierszy. */
  async function nextSong() {
    if (isAdvancingRef.current) return;
    isAdvancingRef.current = true;
    const fromIdx = room.current_song_index;
    const songsLen = songs.length;

    function clearSongGuardsIfNeeded() {
      if (advancedFromSongRef.current === fromIdx) advancedFromSongRef.current = null;
    }

    try {
      let row: { id: string } | null = null;
      if (fromIdx + 1 > songsLen) {
        const nextStatus = room.game_mode === 'word_impostor' ? 'word_finale' : 'results';
        const { data, error } = await supabase
          .from('rooms')
          .update({ status: nextStatus, current_song_index: 1, word_finale_step: 0 })
          .eq('id', room.id)
          .eq('current_song_index', fromIdx)
          .select('id')
          .maybeSingle();
        if (error) throw error;
        row = data;
      } else {
        const nextIdx = fromIdx + 1;
        const { data, error } = await supabase
          .from('rooms')
          .update({ current_song_index: nextIdx })
          .eq('id', room.id)
          .eq('current_song_index', fromIdx)
          .select('id')
          .maybeSingle();
        if (error) throw error;
        row = data;
      }
      if (!row) clearSongGuardsIfNeeded();
    } catch {
      clearSongGuardsIfNeeded();
    } finally {
      isAdvancingRef.current = false;
    }
  }

  const progress = songs.length > 0 ? Math.min((elapsed / DURATION) * 100, 100) : 0;
  const isLastSong = currentSongIdx >= songs.length;
  const votesForCurrentSong = new Set(
    skipVotes
      .filter(v => v.song_index === currentSongIdx)
      .map(v => v.voter_id)
  ).size;
  const skipThreshold = Math.max(1, Math.ceil(players.length * 0.5));
  const hasVotedSkip = skipVotes.some(
    v => v.song_index === currentSongIdx && v.voter_id === currentPlayer.id
  );

  // Tylko admin. Jeden efekt + jedna straż na nutkę.
  // - Wczesny skip: próg głosów i elapsed < 30 (nie mylić z „końcem” poprzedniej nutki).
  // - Koniec nutki po timerze: elapsed >= 30 dopiero gdy playbackReadyForTimerRef (po 800 ms od wejścia na nutkę).
  // Dowolny klient może wywołać nextSong — aktualizacja w DB jest atomowa (eq. current_song_index).
  // Dzięki temu vote-skip i koniec timera działają nawet gdy karta admina jest nieaktywna / w tle.
  useEffect(() => {
    if (songs.length === 0 || room.status !== 'playing') return;
    if (advancedFromSongRef.current === currentSongIdx) return;
    if (isLastSong) return; // na ostatniej nutce tylko admin klika "Pokaż wyniki"

    const skipWins = votesForCurrentSong >= skipThreshold;
    const earlySkip = skipWins && elapsed < DURATION;
    const timerEnd = elapsed >= DURATION && playbackReadyForTimerRef.current;
    if (!earlySkip && !timerEnd) return;

    advancedFromSongRef.current = currentSongIdx;
    void nextSong();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    elapsed,
    room.status,
    currentSongIdx,
    songs.length,
    votesForCurrentSong,
    skipThreshold,
  ]);

  return (
    <div style={{ width: '100%', maxWidth: 1300, margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '7fr 2fr', gap: 24, alignItems: 'start' }}>

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

          {!isLastSong && (
            <div className="card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>Vote skip</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {votesForCurrentSong}/{skipThreshold} głosów
                  </span>
                </div>
                <button
                  className="btn btn-ghost"
                  onClick={() => onVoteSkip(currentSongIdx)}
                  disabled={songs.length === 0 || hasVotedSkip}
                >
                  {hasVotedSkip ? 'Głos oddany' : 'Pomiń nutkę'}
                </button>
              </div>
            </div>
          )}

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
          {!isAdmin && isLastSong && elapsed >= DURATION && (
            <div style={{
              textAlign: 'center',
              padding: '12px 16px',
              background: 'var(--bg3)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              fontSize: 13,
            }}>
              ⏳ Czekaj — admin pokaże wyniki…
            </div>
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
            const isWordImpostorMode = room.game_mode === 'word_impostor';
            const showImpostorCheckbox = isImpostorMode || isWordImpostorMode;
            const amImpostor = currentPlayer.is_impostor;
            const impostorAlreadyGuessed = showImpostorCheckbox && Object.entries(myVotes).some(
              ([k, v]) => parseInt(k) !== idx && v.is_impostor_guess
            );

            return (
              <motion.div
                key={idx}
                className="card"
                style={{
                  border: `1px solid ${idx === currentSongIdx ? 'var(--accent)' : 'var(--border)'}`,
                  background: idx === currentSongIdx ? 'var(--bg3)' : 'var(--bg2)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                {/* Song number badge */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 'var(--radius)',
                    background: idx === currentSongIdx
                      ? 'var(--accent)'
                      : 'var(--bg3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 800, color: idx === currentSongIdx ? '#fff' : 'var(--text-muted)',
                    border: idx !== currentSongIdx ? '1px solid var(--border)' : 'none',
                    flexShrink: 0,
                  }}>
                    {idx}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>
                      Nutka {idx}
                      {idx === currentSongIdx && (
                        <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>
                          ▶ TERAZ GRA
                        </span>
                      )}
                    </span>
                    {revealedTitles[idx] && (
                      <span style={{
                        fontSize: 12,
                        color: 'var(--text-muted)',
                        fontWeight: 500,
                        lineHeight: 1.4,
                      }}>
                        🎵 {revealedTitles[idx]}
                      </span>
                    )}
                  </div>
                </div>

                {/* Who added it */}
                {isWordImpostorMode ? (
                  <div style={{ marginBottom: 4 }}>
                    <label className="label" style={{ marginBottom: 4 }}>Dodał/a:</label>
                    <div style={{
                      padding: '9px 12px', background: 'var(--bg3)', borderRadius: 10,
                      border: '1px solid var(--border)', fontSize: 13, fontWeight: 700
                    }}>
                      {players.find(p => p.id === songs[i].player_id)?.name ?? 'Nieznany'}
                    </div>
                  </div>
                ) : (
                  <>
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
                  </>
                )}

                {/* Impostor guess */}
                {showImpostorCheckbox && !amImpostor && (isWordImpostorMode || vote.voted_for_id) && !impostorAlreadyGuessed && (
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

                    {vote.is_impostor_guess && isImpostorMode && (
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

                {showImpostorCheckbox && !amImpostor && impostorAlreadyGuessed && !vote.is_impostor_guess && (
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
