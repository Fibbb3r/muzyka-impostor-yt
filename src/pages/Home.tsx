import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Music2, Key, User, ArrowRight, Loader2 } from 'lucide-react';
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
      // Upewnij się że globalny pokój istnieje
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

      // Wstaw gracza
      const { data: player, error: playerErr } = await supabase
        .from('players')
        .insert({ room_id: room.id, name: trimmedNick, is_admin: isAdmin, is_impostor: false, is_szpont: false })
        .select()
        .single();
      if (playerErr) throw playerErr;

      // Zapisz sesję
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
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 64, height: 64,
            background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
            borderRadius: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 32px rgba(124,108,252,0.4)',
          }}>
            <Music2 size={30} color="#fff" />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 6 }} className="grad-text">
            Muzyka Impostor
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Zgaduj kto wybrał daną nutkę
          </p>
        </div>

        {/* Form */}
        <div className="card" style={{ padding: 32 }}>
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
                Hasło admina <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcjonalne)</span>
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

            <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
              {loading
                ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Dołączam…</>
                : <><ArrowRight size={18} /> Dołącz do gry</>
              }
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, color: 'var(--text-muted)', fontSize: 12 }}>
          Jeden globalny pokój · Kontrolowany przez admina
        </p>
      </motion.div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
