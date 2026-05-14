import type { CSSProperties } from 'react';
import { Users } from 'lucide-react';
import type { Player, Vote } from '../types/game';
import { groupPlayersByDetectiveImpostorStatus } from '../lib/wordImpostorDetectiveStatus';

interface Props {
  players: Player[];
  votes: Vote[];
  impostors: Player[];
  /** null = pełna runda; liczba = nutki 1..n włącznie */
  throughSongIndex: number | null;
  subtitle?: string;
  /** sticky bottom bar w finale */
  sticky?: boolean;
}

function nameList(list: Player[]) {
  if (list.length === 0) return '—';
  return list.map(p => p.name).join(', ');
}

export default function WordImpostorDetectiveList({
  players,
  votes,
  impostors,
  throughSongIndex,
  subtitle,
  sticky,
}: Props) {
  const impostorIds = new Set(impostors.map(p => p.id));
  const { correct, wrong, notYet } = groupPlayersByDetectiveImpostorStatus(
    players,
    votes,
    impostorIds,
    throughSongIndex,
  );

  const defaultSubtitle =
    throughSongIndex === null
      ? 'Stan po całej rundzie'
      : `Kto wskazał impostora (stan do nutki ${throughSongIndex})`;

  const wrapStyle: CSSProperties = sticky
    ? {
        position: 'sticky',
        bottom: 0,
        zIndex: 5,
        marginTop: 16,
        paddingTop: 8,
        background: 'linear-gradient(180deg, transparent 0%, var(--bg) 12%)',
      }
    : { marginBottom: 0 };

  return (
    <div style={wrapStyle}>
      <div className="card" style={{ marginBottom: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 }}>
          <Users size={18} color="var(--accent)" />
          <span style={{ fontWeight: 900, fontSize: 16 }}>Wskazanie impostora</span>
        </div>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, marginBottom: 14 }}>
          {subtitle ?? defaultSubtitle}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 12,
              background: 'rgba(34,211,160,0.08)',
              border: '1px solid rgba(34,211,160,0.25)',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent2)', marginBottom: 6 }}>
              Zgadł impostora
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.45 }}>{nameList(correct)}</div>
          </div>
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 12,
              background: 'rgba(251,113,133,0.08)',
              border: '1px solid rgba(251,113,133,0.25)',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: '#fb7185', marginBottom: 6 }}>Zgadł źle</div>
            <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.45 }}>{nameList(wrong)}</div>
          </div>
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 12,
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 6 }}>
              Jeszcze nie głosował na impostora
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.45, color: 'var(--text-muted)' }}>
              {nameList(notYet)}
            </div>
          </div>
        </div>

        {impostors.length > 0 && (
          <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 12, marginBottom: 0 }}>
            {impostors.length === 1 ? (
              <>
                Impostor: <strong style={{ color: 'var(--text)' }}>{impostors[0].name}</strong>
              </>
            ) : (
              <>
                Impostorzy:{' '}
                <strong style={{ color: 'var(--text)' }}>{nameList(impostors)}</strong>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
