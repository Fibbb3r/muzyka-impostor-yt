import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Play, Shield, Trash2, Crown, Music2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Room, Player, GameMode } from '../types/game';
import words from '../data/words.json';

interface Props {
  room: Room;
  players: Player[];
  currentPlayer: Player;
  isAdmin: boolean;
  onKick: (p: Player) => void;
}

export default function LobbyPhase({ room, players, currentPlayer, isAdmin, onKick }: Props) {
  const [starting, setStarting] = useState(false);
  const [mode, setMode] = useState<GameMode>('normal');
  const maxImpostors = players.length >= 2 ? players.length - 1 : 1;
  const [impostorCount, setImpostorCount] = useState(1);

  useEffect(() => {
    setImpostorCount(c => Math.min(Math.max(1, c), maxImpostors));
  }, [maxImpostors]);

  async function startGame() {
    if (players.length < 2) return;
    setStarting(true);

    // Reset: usuń stare nutki, głosy i głosy skip (żeby nie mieszały się między rundami)
    await supabase.from('votes').delete().eq('room_id', room.id);
    await supabase.from('songs').delete().eq('room_id', room.id);
    await supabase.from('song_skip_votes').delete().eq('room_id', room.id);

    // Resetuj graczy (impostor)
    await supabase.from('players').update({ is_impostor: false, impersonates_id: null }).eq('room_id', room.id);

    if (mode === 'impostor' && players.length >= 2) {
      const k = Math.min(Math.max(1, impostorCount), players.length - 1);
      const shuffled = [...players].sort(() => Math.random() - 0.5);
      const impostors = shuffled.slice(0, k);
      const impostorIds = new Set(impostors.map(p => p.id));

      for (const imp of impostors) {
        const victims = players.filter(p => !impostorIds.has(p.id));
        const victim = victims[Math.floor(Math.random() * victims.length)];
        await supabase.from('players')
          .update({ is_impostor: true, impersonates_id: victim.id })
          .eq('id', imp.id);
      }
    } else if (mode === 'word_impostor' && players.length >= 2) {
      const k = Math.min(Math.max(1, impostorCount), players.length - 1);
      const shuffled = [...players].sort(() => Math.random() - 0.5);
      const impostors = shuffled.slice(0, k);

      for (const imp of impostors) {
        await supabase.from('players')
          .update({ is_impostor: true, impersonates_id: null })
          .eq('id', imp.id);
      }
    }

    const currentWord = mode === 'word_impostor' ? words[Math.floor(Math.random() * words.length)] : null;

    await supabase.from('rooms')
      .update({
        status: 'picking',
        game_mode: mode,
        current_song_index: 0,
        current_word: currentWord,
        impostor_word_guess: null,
        impostor_word_guesses: {},
        word_finale_step: 0,
      })
      .eq('id', room.id);

    setStarting(false);
  }

  return (
    <div style={{ width: '100%', maxWidth: 520, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{
          width: 56, height: 56,
          background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
          borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 14px',
          boxShadow: '0 6px 24px rgba(124,108,252,0.4)',
        }}>
          <Music2 size={26} color="#fff" />
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800 }} className="grad-text">Muzyka Impostor</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Lobby · Oczekiwanie na start</p>
      </div>

      {/* Player list */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Users size={16} color="var(--accent)" />
          <span style={{ fontWeight: 700, fontSize: 15 }}>Gracze ({players.length})</span>
        </div>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <AnimatePresence>
            {players.map(p => (
              <motion.li
                key={p.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10,
                  background: p.id === currentPlayer.id ? 'rgba(124,108,252,0.1)' : 'var(--bg3)',
                  border: `1px solid ${p.id === currentPlayer.id ? 'rgba(124,108,252,0.3)' : 'var(--border)'}`,
                }}
              >
                <div className="avatar" style={{ width: 32, height: 32, fontSize: 13 }}>
                  {p.name[0].toUpperCase()}
                </div>
                <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{p.name}</span>
                {p.is_admin && (
                  <span className="badge badge-purple">
                    <Crown size={10} /> Admin
                  </span>
                )}
                {p.id === currentPlayer.id && (
                  <span className="badge badge-gray">Ty</span>
                )}
                {isAdmin && p.id !== currentPlayer.id && (
                  <button
                    className="btn btn-sm btn-ghost"
                    style={{ color: 'var(--danger)', borderColor: 'transparent', padding: '4px 6px' }}
                    onClick={() => onKick(p)}
                    title="Wyrzuć gracza"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        {players.length < 2 && (
          <p style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', marginTop: 14 }}>
            Potrzeba minimum 2 graczy
          </p>
        )}
      </div>

      {/* Admin panel */}
      {isAdmin && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <Shield size={16} color="var(--accent2)" />
            <span style={{ fontWeight: 700, fontSize: 15 }}>Panel Admina</span>
          </div>

          <p className="label" style={{ marginBottom: 10 }}>Tryb gry</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
            {(['normal', 'impostor', 'word_impostor'] as GameMode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  padding: '14px 10px',
                  borderRadius: 12,
                  border: `2px solid ${mode === m ? 'var(--accent)' : 'var(--border)'}`,
                  background: mode === m ? 'rgba(124,108,252,0.15)' : 'var(--bg3)',
                  color: mode === m ? 'var(--text)' : 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  textAlign: 'center',
                }}
              >
                {m === 'normal' ? '🎵 Klasyk' : m === 'impostor' ? '🕵️ Impostor' : '🗣️ Słowo Impostor'}
                <div style={{ fontSize: 11, fontWeight: 400, marginTop: 4, opacity: 0.7 }}>
                  {m === 'normal' ? 'Zgaduj kto wybrał' : m === 'impostor' ? 'Gracze podszywają się pod innych' : 'Impostorzy nie znają słowa'}
                </div>
              </button>
            ))}
          </div>

          {(mode === 'impostor' || mode === 'word_impostor') && players.length >= 2 && (
            <>
              <p className="label" style={{ marginBottom: 10 }}>Liczba impostorów</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <input
                  type="range"
                  min={1}
                  max={maxImpostors}
                  value={Math.min(impostorCount, maxImpostors)}
                  onChange={e => setImpostorCount(parseInt(e.target.value, 10))}
                  style={{ flex: 1, accentColor: 'var(--accent)' }}
                />
                <span style={{
                  minWidth: 36,
                  textAlign: 'center',
                  fontWeight: 800,
                  fontSize: 16,
                  color: 'var(--accent)',
                }}>
                  {Math.min(impostorCount, maxImpostors)}
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -12, marginBottom: 20 }}>
                Max {maxImpostors} — zostaje co najmniej jeden nie-impostor.
              </p>
            </>
          )}

          <button
            className="btn btn-primary btn-lg"
            style={{ width: '100%' }}
            disabled={players.length < 2 || starting}
            onClick={startGame}
          >
            <Play size={18} />
            {starting ? 'Startujemy…' : 'Rozpocznij grę'}
          </button>
        </div>
      )}

      {!isAdmin && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
          ⏳ Czekaj aż admin rozpocznie grę…
        </div>
      )}
    </div>
  );
}
