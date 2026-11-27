// MM:SS:CC (minutos : segundos : centésimas)
export function fmtTimer(ms) {
  if (!ms || ms < 0) ms = 0;
  const cc = Math.floor(ms / 10) % 100;
  const ss = Math.floor(ms / 1000) % 60;
  const mm = Math.floor(ms / 60000);
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}:${String(cc).padStart(2, '0')}`;
}

export function fmtDate(d) {
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function fmtClock(d) {
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}
