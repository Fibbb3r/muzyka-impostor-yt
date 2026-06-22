import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Key, User, ArrowRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const GLOBAL_ROOM_CODE = 'GLOBAL';
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || '';

export default function Home() {
  const navigate = useNavigate();
  const [nick, setNick] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const trimmedNick = nick.trim();
    if (!trimmedNick) { setError('Wpisz swój nick!'); return; }
    setLoading(true);
    setError('');

    const isAdmin = password === ADMIN_PASSWORD && ADMIN_PASSWORD !== '';

    try {
      let { data: room } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', GLOBAL_ROOM_CODE)
        .single();

      if (!room) {
        const { data: newRoom, error: createErr } = await supabase
          .from('rooms')
          .insert({ code: GLOBAL_ROOM_CODE, status: 'lobby', game_mode: 'normal', current_song_index: 0 })
          .select()
          .single();
        if (createErr) throw createErr;
        room = newRoom;
      }

      const { data: player, error: playerErr } = await supabase
        .from('players')
        .insert({ room_id: room.id, name: trimmedNick, is_admin: isAdmin, is_impostor: false, is_szpont: false })
        .select()
        .single();
      if (playerErr) throw playerErr;

      sessionStorage.setItem('playerId', player.id);
      sessionStorage.setItem('playerName', trimmedNick);
      sessionStorage.setItem('isAdmin', String(isAdmin));

      navigate('/room');
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Coś poszło nie tak, spróbuj ponownie.');
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <motion.div
        className="container"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className="screen-header">
          <h1 className="screen-header__title">
            Music Impostor
          </h1>
          <p className="screen-header__subtitle">
            Zgaduj kto wybrał daną nutkę
          </p>
        </div>

        <div className="card card-lg card-accent">
          <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label className="label">
                <User size={12} style={{ display: 'inline', marginRight: 5 }} />
                Twój nick
              </label>
              <input
                className="input"
                placeholder="np. Wojtek"
                value={nick}
                onChange={e => setNick(e.target.value)}
                maxLength={20}
                autoFocus
              />
            </div>

            <div>
              <label className="label">
                <Key size={12} style={{ display: 'inline', marginRight: 5 }} />
                Hasło admina{' '}
                <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                  (opcjonalne)
                </span>
              </label>
              <input
                className="input"
                type="password"
                placeholder="Tylko dla admina"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ color: 'var(--danger)', fontSize: 13, textAlign: 'center' }}
              >
                {error}
              </motion.p>
            )}

            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
              {loading
                ? <><Loader2 size={18} className="spin" /> Dołączam…</>
                : <><ArrowRight size={18} /> Dołącz do gry</>
              }
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20 }}>
          <span className="ui-tag">[ GLOBAL ROOM ]</span>
        </p>
      </motion.div>
    </div>
  );
}
