import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Link2, Clock, Check, Loader2, ChevronRight, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Room, Player, Song } from '../types/game';

interface Props {
  room: Room;
  players: Player[];
  currentPlayer: Player;
  isAdmin: boolean;
  songs: Song[];
}

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('?')[0];
    return u.searchParams.get('v');
  } catch {
    return null;
  }
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function PickingPhase({ room, players, currentPlayer, isAdmin, songs }: Props) {
  const [url, setUrl] = useState('');
  const [startMin, setStartMin] = useState('0');
  const [startSec, setStartSec] = useState('0');
  const [saving, setSaving] = useState(false);
  const [urlError, setUrlError] = useState('');
  const [showNames, setShowNames] = useState(false);

  const myRole = currentPlayer.is_impostor
    ? (() => {
        if (room.game_mode === 'word_impostor') {
          return { impostor: true, victimName: null, wordImpostor: true };
        }
        const victim = players.find(p => p.id === currentPlayer.impersonates_id);
        return { impostor: true, victimName: victim?.name ?? '???', wordImpostor: false };
      })()
    : { impostor: false, victimName: '', wordImpostor: false };

  const myDisplayName = (currentPlayer.is_impostor && room.game_mode !== 'word_impostor')
    ? (players.find(p => p.id === currentPlayer.impersonates_id)?.name ?? currentPlayer.name)
    : currentPlayer.name;

  const mySong = songs.find(s => s.player_id === currentPlayer.id);
  const allSubmitted = players.every(p => songs.some(s => s.player_id === p.id && s.submitted));

  const handleSave = useCallback(async () => {
    const videoId = extractVideoId(url.trim());
    if (!videoId) { setUrlError('Nieprawidłowy link YouTube!'); return; }
    const mins = parseInt(startMin) || 0;
    const secs = parseInt(startSec) || 0;
    const startSeconds = mins * 60 + secs;

    setSaving(true);
    setUrlError('');

    // Upsert — jeden gracz, jedna piosenka
    const { error } = await supabase.from('songs').upsert({
      room_id: room.id,
      player_id: currentPlayer.id,
      youtube_url: url.trim(),
      start_seconds: startSeconds,
      submitted: true,
    }, { onConflict: 'room_id,player_id' });

    if (error) { setUrlError(error.message); }
    setSaving(false);
  }, [url, startMin, startSec, room.id, currentPlayer.id]);

  async function goToPlaying() {
    // Shuffle order: assign random song_order to each song
    const shuffled = [...songs].sort(() => Math.random() - 0.5);
    await Promise.all(
      shuffled.map((s, i) =>
        supabase.from('songs').update({ song_order: i + 1 }).eq('id', s.id)
      )
    );

    // Reset vote-skip votes from previous rounds so the new game starts cleanly.
    await supabase.from('song_skip_votes').delete().eq('room_id', room.id);

    await supabase.from('rooms')
      .update({ status: 'playing', current_song_index: 1 })
      .eq('id', room.id);
  }

  const videoId = extractVideoId(url);
  const startSeconds = (parseInt(startMin) || 0) * 60 + (parseInt(startSec) || 0);

  return (
    <div style={{ width: '100%', maxWidth: 600, margin: '0 auto' }}>
      {/* Role banner */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          marginBottom: 20,
          padding: '16px 20px',
          borderRadius: 14,
          background: myRole.impostor
            ? 'linear-gradient(135deg, rgba(244,63,94,0.15), rgba(251,146,60,0.1))'
            : 'rgba(124,108,252,0.1)',
          border: `1px solid ${myRole.impostor ? 'rgba(244,63,94,0.35)' : 'rgba(124,108,252,0.3)'}`,
          textAlign: 'center',
        }}
      >
        {myRole.impostor ? (
          <>
            <div style={{ fontSize: 22, marginBottom: 6 }}>🕵️</div>
            <p style={{ fontWeight: 800, fontSize: 16, color: '#fb7185' }}>Jesteś Impostorem!</p>
            {myRole.wordImpostor ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                Nie znasz słowa, o którym myślą inni. Spróbuj dodać uniwersalną nutkę i wtopić się w tłum!
              </p>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                Podszyj się pod <strong style={{ color: 'var(--text)' }}>{myRole.victimName}</strong> — wybierz nutkę jako gdybyś był tą osobą
              </p>
            )}
          </>
        ) : (
          <>
            <p style={{ fontWeight: 700, fontSize: 15 }}>
              Wybierasz jako <span className="grad-text">{myDisplayName}</span>
            </p>
            {room.game_mode === 'word_impostor' && room.current_word ? (
              <div style={{ marginTop: 8, padding: '8px', background: 'var(--bg3)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Słowo na tę rundę:</p>
                <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>{room.current_word}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Wybierz nutkę, która pasuje do tego słowa!</p>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
                Wklej link do YouTube i wybierz 30-sekundowy fragment
              </p>
            )}
          </>
        )}
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Left: form */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <p className="section-title"><Link2 size={12} style={{ display: 'inline' }} /> Link do YouTube</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              className="input"
              placeholder="https://youtube.com/watch?v=…"
              value={url}
              onChange={e => { setUrl(e.target.value); setUrlError(''); }}
            />
          </div>

          <p className="section-title"><Clock size={12} style={{ display: 'inline' }} /> Start fragmentu</p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <label className="label">Minuty</label>
              <input
                className="input"
                type="number"
                min="0"
                max="59"
                value={startMin}
                onChange={e => setStartMin(e.target.value)}
                style={{ textAlign: 'center' }}
              />
            </div>
            <span style={{ paddingTop: 20, fontWeight: 700, fontSize: 20, color: 'var(--text-muted)' }}>:</span>
            <div style={{ flex: 1 }}>
              <label className="label">Sekundy</label>
              <input
                className="input"
                type="number"
                min="0"
                max="59"
                value={startSec}
                onChange={e => setStartSec(e.target.value)}
                style={{ textAlign: 'center' }}
              />
            </div>
            <div style={{ flex: 1.5, paddingTop: 20 }}>
              <div style={{
                background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '12px 14px', textAlign: 'center',
                color: 'var(--text-muted)', fontSize: 13,
              }}>
                {formatTime(startSeconds)} → {formatTime(startSeconds + 30)}
                <div style={{ fontSize: 11, marginTop: 2, opacity: 0.7 }}>30 sekund</div>
              </div>
            </div>
          </div>

          {urlError && (
            <p style={{ color: 'var(--danger)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
              <AlertCircle size={12} />{urlError}
            </p>
          )}

          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={!url.trim() || saving}
            onClick={handleSave}
          >
            {saving
              ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Zapisuję…</>
              : mySong
              ? <><Check size={15} /> Zaktualizuj wybór</>
              : <><Check size={15} /> Zatwierdź nutkę</>
            }
          </button>

          {/* Preview thumbnail */}
          {videoId && (
            <div style={{ marginTop: 14 }}>
              <img
                src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                alt="Podgląd"
                style={{ width: '100%', borderRadius: 10, border: '1px solid var(--border)' }}
              />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 6 }}>
                Podgląd miniatury · Fragment: {formatTime(startSeconds)}–{formatTime(startSeconds + 30)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Status — anonymous checkmarks */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <p className="section-title" style={{ margin: 0 }}>Status graczy</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {songs.filter(s => s.submitted).length} / {players.length} gotowych
            </span>
            {isAdmin && (
              <button
                onClick={() => setShowNames(v => !v)}
                title={showNames ? 'Ukryj imiona' : 'Pokaż kto wybrał'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 8, cursor: 'pointer',
                  fontSize: 11, fontWeight: 600,
                  background: showNames ? 'rgba(124,108,252,0.15)' : 'var(--bg3)',
                  border: `1px solid ${showNames ? 'rgba(124,108,252,0.4)' : 'var(--border)'}`,
                  color: showNames ? 'var(--accent)' : 'var(--text-muted)',
                  transition: 'all 0.2s',
                }}
              >
                {showNames ? <EyeOff size={12} /> : <Eye size={12} />}
                {showNames ? 'Ukryj' : 'Pokaż'}
              </button>
            )}
          </div>
        </div>

        {/* Checkmarks row — always visible */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[...players].sort((a, b) => {
              const aReady = songs.some(s => s.player_id === a.id && s.submitted) ? 0 : 1;
              const bReady = songs.some(s => s.player_id === b.id && s.submitted) ? 0 : 1;
              return aReady - bReady;
            }).map((p, i) => {
            const hasSong = songs.some(s => s.player_id === p.id && s.submitted);
            return (
              <motion.div
                key={p.id}
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                title={hasSong ? 'Gotowy' : 'Wybiera…'}
                style={{
                  width: 38, height: 38,
                  borderRadius: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: hasSong ? 'rgba(34,197,94,0.15)' : 'var(--bg3)',
                  border: `2px solid ${hasSong ? 'rgba(34,197,94,0.5)' : 'var(--border)'}`,
                  transition: 'all 0.3s ease',
                }}
              >
                {hasSong
                  ? <Check size={18} color="#22c55e" strokeWidth={2.5} />
                  : <div style={{ width: 18, height: 18, borderRadius: 4, background: 'var(--border)' }} />
                }
              </motion.div>
            );
          })}
        </div>

        {/* Admin-only names list */}
        {isAdmin && showNames && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden' }}
          >
            <div style={{ height: 1, background: 'var(--border)', marginBottom: 4 }} />
            {players.map(p => {
              const hasSong = songs.some(s => s.player_id === p.id && s.submitted);
              return (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 10px', borderRadius: 8,
                  background: hasSong ? 'rgba(34,197,94,0.07)' : 'var(--bg3)',
                  border: `1px solid ${hasSong ? 'rgba(34,197,94,0.25)' : 'var(--border)'}`,
                }}>
                  <div className="avatar" style={{ width: 26, height: 26, fontSize: 11 }}>
                    {p.name[0].toUpperCase()}
                  </div>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{p.name}</span>
                  {hasSong
                    ? <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><Check size={11} /> Gotowy</span>
                    : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Wybiera…</span>
                  }
                </div>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* Admin next step */}
      {isAdmin && (
        <button
          className="btn btn-primary btn-lg"
          style={{ width: '100%' }}
          disabled={!allSubmitted}
          onClick={goToPlaying}
        >
          <ChevronRight size={18} />
          {allSubmitted ? 'Wszyscy gotowi — Kolejny etap!' : 'Czekaj aż wszyscy wybiorą…'}
        </button>
      )}
      {!isAdmin && allSubmitted && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
          ✅ Wszyscy gotowi! Czekaj na admina…
        </div>
      )}
      <style>{`@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>
    </div>
  );
}
