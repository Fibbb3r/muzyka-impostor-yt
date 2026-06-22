import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ChevronRight, RotateCcw, Trophy, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Room, Player, Song, Vote } from '../types/game';
import { formatPointsPts, scoreSongPoints, cumulativeScoresThroughSong } from '../lib/scoringSong';
import WordImpostorDetectiveList from './WordImpostorDetectiveList';
import { useYoutubeTitles } from '../lib/youtube';

interface Props {
  room: Room;
  players: Player[];
  songs: Song[];
  votes: Vote[];
  isAdmin: boolean;
}

export default function ResultsPhase({ room, players, songs, votes, isAdmin }: Props) {
  const [revealing, setRevealing] = useState(false);

  // Fetch titles for all songs at once (oEmbed, no API key)
  const allUrls = songs.map(s => s.youtube_url);
  const urlTitles = useYoutubeTitles(allUrls);

  const idx = room.current_song_index; // current song being shown
  const song = songs[idx - 1];
  const trueAuthorId = song?.player_id;
  const trueAuthor = players.find(p => p.id === trueAuthorId);

  const impostors = players.filter(p => p.is_impostor);
  const songImpostor = trueAuthor?.is_impostor ? trueAuthor : undefined;
  const isImpostorSong = Boolean(songImpostor);
  const isSzpontSong =
    room.game_mode === 'word_impostor' &&
    Boolean(trueAuthor?.is_szpont && !trueAuthor?.is_impostor);
  const victim =
    isImpostorSong && room.game_mode === 'impostor' && songImpostor
      ? players.find(p => p.id === songImpostor.impersonates_id) ?? null
      : null;

  const songVotes = votes.filter(v => v.song_index === idx);

  const pointsThisSong =
    song && trueAuthorId
      ? scoreSongPoints({
          gameMode: room.game_mode,
          songIndex: idx,
          votes,
          players,
          trueAuthorId,
        })
      : Object.fromEntries(players.map(p => [p.id, 0]));

  const showPodium = room.game_mode !== 'word_impostor' && Boolean(song && trueAuthorId);

  const rankedByPoints = useMemo(() => {
    if (!showPodium || songs.length === 0) return [];
    const totals = cumulativeScoresThroughSong({
      gameMode: room.game_mode,
      votes,
      players,
      songs,
      throughSongIndex: idx,
    });
    return [...players]
      .map(p => ({ player: p, points: totals[p.id] ?? 0 }))
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return a.player.name.localeCompare(b.player.name, 'pl', { sensitivity: 'base' });
      });
  }, [showPodium, songs, idx, votes, players, room.game_mode]);

  async function next() {
    setRevealing(true);
    const next = room.current_song_index + 1;
    if (next > songs.length) {
      if (room.game_mode === 'word_impostor') {
        await supabase
          .from('rooms')
          .update({
            status: 'word_finale',
            word_finale_step: 0,
            impostor_word_guess: null,
            impostor_word_guesses: {},
          })
          .eq('id', room.id);
      } else {
        await supabase.from('song_skip_votes').delete().eq('room_id', room.id);
        await supabase.from('rooms').update({
          status: 'lobby',
          current_song_index: 0,
          current_word: null,
          szpont_word: null,
        }).eq('id', room.id);
      }
    } else {
      await supabase.from('rooms').update({ current_song_index: next }).eq('id', room.id);
    }
    setRevealing(false);
  }

  const isLastSong = idx >= songs.length;

  return (
    <div className="results-page">
      <div className="results-page__tag">
        <span className="ui-tag">[ WYNIKI {idx} / {songs.length} ]</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          className="card card-accent results-reveal"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35 }}
        >
          <p className="section-title" style={{ marginBottom: 12 }}>Piosenkę dodał</p>
          {trueAuthor ? (
            <>
              <div className={`results-reveal__avatar${
                isImpostorSong ? ' results-reveal__avatar--impostor' : isSzpontSong ? ' results-reveal__avatar--szpont' : ''
              }`}>
                {trueAuthor.name[0].toUpperCase()}
              </div>
              <div className="results-reveal__name">{trueAuthor.name}</div>
              {song && (
                <div className="results-reveal__song">
                  {urlTitles[song.youtube_url] ?? '…'}
                </div>
              )}

              {isImpostorSong && room.game_mode === 'impostor' && victim && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: 12 }}>
                  <span className="badge badge-red">
                    Impostor — podszywa się pod: {victim.name}
                  </span>
                </motion.div>
              )}
              {isImpostorSong && room.game_mode === 'word_impostor' && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: 12 }}>
                  <span className="badge badge-red">
                    Słowo impostor — nie znał tajnego słowa
                  </span>
                </motion.div>
              )}
              {isSzpontSong && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: 12 }}>
                  <span className="badge badge-orange">
                    Szpont — inne słowo niż lojalistowie
                  </span>
                </motion.div>
              )}
            </>
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>Brak danych</p>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="card card-accent results-votes">
        <div className="playing-card-header" style={{ marginBottom: 14 }}>
          <User size={18} color="var(--accent)" />
          <span className="playing-card-header__title">Jak głosowali gracze</span>
        </div>
        <div className="results-votes__list">
          {players.map(voter => {
            const vote = songVotes.find(v => v.voter_id === voter.id);
            const votedFor = players.find(p => p.id === vote?.voted_for_id);
            const isCorrect = vote?.voted_for_id === trueAuthorId;
            const guessedImpostorMusic =
              room.game_mode === 'impostor' &&
              Boolean(vote?.is_impostor_guess && vote.voted_for_id === songImpostor?.id);
            const guessedImpostorWord =
              room.game_mode === 'word_impostor' &&
              Boolean(vote?.is_impostor_guess && trueAuthor?.is_impostor);
            const guessedImpostor = guessedImpostorMusic || guessedImpostorWord;
            const guessedVictim = guessedImpostorMusic && vote?.impostor_target_id === victim?.id;
            const perfectGuess = guessedImpostorMusic && guessedVictim;
            const pts = room.game_mode === 'word_impostor' ? null : (pointsThisSong[voter.id] ?? 0);
            const highlights =
              room.game_mode !== 'word_impostor' &&
              (isCorrect ||
                perfectGuess ||
                (guessedImpostor && !guessedVictim) ||
                (pts !== null && pts > 0));

            return (
              <div
                key={voter.id}
                className={`results-vote-row${highlights ? ' results-vote-row--highlight' : ''}`}
              >
                <div className="avatar" style={{ width: 34, height: 34, fontSize: 13 }}>
                  {voter.name[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="results-vote-row__name">{voter.name}</div>
                  {vote ? (
                    <div className="results-vote-row__meta">
                      {room.game_mode !== 'word_impostor' && (
                        <>Wskazał: <strong style={{ color: 'var(--text)' }}>{votedFor?.name ?? '?'}</strong></>
                      )}
                      {vote.is_impostor_guess && (
                        <span style={{ color: 'var(--danger)', marginLeft: room.game_mode === 'word_impostor' ? 0 : 6 }}>
                          {room.game_mode === 'word_impostor' ? 'Wskazał jako impostora' : '· jako impostor'}{room.game_mode === 'impostor' ? ` pod ${players.find(p => p.id === vote.impostor_target_id)?.name ?? '?'}` : ''}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="results-vote-row__meta">Nie zagłosował</div>
                  )}
                </div>
                <div className="results-vote-row__badges">
                  <span className={`results-vote-row__pts${pts !== null && pts > 0 ? ' results-vote-row__pts--pos' : ''}`}>
                    {pts === null ? '—' : formatPointsPts(pts)}
                  </span>
                  {room.game_mode !== 'word_impostor' && isCorrect && (!vote?.is_impostor_guess || !guessedImpostor) && (
                    <span className="badge badge-green">Trafił</span>
                  )}
                  {room.game_mode !== 'word_impostor' && perfectGuess && (
                    <span className="badge badge-red">Idealny traf</span>
                  )}
                  {guessedImpostorMusic && !guessedVictim && (
                    <span className="badge badge-orange">Wykrył impostora</span>
                  )}
                  {room.game_mode !== 'word_impostor' && !isCorrect && !guessedImpostor && vote && (
                    <span className="badge badge-gray">Pudło</span>
                  )}
                  {room.game_mode === 'word_impostor' && vote?.is_impostor_guess && !guessedImpostor && (
                    <span className="badge badge-gray">Błędny strzał</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {room.game_mode === 'word_impostor' && impostors.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <WordImpostorDetectiveList
            players={players}
            votes={votes}
            impostors={impostors}
            throughSongIndex={idx}
          />
        </div>
      )}

      {showPodium && rankedByPoints.length > 0 && (
        <motion.div
          key={`podium-${idx}`}
          className="card card-accent podium-card"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut', delay: 0.12 }}
        >
          <div className="podium-card__header">
            <Trophy size={18} color="var(--accent)" />
            <span className="podium-card__title">Podium — suma nutek 1–{idx}</span>
          </div>
          <p className="podium-card__sub">
            Ranking zlicza wszystkie nutki pokazane do tego momentu
          </p>

          <div className="podium-stage">
            {[1, 0, 2].map(slot => {
              const row = rankedByPoints[slot];
              if (!row) return <div key={`empty-${slot}`} style={{ flex: 1, maxWidth: 130 }} />;
              const rankClass = slot === 0 ? 'podium-slot__rank--1' : slot === 1 ? 'podium-slot__rank--2' : '';
              const barClass = slot === 0 ? 'podium-bar--1' : slot === 1 ? 'podium-bar--2' : 'podium-bar--3';

              return (
                <motion.div
                  key={row.player.id}
                  className="podium-slot"
                  initial={{ opacity: 0, y: 28 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.38, delay: 0.06 * (slot === 0 ? 1 : slot === 1 ? 0 : 2) }}
                >
                  <div className={`podium-slot__rank ${rankClass}`}>{slot + 1}</div>
                  <div className="podium-slot__name">{row.player.name}</div>
                  <div className={`podium-slot__pts${row.points > 0 ? ' podium-slot__pts--pos' : ''}`}>
                    {formatPointsPts(row.points)}
                  </div>
                  <div className={`podium-bar ${barClass}`}>{slot + 1}</div>
                </motion.div>
              );
            })}
          </div>

          {rankedByPoints.length > 3 && (
            <div className="podium-rest">
              <span className="section-title">Pozostali</span>
              {rankedByPoints.slice(3).map((row, i) => (
                <div key={row.player.id} className="podium-rest__row">
                  <span className="podium-rest__pos">{4 + i}</span>
                  <span className="podium-rest__name">{row.player.name}</span>
                  <span className={`results-vote-row__pts${row.points > 0 ? ' results-vote-row__pts--pos' : ''}`}>
                    {formatPointsPts(row.points)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {isAdmin && (
        <button
          className="btn btn-primary btn-lg btn-block"
          onClick={next}
          disabled={revealing}
        >
          {isLastSong
            ? room.game_mode === 'word_impostor'
              ? <><ChevronRight size={16} /> Finał — wybór słowa</>
              : <><RotateCcw size={16} /> Powrót do lobby</>
            : <><ChevronRight size={16} /> Dalej — Nutka {idx + 1}/{songs.length}</>
          }
        </button>
      )}
      {!isAdmin && (
        <div className="wait-banner">
          Czekaj aż admin przejdzie dalej…
        </div>
      )}
    </div>
  );
}
