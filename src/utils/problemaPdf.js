import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ESTADOS, CATEGORIAS_6M, ESNO_DIM } from './problemas';

const NAVY = [11, 31, 74], BLUE = [37, 99, 235], RED = [220, 38, 38], GREEN = [22, 163, 74], AMBER = [217, 119, 6], GRAY = [100, 116, 139], LIGHT = [243, 246, 251];
const M = 14;
const clip = (t, n) => (t && t.length > n ? `${t.slice(0, n - 1)}…` : t || '');
const fmtTs = ts => new Date(ts).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const TOOL_LABELS = {
  resumen: 'Resumen', esno: 'Es / No es', w2h: '5W2H', porques: '5 Porqués', ishikawa: 'Ishikawa (6M)',
  pareto: 'Pareto', d8: '8D', acciones: 'Plan de acción', comentarios: 'Seguimiento',
};

const has = {
  esno: p => ESNO_DIM.some(d => p.esno[d.id].es || p.esno[d.id].no),
  w2h: p => Object.values(p.w2h).some(Boolean),
  porques: p => p.porques.some(w => w.trim()) || p.causaRaiz,
  ishikawa: p => CATEGORIAS_6M.some(c => (p.ishikawa[c] || []).some(t => t.trim())),
  pareto: p => p.pareto.some(x => parseFloat(x.n) > 0),
  d8: p => Object.values(p.d8).some(Boolean) || p.descripcion || p.contencion || p.causaRaiz,
  acciones: p => p.acciones.length > 0,
  comentarios: p => (p.comentarios || []).length > 0,
};

