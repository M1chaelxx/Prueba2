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
    return new Promise((resolve, reject) => {
      const fd = new FormData();
      fd.append('file', body, body.name || file.name || (isVideo ? 'video.mp4' : 'foto.jpg'));
      fd.append('upload_preset', UPLOAD_PRESET);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`);
      xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100)); };
      xhr.onerror = () => reject(new Error('Sin conexión con el servidor de archivos.'));
      xhr.onload = () => {
        let j = {};
        try { j = JSON.parse(xhr.responseText); } catch { /* ignore */ }
        if (xhr.status >= 200 && xhr.status < 300 && j.secure_url) {
          resolve({ id: genId(), tipo: j.resource_type === 'video' ? 'video' : 'image', url: j.secure_url, publicId: j.public_id, bytes: j.bytes, nombre: file.name || '' });
        } else reject(new Error(j.error?.message || `Error al subir (${xhr.status}).`));
      };
      xhr.send(fd);
    });
  })();
}

// Fotos/videos de un puesto (incluye la foto "vieja" guardada como imagen base64)
export function getMedia(puesto) {
  return [...(puesto?.imagen ? [{ id: 'legacy', tipo: 'image', url: puesto.imagen }] : []), ...(puesto?.media || [])];
}
export const cloudOnly = list => (list || []).filter(m => m?.url && !m.url.startsWith('data:') && !m.url.startsWith('blob:'));
