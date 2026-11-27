import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, firebaseReady } from '../firebase';
import { genId } from './id';

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
  const data = clean({ ...p, actualizado: Date.now() });
  if (!firebaseReady) { writeLS([data, ...readLS().filter(x => x.id !== p.id)]); return; }
  await setDoc(doc(db, COL, p.id), data);
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
