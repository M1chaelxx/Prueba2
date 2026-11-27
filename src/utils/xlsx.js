import ExcelJS from 'exceljs';
import { fmtTimer, fmtDate, fmtClock } from './timer';

const NAVY = 'FF0B1F4A', BLUE = 'FF2563EB', LBLUE = 'FFE3EDFF', GRAYBG = 'FFF3F6FB', LINE = 'FFD5DDEA';
const GREEN = 'FF16A34A', GREENBG = 'FFDCFCE7', RED = 'FFDC2626', REDBG = 'FFFEE2E2', GRAY = 'FF64748B', AMBERBG = 'FFFEF3C7', AMBER = 'FFB45309';

const fill = argb => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const thin = { style: 'thin', color: { argb: LINE } };
const box = { top: thin, bottom: thin, left: thin, right: thin };
const FONT = 'Calibri';

function band(ws, rowNum, from, to, text, { bg = NAVY, size = 12, color = 'FFFFFFFF', height = 24, align = 'left' } = {}) {
  ws.mergeCells(rowNum, from, rowNum, to);
  const c = ws.getCell(rowNum, from);
  c.value = text; c.fill = fill(bg);
  c.font = { name: FONT, bold: true, size, color: { argb: color } };
  c.alignment = { vertical: 'middle', horizontal: align, indent: 1 };
  ws.getRow(rowNum).height = height;
}

function header(ws, rowNum, labels, bg = BLUE) {
  const r = ws.getRow(rowNum);
  labels.forEach((l, i) => {
    const c = r.getCell(i + 1);
    c.value = l; c.fill = fill(bg);
    c.font = { name: FONT, bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    c.border = box;
  });
  r.height = 26;
}

function styleRow(row, { zebra = false, bold = false, bg = null, numFmts = {}, aligns = {} } = {}) {
  row.eachCell({ includeEmpty: true }, (c, col) => {
    c.border = box;
    c.font = { name: FONT, size: 10, bold };
    c.alignment = { vertical: 'middle', horizontal: aligns[col] || 'left', wrapText: true, indent: aligns[col] ? 0 : 1 };
    if (bg) c.fill = fill(bg); else if (zebra) c.fill = fill(GRAYBG);
    if (numFmts[col]) c.numFmt = numFmts[col];
  });
}

function pageSetup(ws, landscape = true) {
  ws.pageSetup = { orientation: landscape ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: .4, right: .4, top: .5, bottom: .5, header: .3, footer: .3 } };
  ws.headerFooter = { oddFooter: '&LToma de Tiempo en Línea&RPágina &P de &N' };
}

