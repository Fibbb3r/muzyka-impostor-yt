import { useEffect, useRef, useState } from 'react';

interface Props {
  videoId: string;
  startSeconds: number;
  playing: boolean;
  volume: number; // 0–100
}

export default function YTPlayer({ videoId, startSeconds, playing, volume }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);

  // Send command to YouTube player via postMessage
  function cmd(func: string, args: unknown[] = []) {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func, args }),
      '*'
    );
  }

  // When iframe loads, set volume and play if needed
  function handleLoad() {
    setLoaded(true);
    // Short delay to let the player initialize before sending commands
    setTimeout(() => {
      cmd('setVolume', [volume]);
      if (playing) {
        cmd('seekTo', [startSeconds, true]);
        cmd('playVideo');
      }
    }, 300);
  }

  // Play / pause control
  useEffect(() => {
    if (!loaded) return;
    if (playing) {
      cmd('seekTo', [startSeconds, true]);
      cmd('playVideo');
    } else {
      cmd('pauseVideo');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, loaded]);

  // Volume control
  useEffect(() => {
    if (!loaded) return;
    cmd('setVolume', [volume]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volume, loaded]);

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
  ].join('');

  return (
    <div style={{
      position: 'relative', width: '100%', paddingBottom: '56.25%',
      borderRadius: 12, overflow: 'hidden', background: '#000',
    }}>
      <iframe
        ref={iframeRef}
        key={`${videoId}-${startSeconds}`}   // force remount on video change
        src={src}
        onLoad={handleLoad}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        title="YouTube player"
      />
      {!loaded && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg3)', color: 'var(--text-muted)', fontSize: 13,
          pointerEvents: 'none', zIndex: 1,
        }}>
          Ładowanie…
        </div>
      )}
    </div>
  );
}
