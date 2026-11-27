import { useEffect, useState } from 'react';
import { fmtTimer, fmtDate, fmtClock } from '../utils/timer';
import { saveStudy } from '../utils/sync';
import { cloudOnly, getMedia } from '../utils/cloudinary';
import MediaStrip from '../components/MediaStrip';

const normTakes = v => {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  return [{ ms: v, val: 100 }];
};
const avgRealS = takes => takes.length ? takes.reduce((s, t) => s + t.ms, 0) / takes.length / 1000 : null;
const avgTNormS = takes => takes.length ? takes.reduce((s, t) => s + (t.ms / 1000) * (t.val / 100), 0) / takes.length : null;
const avgMsVal = takes => takes.length ? takes.reduce((s, t) => s + t.ms, 0) / takes.length : null;

export default function ResultsScreen({ study, result, onBack, onNew, onProblema, backLabel }) {
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

  // El estudio ya no se guarda solo: se guarda únicamente con "Guardar estudio" o "Nuevo estudio".
  // Un estudio abierto desde "Estudios guardados" (_savedId) ya está guardado y no se vuelve a guardar.
  const alreadySaved = !!result?._savedId;
  const [saving, setSaving] = useState(false);

  const saveAndExit = async () => {
    if (saving) return;
    if (!alreadySaved) {
      setSaving(true);
      try {
        await saveStudy({
          id: Date.now(),
          timestamp: new Date().toISOString(),
          study: { ...study, puestos: study.puestos.map(p => ({ ...p, imagen: null, media: cloudOnly(p.media) })) },
          result,
        });
      } catch {
        setSaving(false);
        setExportMsg('⚠ No se pudo guardar el estudio. Revisá la conexión e intentá de nuevo.');
        setTimeout(() => setExportMsg(''), 4000);
        return;
      }
      setSaving(false);
    }
    onNew();
  };

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
    try {
      const { buildXlsx, downloadXlsx } = await import('../utils/xlsx');
      const buf = await buildXlsx({ study, rows, totals: { real: gReal, norm: gNorm, done: gDone, total: gTotal }, meds, normTakes, now });
      downloadXlsx(buf, `toma-tiempos-${study.modelo}-${study.capacidad}-${study.linea}-${now.toISOString().slice(0, 10)}.xlsx`);
      setExportMsg('✓ Exportación Excel completada');
    } catch (e) {
      console.error(e);
      setExportMsg('⚠ No se pudo generar el Excel');
    }
    setTimeout(() => setExportMsg(''), 3000);
  };

  const exportPdf = async () => {
    try {
      const { exportEstudioPdf } = await import('../utils/estudioPdf');
      await exportEstudioPdf({ study, rows, totals: { real: gReal, norm: gNorm, done: gDone, total: gTotal }, meds, normTakes, now });
      setExportMsg('✓ Exportación PDF completada');
    } catch (e) {
      console.error(e);
      setExportMsg('⚠ No se pudo generar el PDF');
    }
    setTimeout(() => setExportMsg(''), 3000);
  };

  const elemGrid = '28px 1fr 68px 68px 88px 52px';

  // Gráfico de barras T Real vs Takt Time
  const BarChart = ({ rows, taktTime, isMobileView }) => {
    if (!taktTime || rows.length === 0) return null;
    const maxVal = Math.max(...rows.map(r => r.realTot), taktTime);
    const scale = isMobileView ? 100 / maxVal : 200 / maxVal;
    const leftMargin = isMobileView ? 30 : 45;
    const chartW = Math.max(isMobileView ? 300 : 640, rows.length * (isMobileView ? 40 : 70) + leftMargin + 20);
    const barW = (chartW - leftMargin - 20) / rows.length;
    const chartH = isMobileView ? 200 : 280;
    const baseY = isMobileView ? 160 : 260;

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
        <div className="res-actions">
          {!alreadySaved && (
            <button className="primary-btn res-new-btn" onClick={saveAndExit} disabled={saving}>
              {saving ? 'Guardando…' : '💾 Guardar estudio'}
            </button>
          )}
          <button className="primary-btn res-new-btn" onClick={saveAndExit} disabled={saving}>+ Nuevo estudio</button>
        </div>
        {!alreadySaved && <p className="res-unsaved">⚠ Este estudio todavía no está guardado. Se guarda al tocar “Guardar estudio” o “Nuevo estudio”.</p>}
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
              <MediaStrip items={getMedia(r.puesto)} />
              {onProblema && (
                <button
                  className={`ghost-btn prob-open-btn${study.taktTime && r.realTot > study.taktTime ? ' alert' : ''}`}
                  onClick={() => onProblema({
                    modelo: study.modelo, capacidad: study.capacidad, linea: study.linea,
                    puesto: r.puesto.nombre,
                    titulo: study.taktTime && r.realTot > study.taktTime ? `Cuello de botella en ${r.puesto.nombre}` : '',
                    medicion: { tReal: +r.realTot.toFixed(2), takt: study.taktTime || null, estudio: `${study.analista} · ${fmtDate(now)}` },
                  })}
                >
                  🔎 {study.taktTime && r.realTot > study.taktTime ? 'Analizar cuello de botella' : 'Abrir problema en este puesto'}
                </button>
              )}

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
