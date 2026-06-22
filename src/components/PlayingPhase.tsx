import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { ChevronRight, Music, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import YTPlayer from './YTPlayer';
import PlayerSelect from './PlayerSelect';
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
          intervalRef.current = null;
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

  const volumeBeforeMuteRef = useRef(
    Math.max(1, parseInt(localStorage.getItem('yt-volume') || '80', 10) || 80),
  );

  function handleVolumeChange(v: number) {
    setVolume(v);
    localStorage.setItem('yt-volume', String(v));
    if (v > 0) volumeBeforeMuteRef.current = v;
  }

  function toggleMute() {
    if (volume === 0) {
      handleVolumeChange(volumeBeforeMuteRef.current || 80);
    } else {
      volumeBeforeMuteRef.current = volume;
      handleVolumeChange(0);
    }
  }

  return (
    <div className="playing-col" style={{ maxWidth: 1300, width: '100%', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <span className="ui-tag">[ NUTKA {currentSongIdx} / {songs.length} ]</span>
      </div>

      <div className="playing-grid">
        {/* LEFT — Player */}
        <div className="playing-col">
          <div className="card card-accent">
            <div className="playing-card-header">
              <Music size={18} color="var(--accent)" />
              <span className="playing-card-header__title">
                Odtwarzanie
              </span>
              {currentSong && (
                <span className="playing-card-header__time">
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
                onVolumeChange={handleVolumeChange}
                onMuteToggle={toggleMute}
              />
            ) : (
              <div className="yt-wrap__placeholder">
                {songs.length === 0 ? 'Ładowanie nutek…' : 'Nieprawidłowy link YouTube'}
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              <div className="progress-meta">
                <span>{elapsed}s</span>
                <span>{DURATION}s</span>
              </div>
              <div className="progress-track">
                <motion.div
                  className="progress-fill"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          </div>

          {!isLastSong && (
            <div className="card card-sm">
              <div className="vote-skip-row">
                <div>
                  <div className="vote-skip-row__label">Vote skip</div>
                  <div className="vote-skip-row__meta">
                    {votesForCurrentSong}/{skipThreshold} głosów
                  </div>
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
              className="btn btn-primary btn-lg btn-block"
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
            <div className="wait-banner">
              ⏳ Czekaj — admin pokaże wyniki…
            </div>
          )}
        </div>

        {/* RIGHT — Voting panel */}
        <div className="playing-col playing-col--vote">
          <div className="card card-accent vote-panel">
            <div className="playing-card-header">
              <Trophy size={18} color="var(--accent)" />
              <span className="playing-card-header__title">Głosowanie</span>
            </div>

            <div className="vote-panel__list">
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
            const isActive = idx === currentSongIdx;

            return (
              <motion.div
                key={idx}
                className={`vote-item${isActive ? ' vote-item--active' : ''}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <div className="vote-card__top">
                  <div className={`vote-card__num${isActive ? ' vote-card__num--active' : ''}`}>
                    {idx}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                    <span className="vote-card__title">
                      Nutka {idx}
                      {isActive && (
                        <span className="vote-card__now">▶ TERAZ</span>
                      )}
                    </span>
                    {revealedTitles[idx] && (
                      <span className="vote-card__song-title">
                        {revealedTitles[idx]}
                      </span>
                    )}
                  </div>
                </div>

                {!isWordImpostorMode && (
                  <>
                    <label className="label">Kto dodał?</label>
                    <PlayerSelect
                      value={vote.voted_for_id}
                      onChange={v => onVoteChange(idx, 'voted_for_id', v)}
                      options={players.map(p => ({ value: p.id, label: p.name }))}
                    />
                  </>
                )}

                {showImpostorCheckbox && !amImpostor && (isWordImpostorMode || vote.voted_for_id) && !impostorAlreadyGuessed && (
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 8 }}>
                      <input
                        type="checkbox"
                        checked={vote.is_impostor_guess}
                        onChange={e => onVoteChange(idx, 'is_impostor_guess', e.target.checked)}
                        style={{ accentColor: 'var(--danger)', width: 15, height: 15 }}
                      />
                      <span style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 600 }}>To Impostor!</span>
                    </label>

                    {vote.is_impostor_guess && isImpostorMode && (
                      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
                        <label className="label" style={{ color: 'var(--danger)' }}>Pod kogo się podszywa?</label>
                        <PlayerSelect
                          value={vote.impostor_target_id}
                          onChange={v => onVoteChange(idx, 'impostor_target_id', v)}
                          placeholder="— wybierz ofiarę —"
                          options={players
                            .filter(p => p.id !== vote.voted_for_id)
                            .map(p => ({ value: p.id, label: p.name }))}
                        />
                      </motion.div>
                    )}
                  </div>
                )}

                {showImpostorCheckbox && !amImpostor && impostorAlreadyGuessed && !vote.is_impostor_guess && (
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Już wskazałeś impostora w innej nutce
                  </p>
                )}
              </motion.div>
            );
          })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
