import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Volume2, Volume1, VolumeX } from 'lucide-react';

interface Props {
  videoId: string;
  startSeconds: number;
  playing: boolean;
  volume: number;
  onVolumeChange: (v: number) => void;
  onMuteToggle: () => void;
}

export default function YTPlayer({
  videoId, startSeconds, playing, volume, onVolumeChange, onMuteToggle,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const needsSeekRef = useRef(true);
  const [loaded, setLoaded] = useState(false);

  function cmd(func: string, args: unknown[] = []) {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func, args }),
      '*'
    );
  }

  useLayoutEffect(() => {
    needsSeekRef.current = true;
  }, [videoId, startSeconds]);

  function handleLoad() {
    setLoaded(true);
    setTimeout(() => {
      cmd('setVolume', [volume]);
      if (playing) {
        cmd('seekTo', [startSeconds, true]);
        needsSeekRef.current = false;
        cmd('playVideo');
      }
    }, 300);
  }

  useEffect(() => {
    if (!loaded) return;
    if (playing) {
      if (needsSeekRef.current) {
        cmd('seekTo', [startSeconds, true]);
        needsSeekRef.current = false;
      }
      cmd('playVideo');
    } else {
      cmd('pauseVideo');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, loaded]);

  useEffect(() => {
    if (!loaded) return;
    cmd('setVolume', [volume]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volume, loaded]);

  const VolIcon = volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const src = [
    `https://www.youtube.com/embed/${videoId}`,
    `?start=${Math.floor(startSeconds)}`,
    `&enablejsapi=1`,
    `&origin=${encodeURIComponent(origin)}`,
    `&autoplay=0`,
    `&controls=0`,
    `&rel=0`,
    `&modestbranding=1`,
    `&iv_load_policy=3`,
    `&playsinline=1`,
    `&cc_load_policy=0`,
    `&fs=0`,
    `&disablekb=1`,
  ].join('');

  return (
    <div className="yt-wrap">
      <iframe
        ref={iframeRef}
        key={`${videoId}-${startSeconds}`}
        src={src}
        onLoad={handleLoad}
        allow="autoplay; encrypted-media"
        title="YouTube player"
        tabIndex={-1}
      />
      {!loaded && (
        <div className="yt-wrap__loading">Ładowanie…</div>
      )}
      <div className="yt-wrap__shield" aria-hidden="true" />
      <div className="vol-hud">
        <div className="vol-hud__panel">
          <span className="vol-hud__value">{volume}</span>
          <div className="vol-hud__slider-wrap">
            <input
              type="range"
              className="vol-hud__range"
              min={0}
              max={100}
              value={volume}
              onChange={e => onVolumeChange(parseInt(e.target.value, 10))}
              aria-label="Głośność"
            />
          </div>
        </div>
        <button
          type="button"
          className="yt-ctrl-btn vol-hud__btn"
          onClick={onMuteToggle}
          aria-label={volume === 0 ? 'Włącz dźwięk' : 'Wycisz'}
        >
          <VolIcon size={18} />
        </button>
      </div>
    </div>
  );
}
