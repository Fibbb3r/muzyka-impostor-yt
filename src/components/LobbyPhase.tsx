import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Play, Shield, Trash2, Crown } from 'lucide-react';
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
  const [szpontCount, setSzpontCount] = useState(0);

  const kWordImpostor =
    players.length >= 2 ? Math.min(Math.max(1, impostorCount), players.length - 1) : 1;
  const maxSzponts =
    mode === 'word_impostor' && players.length >= 2 ? Math.max(0, players.length - kWordImpostor - 1) : 0;

  useEffect(() => {
    setImpostorCount(c => Math.min(Math.max(1, c), maxImpostors));
  }, [maxImpostors]);

  useEffect(() => {
    if (mode !== 'word_impostor') return;
    setSzpontCount(c => Math.min(Math.max(0, c), maxSzponts));
  }, [maxSzponts, mode]);

  async function startGame() {
    if (players.length < 2) return;
    setStarting(true);

    await supabase.from('votes').delete().eq('room_id', room.id);
    await supabase.from('songs').delete().eq('room_id', room.id);
    await supabase.from('song_skip_votes').delete().eq('room_id', room.id);

    await supabase
      .from('players')
      .update({ is_impostor: false, impersonates_id: null, is_szpont: false })
      .eq('room_id', room.id);

    let currentWord: string | null = null;
    let szpontWord: string | null = null;

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
      const impostorIds = new Set(impostors.map(p => p.id));

      for (const imp of impostors) {
        await supabase.from('players')
          .update({ is_impostor: true, impersonates_id: null })
          .eq('id', imp.id);
      }

      const pool = players.filter(p => !impostorIds.has(p.id));
      const maxS = Math.max(0, pool.length - 1);
      const s = Math.min(szpontCount, maxS);
      const poolShuffled = [...pool].sort(() => Math.random() - 0.5);
      for (const sp of poolShuffled.slice(0, s)) {
        await supabase.from('players').update({ is_szpont: true }).eq('id', sp.id);
      }

      currentWord = words[Math.floor(Math.random() * words.length)] ?? null;
      if (s > 0 && currentWord) {
        const alt = words.filter(w => w !== currentWord);
        const pickFrom = alt.length > 0 ? alt : words;
        szpontWord = pickFrom[Math.floor(Math.random() * pickFrom.length)] ?? null;
      }
    }

    if (mode === 'word_impostor' && !currentWord) {
      currentWord = words[Math.floor(Math.random() * words.length)] ?? null;
    }

    await supabase.from('rooms')
      .update({
        status: 'picking',
        game_mode: mode,
        current_song_index: 0,
        current_word: mode === 'word_impostor' ? currentWord : null,
        szpont_word: mode === 'word_impostor' ? szpontWord : null,
        impostor_word_guess: null,
        impostor_word_guesses: {},
        word_finale_step: 0,
      })
      .eq('id', room.id);

    setStarting(false);
  }

  return (
    <div style={{ width: '100%', maxWidth: 520, margin: '0 auto' }}>
      <div className="screen-header screen-header--compact">
        <h1 className="screen-header__title--sm">Music Impostor</h1>
        <p className="screen-header__tag">
          <span className="ui-tag">[ LOBBY GLOBALNE ]</span>
        </p>
      </div>

      <div className="card card-accent" style={{ marginBottom: 16 }}>
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
                className={`list-row${p.id === currentPlayer.id ? ' list-row--active' : ''}`}
              >
                <div className="avatar" style={{ width: 32, height: 32, fontSize: 13 }}>
                  {p.name[0].toUpperCase()}
                </div>
                <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{p.name}</span>
                {p.is_admin && (
                  <span className="badge badge-gold">
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

      {isAdmin && (
        <div className="card card-accent">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <Shield size={16} color="var(--accent)" />
            <span style={{ fontWeight: 700, fontSize: 15 }}>Panel Admina</span>
          </div>

          <p className="label" style={{ marginBottom: 10 }}>Tryb gry</p>
          <div className="btn-toggle-grid" style={{ marginBottom: 20 }}>
            {(['normal', 'impostor', 'word_impostor'] as GameMode[]).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`btn-toggle${mode === m ? ' btn-toggle--active' : ''}`}
              >
                {m === 'normal' ? '🎵 Klasyk' : m === 'impostor' ? '🕵️ Impostor' : '🗣️ Słowo Impostor'}
                <span className="btn-toggle__desc">
                  {m === 'normal' ? 'Zgaduj kto wybrał' : m === 'impostor' ? 'Gracze podszywają się pod innych' : 'Impostorzy nie znają słowa'}
                </span>
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

          {mode === 'word_impostor' && players.length >= 2 && maxSzponts > 0 && (
            <>
              <p className="label" style={{ marginBottom: 10 }}>Liczba szpontów</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <input
                  type="range"
                  min={0}
                  max={maxSzponts}
                  value={Math.min(szpontCount, maxSzponts)}
                  onChange={e => setSzpontCount(parseInt(e.target.value, 10))}
                  style={{ flex: 1, accentColor: 'var(--warn)' }}
                />
                <span style={{
                  minWidth: 36,
                  textAlign: 'center',
                  fontWeight: 800,
                  fontSize: 16,
                  color: 'var(--warn)',
                }}>
                  {Math.min(szpontCount, maxSzponts)}
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -12, marginBottom: 20 }}>
                Szponty mają wspólne inne słowo niż lojalistów — max {maxSzponts}, żeby został co najmniej jeden gracz z prawdziwym słowem.
              </p>
            </>
          )}

          <button
            className="btn btn-primary btn-lg btn-block"
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
