import { useEffect, useState } from 'react';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fmtTimer, fmtDate, fmtClock } from '../utils/timer';
import { saveStudy } from '../utils/sync';

const normTakes = v => {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  return [{ ms: v, val: 100 }];
};
const avgRealS = takes => takes.length ? takes.reduce((s, t) => s + t.ms, 0) / takes.length / 1000 : null;
const avgTNormS = takes => takes.length ? takes.reduce((s, t) => s + (t.ms / 1000) * (t.val / 100), 0) / takes.length : null;
const avgMsVal = takes => takes.length ? takes.reduce((s, t) => s + t.ms, 0) / takes.length : null;

export default function ResultsScreen({ study, result, onBack, onNew, backLabel }) {
  const now = new Date();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 760);
  const [exportMsg, setExportMsg] = useState('');
  // modo is now per-puesto (computed from acciones.length); globalModo supports old saved studies
  const { meds = {}, puestoRec = {}, modo: globalModo, comments = {} } = result || {};

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 760);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!study || !result || result._savedId) return;
    const nowMs = Date.now();
    const entry = {
      id: nowMs,
      timestamp: now.toISOString(),
      study: { ...study, puestos: study.puestos.map(p => ({ ...p, imagen: null })) },
      result,
    };
    saveStudy(entry).catch(() => {});
  }, []);

  const rows = study.puestos.map((p, i) => {
    // Per-puesto mode: element if has acciones, puesto otherwise; fallback to saved global modo
    const pModo = globalModo || (p.acciones.length > 0 ? 'elemento' : 'puesto');
    const pm = meds[p.id] || {};
    const acciones = p.acciones.map((a, j) => {
      const takes = normTakes(pModo === 'elemento' ? pm[a.id] : undefined);
      const std = parseFloat(a.tstd) || 0;
      const realS = avgRealS(takes);
      const tNorm = avgTNormS(takes);
      const avgMs = avgMsVal(takes);
      const delta = realS != null && std > 0 ? ((realS - std) / std) * 100 : null;
      return { ...a, idx: j + 1, std, realS, tNorm, avgMs, delta, nTakes: takes.length };
    });
    const stdTot = acciones.reduce((s, a) => s + a.std, 0);
    const pTakes = normTakes(puestoRec[p.id]);
    const realTot = pModo === 'puesto'
      ? (avgRealS(pTakes) || 0)
      : acciones.reduce((s, a) => s + (a.realS || 0), 0);
    const tNormTot = pModo === 'puesto'
      ? (avgTNormS(pTakes) || 0)
      : acciones.reduce((s, a) => s + (a.tNorm || 0), 0);
    const done = pModo === 'puesto' ? (pTakes.length > 0 ? 1 : 0) : acciones.filter(a => a.realS != null).length;
    const doneOf = pModo === 'puesto' ? 1 : (acciones.length || 1);
    return { puesto: p, num: i + 1, acciones, stdTot, realTot, tNormTot, done, doneOf, pTakes, pModo, comment: comments[p.id] || '' };
  });

  const gStd = rows.reduce((s, r) => s + r.stdTot, 0);
  const gReal = rows.reduce((s, r) => s + r.realTot, 0);
  const gNorm = rows.reduce((s, r) => s + r.tNormTot, 0);
  const gDone = rows.reduce((s, r) => s + r.done, 0);
  const gTotal = rows.reduce((s, r) => s + r.doneOf, 0);
  const gEff = gReal > 0 && gStd > 0 ? (gStd / gReal) * 100 : null;

  const exportXlsx = async () => {
    // Colors: azul = dato ingresado por el usuario, gris = calculado automáticamente
    const C_USER = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB3D1F2' } };
    const C_CALC = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    const boldFont = { bold: true, size: 10 };
    const hdrBorder = { top: { style: 'thin' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } };

    const styleHdr = (cell, isUser) => {
      cell.fill = isUser ? C_USER : C_CALC;
      cell.font = boldFont;
      cell.border = hdrBorder;
      cell.alignment = { vertical: 'middle', wrapText: false };
    };

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Toma de Tiempo en Línea';

    // ── Hoja 1: Estudio ──
    const ws = wb.addWorksheet('Estudio');
    ws.columns = [
      { key: 'puesto', width: 30 }, { key: 'operario', width: 20 },
      { key: 'modo', width: 14 }, { key: 'nro', width: 6 },
      { key: 'accion', width: 36 }, { key: 'treal', width: 16 },
      { key: 'tnorm', width: 16 }, { key: 'mmss', width: 14 },
      { key: 'tomas', width: 8 }, { key: 'comment', width: 30 },
    ];

    // Info del estudio
    const addInfo = (vals, bold = false) => {
      const r = ws.addRow(vals);
      if (bold) r.font = { bold: true, size: 11 };
      return r;
    };
    addInfo(['Estudio de Tiempos en Línea'], true);
    addInfo(['Modelo', `${study.modelo} ${study.capacidad}`, 'Línea', study.linea]);
    addInfo(['Analista', study.analista, 'Fecha', `${fmtDate(now)} ${fmtClock(now)}`]);
    ws.addRow([]);

    // Totales globales
    addInfo(['TOTALES'], true);
    ws.addRow(['T Real prom total (s)', gReal.toFixed(3), 'T Normal prom total (s)', gNorm.toFixed(3)]);
    ws.addRow([]);

    // Headers con colores (azul = usuario, gris = calculado)
    // Puesto(U) Operario(U) Modo(C) Nro(C) Acción(U) T Real(C) T Norm(C) MM:SS(C) Tomas(C) Comentario(U)
    const isUser = [true, true, false, false, true, false, false, false, false, true];
    const hdrLabels = ['Puesto', 'Operario', 'Modo', 'Nro', 'Acción', 'T Real prom (s)', 'T Normal prom (s)', 'MM:SS:CC', 'Tomas', 'Comentario'];
    const hdrRow = ws.addRow(hdrLabels);
    hdrRow.height = 22;
    hdrRow.eachCell((cell, col) => styleHdr(cell, isUser[col - 1]));

    rows.forEach(r => {
      if (r.pModo === 'puesto') {
        ws.addRow([
          `P${String(r.num).padStart(2, '0')} ${r.puesto.nombre}`,
          r.puesto.operario || '', 'Por Puesto', '', '',
          r.realTot ? +r.realTot.toFixed(3) : null,
          r.tNormTot ? +r.tNormTot.toFixed(3) : null,
          '', r.pTakes.length, r.comment || '',
        ]);
      } else {
        r.acciones.forEach(a => {
          ws.addRow([
            `P${String(r.num).padStart(2, '0')} ${r.puesto.nombre}`,
            r.puesto.operario || '', 'Por Elemento', a.idx, a.desc || '',
            a.realS != null ? +a.realS.toFixed(3) : null,
            a.tNorm != null ? +a.tNorm.toFixed(3) : null,
            a.avgMs != null ? fmtTimer(a.avgMs) : '',
            a.nTakes, a.idx === 1 ? (r.comment || '') : '',
          ]);
        });
        const totRow = ws.addRow([
          `P${String(r.num).padStart(2, '0')} TOTAL`, '', 'Por Elemento', '', '',
          +r.realTot.toFixed(3), +r.tNormTot.toFixed(3), '', '', '',
        ]);
        totRow.font = { bold: true };
        totRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
      }
    });

    // ── Hoja 2: Tomas individuales ──
    const ws2 = wb.addWorksheet('Tomas individuales');
    ws2.columns = [
      { key: 'puesto', width: 28 }, { key: 'operario', width: 20 },
      { key: 'modo', width: 14 }, { key: 'accion', width: 32 },
      { key: 'toma', width: 8 }, { key: 'mmss', width: 14 },
      { key: 'treal', width: 14 }, { key: 'val', width: 16 },
      { key: 'tnorm', width: 14 },
    ];

    // Puesto(U) Operario(U) Modo(C) Acción(U) Toma#(C) MM:SS(C) T Real(C) Valoración(U) T Normal(C)
    const isUser2 = [true, true, false, true, false, false, false, true, false];
    const hdrLabels2 = ['Puesto', 'Operario', 'Modo', 'Acción', 'Toma #', 'MM:SS:CC', 'T Real (s)', 'Valoración (%)', 'T Normal (s)'];
    const hdrRow2 = ws2.addRow(hdrLabels2);
    hdrRow2.height = 22;
    hdrRow2.eachCell((cell, col) => styleHdr(cell, isUser2[col - 1]));

    rows.forEach(r => {
      if (r.pModo === 'puesto') {
        r.pTakes.forEach((take, idx) => {
          ws2.addRow([
            `P${String(r.num).padStart(2, '0')} ${r.puesto.nombre}`,
            r.puesto.operario || '', 'Por Puesto', '(total puesto)', idx + 1,
            fmtTimer(take.ms), +(take.ms / 1000).toFixed(3), take.val, +((take.ms / 1000) * (take.val / 100)).toFixed(3),
          ]);
        });
      } else {
        const pm = meds[r.puesto.id] || {};
        r.acciones.forEach(a => {
          normTakes(pm[a.id]).forEach((take, idx) => {
            ws2.addRow([
              `P${String(r.num).padStart(2, '0')} ${r.puesto.nombre}`,
              r.puesto.operario || '', 'Por Elemento', a.desc || `Acción ${a.idx}`, idx + 1,
              fmtTimer(take.ms), +(take.ms / 1000).toFixed(3), take.val, +((take.ms / 1000) * (take.val / 100)).toFixed(3),
            ]);
          });
        });
      }
    });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `toma-tiempos-${study.modelo}-${study.capacidad}-${study.linea}-${now.toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    setExportMsg('✓ Exportación Excel completada');
    setTimeout(() => setExportMsg(''), 3000);
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const margin = 14;
    const pageW = doc.internal.pageSize.getWidth();
    let y = margin;

    // ── Encabezado ──
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('Estudio de Tiempos en Línea', margin, y); y += 7;
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(`Modelo: ${study.modelo} ${study.capacidad}   Línea: ${study.linea}   Analista: ${study.analista}   Fecha: ${fmtDate(now)} ${fmtClock(now)}`, margin, y); y += 5;
    if (study.taktTime) { doc.text(`Takt Time: ${study.taktTime.toFixed(1)} s`, margin, y); y += 5; }

    // ── Totales ──
    y += 2;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('Resumen General', margin, y); y += 4;
    autoTable(doc, {
      startY: y, margin: { left: margin, right: margin },
      head: [['Medidas', 'T Real prom total (s)', 'T Normal prom total (s)']],
      body: [[`${gDone}/${gTotal}`, gReal.toFixed(2), gNorm.toFixed(2)]],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 98, 255] },
    });
    y = doc.lastAutoTable.finalY + 6;

    // ── Por puesto ──
    rows.forEach(r => {
      if (y > 260) { doc.addPage(); y = margin; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.text(`P${String(r.num).padStart(2, '0')} — ${r.puesto.nombre}${r.puesto.operario ? `   Op: ${r.puesto.operario}` : ''}`, margin, y); y += 4;

      if (r.pModo === 'puesto') {
        autoTable(doc, {
          startY: y, margin: { left: margin, right: margin },
          head: [['#', 'T Real (s)', 'Valoración (%)', 'T Normal (s)']],
          body: r.pTakes.length === 0
            ? [['Sin tomas', '', '', '']]
            : r.pTakes.map((t, i) => [i + 1, (t.ms / 1000).toFixed(2), `${t.val}%`, ((t.ms / 1000) * (t.val / 100)).toFixed(2)]),
          foot: r.pTakes.length > 0 ? [['Prom', r.realTot.toFixed(2), '', r.tNormTot.toFixed(2)]] : [],
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [80, 80, 80] },
          footStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold' },
        });
      } else {
        autoTable(doc, {
          startY: y, margin: { left: margin, right: margin },
          head: [['#', 'Acción', 'T Real (s)', 'T Norm (s)', 'MM:SS:CC', 'Tomas']],
          body: r.acciones.map(a => [
            a.idx, a.desc || '(sin desc.)',
            a.realS != null ? a.realS.toFixed(2) : '—',
            a.tNorm != null ? a.tNorm.toFixed(2) : '—',
            a.avgMs != null ? fmtTimer(a.avgMs) : '—',
            a.nTakes,
          ]),
          foot: [['', 'Total', r.realTot.toFixed(2), r.tNormTot.toFixed(2), '', '']],
          styles: { fontSize: 7.5, cellPadding: 2 },
          headStyles: { fillColor: [80, 80, 80] },
          footStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold' },
          columnStyles: { 1: { cellWidth: 55 } },
        });
      }
      y = doc.lastAutoTable.finalY + 3;

      if (r.comment) {
        if (y > 270) { doc.addPage(); y = margin; }
        doc.setFont('helvetica', 'italic'); doc.setFontSize(8);
        doc.text(`Comentario: ${r.comment}`, margin, y); y += 5;
      }
      y += 3;
    });

    // Numeración de páginas
    const total = doc.internal.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
      doc.text(`Página ${i} de ${total}`, pageW - margin, doc.internal.pageSize.getHeight() - 6, { align: 'right' });
    }

    doc.save(`toma-tiempos-${study.modelo}-${study.capacidad}-${study.linea}-${now.toISOString().slice(0, 10)}.pdf`);
    setExportMsg('✓ Exportación PDF completada');
    setTimeout(() => setExportMsg(''), 3000);
  };

  const elemGrid = '28px 1fr 68px 68px 88px 52px';

  // Gráfico de barras T Real vs Takt Time
  const BarChart = ({ rows, taktTime, isMobileView }) => {
    if (!taktTime || rows.length === 0) return null;
    const maxVal = Math.max(...rows.map(r => r.realTot), taktTime);
    const scale = isMobileView ? 100 / maxVal : 200 / maxVal;
    const barW = isMobileView ? Math.max(22, 150 / rows.length) : Math.max(30, 250 / rows.length);
    const chartW = rows.length * barW + (isMobileView ? 40 : 60);
    const chartH = isMobileView ? 200 : 280;
    const baseY = isMobileView ? 160 : 260;
    const leftMargin = isMobileView ? 30 : 45;

    return (
      <svg width="100%" height={chartH} viewBox={`0 0 ${chartW} ${chartH}`} style={{ marginTop: '12px' }} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
        <text x={isMobileView ? 10 : 20} y={isMobileView ? 14 : 20} fontSize={isMobileView ? "10" : "13"} fontWeight="600" fill="var(--text)">T Real vs Takt</text>
        {/* Línea de Takt Time */}
        {taktTime * scale > 0 && (
          <>
            <line x1={leftMargin} y1={baseY - taktTime * scale} x2={chartW - 10} y2={baseY - taktTime * scale} stroke="#ef4444" strokeWidth="2" strokeDasharray="4,2" />
            <text x={chartW - (isMobileView ? 30 : 50)} y={baseY - taktTime * scale - 4} fontSize={isMobileView ? "7" : "9"} fill="#ef4444" fontWeight="600">TT</text>
          </>
        )}
        {/* Barras */}
        {rows.map((r, i) => {
          const barW2 = isMobileView ? 18 : 28;
          const x = leftMargin + i * barW + barW / 2 - barW2 / 2;
          const h = Math.max(3, r.realTot * scale);
          const isOver = r.realTot > taktTime;
          return (
            <g key={r.puesto.id}>
              <rect x={x} y={baseY - h} width={barW2} height={h} fill={isOver ? '#fca5a5' : '#86efac'} rx="1" opacity="0.95" />
              <text x={x + barW2 / 2} y={baseY + (isMobileView ? 12 : 14)} fontSize={isMobileView ? "6" : "8"} textAnchor="middle" fill="var(--text)" fontWeight="500">
                P{String(r.num).padStart(2, '0')}
              </text>
              {!isMobileView && (
                <text x={x + barW2 / 2} y={baseY - h - 5} fontSize="9" textAnchor="middle" fill="var(--text)" fontWeight="600">
                  {r.realTot.toFixed(1)}s
                </text>
              )}
            </g>
          );
        })}
        {/* Ejes */}
        <line x1={leftMargin - 2} y1={isMobileView ? 30 : 40} x2={leftMargin - 2} y2={baseY} stroke="var(--border)" strokeWidth="1" />
        <line x1={leftMargin - 5} y1={baseY} x2={chartW - 8} y2={baseY} stroke="var(--border)" strokeWidth="1" />
      </svg>
    );
  };

  return (
    <div className="screen results-screen">

      {/* Mensaje de exportación */}
      {exportMsg && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 1000,
          backgroundColor: '#10b981', color: 'white', padding: '12px 16px', borderRadius: '6px',
          fontSize: '0.9rem', fontWeight: 500, boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          animation: 'fadeOut 3s forwards'
        }}>
          {exportMsg}
        </div>
      )}
      <style>{`
        @keyframes fadeOut {
          0% { opacity: 1; }
          90% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>

      {/* ── Header ── */}
      <header className="app-header results-header">
        <div className="res-header-top">
          <button className="ghost-btn" onClick={onBack}>{backLabel || '← Volver'}</button>
          <h1>Resultados</h1>
          <button className="ghost-btn" onClick={exportXlsx}>⬇ Excel</button>
          <button className="ghost-btn" onClick={exportPdf}>⬇ PDF</button>
        </div>
        <p className="subtitle res-subtitle">
          {study.modelo} {study.capacidad} · {study.linea} · {study.analista} · {fmtDate(now)}
        </p>
        <button className="primary-btn res-new-btn" onClick={onNew}>+ Nuevo estudio</button>
      </header>

      <div className="results-body">

        {/* ── Takt Time ── */}
        {study.taktTime && (
          <section className="card takt-section">
            <div className="takt-header">
              <h2>Análisis de Takt Time</h2>
              <span className="takt-val">Takt Time: {study.taktTime.toFixed(1)} s</span>
            </div>
            <div className="takt-bars">
              {rows.map(r => {
                const pct = study.taktTime > 0 ? (r.realTot / study.taktTime) * 100 : 0;
                const isOver = r.realTot > study.taktTime;
                return (
                  <div key={r.puesto.id} className="takt-bar-row">
                    <span className="takt-bar-label">P{String(r.num).padStart(2, '0')} {r.puesto.nombre}</span>
                    <div className="takt-bar-track">
                      <div className={`takt-bar-fill ${isOver ? 'over' : 'ok'}`} style={{ width: `${Math.min(pct, 150)}%` }} />
                      <span className="takt-line" />
                    </div>
                    <span className={`takt-bar-val ${r.realTot === 0 ? '' : isOver ? 'over' : 'ok'}`}>
                      {r.realTot > 0 ? `${r.realTot.toFixed(1)}s` : '—'}
                      {r.realTot > 0 && <span className="takt-pct">{isOver ? ' ▲' : ' ✓'} {pct.toFixed(0)}%</span>}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="hint takt-note">Línea azul = Takt Time (100%). Rojo = cuello de botella.</p>
          </section>
        )}

        {/* ── Totales ── */}
        <section className="totals-card card">
          <div className="stat"><span className="stat-lbl">Medidas</span><span className="stat-val">{gDone}/{gTotal}</span></div>
          <div className="stat"><span className="stat-lbl">T Real prom total</span><span className="stat-val">{gReal.toFixed(2)}s</span></div>
          <div className="stat"><span className="stat-lbl">T Normal prom total</span><span className="stat-val">{gNorm.toFixed(2)}s</span></div>
        </section>

        {/* ── Gráfico de barras ── */}
        {study.taktTime && (
          <section className="card" style={{ padding: '20px 12px' }}>
            <BarChart rows={rows} taktTime={study.taktTime} isMobileView={isMobile} />
            <p className="hint" style={{ marginTop: '12px', fontSize: '0.8rem' }}>
              🟢 Verde = dentro del Takt Time. 🔴 Rojo = supera el Takt Time (cuello de botella).
            </p>
          </section>
        )}

        {/* ── Por puesto / por elemento ── */}
        {rows.map(r => (
            <section key={r.puesto.id} className="card">
              <div className="card-head">
                <div>
                  <h2>P{String(r.num).padStart(2, '0')} — {r.puesto.nombre}</h2>
                  {r.puesto.operario && <span className="puesto-operario">Op: {r.puesto.operario}</span>}
                </div>
                <span className="pbadge">{r.done}/{r.doneOf}</span>
              </div>

              {/* Modo Por Puesto: tomas como filas */}
              {r.pModo === 'puesto' && (
                <div className="pr-section">
                  <div className="pr-meta-row">
                    {r.stdTot > 0 && <span className="pr-meta-item"><span className="pr-lbl">T STD</span> {r.stdTot.toFixed(2)}s</span>}
                    <span className="pr-meta-item"><span className="pr-lbl">{r.pTakes.length} toma{r.pTakes.length !== 1 ? 's' : ''}</span></span>
                    {r.pTakes.length > 1 && (
                      <span className="pr-meta-item">
                        <span className="pr-lbl">Prom Real</span> <strong>{r.realTot.toFixed(2)}s</strong>
                        <span className="pr-lbl" style={{ marginLeft: 8 }}>T Normal</span> <strong>{r.tNormTot.toFixed(2)}s</strong>
                      </span>
                    )}
                  </div>

                  {r.pTakes.length === 0
                    ? <span className="badge pend" style={{ margin: '8px 0 4px' }}>Sin medir</span>
                    : (
                      <div className="takes-list" style={{ marginTop: 8 }}>
                        {r.pTakes.map((take, idx) => (
                          <div key={idx} className="take-row">
                            <span className="take-num">#{idx + 1}</span>
                            <span className="take-time mono">{fmtTimer(take.ms)}</span>
                            <span className="take-sec">{(take.ms / 1000).toFixed(2)}s</span>
                            <span className="take-val">Val: {take.val}%</span>
                            <span className="take-tnorm">T Norm: {((take.ms / 1000) * (take.val / 100)).toFixed(2)}s</span>
                          </div>
                        ))}
                      </div>
                    )
                  }
                </div>
              )}

              {/* Acciones */}
              {r.acciones.length === 0
                ? null
                : r.pModo === 'puesto'
                  ? (
                    <div className="ref-table" style={{ marginTop: 12 }}>
                      <p className="refs-title">Acciones del puesto — referencia</p>
                      {r.acciones.map(a => (
                        <div key={a.id} className="ref-row">
                          <span className="anum">{a.idx}</span>
                          <span className="ref-desc">{a.desc || '(sin descripción)'}</span>
                        </div>
                      ))}
                    </div>
                  )
                  : (
                    <div className="res-table-wrap">
                      <div className="res-table">
                        <div className="res-row head" style={{ gridTemplateColumns: elemGrid }}>
                          <span>#</span><span>Acción</span>
                          <span>T Real</span><span>T Norm</span><span>MM:SS</span><span>Tomas</span>
                        </div>
                        {r.acciones.map(a => (
                          <div key={a.id} className="res-row" style={{ gridTemplateColumns: elemGrid }}>
                            <span>{a.idx}</span>
                            <span className="res-desc">{a.desc || '(sin desc.)'}</span>
                            <span>{a.realS != null ? `${a.realS.toFixed(1)}s` : '—'}</span>
                            <span>{a.tNorm != null ? `${a.tNorm.toFixed(1)}s` : '—'}</span>
                            <span className="mono">{a.avgMs != null ? fmtTimer(a.avgMs) : '—'}</span>
                            <span>{a.nTakes}</span>
                          </div>
                        ))}
                        <div className="res-row total" style={{ gridTemplateColumns: elemGrid }}>
                          <span /><span>Total</span>
                          <span>{r.realTot.toFixed(1)}s</span>
                          <span>{r.tNormTot.toFixed(1)}s</span>
                          <span /><span />
                        </div>
                      </div>
                    </div>
                  )
              }
              {r.comment && (
                <div className="res-comment">
                  <span className="res-comment-lbl">💬 Comentario</span>
                  <span className="res-comment-text">{r.comment}</span>
                </div>
              )}
            </section>
        ))}
      </div>
    </div>
  );
}
