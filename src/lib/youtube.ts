import { useEffect, useState } from 'react';

export function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('?')[0];
    return u.searchParams.get('v');
  } catch { return null; }
}

/**
 * Fetches YouTube titles for a list of URLs via oEmbed (no API key needed).
 * Returns a map: youtube_url -> title.
 */
export function useYoutubeTitles(urls: string[]): Record<string, string> {
  const [titles, setTitles] = useState<Record<string, string>>({});

  useEffect(() => {
    const unique = [...new Set(urls.filter(Boolean))];
    if (unique.length === 0) return;

    let cancelled = false;

    Promise.all(
      unique.map(async url => {
        const vid = extractVideoId(url);
        if (!vid) return null;
        try {
          const res = await fetch(
            `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${vid}&format=json`
          );
          const data = await res.json();
          return data?.title ? { url, title: data.title as string } : null;
        } catch {
          return null;
        }
      })
    ).then(results => {
      if (cancelled) return;
      const map: Record<string, string> = {};
      for (const r of results) {
        if (r) map[r.url] = r.title;
      }
      setTitles(map);
    });

    return () => { cancelled = true; };
  }, [urls.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  return titles;
}
