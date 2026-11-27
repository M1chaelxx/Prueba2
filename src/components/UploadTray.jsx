import { useState } from 'react';
import { useUploads, isActive } from '../utils/uploadQueue';
import { JobRow } from './MediaPicker';

// Bandeja flotante: muestra las subidas en curso cuando no estás en la pantalla del puesto/problema
export default function UploadTray() {
  const { jobs, viewKeys } = useUploads();
  const [open, setOpen] = useState(false);
  const shown = jobs.filter(j => !viewKeys.includes(`${j.target.type}:${j.target.id}`));
  if (!shown.length) return null;
  const active = shown.filter(isActive);
  const bad = shown.filter(j => j.status === 'error' || j.status === 'waiting');
  const cur = active.find(j => j.status === 'compressing' || j.status === 'uploading') || active[0];
  const summary = bad.length && !cur
    ? `⚠ ${bad.length} subida${bad.length > 1 ? 's' : ''} con problemas`
    : cur ? `${cur.status === 'compressing' ? '🗜' : '⬆'} ${active.length} subida${active.length > 1 ? 's' : ''} · ${cur.pct}%` : '✓ Subidas listas';
  return (
    <div className="upload-tray">
      {open && <div className="upload-list">{shown.map(j => <JobRow key={j.id} j={j} />)}</div>}
      <button type="button" className={`upload-pill${bad.length ? ' bad' : ''}`} onClick={() => setOpen(!open)}>
        {summary} <span>{open ? '▼' : '▲'}</span>
      </button>
    </div>
  );
}
