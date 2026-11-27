import { useEffect, useState } from 'react';
import { imageSrc, videoSrc } from '../utils/cloudinary';
import VideoPlayer from './VideoPlayer';

// Visor a pantalla completa de fotos y videos
export default function MediaViewer({ items, start = 0, onClose }) {
  const [i, setI] = useState(Math.min(start, items.length - 1));
  const m = items[i];

  useEffect(() => {
    const h = e => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI(x => Math.min(items.length - 1, x + 1));
      if (e.key === 'ArrowLeft') setI(x => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [items.length, onClose]);

  if (!m) return null;
  const src = m.url?.startsWith('data:') ? m.url : null;
  return (
    <div className="viewer" onClick={onClose}>
      <button className="viewer-close" onClick={onClose} aria-label="Cerrar">✕</button>
      <div className="viewer-body" onClick={e => e.stopPropagation()}>
        {m.tipo === 'video'
          ? <VideoPlayer key={m.id} src={src || videoSrc(m)} />
          : <img key={m.id} src={src || imageSrc(m)} alt="Referencia" />}
      </div>
      {items.length > 1 && (
        <div className="viewer-nav" onClick={e => e.stopPropagation()}>
          <button disabled={i === 0} onClick={() => setI(i - 1)}>‹</button>
          <span>{i + 1} / {items.length}</span>
          <button disabled={i === items.length - 1} onClick={() => setI(i + 1)}>›</button>
        </div>
      )}
    </div>
  );
}
