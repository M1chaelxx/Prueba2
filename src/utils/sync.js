import {
  collection, doc, setDoc, deleteDoc, getDoc, updateDoc,
  onSnapshot, query, orderBy, limit,
} from 'firebase/firestore';
import { db, firebaseReady } from '../firebase';
import { cloudOnly } from './cloudinary';

const COL = 'toma-tiempos';
const TEMPLATES_COL = 'puesto-templates';

const stripImages = study => ({
  ...study,
  puestos: (study.puestos || []).map(p => ({ ...p, imagen: null, media: cloudOnly(p.media) })),
});

// Returns unsubscribe function, or null if Firebase not available
export function subscribeStudies(onChange, onError) {
  if (!firebaseReady) { onError?.(new Error('firebase-not-configured')); return null; }
  const q = query(collection(db, COL), orderBy('timestamp', 'desc'), limit(50));
  return onSnapshot(q,
    snap => onChange(snap.docs.map(d => ({ ...d.data(), _docId: d.id }))),
    err => { console.warn('Firestore sync error:', err); onError?.(err); }
  );
}

// ── Respaldo local (cuando no hay Firebase) ──
const LS_STUDIES = 'saved-studies';
const LS_TPL = 'puesto-templates';
const readLS = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* cuota llena */ } };

export async function saveStudy(entry) {
  if (!firebaseReady) {
    const list = readLS(LS_STUDIES, []).filter(e => e.id !== entry.id);
    writeLS(LS_STUDIES, [{ ...entry, study: stripImages(entry.study) }, ...list].slice(0, 50));
    return;
  }
  const toSave = { ...entry, study: stripImages(entry.study) };
  await setDoc(doc(db, COL, String(entry.id)), toSave);
}

export async function deleteStudy(id) {
  if (!firebaseReady) {
    writeLS(LS_STUDIES, readLS(LS_STUDIES, []).filter(e => e.id !== id));
    return;
  }
  await deleteDoc(doc(db, COL, String(id)));
}

// Plantillas de puestos
export async function savePuestoTemplate(modelo, nombre, puestosRaw) {
  // Sin fotos en base64 (el límite de Firestore es 1 MB por documento); solo links a la nube
  const puestos = (puestosRaw || []).map(p => ({ ...p, imagen: null, media: cloudOnly(p.media) }));
  if (!firebaseReady) {
    const all = readLS(LS_TPL, {});
    all[modelo] = [...(all[modelo] || []).filter(t => t.nombre !== nombre), { nombre, puestos, timestamp: Date.now() }];
    writeLS(LS_TPL, all);
    return;
  }
  const docRef = doc(db, TEMPLATES_COL, modelo);
  const docSnap = await getDoc(docRef);
  const current = docSnap.exists() ? docSnap.data().templates || [] : [];
  const updated = [...current.filter(t => t.nombre !== nombre), { nombre, puestos, timestamp: Date.now() }];
  await setDoc(docRef, { templates: updated }, { merge: true });
}

export async function loadPuestosTemplates(modelo) {
  if (!firebaseReady) return readLS(LS_TPL, {})[modelo] || [];
  const docRef = doc(db, TEMPLATES_COL, modelo);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? (docSnap.data().templates || []) : [];
}

export async function deletePuestoTemplate(modelo, nombre) {
  if (!firebaseReady) {
    const all = readLS(LS_TPL, {});
    all[modelo] = (all[modelo] || []).filter(t => t.nombre !== nombre);
    writeLS(LS_TPL, all);
    return;
  }
  const docRef = doc(db, TEMPLATES_COL, modelo);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const updated = (docSnap.data().templates || []).filter(t => t.nombre !== nombre);
    await setDoc(docRef, { templates: updated }, { merge: true });
  }
}
