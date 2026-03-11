'use client';

import React, { useEffect, useRef, useState } from 'react';

export default function VideoPlayer({ embedUrl, title, poster }) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const hlsRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [streamData, setStreamData] = useState(null);
  const [adBlockDetected, setAdBlockDetected] = useState(false);

  // Inject ad script once on mount
  useEffect(() => {
    if (document.getElementById('wpadmngr-script')) return;
    const script = document.createElement('script');
    script.id = 'wpadmngr-script';
    script.async = true;
    script.src = 'https://js.wpadmngr.com/static/adManager.js';
    script.setAttribute('data-admpid', '314103');
    document.head.appendChild(script);
  }, []);

  // Anti AdBlock detection via bait element
  useEffect(() => {
    const bait = document.createElement('div');
    bait.className = 'ads ad adsbox doubleclick ad-placement carbon-ads';
    bait.style.cssText = 'height:1px;width:1px;position:absolute;left:-9999px;top:-9999px;';
    document.body.appendChild(bait);

    const timer = setTimeout(() => {
      const detected =
        !bait.offsetHeight ||
        !bait.offsetWidth ||
        bait.style.display === 'none' ||
        bait.style.visibility === 'hidden';
      setAdBlockDetected(detected);
      bait.remove();
    }, 150);

    return () => {
      clearTimeout(timer);
      bait.remove();
    };
  }, []);

  // Step 1: Fetch stream from proxy
  useEffect(() => {
    if (!embedUrl) return;
    let isMounted = true;

    async function fetchStream() {
      try {
        setLoading(true);
        const cleanUrl = embedUrl.startsWith('//') ? `https:${embedUrl}` : embedUrl;
        const res = await fetch(`/api/proxy?url=${encodeURIComponent(cleanUrl)}`);
        const result = await res.json();

        if (!isMounted) return;

        if (result.success && result.data?.streams?.length > 0) {
          setStreamData(result.data);
          setError(null);
        } else {
          setError(result.message || 'Gagal mengambil stream.');
        }
      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchStream();
    return () => { isMounted = false; };
  }, [embedUrl]);

  // Step 2: Initialize Plyr + HLS.js once stream data is ready
  useEffect(() => {
    if (!streamData || !videoRef.current) return;

    const m3u8Url = streamData.streams[0]?.src;
    if (!m3u8Url) return;

    let Plyr, Hls;

    async function initPlayer() {
      try {
        [{ default: Plyr }, { default: Hls }] = await Promise.all([
          import('plyr'),
          import('hls.js'),
        ]);

        // Cleanup previous instances
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
        if (playerRef.current) {
          playerRef.current.destroy();
          playerRef.current = null;
        }

        const video = videoRef.current;
        if (!video) return;

        if (poster) video.poster = poster;

        if (Hls.isSupported()) {
          const hls = new Hls({
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            enableWorker: true,
          });
          hls.loadSource(m3u8Url);
          hls.attachMedia(video);
          hlsRef.current = hls;

          hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
              console.error('[HLS] Fatal error:', data);
              setError('Stream gagal dimuat (HLS error).');
            }
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          // Native HLS (Safari)
          video.src = m3u8Url;
        } else {
          setError('Browser tidak mendukung HLS.');
          return;
        }

        const player = new Plyr(video, {
          controls: [
            'play-large',
            'rewind',
            'play',
            'fast-forward',
            'progress',
            'current-time',
            'duration',
            'mute',
            'volume',
            'settings',
            'fullscreen',
          ],
          settings: ['quality', 'speed'],
          speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
          tooltips: { controls: true, seek: true },
          keyboard: { focused: true, global: false },
          autoplay: false,
          resetOnEnd: false,
          ratio: '16:9',
          storage: { enabled: true, key: 'plyr' },
        });

        playerRef.current = player;
      } catch (err) {
        console.error('[VideoPlayer] Init error:', err);
        setError('Gagal memuat player: ' + err.message);
      }
    }

    initPlayer();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [streamData, poster]);

  // --- LOADING STATE ---
  if (loading) {
    return (
      <div className="w-full aspect-video bg-black flex items-center justify-center flex-col gap-4 relative rounded-xl overflow-hidden border border-gray-800">
        {poster && (
          <img src={poster} className="absolute inset-0 w-full h-full object-cover opacity-20 blur-sm" alt="" />
        )}
        <div className="relative z-10 w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
        <p className="relative z-10 text-pink-400 font-medium text-sm">Mengekstrak Stream...</p>
      </div>
    );
  }

  // --- IFRAME FALLBACK when proxy fails ---
  if (error || !streamData) {
    const cleanUrl = embedUrl?.startsWith('//') ? `https:${embedUrl}` : embedUrl;
    return (
      <div className="aspect-video w-full relative rounded-xl overflow-hidden border border-gray-800 bg-black">
        <iframe
          src={cleanUrl}
          className="absolute top-0 left-0 w-full h-full"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={title}
        />
      </div>
    );
  }

  // --- PLYR PLAYER ---
  return (
    <div className="w-full rounded-xl overflow-hidden border border-gray-800 shadow-2xl bg-black">
      <style dangerouslySetInnerHTML={{ __html: `
        .plyr-container {
          --plyr-color-main: #ec4899;
          --plyr-video-background: #000;
          --plyr-range-fill-background: #ec4899;
          --plyr-video-controls-background: linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0.75));
          --plyr-control-radius: 6px;
          --plyr-font-size-base: 14px;
          width: 100%;
          aspect-ratio: 16 / 9;
          position: relative;
          background: #000;
        }

        .plyr-container .plyr {
          width: 100%;
          height: 100%;
          border-radius: 0;
        }

        .plyr-container video {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
        }

        .plyr__control--overlaid {
          background: rgba(236, 72, 153, 0.85) !important;
          border-radius: 50% !important;
          width: 64px !important;
          height: 64px !important;
          transition: background 0.2s ease, transform 0.2s ease !important;
        }

        .plyr__control--overlaid:hover {
          background: #ec4899 !important;
          transform: scale(1.12) !important;
        }

        .plyr--video .plyr__controls {
          padding: 10px 14px !important;
        }
      `}} />
      <div className="plyr-container" style={{ position: 'relative' }}>
        <video ref={videoRef} playsInline crossOrigin="anonymous" />

        {/* Anti-AdBlock Overlay */}
        {adBlockDetected && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: '16px', padding: '24px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '48px' }}>🚫</div>
            <h3 style={{ color: '#f9a8d4', fontSize: '18px', fontWeight: 700, margin: 0 }}>
              AdBlock Terdeteksi
            </h3>
            <p style={{ color: '#d1d5db', fontSize: '14px', maxWidth: '320px', margin: 0, lineHeight: '1.6' }}>
              Situs ini didukung oleh iklan. Harap matikan AdBlock untuk dapat menonton video ini secara gratis.
            </p>
            <button
              onClick={() => {
                const bait = document.createElement('div');
                bait.className = 'ads ad adsbox doubleclick ad-placement';
                bait.style.cssText = 'height:1px;width:1px;position:absolute;left:-9999px;';
                document.body.appendChild(bait);
                setTimeout(() => {
                  const stillBlocked = !bait.offsetHeight || !bait.offsetWidth;
                  bait.remove();
                  setAdBlockDetected(stillBlocked);
                  if (!stillBlocked) window.location.reload();
                }, 200);
              }}
              style={{
                background: 'linear-gradient(135deg, #ec4899, #db2777)',
                color: '#fff', border: 'none', borderRadius: '8px',
                padding: '10px 24px', fontSize: '14px', fontWeight: 600,
                cursor: 'pointer', transition: 'opacity 0.2s',
              }}
              onMouseEnter={e => e.target.style.opacity = '0.85'}
              onMouseLeave={e => e.target.style.opacity = '1'}
            >
              ✅ Sudah Dimatikan, Muat Ulang
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
