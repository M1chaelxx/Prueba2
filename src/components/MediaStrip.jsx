import { useState } from 'react';
import MediaViewer from './MediaViewer';
import { thumbSrc } from '../utils/cloudinary';

// Fotos y videos en solo lectura (Resultados y estudios guardados)
export default function MediaStrip({ items }) {
  const [view, setView] = useState(null);
  if (!items?.length) return null;
  return (
    <div className="media-strip">
      <span className="media-strip-lbl">📎 Fotos y videos del puesto ({items.length})</span>
      <div className="media-grid">
        {items.map((m, k) => (
          <button type="button" className="media-thumb media-thumb-sq" key={m.id} onClick={() => setView(k)} aria-label={m.tipo === 'video' ? 'Ver video' : 'Ver foto'}>
            <img src={m.url?.startsWith('data:') ? m.url : thumbSrc(m)} alt="" loading="lazy" />
            {m.tipo === 'video' && <span className="media-play">▶</span>}
          </button>
        ))}
      </div>
      {view !== null && <MediaViewer items={items} start={view} onClose={() => setView(null)} />}
    </div>
  );
}
