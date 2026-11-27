import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fmtTimer, fmtDate, fmtClock } from './timer';
import { getMedia, imageSrc, blobToDataUrl } from './cloudinary';

// Descarga la primera foto de cada puesto para incluirla en el PDF (si falla, se omite)
async function loadPuestoImage(puesto) {
  const m = getMedia(puesto).find(x => x.tipo === 'image');
  if (!m) return null;
  if (m.url.startsWith('data:')) return m.url;
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
    const res = await fetch(imageSrc(m, 700).replace('f_auto', 'f_jpg'), { signal: ctl.signal }); clearTimeout(t);
    return await blobToDataUrl(await res.blob());
  } catch { return null; }
}

const NAVY = [11, 31, 74], BLUE = [37, 99, 235], LBLUE = [227, 237, 255], LIGHT = [243, 246, 251];
const GREEN = [22, 163, 74], RED = [220, 38, 38], GRAY = [100, 116, 139], AMBER = [217, 119, 6];
const M = 14, PW = 210, PH = 297;
const clip = (t, n) => (t && t.length > n ? `${t.slice(0, n - 1)}…` : t || '');

export async function exportEstudioPdf({ study, rows, totals, meds, normTakes, now }) {
  const imgs = await Promise.all(rows.map(r => loadPuestoImage(r.puesto)));
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const taktTime = study.taktTime || null;
  const modelo = `${study.modelo} ${study.capacidad}`;
  const pLabel = r => `P${String(r.num).padStart(2, '0')}`;
  const estadoOf = r => {
    if (!r.done) return { t: 'Sin medir', c: GRAY };
    if (!taktTime) return { t: 'Medido', c: BLUE };
    return r.realTot > taktTime ? { t: 'Cuello de botella', c: RED } : { t: 'OK', c: GREEN };
  };
  let y = 0;

  const text = (t, x, yy, o = {}) => {
    doc.setFont('helvetica', o.bold ? 'bold' : o.italic ? 'italic' : 'normal');
    doc.setFontSize(o.size || 9); doc.setTextColor(...(o.color || [30, 30, 30]));
    doc.text(t, x, yy, o.opts);
  };
  const ensure = h => { if (y + h > PH - 16) { doc.addPage(); y = M; } };
  const afterTable = (gap = 6) => { y = doc.lastAutoTable.finalY + gap; };

  /* ── Portada / encabezado ── */
  doc.setFillColor(...NAVY); doc.rect(0, 0, PW, 34, 'F');
  doc.setFillColor(...BLUE); doc.rect(0, 34, PW, 3, 'F');
  text('ESTUDIO DE TIEMPOS EN LÍNEA', M, 14, { bold: true, size: 17, color: [255, 255, 255] });
  text(`${modelo}  ·  Línea ${study.linea}`, M, 23, { size: 11, color: [182, 201, 238] });
  text(`Analista: ${study.analista}`, M, 30, { size: 9, color: [182, 201, 238] });
  text(`${fmtDate(now)}  ${fmtClock(now)}`, PW - M, 30, { size: 9, color: [182, 201, 238], opts: { align: 'right' } });
  y = 46;

  /* ── Indicadores ── */
  const cards = [
    ['MEDIDAS', `${totals.done}/${totals.total}`, NAVY],
    ['T REAL PROM TOTAL', `${totals.real.toFixed(1)} s`, NAVY],
    ['T NORMAL PROM TOTAL', `${totals.norm.toFixed(1)} s`, NAVY],
    ['TAKT TIME', taktTime ? `${taktTime} s` : '—', taktTime ? BLUE : GRAY],
  ];
  const cw = (PW - 2 * M - 3 * 4) / 4;
  cards.forEach(([l, v, c], i) => {
    const x = M + i * (cw + 4);
    doc.setFillColor(...LBLUE); doc.setDrawColor(213, 221, 234); doc.roundedRect(x, y, cw, 22, 3, 3, 'FD');
    text(l, x + cw / 2, y + 7, { bold: true, size: 7, color: GRAY, opts: { align: 'center' } });
    text(v, x + cw / 2, y + 16.5, { bold: true, size: 15, color: c, opts: { align: 'center' } });
  });
  y += 30;

  /* ── Gráfico T Real vs Takt ── */
  if (rows.length) {
    const h = 52, x0 = M + 8, wC = PW - 2 * M - 10;
    text('T Real por puesto vs Takt Time', M, y, { bold: true, size: 10, color: NAVY }); y += 3;
    const base = y + h, top = y + 4;
    const max = Math.max(...rows.map(r => r.realTot), taktTime || 0, 1);
    const sc = (base - top - 4) / max;
    doc.setDrawColor(200, 208, 220); doc.setLineWidth(0.3); doc.line(x0, base, x0 + wC, base); doc.line(x0, top, x0, base);
    const bw = wC / rows.length;
    rows.forEach((r, i) => {
      const bh = Math.max(0.6, r.realTot * sc), bx = x0 + i * bw + bw * 0.2, bwid = bw * 0.6;
      const over = taktTime && r.realTot > taktTime;
      doc.setFillColor(...(!r.realTot ? [210, 215, 225] : over ? RED : GREEN)); doc.roundedRect(bx, base - bh, bwid, bh, 0.8, 0.8, 'F');
      if (r.realTot) text(`${r.realTot.toFixed(1)}`, bx + bwid / 2, base - bh - 1.5, { bold: true, size: 7.5, opts: { align: 'center' } });
      text(pLabel(r), bx + bwid / 2, base + 4, { size: 7.5, color: GRAY, opts: { align: 'center' } });
    });
    if (taktTime) {
      const ty = base - taktTime * sc;
      doc.setDrawColor(...BLUE); doc.setLineWidth(0.6); doc.setLineDashPattern([2, 1.5], 0); doc.line(x0, ty, x0 + wC, ty); doc.setLineDashPattern([], 0);
      text(`Takt ${taktTime}s`, x0 + wC, ty - 1.5, { bold: true, size: 7.5, color: BLUE, opts: { align: 'right' } });
    }
    y = base + 11;
  }

  /* ── Resumen por puesto ── */
  text('Resumen por puesto', M, y, { bold: true, size: 10, color: NAVY }); y += 3;
  autoTable(doc, {
    startY: y, margin: { left: M, right: M }, theme: 'grid',
    head: [['Puesto', 'Operario', 'Modo', 'T Real (s)', 'T Normal (s)', '% Takt', 'Estado']],
    body: rows.map(r => [`${pLabel(r)} ${r.puesto.nombre}`, r.puesto.operario || '—', r.pModo === 'puesto' ? 'Por puesto' : 'Por elemento',
      r.realTot ? r.realTot.toFixed(2) : '—', r.tNormTot ? r.tNormTot.toFixed(2) : '—',
      taktTime && r.realTot ? `${Math.round((r.realTot / taktTime) * 100)}%` : '—', estadoOf(r).t]),
    foot: [['TOTAL', '', '', totals.real.toFixed(2), totals.norm.toFixed(2), '', '']],
    styles: { fontSize: 8.5, cellPadding: 2.2, lineColor: [213, 221, 234] },
    headStyles: { fillColor: BLUE, halign: 'center' }, footStyles: { fillColor: LBLUE, textColor: NAVY, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: { 3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'center' }, 6: { halign: 'center', fontStyle: 'bold' }, 2: { halign: 'center' } },
    didParseCell: d => {
      if (d.section === 'body' && d.column.index === 6) d.cell.styles.textColor = estadoOf(rows[d.row.index]).c;
      if (d.section === 'body' && d.column.index === 5 && taktTime && rows[d.row.index].realTot) d.cell.styles.textColor = rows[d.row.index].realTot > taktTime ? RED : GREEN;
    },
  });
  afterTable(8);

  /* ── Detalle por puesto ── */
  rows.forEach(r => {
    const est = estadoOf(r);
    ensure(40);
    doc.setFillColor(...BLUE); doc.roundedRect(M, y, PW - 2 * M, 9, 2, 2, 'F');
    text(`${pLabel(r)} · ${r.puesto.nombre}${r.puesto.operario ? `   Operario: ${r.puesto.operario}` : ''}`, M + 4, y + 6, { bold: true, size: 10.5, color: [255, 255, 255] });
    doc.setFillColor(255, 255, 255); doc.roundedRect(PW - M - 36, y + 1.6, 34, 5.8, 2.5, 2.5, 'F');
    text(est.t, PW - M - 19, y + 5.6, { bold: true, size: 7.5, color: est.c, opts: { align: 'center' } });
    y += 12;

    // Imagen de referencia (si el puesto la tiene)
    let imgW = 0;
    const imgData = imgs[rows.indexOf(r)];
    if (imgData) {
      try {
        const fmt = /^data:image\/png/.test(imgData) ? 'PNG' : 'JPEG';
        const p = doc.getImageProperties(imgData);
        const mw = 42, mh = 32, k = Math.min(mw / p.width, mh / p.height);
        imgW = p.width * k + 4;
        doc.addImage(imgData, fmt, PW - M - p.width * k, y, p.width * k, p.height * k);
        doc.setDrawColor(213, 221, 234); doc.rect(PW - M - p.width * k, y, p.width * k, p.height * k);
        r._imgH = p.height * k;
      } catch { imgW = 0; r._imgH = 0; }
    }
    const tblRight = M + (imgW ? imgW + 0 : 0);

    if (r.pModo === 'puesto') {
      autoTable(doc, {
        startY: y, margin: { left: M, right: M + (imgW || 0) }, theme: 'grid',
        head: [['Toma', 'MM:SS:CC', 'T Real (s)', 'Valoración', 'T Normal (s)']],
        body: r.pTakes.length ? r.pTakes.map((t, i) => [i + 1, fmtTimer(t.ms), (t.ms / 1000).toFixed(2), `${t.val}%`, ((t.ms / 1000) * (t.val / 100)).toFixed(2)]) : [['Sin tomas registradas', '', '', '', '']],
        foot: r.pTakes.length ? [['Promedio', '', r.realTot.toFixed(2), '', r.tNormTot.toFixed(2)]] : undefined,
        styles: { fontSize: 8.5, cellPadding: 2, halign: 'center', lineColor: [213, 221, 234] }, headStyles: { fillColor: GRAY },
        footStyles: { fillColor: LBLUE, textColor: NAVY, fontStyle: 'bold' }, alternateRowStyles: { fillColor: LIGHT },
      });
    } else {
      const pm = meds[r.puesto.id] || {};
      autoTable(doc, {
        startY: y, margin: { left: M, right: M + (imgW || 0) }, theme: 'grid',
        head: [['#', 'Acción', 'T Real (s)', 'T Norm (s)', 'MM:SS:CC', 'Tomas']],
        body: r.acciones.map(a => [a.idx, a.desc || '(sin descripción)', a.realS != null ? a.realS.toFixed(2) : '—', a.tNorm != null ? a.tNorm.toFixed(2) : '—', a.avgMs != null ? fmtTimer(a.avgMs) : '—',
          normTakes(pm[a.id]).length ? normTakes(pm[a.id]).map(t => (t.ms / 1000).toFixed(1)).join(' · ') : '—']),
        foot: [['', 'TOTAL DEL PUESTO', r.realTot.toFixed(2), r.tNormTot.toFixed(2), '', '']],
        styles: { fontSize: 8, cellPadding: 2, lineColor: [213, 221, 234] }, headStyles: { fillColor: GRAY, halign: 'center' },
        footStyles: { fillColor: LBLUE, textColor: NAVY, fontStyle: 'bold' }, alternateRowStyles: { fillColor: LIGHT },
        columnStyles: { 0: { cellWidth: 8, halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' }, 5: { cellWidth: 38, halign: 'center', fontSize: 7.5 } },
      });
    }
    y = Math.max(doc.lastAutoTable.finalY, r._imgH ? y + r._imgH : 0) + 4;
    void tblRight;

    if (r.comment) {
      const lines = doc.splitTextToSize(r.comment, PW - 2 * M - 10);
      const bh = lines.length * 4.2 + 8; ensure(bh + 4);
      doc.setFillColor(254, 249, 235); doc.setDrawColor(240, 220, 160); doc.roundedRect(M, y, PW - 2 * M, bh, 2, 2, 'FD');
      text('COMENTARIO', M + 4, y + 4.6, { bold: true, size: 7, color: AMBER });
      text(lines, M + 4, y + 9, { size: 8.5 });
      y += bh + 4;
    }
    y += 4;
  });

  /* ── Pie de página ── */
  const n = doc.internal.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(213, 221, 234); doc.setLineWidth(0.2); doc.line(M, PH - 11, PW - M, PH - 11);
    text(`Estudio de tiempos · ${modelo} · Línea ${study.linea}`, M, PH - 6.5, { size: 7.5, color: GRAY });
    text(`Página ${i} de ${n}`, PW - M, PH - 6.5, { size: 7.5, color: GRAY, opts: { align: 'right' } });
  }

  doc.save(`toma-tiempos-${study.modelo}-${study.capacidad}-${study.linea}-${now.toISOString().slice(0, 10)}.pdf`);
}