export function exportProblemaPdf(p, only = null) {
  const landscapeFirst = only === 'ishikawa';
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: landscapeFirst ? 'landscape' : 'portrait' });
  const pages = [landscapeFirst ? 'l' : 'p'];
  const pw = () => (pages[pages.length - 1] === 'l' ? 297 : 210);
  const ph = () => (pages[pages.length - 1] === 'l' ? 210 : 297);
  let y = 0;

  const newPage = (orient = 'p') => {
    doc.addPage('a4', orient === 'l' ? 'landscape' : 'portrait');
    pages.push(orient); y = M;
  };
  const ensure = h => { if (y + h > ph() - 16) newPage(pages[pages.length - 1]); };
  const text = (t, x, yy, o = {}) => {
    doc.setFont('helvetica', o.bold ? 'bold' : o.italic ? 'italic' : 'normal');
    doc.setFontSize(o.size || 9); doc.setTextColor(...(o.color || [30, 30, 30]));
    doc.text(t, x, yy, o.opts);
  };
  const section = (title, color = BLUE) => {
    ensure(18);
    doc.setFillColor(...color); doc.roundedRect(M, y, pw() - 2 * M, 8, 2, 2, 'F');
    text(title, M + 4, y + 5.6, { bold: true, size: 11, color: [255, 255, 255] });
    y += 12;
  };
  const afterTable = () => { y = doc.lastAutoTable.finalY + 6; };
  const tbl = o => autoTable(doc, { startY: y, margin: { left: M, right: M }, styles: { fontSize: 9, cellPadding: 2.2, overflow: 'linebreak' }, ...o });

  // ── Encabezado ──
  const est = ESTADOS.find(e => e.id === p.estado) || ESTADOS[0];
  doc.setFillColor(...NAVY); doc.rect(0, 0, pw(), 26, 'F');
  text(only ? `${TOOL_LABELS[only]} · Análisis de problema` : 'Análisis de problema', M, 9, { bold: true, size: 10, color: [182, 201, 238] });
  text(doc.splitTextToSize(p.titulo || '(sin título)', pw() - 2 * M - 40)[0], M, 18, { bold: true, size: 15, color: [255, 255, 255] });
  doc.setFillColor(...(est.id === 'cerrado' ? GREEN : est.id === 'abierto' ? RED : est.id === 'accion' ? BLUE : AMBER));
  doc.roundedRect(pw() - M - 32, 8, 32, 9, 4, 4, 'F');
  text(est.label, pw() - M - 16, 14, { bold: true, size: 9, color: [255, 255, 255], opts: { align: 'center' } });
  y = 32;

  const meta = [
    ['Línea', [p.modelo, p.capacidad, p.linea].filter(Boolean).join(' ') || '-'], ['Puesto', p.puesto || '-'],
    ['Tipo / Severidad', `${p.tipo} / ${p.severidad}`], ['Responsable', p.responsable || '-'],
    ['Creado por', p.creador || '-'], ['Fecha', fmtTs(p.creado)],
    ['Cantidad afectada', p.cantidad || '-'], ['Detectado en', p.detectadoEn || '-'],
  ];
  const rows = [];
  for (let i = 0; i < meta.length; i += 2) rows.push([meta[i][0], meta[i][1], meta[i + 1][0], meta[i + 1][1]]);
  tbl({
    body: rows, theme: 'grid',
    columnStyles: { 0: { fontStyle: 'bold', fillColor: LIGHT, cellWidth: 32 }, 1: { cellWidth: 55 }, 2: { fontStyle: 'bold', fillColor: LIGHT, cellWidth: 32 } },
    styles: { fontSize: 8.5, cellPadding: 2, lineColor: [219, 227, 239] },
  });
  afterTable();

  // ── Resumen (descripción, contención, medición) ──
  if (!only || only === 'resumen') {
    const extra = [];
    if (p.descripcion) extra.push(['Descripción', p.descripcion]);
    if (p.contencion) extra.push(['Contención inmediata', p.contencion]);
    if (p.medicion) extra.push(['Medición de origen', `T Real ${p.medicion.tReal}s${p.medicion.takt ? ` · Takt Time ${p.medicion.takt}s` : ''}${p.medicion.estudio ? ` · ${p.medicion.estudio}` : ''}`]);
    if (extra.length) {
      section('Resumen');
      tbl({ body: extra, theme: 'grid', columnStyles: { 0: { fontStyle: 'bold', fillColor: LIGHT, cellWidth: 40 } }, styles: { fontSize: 9, cellPadding: 2.4, lineColor: [219, 227, 239] } });
      afterTable();
    }
  }

  // ── Es / No es ──
  const secEsNo = () => {
    section('Es / No es', [124, 58, 237]);
    tbl({
      head: [['', 'ES', 'NO ES']],
      body: ESNO_DIM.map(d => [d.label, p.esno[d.id].es || '-', p.esno[d.id].no || '-']),
      theme: 'grid', styles: { fontSize: 9, cellPadding: 3, lineColor: [219, 227, 239] },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 24, fillColor: LIGHT } },
      didParseCell: d => {
        if (d.section === 'head') { d.cell.styles.fillColor = d.column.index === 1 ? GREEN : d.column.index === 2 ? RED : NAVY; d.cell.styles.halign = 'center'; }
      },
    });
    afterTable();
  };

  // ── 5W2H ──
  const sec5w2h = () => {
    section('5W2H', [8, 145, 178]);
    const L = [['que', 'WHAT', 'Qué'], ['porque', 'WHY', 'Por qué'], ['donde', 'WHERE', 'Dónde'], ['cuando', 'WHEN', 'Cuándo'], ['quien', 'WHO', 'Quién'], ['como', 'HOW', 'Cómo'], ['cuanto', 'HOW MUCH', 'Cuánto']];
    tbl({
      body: L.map(([k, en, es]) => [`${en}\n${es}`, p.w2h[k] || '-']), theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3, lineColor: [219, 227, 239], minCellHeight: 11 },
      columnStyles: { 0: { cellWidth: 30, fontStyle: 'bold', fillColor: [8, 145, 178], textColor: [255, 255, 255], halign: 'center', valign: 'middle' } },
    });
    afterTable();
  };

  // ── 5 Porqués (cadena) ──
  const secPorques = () => {
    section('5 Porqués', AMBER);
    const whys = p.porques.filter(w => w.trim());
    const bw = pw() - 2 * M - 14;
    text(`Problema: ${p.titulo || '-'}`, M, y, { bold: true, size: 9.5, color: NAVY }); y += 5;
    whys.forEach((w, i) => {
      const lines = doc.splitTextToSize(w, bw - 24);
      const h = Math.max(11, lines.length * 4.4 + 5);
      ensure(h + 8);
      doc.setFillColor(255, 247, 237); doc.setDrawColor(...AMBER); doc.setLineWidth(0.4);
      doc.roundedRect(M + 14, y, bw, h, 2.5, 2.5, 'FD');
      doc.setFillColor(...AMBER); doc.circle(M + 6, y + h / 2, 5, 'F');
      text(String(i + 1), M + 6, y + h / 2 + 1.4, { bold: true, size: 10, color: [255, 255, 255], opts: { align: 'center' } });
      text('¿Por qué?', M + 17, y + 4.2, { bold: true, size: 7, color: AMBER });
      text(lines, M + 17, y + 8.2, { size: 9 });
      y += h;
      doc.setFillColor(...GRAY); doc.triangle(M + 6 - 2.5, y + 1.5, M + 6 + 2.5, y + 1.5, M + 6, y + 5.5, 'F');
      y += 6.5;
    });
    const rl = doc.splitTextToSize(p.causaRaiz || '(sin definir)', bw - 8);
    const rh = Math.max(14, rl.length * 4.6 + 9);
    ensure(rh + 4);
    doc.setFillColor(254, 242, 242); doc.setDrawColor(...RED); doc.setLineWidth(0.8);
    doc.roundedRect(M, y, bw + 14, rh, 3, 3, 'FD');
    text('CAUSA RAÍZ', M + 4, y + 5, { bold: true, size: 8, color: RED });
    text(rl, M + 4, y + 10, { bold: true, size: 9.5 });
    y += rh + 6;
  };

  // ── Ishikawa (página horizontal) ──
  const secIshikawa = () => {
    if (!(landscapeFirst && y < 40)) newPage('l');
    else y = 32;
    const W = 297, sy = 112;
    text('Diagrama Ishikawa (6M)', M, y + 2, { bold: true, size: 12, color: NAVY });
    doc.setDrawColor(30, 64, 175); doc.setLineWidth(1.3); doc.line(M, sy, 244, sy);
    doc.setFillColor(30, 64, 175); doc.triangle(244, sy - 3, 244, sy + 3, 250, sy, 'F');
    doc.setFillColor(...RED); doc.roundedRect(250, sy - 24, W - 250 - M, 48, 3, 3, 'F');
    const tl = doc.splitTextToSize(p.titulo || 'Problema', W - 250 - M - 4).slice(0, 6);
    text(tl, 250 + (W - 250 - M) / 2, sy - (tl.length - 1) * 2.4, { bold: true, size: 8.5, color: [255, 255, 255], opts: { align: 'center' } });
    const cx = [88, 158, 228];
    CATEGORIAS_6M.forEach((cat, idx) => {
      const top = idx < 3; const x = cx[idx % 3]; const x0 = x - 30; const y0 = top ? 42 : 182;
      doc.setDrawColor(...BLUE); doc.setLineWidth(0.9); doc.line(x0, y0, x, sy);
      doc.setFillColor(...BLUE); doc.roundedRect(x0 - 26, top ? 31 : 183, 46, 8, 2, 2, 'F');
      text(cat, x0 - 3, top ? 36.5 : 188.5, { bold: true, size: 8.5, color: [255, 255, 255], opts: { align: 'center' } });
      const causes = (p.ishikawa[cat] || []).filter(t => t.trim()).slice(0, 6);
      doc.setLineWidth(0.2); doc.setDrawColor(130, 130, 130);
      causes.forEach((c, k) => {
        const t = (k + 1) / (causes.length + 1); const bx = x0 + (x - x0) * t; const by = y0 + (sy - y0) * t;
        doc.line(bx - 42, by, bx, by); text(clip(c, 30), bx - 41, by - 1, { size: 7 });
      });
    });
    y = 200;
  };

  // ── Pareto (gráfico) ──
  const secPareto = () => {
    section('Pareto', [190, 24, 93]);
    const data = p.pareto.map(x => ({ label: x.cat || '—', n: parseFloat(x.n) || 0 })).filter(d => d.n > 0).sort((a, b) => b.n - a.n);
    const total = data.reduce((t, d) => t + d.n, 0);
    const cw = pw() - 2 * M, chH = 62; ensure(chH + 30);
    const x0 = M + 10, base = y + chH, top = y + 4, bw = (cw - 24) / data.length, max = data[0].n;
    doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3); doc.line(x0, base, x0 + cw - 20, base); doc.line(x0, top, x0, base);
    doc.setDrawColor(...RED); doc.setLineDashPattern([1.5, 1.5], 0); const y80 = base - 0.8 * (base - top); doc.line(x0, y80, x0 + cw - 20, y80); doc.setLineDashPattern([], 0);
    text('80%', x0 + cw - 18, y80 + 1, { size: 7, color: RED });
    text('100%', M, top + 2, { size: 7, color: GRAY }); text('0', M + 4, base, { size: 7, color: GRAY });
    let acc = 0; const pts = [];
    data.forEach((d, i) => {
      const h = (d.n / max) * (base - top - 6); const bx = x0 + i * bw + bw * 0.15;
      doc.setFillColor(...(i === 0 ? RED : BLUE)); doc.rect(bx, base - h, bw * 0.7, h, 'F');
      text(String(d.n), bx + bw * 0.35, base - h - 1.5, { bold: true, size: 8, opts: { align: 'center' } });
      text(clip(d.label, 14), bx + bw * 0.35, base + 4, { size: 7, color: GRAY, opts: { align: 'center' } });
      acc += d.n; pts.push([bx + bw * 0.35, base - (acc / total) * (base - top)]);
    });
    doc.setDrawColor(...GREEN); doc.setLineWidth(0.8);
    pts.forEach((pt, i) => { if (i) doc.line(pts[i - 1][0], pts[i - 1][1], pt[0], pt[1]); });
    doc.setFillColor(...GREEN); pts.forEach(pt => doc.circle(pt[0], pt[1], 1, 'F'));
    y = base + 9;
    let a2 = 0;
    tbl({
      head: [['Categoría', 'Cantidad', '%', '% acumulado']],
      body: data.map(d => { a2 += d.n; return [d.label, d.n, `${((d.n / total) * 100).toFixed(1)}%`, `${((a2 / total) * 100).toFixed(1)}%`]; }),
      foot: [['Total', total, '100%', '']], headStyles: { fillColor: [190, 24, 93] }, footStyles: { fillColor: LIGHT, textColor: [0, 0, 0] },
      styles: { fontSize: 8.5, cellPadding: 2 }, theme: 'striped',
    });
    afterTable();
  };

  // ── 8D (formulario) ──
  const sec8d = () => {
    section('Reporte 8D', NAVY);
    const D = [
      ['D1', 'Equipo', p.d8.d1], ['D2', 'Descripción del problema', p.descripcion], ['D3', 'Contención inmediata', p.contencion],
      ['D4', 'Causa raíz y punto de escape', [p.causaRaiz && `Causa raíz: ${p.causaRaiz}`, p.d8.escape && `Punto de escape: ${p.d8.escape}`].filter(Boolean).join('\n')],
      ['D5', 'Acciones correctivas permanentes', [p.d8.d5, p.acciones.length ? p.acciones.map((a, i) => `${i + 1}. ${a.desc}${a.resp ? ` (${a.resp})` : ''}`).join('\n') : ''].filter(Boolean).join('\n')],
      ['D6', 'Implementación y validación', p.d8.d6], ['D7', 'Prevención de recurrencia', p.d8.d7], ['D8', 'Cierre y reconocimiento', p.d8.d8],
    ];
    tbl({
      body: D.map(([k, t, v]) => [k, `${t}\n${v || '-'}`]), theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3, lineColor: [219, 227, 239] },
      columnStyles: { 0: { cellWidth: 14, fontStyle: 'bold', fontSize: 12, fillColor: NAVY, textColor: [255, 255, 255], halign: 'center', valign: 'middle' } },
      didParseCell: d => { if (d.column.index === 1 && d.section === 'body') d.cell.styles.fontStyle = 'normal'; },
      didDrawCell: d => {
        if (d.column.index === 1 && d.section === 'body') {
          const t = D[d.row.index][1];
          doc.setFillColor(255, 255, 255); doc.rect(d.cell.x + 0.3, d.cell.y + 0.3, d.cell.width - 0.6, 5.6, 'F');
          text(t, d.cell.x + 2.4, d.cell.y + 4.4, { bold: true, size: 8.5, color: NAVY });
        }
      },
    });
    afterTable();
  };

  // ── Plan de acción + matriz ──
  const secAcciones = () => {
    section('Plan de acción', GREEN);
    const col = { pendiente: AMBER, curso: BLUE, hecha: GREEN };
    const lab = { pendiente: 'Pendiente', curso: 'En curso', hecha: 'Hecha' };
    tbl({
      head: [['#', 'Acción', 'Responsable', 'Fecha', 'Estado']],
      body: p.acciones.map((a, i) => [i + 1, a.desc || '-', a.resp || '-', a.fecha || '-', lab[a.estado] || a.estado]),
      headStyles: { fillColor: GREEN }, styles: { fontSize: 8.5, cellPadding: 2.2 }, theme: 'striped',
      columnStyles: { 0: { cellWidth: 8 }, 3: { cellWidth: 24 }, 4: { cellWidth: 22, fontStyle: 'bold' } },
      didParseCell: d => { if (d.section === 'body' && d.column.index === 4) d.cell.styles.textColor = col[p.acciones[d.row.index].estado] || [0, 0, 0]; },
    });
    afterTable();
    if (p.acciones.some(a => a.impacto && a.esfuerzo)) {
      ensure(80);
      text('Matriz impacto / esfuerzo', M, y, { bold: true, size: 10, color: NAVY }); y += 4;
      const cw = (pw() - 2 * M - 4) / 2, chh = 30;
      [['alto', 'bajo', 'Quick wins', GREEN], ['alto', 'alto', 'Proyectos grandes', BLUE], ['bajo', 'bajo', 'Rellenos', GRAY], ['bajo', 'alto', 'Evitar', RED]].forEach(([imp, esf, label, c], i) => {
        const cx = M + (i % 2) * (cw + 4), cy = y + Math.floor(i / 2) * (chh + 4);
        doc.setDrawColor(...c); doc.setLineWidth(0.5); doc.setFillColor(c[0], c[1], c[2], 0.08); doc.setFillColor(250, 250, 252);
        doc.roundedRect(cx, cy, cw, chh, 2.5, 2.5, 'FD');
        doc.setFillColor(...c); doc.roundedRect(cx, cy, cw, 6.5, 2.5, 2.5, 'F');
        text(`${label}  (impacto ${imp} · esfuerzo ${esf})`, cx + 3, cy + 4.6, { bold: true, size: 8, color: [255, 255, 255] });
        p.acciones.map((a, k) => ({ a, k })).filter(({ a }) => a.impacto === imp && a.esfuerzo === esf).slice(0, 5)
          .forEach(({ a, k }, j) => text(`#${k + 1} ${clip(a.desc, 52)}`, cx + 3, cy + 12 + j * 4.2, { size: 8 }));
      });
      y += 2 * chh + 12;
    }
  };

  const secComentarios = () => {
    section('Seguimiento del equipo', GRAY);
    tbl({
      head: [['Fecha', 'Autor', 'Comentario']],
      body: [...(p.comentarios || [])].sort((a, b) => a.ts - b.ts).map(c => [fmtTs(c.ts), c.autor, c.texto]),
      headStyles: { fillColor: GRAY }, styles: { fontSize: 8.5, cellPadding: 2.2 }, theme: 'striped', columnStyles: { 0: { cellWidth: 34 }, 1: { cellWidth: 28 } },
    });
    afterTable();
  };

  const SECTIONS = [
    ['esno', secEsNo], ['w2h', sec5w2h], ['porques', secPorques], ['ishikawa', secIshikawa],
    ['pareto', secPareto], ['d8', sec8d], ['acciones', secAcciones], ['comentarios', secComentarios],
  ];
  let backToPortrait = false;
  SECTIONS.forEach(([k, fn]) => {
    if (only && only !== 'resumen' && only !== k) return;
    if (only === k || (!only && has[k](p))) {
      if (backToPortrait) { newPage('p'); backToPortrait = false; }
      if (only === k && !has[k](p)) { section(TOOL_LABELS[k]); text('Todavía no hay datos cargados en esta herramienta.', M, y, { italic: true, color: GRAY }); y += 8; return; }
      fn();
      if (k === 'ishikawa') backToPortrait = true;
    }
  });

  // ── Pie de página ──
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const w = pages[i - 1] === 'l' ? 297 : 210, h = pages[i - 1] === 'l' ? 210 : 297;
    doc.setDrawColor(219, 227, 239); doc.setLineWidth(0.2); doc.line(M, h - 11, w - M, h - 11);
    text(clip(p.titulo || 'Análisis de problema', 60), M, h - 6.5, { size: 7.5, color: GRAY });
    text(`Página ${i} de ${total}`, w - M, h - 6.5, { size: 7.5, color: GRAY, opts: { align: 'right' } });
  }

  const slug = (p.titulo || 'sin-titulo').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  doc.save(`problema-${slug}${only ? `-${only}` : ''}.pdf`);
}
