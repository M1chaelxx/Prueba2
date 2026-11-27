// Reduce el peso de un video en el propio dispositivo antes de subirlo.
// Convierte a MP4 (o WebM si el navegador no puede) con lado mayor de 1280 px, 30 fps y ~1.8 Mbps.
// Un clip de 120 s queda en unos 25-30 MB. Si algo falla, el llamador sube el original.
// Calidades: más baja = comprime y sube más rápido, pero se ve menos nítido.
export const QUALITIES = {
  rapida: { label: 'Rápida', hint: 'Más liviano y veloz (≈15 MB por 2 min)', side: 960, video: 1_000_000, audio: 64_000 },
  normal: { label: 'Normal', hint: 'Equilibrado (≈30 MB por 2 min)', side: 1280, video: 1_800_000, audio: 96_000 },
  alta: { label: 'Alta', hint: 'Más nítido (≈55 MB por 2 min)', side: 1920, video: 3_500_000, audio: 128_000 },
};
export const DEFAULT_QUALITY = 'normal';
export const getQuality = () => { try { const q = localStorage.getItem('video-calidad'); return QUALITIES[q] ? q : DEFAULT_QUALITY; } catch { return DEFAULT_QUALITY; } };
export const setQuality = q => { try { localStorage.setItem('video-calidad', q); } catch { /* ignore */ } };
export const COMPRESS_MIN_MB = 8; // por debajo de este peso no vale la pena comprimir

export const canCompressVideo = () => typeof VideoEncoder !== 'undefined' && typeof VideoDecoder !== 'undefined';

export async function compressVideo(file, onProgress, quality = DEFAULT_QUALITY, signal) {
  const Q = QUALITIES[quality] || QUALITIES[DEFAULT_QUALITY];
  if (!canCompressVideo()) throw new Error('El navegador no permite comprimir video.');
  const mb = await import('mediabunny');
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();
  if (!track) throw new Error('El archivo no tiene video.');

  const w = track.displayWidth, h = track.displayHeight;
  const k = Math.min(1, Q.side / Math.max(w, h));
  const even = n => Math.max(2, Math.round(n / 2) * 2);
  const opts = { video: { width: even(w * k), frameRate: 30, bitrate: Q.video }, audio: { bitrate: Q.audio } };

  const attempt = async format => {
    const output = new mb.Output({ format, target: new mb.BufferTarget() });
    const conv = await mb.Conversion.init({ input, output, ...opts, showWarnings: false });
    if (!conv.isValid) return null;
    conv.onProgress = p => onProgress?.(Math.min(100, Math.round(p * 100)));
    const onAbort = () => conv.cancel();
    signal?.addEventListener('abort', onAbort);
    try { await conv.execute(); } finally { signal?.removeEventListener('abort', onAbort); }
    if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
    return output.target.buffer;
  };

  let buf = null, type = 'video/mp4', ext = 'mp4';
  try { buf = await attempt(new mb.Mp4OutputFormat()); } catch { buf = null; }
  if (!buf) { buf = await attempt(new mb.WebMOutputFormat()); type = 'video/webm'; ext = 'webm'; }
  if (!buf) throw new Error('No se pudo convertir el video en este dispositivo.');

  const name = (file.name || 'video').replace(/\.[^.]+$/, '') + '.' + ext;
  return new File([buf], name, { type });
}
