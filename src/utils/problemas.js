import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, firebaseReady } from '../firebase';
import { genId } from './id';
import { cloudOnly } from './cloudinary';

const COL = 'problemas';
const LS = 'problemas-local';
const listeners = new Set();

const readLS = () => { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch { return []; } };
const writeLS = list => {
  try { localStorage.setItem(LS, JSON.stringify(list)); } catch { /* cuota llena */ }
  listeners.forEach(fn => fn());
};
const clean = o => JSON.parse(JSON.stringify(o)); // Firestore no admite undefined

export const ESTADOS = [
  { id: 'abierto', label: 'Abierto', color: '#dc2626' },
  { id: 'analisis', label: 'En análisis', color: '#d97706' },
  { id: 'accion', label: 'En acción', color: '#2563eb' },
  { id: 'cerrado', label: 'Cerrado', color: '#16a34a' },
];
export const TIPOS = ['Calidad', 'Seguridad', 'Producción', 'Mantenimiento', 'Material', 'Otro'];
export const SEVERIDADES = ['Baja', 'Media', 'Alta', 'Crítica'];
export const CATEGORIAS_6M = ['Mano de obra', 'Máquina', 'Método', 'Material', 'Medición', 'Medio ambiente'];

export const ESNO_DIM = [
  { id: 'que', label: 'QUÉ', ph: 'Qué producto/defecto' },
  { id: 'donde', label: 'DÓNDE', ph: 'Dónde ocurre (puesto, zona, pieza)' },
  { id: 'cuando', label: 'CUÁNDO', ph: 'Cuándo (turno, lote, hora)' },
  { id: 'cuanto', label: 'CUÁNTO', ph: 'Cuántas piezas / frecuencia' },
];

// Completa campos nuevos en problemas guardados antes de que existieran
export function withDefaults(p) {
  const d = newProblema();
  return { ...d, ...p, w2h: { ...d.w2h, ...p.w2h }, d8: { ...d.d8, ...p.d8 }, esno: { ...d.esno, ...p.esno }, ishikawa: { ...d.ishikawa, ...p.ishikawa }, pareto: p.pareto || [], media: p.media || [] };
}

export function newProblema(base = {}) {
  const now = Date.now();
  return {
    id: genId() + genId(),
    titulo: '', descripcion: '', contencion: '',
    estado: 'abierto', tipo: 'Calidad', severidad: 'Media',
    modelo: '', capacidad: '', linea: '', puesto: '',
    cantidad: '', detectadoEn: '',
    creador: '', responsable: '',
    medicion: null,
    porques: [''], causaRaiz: '',
    ishikawa: Object.fromEntries(CATEGORIAS_6M.map(c => [c, []])),
    pareto: [],
    media: [],
    w2h: { que: '', porque: '', donde: '', cuando: '', quien: '', como: '', cuanto: '' },
    esno: Object.fromEntries(ESNO_DIM.map(d => [d.id, { es: '', no: '' }])),
    d8: { d1: '', escape: '', d5: '', d6: '', d7: '', d8: '' },
    acciones: [], comentarios: [],
    creado: now, actualizado: now,
    ...base,
  };
}

export function subscribeProblemas(cb, onErr) {
  if (!firebaseReady) {
    const emit = () => cb(readLS().sort((a, b) => b.actualizado - a.actualizado));
    listeners.add(emit); emit();
    return () => listeners.delete(emit);
  }
  const q = query(collection(db, COL), orderBy('actualizado', 'desc'));
  return onSnapshot(q, snap => cb(snap.docs.map(d => d.data())), err => { console.warn('Problemas sync error:', err); onErr?.(err); });
}

export async function saveProblema(p) {
  if (!firebaseReady) {
    const data = clean({ ...p, actualizado: Date.now() }); writeLS([data, ...readLS().filter(x => x.id !== p.id)]); return; }
  // En la nube solo viajan links (las fotos guardadas solo en el dispositivo no se sincronizan)
  await setDoc(doc(db, COL, p.id), clean({ ...p, media: cloudOnly(p.media), actualizado: Date.now() }));
}

export async function deleteProblema(id) {
  if (!firebaseReady) { writeLS(readLS().filter(x => x.id !== id)); return; }
  await deleteDoc(doc(db, COL, id));
}

// Los comentarios se agregan de forma atómica: dos personas comentando a la vez no se pisan.
export async function addComentario(id, autor, texto) {
  const c = { id: genId(), autor, texto, ts: Date.now() };
  if (!firebaseReady) {
    writeLS(readLS().map(x => (x.id === id ? { ...x, comentarios: [...(x.comentarios || []), c], actualizado: Date.now() } : x)));
    return;
  }
  await updateDoc(doc(db, COL, id), { comentarios: arrayUnion(c), actualizado: Date.now() });
}

// Agrega un archivo ya subido a un problema guardado (cuando la subida termina con la pantalla cerrada)
export async function addMediaToProblema(id, item) {
  if (!firebaseReady) {
    const list = readLS();
    if (!list.some(x => x.id === id)) return false;
    writeLS(list.map(x => (x.id === id ? { ...x, media: [...(x.media || []), item], actualizado: Date.now() } : x)));
    return true;
  }
  try { await updateDoc(doc(db, COL, id), { media: arrayUnion(clean(item)), actualizado: Date.now() }); return true; } catch { return false; }
}
