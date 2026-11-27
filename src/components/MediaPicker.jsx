import { useRef, useState } from 'react';
import MediaViewer from './MediaViewer';
import { uploadMedia, thumbSrc, resizeImage, blobToDataUrl, isLocalMedia, MAX_VIDEO_MB } from '../utils/cloudinary';
import { genId } from '../utils/id';

// Fotos y videos de un puesto o de un problema. items = [{id, tipo, url, nombre}]
export default function MediaPicker({ items, onChange, hint }) {
  const [busy, setBusy] = useState([]); // [{id, name, pct}]
  const [error, setError] = useState('');
  const [view, setView] = useState(null);
  const refs = { gal: useRef(null), cam: useRef(null), vid: useRef(null), rec: useRef(null) };
  const itemsRef = useRef(items); itemsRef.current = items;

  const handle = async e => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    setError('');
    for (const file of files) {
      const id = genId();
      setBusy(b => [...b, { id, name: file.name || 'archivo', pct: 0, stage: 'upload' }]);
      try {
        const m = await uploadMedia(
          file,
          pct => setBusy(b => b.map(x => (x.id === id ? { ...x, pct } : x))),
          stage => setBusy(b => b.map(x => (x.id === id ? { ...x, stage, pct: 0 } : x)))
        );
        onChange([...itemsRef.current, m]); itemsRef.current = [...itemsRef.current, m];
      } catch (err) {
        if (file.type.startsWith('image/')) {
          // Sin conexión: la foto queda en este dispositivo (no se sincroniza con el equipo)
          try {
            const small = await resizeImage(file, 1400, 0.8);
            const m = { id: genId(), tipo: 'image', url: await blobToDataUrl(small), nombre: file.name || '' };
            onChange([...itemsRef.current, m]); itemsRef.current = [...itemsRef.current, m];
            setError(`No se pudo subir a la nube (${err.message}). La foto quedó solo en este dispositivo.`);
          } catch { setError(err.message); }
        } else setError(err.message);
      }
      setBusy(b => b.filter(x => x.id !== id));
    }
  };

  const remove = id => onChange(items.filter(m => m.id !== id));

  return (
    <div className="media-picker">
      <input ref={refs.gal} type="file" accept="image/*" multiple hidden onChange={handle} />
      <input ref={refs.cam} type="file" accept="image/*" capture="environment" hidden onChange={handle} />
      <input ref={refs.vid} type="file" accept="video/*" hidden onChange={handle} />
      <input ref={refs.rec} type="file" accept="video/*" capture="environment" hidden onChange={handle} />

      <div className="media-btns">
        <button type="button" className="ghost-btn" onClick={() => refs.gal.current.click()}>🖼 Foto (galería)</button>
        <button type="button" className="ghost-btn" onClick={() => refs.cam.current.click()}>📸 Sacar foto</button>
        <button type="button" className="ghost-btn" onClick={() => refs.vid.current.click()}>🎞 Video (galería)</button>
        <button type="button" className="ghost-btn" onClick={() => refs.rec.current.click()}>🎥 Grabar video</button>
      </div>
      <p className="hint">{hint || `Videos de hasta ${MAX_VIDEO_MB} MB (conviene clips cortos de 20 a 40 s).`}</p>

      {busy.map(b => (
        <div className="media-busy" key={b.id}>
          <span>{b.stage === 'compress' ? '🗜 Comprimiendo video (puede tardar un poco)…' : `⬆ Subiendo ${b.name}…`} {b.pct}%</span>
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${b.pct}%` }} /></div>
        </div>
      ))}
      {error && <p className="media-error">⚠ {error}</p>}

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
              <button type="button" className="media-del" onClick={() => remove(m.id)} aria-label="Quitar">✕</button>
            </div>
          ))}
        </div>
      )}
      {view !== null && <MediaViewer items={items} start={view} onClose={() => setView(null)} />}
    </div>
  );
}