export async function buildXlsx({ study, rows, totals, meds, normTakes, now }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Toma de Tiempo en Línea';
  wb.created = now;
  const taktTime = study.taktTime || null;
  const modelo = `${study.modelo} ${study.capacidad}`;
  const fecha = `${fmtDate(now)} ${fmtClock(now)}`;
  const pLabel = r => `P${String(r.num).padStart(2, '0')} · ${r.puesto.nombre}`;
  const estadoOf = r => {
    if (!r.done) return { t: 'Sin medir', fg: GRAY, bg: GRAYBG };
    if (!taktTime) return { t: 'Medido', fg: BLUE, bg: LBLUE };
    return r.realTot > taktTime ? { t: 'Cuello de botella', fg: RED, bg: REDBG } : { t: 'OK', fg: GREEN, bg: GREENBG };
  };

  /* ───────── Hoja 1: Resumen ───────── */
  const ws = wb.addWorksheet('Resumen', { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 30 }, { width: 20 }, { width: 14 }, { width: 16 }, { width: 16 }, { width: 13 }, { width: 20 }, { width: 38 }];
  band(ws, 1, 1, 8, 'ESTUDIO DE TIEMPOS EN LÍNEA', { size: 18, height: 36 });
  band(ws, 2, 1, 8, `${modelo}  ·  Línea ${study.linea}`, { bg: BLUE, size: 12, height: 24 });
  ws.getRow(3).height = 8;

  const info = [['Analista', study.analista, 'Fecha', fecha], ['Takt Time', taktTime ? `${taktTime} s` : 'No definido', 'Puestos', rows.length]];
  info.forEach((v, i) => {
    const r = ws.getRow(4 + i);
    r.getCell(1).value = v[0]; r.getCell(2).value = v[1]; r.getCell(4).value = v[2]; r.getCell(5).value = v[3];
    [1, 4].forEach(col => { const c = r.getCell(col); c.font = { name: FONT, bold: true, size: 10, color: { argb: GRAY } }; c.alignment = { horizontal: 'left', indent: 1 }; });
    [2, 5].forEach(col => { const c = r.getCell(col); c.font = { name: FONT, size: 11, bold: true }; c.alignment = { horizontal: 'left' }; });
    r.height = 18;
  });
  ws.getRow(6).height = 8;

  // KPIs
  const kpis = [['MEDIDAS', `${totals.done}/${totals.total}`, null], ['T REAL PROM TOTAL (s)', +totals.real.toFixed(2), '0.00'], ['T NORMAL PROM TOTAL (s)', +totals.norm.toFixed(2), '0.00']];
  const spans = [[1, 2], [3, 5], [6, 8]];
  kpis.forEach(([label, val, fmt], i) => {
    const [a, b] = spans[i];
    ws.mergeCells(7, a, 7, b); ws.mergeCells(8, a, 8, b);
    const l = ws.getCell(7, a); l.value = label; l.fill = fill(LBLUE);
    l.font = { name: FONT, bold: true, size: 9, color: { argb: GRAY } }; l.alignment = { horizontal: 'center', vertical: 'middle' };
    const v = ws.getCell(8, a); v.value = val; v.fill = fill(LBLUE); if (fmt) v.numFmt = fmt;
    v.font = { name: FONT, bold: true, size: 20, color: { argb: NAVY } }; v.alignment = { horizontal: 'center', vertical: 'middle' };
    for (let c = a; c <= b; c++) { ws.getCell(7, c).fill = fill(LBLUE); ws.getCell(8, c).fill = fill(LBLUE); ws.getCell(7, c).border = { top: thin, left: c === a ? thin : undefined, right: c === b ? thin : undefined }; ws.getCell(8, c).border = { bottom: thin, left: c === a ? thin : undefined, right: c === b ? thin : undefined }; }
  });
  ws.getRow(7).height = 18; ws.getRow(8).height = 34; ws.getRow(9).height = 10;

  header(ws, 10, ['Puesto', 'Operario', 'Modo', 'T Real prom (s)', 'T Normal prom (s)', '% del Takt', 'Estado', 'Comentario']);
  let rn = 11;
  rows.forEach((r, i) => {
    const row = ws.getRow(rn);
    const est = estadoOf(r);
    row.values = [pLabel(r), r.puesto.operario || '', r.pModo === 'puesto' ? 'Por Puesto' : 'Por Elemento',
      r.realTot ? +r.realTot.toFixed(2) : null, r.tNormTot ? +r.tNormTot.toFixed(2) : null,
      taktTime && r.realTot ? r.realTot / taktTime : null, est.t, r.comment || ''];
    styleRow(row, { zebra: i % 2 === 1, numFmts: { 4: '0.00', 5: '0.00', 6: '0%' }, aligns: { 3: 'center', 4: 'center', 5: 'center', 6: 'center', 7: 'center' } });
    const ec = row.getCell(7); ec.fill = fill(est.bg); ec.font = { name: FONT, size: 10, bold: true, color: { argb: est.fg } };
    if (taktTime && r.realTot) row.getCell(6).font = { name: FONT, size: 10, bold: true, color: { argb: r.realTot > taktTime ? RED : GREEN } };
    row.height = r.comment && r.comment.length > 45 ? 32 : 20;
    rn++;
  });
  const tot = ws.getRow(rn);
  tot.values = ['TOTAL', '', '', +totals.real.toFixed(2), +totals.norm.toFixed(2), '', '', ''];
  styleRow(tot, { bold: true, bg: LBLUE, numFmts: { 4: '0.00', 5: '0.00' }, aligns: { 4: 'center', 5: 'center' } });
  tot.height = 22;
  rn += 2;
  ws.mergeCells(rn, 1, rn, 8);
  const note = ws.getCell(rn, 1);
  note.value = 'T Normal = T Real × (Valoración / 100).  Cuello de botella = T Real del puesto mayor al Takt Time.  Hoja "Detalle" por acción y "Tomas individuales" con cada medición.';
  note.font = { name: FONT, italic: true, size: 9, color: { argb: GRAY } }; note.alignment = { wrapText: true, vertical: 'top' }; ws.getRow(rn).height = 26;
  pageSetup(ws);

  /* ───────── Hoja 2: Detalle ───────── */
  const wd = wb.addWorksheet('Detalle', { views: [{ showGridLines: false, state: 'frozen', ySplit: 3 }] });
  wd.columns = [{ width: 6 }, { width: 44 }, { width: 16 }, { width: 18 }, { width: 14 }, { width: 9 }, { width: 36 }];
  band(wd, 1, 1, 7, `DETALLE POR PUESTO · ${modelo} · Línea ${study.linea}`, { size: 13, height: 28 });
  wd.getRow(2).height = 6;
  header(wd, 3, ['Nº', 'Acción', 'T Real prom (s)', 'T Normal prom (s)', 'MM:SS:CC', 'Tomas', 'Comentario']);
  let dn = 4;
  rows.forEach(r => {
    const est = estadoOf(r);
    band(wd, dn, 1, 7, `${pLabel(r)}${r.puesto.operario ? `   ·   Operario: ${r.puesto.operario}` : ''}   ·   ${est.t}`, { bg: BLUE, size: 11, height: 22 });
    dn++;
    if (r.pModo === 'puesto') {
      const row = wd.getRow(dn);
      row.values = ['', 'Puesto completo', r.realTot ? +r.realTot.toFixed(2) : null, r.tNormTot ? +r.tNormTot.toFixed(2) : null, r.realTot ? fmtTimer(r.realTot * 1000) : '', r.pTakes.length, r.comment || ''];
      styleRow(row, { numFmts: { 3: '0.00', 4: '0.00' }, aligns: { 1: 'center', 3: 'center', 4: 'center', 5: 'center', 6: 'center' } });
      row.height = 20; dn++;
    } else {
      r.acciones.forEach((a, i) => {
        const row = wd.getRow(dn);
        row.values = [a.idx, a.desc || '(sin descripción)', a.realS != null ? +a.realS.toFixed(2) : null, a.tNorm != null ? +a.tNorm.toFixed(2) : null, a.avgMs != null ? fmtTimer(a.avgMs) : '', a.nTakes, i === 0 ? (r.comment || '') : ''];
        styleRow(row, { zebra: i % 2 === 1, numFmts: { 3: '0.00', 4: '0.00' }, aligns: { 1: 'center', 3: 'center', 4: 'center', 5: 'center', 6: 'center' } });
        if (a.realS == null) { row.getCell(3).value = '—'; row.getCell(4).value = '—'; row.getCell(3).font = row.getCell(4).font = { name: FONT, size: 10, color: { argb: GRAY } }; }
        row.height = 20; dn++;
      });
      const t = wd.getRow(dn);
      t.values = ['', 'TOTAL DEL PUESTO', +r.realTot.toFixed(2), +r.tNormTot.toFixed(2), '', '', ''];
      styleRow(t, { bold: true, bg: LBLUE, numFmts: { 3: '0.00', 4: '0.00' }, aligns: { 3: 'center', 4: 'center' } });
      t.height = 22; dn++;
    }
    wd.getRow(dn).height = 8; dn++;
  });
  pageSetup(wd);

  /* ───────── Hoja 3: Tomas individuales ───────── */
  const wt = wb.addWorksheet('Tomas individuales', { views: [{ showGridLines: false, state: 'frozen', ySplit: 3 }] });
  wt.columns = [{ width: 28 }, { width: 18 }, { width: 14 }, { width: 34 }, { width: 8 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 14 }];
  band(wt, 1, 1, 9, `TOMAS INDIVIDUALES · ${modelo} · Línea ${study.linea}`, { size: 13, height: 28 });
  wt.getRow(2).height = 6;
  header(wt, 3, ['Puesto', 'Operario', 'Modo', 'Acción', 'Toma #', 'MM:SS:CC', 'T Real (s)', 'Valoración', 'T Normal (s)']);
  let tn = 4, zebra = 0;
  const addTake = (r, accion, take, idx, modo) => {
    const row = wt.getRow(tn);
    row.values = [pLabel(r), r.puesto.operario || '', modo, accion, idx, fmtTimer(take.ms), +(take.ms / 1000).toFixed(3), take.val, +((take.ms / 1000) * (take.val / 100)).toFixed(3)];
    styleRow(row, { zebra: zebra % 2 === 1, numFmts: { 7: '0.00', 8: '0"%"', 9: '0.00' }, aligns: { 3: 'center', 5: 'center', 6: 'center', 7: 'center', 8: 'center', 9: 'center' } });
    row.height = 19; tn++; zebra++;
  };
  rows.forEach(r => {
    if (r.pModo === 'puesto') r.pTakes.forEach((t, i) => addTake(r, '(total puesto)', t, i + 1, 'Por Puesto'));
    else {
      const pm = meds[r.puesto.id] || {};
      r.acciones.forEach(a => normTakes(pm[a.id]).forEach((t, i) => addTake(r, a.desc || `Acción ${a.idx}`, t, i + 1, 'Por Elemento')));
    }
  });
  if (tn > 4) wt.autoFilter = { from: { row: 3, column: 1 }, to: { row: tn - 1, column: 9 } };
  else { wt.mergeCells(4, 1, 4, 9); wt.getCell(4, 1).value = 'Todavía no hay tomas registradas.'; wt.getCell(4, 1).font = { name: FONT, italic: true, color: { argb: GRAY } }; }
  pageSetup(wt);

  return wb.xlsx.writeBuffer();
}

export function downloadXlsx(buf, name) {
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
