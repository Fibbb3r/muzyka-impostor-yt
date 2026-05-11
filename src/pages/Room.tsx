import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';
import Toast from '../components/Toast';
import LobbyPhase from '../components/LobbyPhase';
import PickingPhase from '../components/PickingPhase';
import PlayingPhase from '../components/PlayingPhase';
import ResultsPhase from '../components/ResultsPhase';
import ErrorBoundary from '../components/ErrorBoundary';
import type { Room, Player, Song, Vote, VoteState, SkipVote } from '../types/game';

function sortSongs(s: Song[]): Song[] {
  return [...s].sort((a, b) => {
    // If song_order is assigned (non-zero), use it; otherwise fall back to created_at
    const ao = a.song_order ?? 0;
    const bo = b.song_order ?? 0;
    if (ao !== 0 || bo !== 0) return ao - bo;
    return new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime();
  });
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
  const [skipVotes, setSkipVotes] = useState<SkipVote[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [myVotes, setMyVotes] = useState<Record<number, VoteState>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [kicked, setKicked] = useState(false);
  const previousRoomRef = useRef<Room | null>(null);

  // ── Fetch all data ──────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!playerId) { navigate('/'); return; }
    try {
      const { data: roomData, error: roomErr } = await supabase
        .from('rooms').select('*').eq('code', GLOBAL_ROOM_CODE).single();
      if (roomErr || !roomData) { navigate('/'); return; }

      const [{ data: pData }, { data: sData }, { data: vData }] = await Promise.all([
        supabase.from('players').select('*').eq('room_id', roomData.id),
        supabase.from('songs').select('*').eq('room_id', roomData.id),
        supabase.from('votes').select('*').eq('room_id', roomData.id),
      ]);

      // song_skip_votes is non-critical for initial render; ignore read errors gracefully
      const { data: svData } = await supabase
        .from('song_skip_votes')
        .select('*')
        .eq('room_id', roomData.id);

      setRoom(roomData as Room);
      const ps = (pData ?? []) as Player[];
      setPlayers(ps);
      setSongs(sortSongs((sData ?? []) as Song[]));
      setVotes((vData ?? []) as Vote[]);
      setSkipVotes((svData ?? []) as SkipVote[]);

      const me = ps.find(p => p.id === playerId) ?? null;
      if (!me) {
        sessionStorage.clear();
        navigate('/');
        return;
      }
      setCurrentPlayer(me);
    } finally {
      setLoading(false);
    }
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'song_skip_votes' }, () => {
        supabase.from('song_skip_votes').select('*').eq('room_id', room.id).then(({ data }) => {
          if (data) setSkipVotes(data as SkipVote[]);
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

      if (room.game_mode === 'word_impostor' && !updated.voted_for_id) {
        updated.voted_for_id = songs[songIdx - 1]?.player_id ?? '';
      }

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
  }, [room, currentPlayer, songs]);

  // ── Vote skip handler ────────────────────────────────────────
  const handleVoteSkip = useCallback(async (songIdx: number) => {
    if (!room || !currentPlayer || room.status !== 'playing') return;

    await supabase.from('song_skip_votes').upsert({
      room_id: room.id,
      song_index: songIdx,
      voter_id: currentPlayer.id,
    }, { onConflict: 'room_id,song_index,voter_id' });
  }, [room, currentPlayer]);

  // ── Vote-skip toast when song changes ────────────────────────
  useEffect(() => {
    if (!room) return;

    const previousRoom = previousRoomRef.current;
    if (
      previousRoom &&
      previousRoom.status === 'playing' &&
      room.current_song_index !== previousRoom.current_song_index
    ) {
      const previousSongIdx = previousRoom.current_song_index;
      const voters = new Set(
        skipVotes
          .filter(v => v.song_index === previousSongIdx)
          .map(v => v.voter_id)
      );
      const threshold = Math.max(1, Math.ceil(players.length * 0.5));
      if (voters.size >= threshold) {
        setToast('Nutka pominięta głosami!');
      }
    }

    previousRoomRef.current = room;
  }, [room, skipVotes, players.length]);

  // ── Kick player ─────────────────────────────────────────────
  async function kickPlayer(p: Player) {
    await supabase.from('players').delete().eq('id', p.id);
    setToast(`Wyrzucono: ${p.name}`);
  }

  // ── Auto-remove on tab close (lobby & picking only) ─────────
  useEffect(() => {
    const handleUnload = () => {
      if (!playerId) return;
      // Only remove during lobby/picking — don't interrupt active game
      const status = room?.status;
      if (status !== 'lobby' && status !== 'picking') return;

      // fetch with keepalive=true is guaranteed to send even when page is closing
      fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/players?id=eq.${playerId}`,
        {
          method: 'DELETE',
          keepalive: true,
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        }
      );
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload); // Safari / iOS
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, [playerId, room?.status]);

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

  if (loading || !room) {
    return (
      <div className="page" style={{ color: 'var(--text-muted)' }}>
        <div style={{ fontSize: 14 }}>Ładowanie…</div>
      </div>
    );
  }

  if (!currentPlayer) {
    return (
      <div className="page" style={{ color: 'var(--text-muted)' }}>
        <div style={{ fontSize: 14 }}>Nie znaleziono gracza w pokoju. Wróć do lobby.</div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
    <div className="page-top" style={{ paddingTop: 28 }}>
      <div style={{ width: '100%', maxWidth: 1600, padding: '0 16px' }}>

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
            skipVotes={skipVotes}
            myVotes={myVotes}
            onVoteChange={handleVoteChange}
            onVoteSkip={handleVoteSkip}
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
