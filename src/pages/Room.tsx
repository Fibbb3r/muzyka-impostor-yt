import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';
import Toast from '../components/Toast';
import LobbyPhase from '../components/LobbyPhase';
import PickingPhase from '../components/PickingPhase';
import PlayingPhase from '../components/PlayingPhase';
import ResultsPhase from '../components/ResultsPhase';
import ErrorBoundary from '../components/ErrorBoundary';
import type { Room, Player, Song, Vote, VoteState } from '../types/game';

function sortSongs(s: Song[]): Song[] {
  return [...s].sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime());
}

const GLOBAL_ROOM_CODE = 'GLOBAL';

export default function RoomPage() {
  const navigate = useNavigate();
  const playerId = sessionStorage.getItem('playerId') ?? '';
  const isAdmin = sessionStorage.getItem('isAdmin') === 'true';

  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [myVotes, setMyVotes] = useState<Record<number, VoteState>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [kicked, setKicked] = useState(false);

  // ── Fetch all data ──────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!playerId) { navigate('/'); return; }

    const { data: roomData } = await supabase
      .from('rooms').select('*').eq('code', GLOBAL_ROOM_CODE).single();
    if (!roomData) { navigate('/'); return; }

    const [{ data: pData }, { data: sData }, { data: vData }] = await Promise.all([
      supabase.from('players').select('*').eq('room_id', roomData.id),
      supabase.from('songs').select('*').eq('room_id', roomData.id),
      supabase.from('votes').select('*').eq('room_id', roomData.id),
    ]);

    setRoom(roomData as Room);
    const ps = (pData ?? []) as Player[];
    setPlayers(ps);
    setSongs(sortSongs((sData ?? []) as Song[]));
    setVotes((vData ?? []) as Vote[]);

    const me = ps.find(p => p.id === playerId) ?? null;
    setCurrentPlayer(me);
    setLoading(false);
    return { roomData, ps };
  }, [playerId, navigate]);

  // ── Initial load ────────────────────────────────────────────
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Realtime subscriptions ──────────────────────────────────
  useEffect(() => {
    if (!room) return;

    const ch = supabase.channel(`room-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, payload => {
        const newRoom = payload.new as Room;
        setRoom(newRoom);
        // Clear local votes when returning to lobby
        if (newRoom.status === 'lobby') setMyVotes({});
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, async payload => {
        if (payload.eventType === 'DELETE') {
          const deletedId = (payload.old as Player).id;
          if (deletedId === playerId) { setKicked(true); return; }
          setPlayers(prev => prev.filter(p => p.id !== deletedId));
          setToast(`Gracz opuścił grę`);
        } else if (payload.eventType === 'INSERT') {
          const np = payload.new as Player;
          setPlayers(prev => prev.some(p => p.id === np.id) ? prev : [...prev, np]);
          setToast(`Do gry dołączył(a): ${np.name}`);
        } else if (payload.eventType === 'UPDATE') {
          setPlayers(prev => prev.map(p => p.id === (payload.new as Player).id ? payload.new as Player : p));
          if ((payload.new as Player).id === playerId) {
            setCurrentPlayer(payload.new as Player);
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'songs' }, () => {
        supabase.from('songs').select('*').eq('room_id', room.id).then(({ data }) => {
          if (data) setSongs(sortSongs(data as Song[]));
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, () => {
        supabase.from('votes').select('*').eq('room_id', room.id).then(({ data }) => {
          if (data) setVotes(data as Vote[]);
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [room?.id, playerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Vote change handler ─────────────────────────────────────
  const handleVoteChange = useCallback(async (songIdx: number, field: keyof VoteState, value: string | boolean) => {
    if (!room || !currentPlayer) return;

    let updatedVote: VoteState = { voted_for_id: '', is_impostor_guess: false, impostor_target_id: '' };

    setMyVotes(prev => {
      const cur = prev[songIdx] ?? { voted_for_id: '', is_impostor_guess: false, impostor_target_id: '' };
      let updated = { ...cur, [field]: value };

      // Only one impostor guess allowed across all songs
      if (field === 'is_impostor_guess' && value === true) {
        const cleared: Record<number, VoteState> = {};
        Object.entries(prev).forEach(([k, v]) => {
          const ki = parseInt(k);
          cleared[ki] = ki === songIdx ? updated : { ...v, is_impostor_guess: false, impostor_target_id: '' };
        });
        updatedVote = updated;
        return { ...cleared, [songIdx]: updated };
      }

      if (field === 'is_impostor_guess' && value === false) {
        updated = { ...updated, impostor_target_id: '' };
      }

      updatedVote = updated;
      return { ...prev, [songIdx]: updated };
    });

    // Auto-save to DB (fire and forget — state already updated above)
    setTimeout(async () => {
      if (!updatedVote.voted_for_id) return;
      await supabase.from('votes').upsert({
        room_id: room.id,
        voter_id: currentPlayer.id,
        song_index: songIdx,
        voted_for_id: updatedVote.voted_for_id,
        is_impostor_guess: updatedVote.is_impostor_guess,
        impostor_target_id: updatedVote.impostor_target_id || null,
      }, { onConflict: 'room_id,voter_id,song_index' });
    }, 0);
  }, [room, currentPlayer]);

  // ── Kick player ─────────────────────────────────────────────
  async function kickPlayer(p: Player) {
    await supabase.from('players').delete().eq('id', p.id);
    setToast(`Wyrzucono: ${p.name}`);
  }

  // ── Cleanup on unmount (remove player from DB) ──────────────
  useEffect(() => {
    const handleUnload = () => {
      if (playerId) {
        navigator.sendBeacon('/api/noop'); // keepalive trick
        supabase.from('players').delete().eq('id', playerId).then(() => {});
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [playerId]);

  // ── Kicked screen ───────────────────────────────────────────
  if (kicked) {
    sessionStorage.clear();
    return (
      <div className="page">
        <motion.div
          className="card"
          style={{ maxWidth: 380, textAlign: 'center', padding: 40 }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div style={{ fontSize: 40, marginBottom: 16 }}>🚫</div>
          <h2 style={{ fontWeight: 800, fontSize: 20, marginBottom: 8 }}>Zostałeś wyrzucony</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
            Admin usunął Cię z gry.
          </p>
          <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => navigate('/')}>
            Wróć do strony głównej
          </button>
        </motion.div>
      </div>
    );
  }

  if (loading || !room || !currentPlayer) {
    return (
      <div className="page" style={{ color: 'var(--text-muted)' }}>
        <div style={{ fontSize: 14 }}>Ładowanie…</div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
    <div className="page-top" style={{ paddingTop: 28 }}>
      <div style={{ width: '100%', maxWidth: 1100, padding: '0 16px' }}>

        {room.status === 'lobby' && (
          <LobbyPhase
            room={room}
            players={players}
            currentPlayer={currentPlayer}
            isAdmin={isAdmin}
            onKick={kickPlayer}
          />
        )}

        {room.status === 'picking' && (
          <PickingPhase
            room={room}
            players={players}
            currentPlayer={currentPlayer}
            isAdmin={isAdmin}
            songs={songs}
          />
        )}

        {room.status === 'playing' && (
          <PlayingPhase
            room={room}
            players={players}
            currentPlayer={currentPlayer}
            isAdmin={isAdmin}
            songs={songs}
            votes={votes}
            myVotes={myVotes}
            onVoteChange={handleVoteChange}
          />
        )}

        {room.status === 'results' && (
          <ResultsPhase
            room={room}
            players={players}
            songs={songs}
            votes={votes}
            isAdmin={isAdmin}
          />
        )}
      </div>

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
    </ErrorBoundary>
  );
}
