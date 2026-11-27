import { useEffect, useRef, useState } from 'react';

const RATES = [0.25, 0.5, 1, 1.5, 2];
const fmt = t => {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60), s = (t % 60).toFixed(1).padStart(4, '0');
  return `${m}:${s}`;
};

// Reproductor con adelantar/atrasar, cuadro por cuadro y velocidad lenta (útil para analizar un ciclo)
export default function VideoPlayer({ src }) {
  const box = useRef(null), vid = useRef(null), drag = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [rate, setRate] = useState(1);
  const [err, setErr] = useState(false);

  useEffect(() => { setCur(0); setDur(0); setPlaying(false); setErr(false); setRate(1); }, [src]);

  const v = () => vid.current;
  const seek = t => { const el = v(); if (!el) return; el.currentTime = Math.max(0, Math.min(el.duration || t, t)); setCur(el.currentTime); };
  const toggle = () => { const el = v(); if (!el) return; if (el.paused) el.play().catch(() => {}); else el.pause(); };
  const step = dir => { const el = v(); if (!el) return; el.pause(); seek(el.currentTime + dir / 30); };
  const cycleRate = () => { const el = v(); const n = RATES[(RATES.indexOf(rate) + 1) % RATES.length]; setRate(n); if (el) el.playbackRate = n; };
  const full = () => {
    const el = box.current, vv = v();
    if (el?.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (vv?.webkitEnterFullscreen) vv.webkitEnterFullscreen();
  };

  return (
    <div className="vp" ref={box}>
      <video
        ref={vid} src={src} playsInline preload="metadata" onClick={toggle}
        onLoadedMetadata={e => setDur(e.target.duration)} onDurationChange={e => setDur(e.target.duration)}
        onTimeUpdate={e => { if (!drag.current) setCur(e.target.currentTime); }}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
        onError={() => setErr(true)}
      />
      {err && <p className="vp-err">No se pudo reproducir este video en el dispositivo.</p>}
      <div className="vp-bar">
        <span className="vp-time">{fmt(cur)}</span>
        <input
          type="range" className="vp-seek" min="0" max={isFinite(dur) && dur > 0 ? dur : 0} step="0.05" value={Math.min(cur, dur || 0)}
          onPointerDown={() => { drag.current = true; }}
          onChange={e => { setCur(+e.target.value); seek(+e.target.value); }}
          onPointerUp={() => { drag.current = false; }} onBlur={() => { drag.current = false; }} aria-label="Posición del video"
        />
        <span className="vp-time">{fmt(dur)}</span>
      </div>
      <div className="vp-btns">
        <button type="button" onClick={() => seek((v()?.currentTime || 0) - 10)} aria-label="Atrasar 10 segundos">⏪ 10s</button>
        <button type="button" onClick={() => step(-1)} aria-label="Cuadro anterior">‹ cuadro</button>
        <button type="button" className="vp-play" onClick={toggle} aria-label={playing ? 'Pausar' : 'Reproducir'}>{playing ? '⏸' : '▶'}</button>
        <button type="button" onClick={() => step(1)} aria-label="Cuadro siguiente">cuadro ›</button>
        <button type="button" onClick={() => seek((v()?.currentTime || 0) + 10)} aria-label="Adelantar 10 segundos">10s ⏩</button>
      </div>
      <div className="vp-btns vp-sub">
        <button type="button" onClick={cycleRate}>Velocidad {rate}×</button>
        <button type="button" onClick={full}>⛶ Pantalla completa</button>
      </div>
    </div>
  );
}
