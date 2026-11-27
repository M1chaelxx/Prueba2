// Reduce el peso de un video en el propio dispositivo antes de subirlo.
// Convierte a MP4 (o WebM si el navegador no puede) con lado mayor de 1280 px, 30 fps y ~1.8 Mbps.
// Un clip de 120 s queda en unos 25-30 MB. Si algo falla, el llamador sube el original.
const LONG_SIDE = 1280;
const VIDEO_BPS = 1_800_000;
const AUDIO_BPS = 96_000;
export const COMPRESS_MIN_MB = 8; // por debajo de este peso no vale la pena comprimir

export const canCompressVideo = () => typeof VideoEncoder !== 'undefined' && typeof VideoDecoder !== 'undefined';

export async function compressVideo(file, onProgress) {
  if (!canCompressVideo()) throw new Error('El navegador no permite comprimir video.');
  const mb = await import('mediabunny');
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();
  if (!track) throw new Error('El archivo no tiene video.');

  const w = track.displayWidth, h = track.displayHeight;
  const k = Math.min(1, LONG_SIDE / Math.max(w, h));
  const even = n => Math.max(2, Math.round(n / 2) * 2);
  const opts = { video: { width: even(w * k), frameRate: 30, bitrate: VIDEO_BPS }, audio: { bitrate: AUDIO_BPS } };

  const attempt = async format => {
    const output = new mb.Output({ format, target: new mb.BufferTarget() });
    const conv = await mb.Conversion.init({ input, output, ...opts, showWarnings: false });
    if (!conv.isValid) return null;
    conv.onProgress = p => onProgress?.(Math.min(100, Math.round(p * 100)));
    await conv.execute();
    return output.target.buffer;
  };

  let buf = null, type = 'video/mp4', ext = 'mp4';
  try { buf = await attempt(new mb.Mp4OutputFormat()); } catch { buf = null; }
  if (!buf) { buf = await attempt(new mb.WebMOutputFormat()); type = 'video/webm'; ext = 'webm'; }
  if (!buf) throw new Error('No se pudo convertir el video en este dispositivo.');

  const name = (file.name || 'video').replace(/\.[^.]+$/, '') + '.' + ext;
  return new File([buf], name, { type });
}
