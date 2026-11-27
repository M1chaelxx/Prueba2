import { useEffect, useRef, useState } from 'react';
import MediaViewer from './MediaViewer';
import { thumbSrc, isLocalMedia, MAX_VIDEO_MB } from '../utils/cloudinary';
import { QUALITIES, getQuality, setQuality } from '../utils/videoCompress';
import { enqueue, retry, cancel, registerView, useUploads } from '../utils/uploadQueue';

export const jobLabel = j => {
  if (j.status === 'queued') return 'En cola…';
  if (j.status === 'compressing') return `🗜 Comprimiendo ${j.name}`;
  if (j.status === 'uploading') return `⬆ Subiendo ${j.name}`;
  if (j.status === 'waiting') return `📡 Sin conexión · ${j.name}`;
  if (j.status === 'done') return `✓ Listo · ${j.name}`;
  return `⚠ ${j.name}`;
};

export function JobRow({ j }) {
  const bar = ['compressing', 'uploading'].includes(j.status);
  return (
    <div className={`media-busy job-${j.status}`}>
      <div className="job-top">
        <span className="job-name">{jobLabel(j)}{bar ? ` · ${j.pct}%` : ''}</span>
        <span className="job-actions">
          {['waiting', 'error'].includes(j.status) && <button type="button" onClick={() => retry(j.id)}>↻ Reintentar</button>}
          {j.status !== 'done' && <button type="button" onClick={() => cancel(j.id)} aria-label="Cancelar">✕</button>}
        </span>
      </div>
      {bar && <div className="progress-bar"><div className="progress-fill" style={{ width: `${j.pct}%` }} /></div>}
      {j.status === 'waiting' && <small>Se reintenta sola cuando vuelva la conexión.</small>}
      {j.status === 'error' && <small>{j.error}</small>}
      {j.warning && <small>{j.warning}</small>}
    </div>
  );
}

// Fotos y videos de un puesto o de un problema. items = [{id, tipo, url, nombre}]
// Las subidas van a una cola global: siguen aunque cambies de pantalla.
export default function MediaPicker({ items, onChange, target, hint }) {
  const [view, setView] = useState(null);
  const [quality, setQ] = useState(getQuality);
  const { jobs } = useUploads();
  const refs = { gal: useRef(null), cam: useRef(null), vid: useRef(null), rec: useRef(null) };
  const tKey = `${target.type}:${target.id}`;
  const mine = jobs.filter(j => `${j.target.type}:${j.target.id}` === tKey);

  useEffect(() => registerView(target), [tKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handle = e => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (files.length) enqueue(files, target, quality);
  };
  const pickQuality = q => { setQ(q); setQuality(q); };

  return (
    <div className="media-picker">
      <input ref={refs.gal} type="file" accept="image/*" multiple hidden onChange={handle} />
      <input ref={refs.cam} type="file" accept="image/*" capture="environment" hidden onChange={handle} />
      <input ref={refs.vid} type="file" accept="video/*" multiple hidden onChange={handle} />
      <input ref={refs.rec} type="file" accept="video/*" capture="environment" hidden onChange={handle} />

      <div className="media-btns">
        <button type="button" className="ghost-btn" onClick={() => refs.gal.current.click()}>🖼 Foto (galería)</button>
        <button type="button" className="ghost-btn" onClick={() => refs.cam.current.click()}>📸 Sacar foto</button>
        <button type="button" className="ghost-btn" onClick={() => refs.vid.current.click()}>🎞 Video (galería)</button>
        <button type="button" className="ghost-btn" onClick={() => refs.rec.current.click()}>🎥 Grabar video</button>
      </div>

      <div className="quality-row">
        <span className="quality-lbl">Calidad de video</span>
        <div className="quality-seg" role="group" aria-label="Calidad de video">
          {Object.entries(QUALITIES).map(([k, q]) => (
            <button type="button" key={k} className={quality === k ? 'sel' : ''} onClick={() => pickQuality(k)}>{q.label}</button>
          ))}
        </div>
      </div>
      <p className="hint">{QUALITIES[quality].hint}. {hint || `Máximo ${MAX_VIDEO_MB} MB por video. Podés seguir trabajando mientras sube.`}</p>

      {mine.map(j => <JobRow key={j.id} j={j} />)}

      {items.length > 0 && (
        <div className="media-grid">
          {items.map((m, k) => (
            <div className="media-item" key={m.id}>
              <button type="button" className="media-thumb" onClick={() => setView(k)} aria-label="Ver">
                {m.url?.startsWith('data:') && m.tipo !== 'video'
                  ? <img src={m.url} alt="" />
                  : <img src={thumbSrc(m)} alt="" loading="lazy" />}
                {m.tipo === 'video' && <span className="media-play">▶</span>}
              </button>
              {isLocalMedia(m) && <span className="media-local" title="Solo en este dispositivo">📵</span>}
              <button type="button" className="media-del" onClick={() => onChange(items.filter(x => x.id !== m.id))} aria-label="Quitar">✕</button>
            </div>
          ))}
        </div>
      )}
      {view !== null && <MediaViewer items={items} start={view} onClose={() => setView(null)} />}
    </div>
  );
}
