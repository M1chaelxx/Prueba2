import { useSyncExternalStore } from 'react';
import { uploadMedia, resizeImage, blobToDataUrl } from './cloudinary';
import { addMediaToProblema } from './problemas';
import { getQuality } from './videoCompress';
import { genId } from './id';

// Cola de subidas global: sigue trabajando aunque cambies de pantalla.
// Estados: queued · compressing · uploading · waiting (sin red, reintenta sola) · error · done
let state = { jobs: [], viewKeys: [] };
const subs = new Set();
const files = new Map();   // id -> File (para poder reintentar)
const ctls = new Map();    // id -> AbortController
const handlers = { puesto: null, problema: new Set() };
let running = false;

const keyOf = t => `${t.type}:${t.id}`;
const emit = patch => { state = { ...state, ...patch }; subs.forEach(f => f()); };
const setJobs = fn => emit({ jobs: fn(state.jobs) });
const update = (id, patch) => setJobs(js => js.map(j => (j.id === id ? { ...j, ...patch } : j)));
const remove = id => { files.delete(id); ctls.delete(id); setJobs(js => js.filter(j => j.id !== id)); };

export const subscribe = f => { subs.add(f); return () => subs.delete(f); };
export const getState = () => state;
export const useUploads = () => useSyncExternalStore(subscribe, getState);
export const isActive = j => ['queued', 'compressing', 'uploading', 'waiting'].includes(j.status);
export const hasActiveUploads = () => state.jobs.some(isActive);

// Quién muestra el detalle de un destino (si lo muestra una pantalla, la bandeja global no lo repite)
export function registerView(target) {
  const k = keyOf(target);
  emit({ viewKeys: [...state.viewKeys, k] });
  return () => { const i = state.viewKeys.indexOf(k); if (i >= 0) { const a = [...state.viewKeys]; a.splice(i, 1); emit({ viewKeys: a }); } };
}

// Quien recibe el archivo cuando termina de subir
export const setPuestoHandler = fn => { handlers.puesto = fn; };
export function addProblemaHandler(fn) { handlers.problema.add(fn); return () => handlers.problema.delete(fn); }

async function deliver(job, item) {
  if (job.target.type === 'puesto') return !!handlers.puesto?.(job.target.id, item);
  for (const h of handlers.problema) if (h(job.target.id, item)) return true;
  return addMediaToProblema(job.target.id, item); // pantalla cerrada: se agrega directo al problema guardado
}

async function run(job) {
  const file = files.get(job.id);
  const ctl = new AbortController(); ctls.set(job.id, ctl);
  update(job.id, { status: job.kind === 'video' ? 'compressing' : 'uploading', pct: 0, error: '' });
  try {
    const item = await uploadMedia(file, {
      quality: job.quality, signal: ctl.signal,
      onProgress: pct => update(job.id, { pct }),
      onStage: stage => update(job.id, { status: stage === 'compress' ? 'compressing' : 'uploading', pct: 0 }),
    });
    const ok = await deliver(job, item);
    if (ok) { update(job.id, { status: 'done', pct: 100 }); setTimeout(() => remove(job.id), 3500); }
    else update(job.id, { status: 'error', error: 'Se subió, pero no hay dónde agregarlo (¿cerraste el estudio o el problema sin guardar?).' });
  } catch (err) {
    if (err?.name === 'AbortError') { remove(job.id); return; }
    if (job.kind === 'image') {
      // Sin conexión: la foto queda solo en este dispositivo
      try {
        const small = await resizeImage(file, 1400, 0.8);
        const ok = await deliver(job, { id: genId(), tipo: 'image', url: await blobToDataUrl(small), nombre: file.name || '' });
        if (ok) { update(job.id, { status: 'done', pct: 100, warning: 'Quedó solo en este dispositivo (no se pudo subir a la nube).' }); setTimeout(() => remove(job.id), 7000); return; }
      } catch { /* sigue al error */ }
    }
    update(job.id, { status: err?.network ? 'waiting' : 'error', error: err?.message || 'No se pudo subir.' });
  } finally { ctls.delete(job.id); }
}

async function pump() {
  if (running) return;
  running = true;
  try {
    for (;;) {
      const next = state.jobs.find(j => j.status === 'queued');
      if (!next) break;
      await run(next);
    }
  } finally { running = false; }
}

export function enqueue(fileList, target, quality = getQuality()) {
  const added = [...fileList].map(file => {
    const id = genId();
    files.set(id, file);
    return { id, name: file.name || 'archivo', kind: file.type.startsWith('video/') ? 'video' : 'image', size: file.size, target, quality, status: 'queued', pct: 0, error: '', warning: '' };
  });
  setJobs(js => [...js, ...added]);
  pump();
}

export function retry(id) { update(id, { status: 'queued', error: '', pct: 0 }); pump(); }
export function cancel(id) { ctls.get(id)?.abort(); if (!ctls.has(id)) remove(id); }

if (typeof window !== 'undefined') {
  // Al volver la conexión, se reintentan solas las subidas que esperaban red
  window.addEventListener('online', () => { state.jobs.filter(j => j.status === 'waiting').forEach(j => retry(j.id)); });
  // Aviso si se intenta cerrar la página con subidas pendientes
  window.addEventListener('beforeunload', e => { if (hasActiveUploads()) { e.preventDefault(); e.returnValue = ''; } });
}
