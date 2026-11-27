import { genId } from './id';
import { compressVideo, canCompressVideo, COMPRESS_MIN_MB } from './videoCompress';

// Cloud name y preset "unsigned" son datos públicos (no hay claves secretas en la app).
export const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD || 'vgia9y4h';
export const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_PRESET || 'toma-tiempo';
export const MAX_VIDEO_MB = 100;
export const MAX_IMAGE_MB = 10;

const isCloud = url => typeof url === 'string' && url.includes('res.cloudinary.com');
export const isLocalMedia = m => !m?.url || m.url.startsWith('data:') || m.url.startsWith('blob:');

// Reduce fotos de celular antes de subir (más rápido y no se pasa del límite del plan gratuito)
export function resizeImage(file, max = 1800, quality = 0.85) {
  return new Promise(resolve => {
    if (!file.type.startsWith('image/') || file.type === 'image/gif') return resolve(file);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => resolve(b || file), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); }; // p. ej. HEIC: se sube tal cual
    img.src = url;
  });
}

export const blobToDataUrl = blob => new Promise((res, rej) => {
  const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob);
});

// Inserta transformaciones en la URL de entrega de Cloudinary
function withTransform(url, t) {
  return isCloud(url) ? url.replace('/upload/', `/upload/${t}/`) : url;
}
export const imageSrc = (m, w = 1400) => withTransform(m.url, `f_auto,q_auto,w_${w},c_limit`);
export const videoSrc = m => withTransform(m.url, 'f_auto,q_auto');
export const thumbSrc = m => {
  if (m.tipo === 'video') return withTransform(m.url, 'so_0,w_360,h_360,c_fill,f_jpg,q_auto').replace(/\.[a-z0-9]+(\?.*)?$/i, '.jpg');
  return withTransform(m.url, 'f_auto,q_auto,w_360,h_360,c_fill');
};

// Sube un archivo (foto o video). Devuelve un item de media listo para guardar.
export function uploadMedia(file, onProgress, onStage) {
  const isVideo = file.type.startsWith('video/');
  const limit = (isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB) * 1024 * 1024;
  return (async () => {
    let body;
    if (isVideo) {
      body = file;
      // Comprime en el dispositivo (más liviano y más rápido de subir). Si no se puede, sube el original.
      if (canCompressVideo() && file.size > COMPRESS_MIN_MB * 1048576) {
        try {
          onStage?.('compress');
          const small = await compressVideo(file, p => onProgress?.(p));
          if (small.size < file.size) body = small;
        } catch (err) { console.warn('Compresión de video no disponible:', err); }
        onStage?.('upload');
      }
    } else body = await resizeImage(file);
    if (body.size > limit) {
      const tip = isVideo ? ' Grabá en 720p o un clip más corto.' : '';
      throw new Error(`El archivo pesa ${(body.size / 1048576).toFixed(0)} MB y el máximo es ${isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB} MB.${tip}`);
    }
    return sendToCloudinary(body, file, isVideo, onProgress);
  })();
}

/* ───────── Transporte: por partes + reintentos ───────── */
const ENDPOINT = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;
const CHUNK = 5 * 1024 * 1024;
const wait = ms => new Promise(r => setTimeout(r, ms));

class NetworkError extends Error {}

// Un POST. Rechaza con NetworkError si no hubo respuesta (corte, bloqueo, timeout).
function post(blob, name, headers, onBytes) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append('file', blob, name);
    fd.append('upload_preset', UPLOAD_PRESET);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', ENDPOINT);
    xhr.timeout = 180000;
    Object.entries(headers || {}).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = e => { if (e.lengthComputable) onBytes?.(e.loaded); };
    xhr.onerror = () => reject(new NetworkError('sin respuesta'));
    xhr.ontimeout = () => reject(new NetworkError('tiempo agotado'));
    xhr.onload = () => {
      let j = {};
      try { j = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      resolve({ status: xhr.status, json: j });
    };
    xhr.send(fd);
  });
}

async function withRetry(fn, tries = 4) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await fn(i); } catch (e) {
      last = e;
      if (!(e instanceof NetworkError)) throw e; // errores de Cloudinary (4xx) no se reintentan
      await wait(1000 * (i + 1));
    }
  }
  throw last;
}

function toItem(j, file) {
  return { id: genId(), tipo: j.resource_type === 'video' ? 'video' : 'image', url: j.secure_url, publicId: j.public_id, bytes: j.bytes, nombre: file.name || '' };
}
function apiError(r) { return new Error(r.json?.error?.message || `Cloudinary rechazó el archivo (código ${r.status}).`); }

async function sendToCloudinary(body, file, isVideo, onProgress) {
  const name = body.name || file.name || (isVideo ? 'video.mp4' : 'foto.jpg');
  const total = body.size;
  const mb = (total / 1048576).toFixed(1);

  // Archivos chicos: un solo envío (con reintentos)
  const single = async () => {
    const r = await withRetry(() => post(body, name, null, loaded => onProgress?.(Math.round((loaded / total) * 100))));
    if (r.status >= 200 && r.status < 300 && r.json.secure_url) return toItem(r.json, file);
    throw apiError(r);
  };

  try {
    if (total <= CHUNK * 1.2) return await single();

    // Archivos grandes: por partes (si se corta la conexión, solo se repite la parte, no todo)
    const uid = genId() + genId() + Date.now();
    let sent = 0, last = null;
    for (let start = 0; start < total; start += CHUNK) {
      const end = Math.min(start + CHUNK, total);
      const part = body.slice(start, end);
      const headers = { 'X-Unique-Upload-Id': uid, 'Content-Range': `bytes ${start}-${end - 1}/${total}` };
      const r = await withRetry(() => post(part, name, headers, loaded => onProgress?.(Math.round(((sent + loaded) / total) * 100))));
      if (r.status < 200 || r.status >= 300) throw apiError(r);
      sent = end; last = r.json;
      onProgress?.(Math.round((sent / total) * 100));
    }
    if (last?.secure_url) return toItem(last, file);
    throw new Error('Cloudinary no devolvió el archivo al terminar la subida.');
  } catch (e) {
    if (!(e instanceof NetworkError)) throw e;
    // Último recurso: un solo envío, por si la subida por partes está bloqueada en esa red
    if (total > CHUNK * 1.2) {
      try { return await single(); } catch (e2) { if (!(e2 instanceof NetworkError)) throw e2; }
    }
    const online = typeof navigator !== 'undefined' && navigator.onLine === false;
    throw new Error(online
      ? 'El dispositivo no tiene internet. Conectate y volvé a intentar.'
      : `No se pudo conectar con Cloudinary tras varios intentos (archivo de ${mb} MB). Probá con otra red (datos móviles o Wi-Fi distinto): algunas redes de empresa bloquean api.cloudinary.com.`);
  }
}

// Fotos/videos de un puesto (incluye la foto "vieja" guardada como imagen base64)
export function getMedia(puesto) {
  return [...(puesto?.imagen ? [{ id: 'legacy', tipo: 'image', url: puesto.imagen }] : []), ...(puesto?.media || [])];
}
export const cloudOnly = list => (list || []).filter(m => m?.url && !m.url.startsWith('data:') && !m.url.startsWith('blob:'));
