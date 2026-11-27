import { useState } from 'react';
import TimerDisplay from '../components/TimerDisplay';
import { fmtTimer } from '../utils/timer';

const emptyTimer = { elapsed: 0, startAt: null, running: false };

export default function StudyScreen({ study, onBack, onResults }) {
  const [selId, setSelId] = useState(study.puestos[0]?.id);
  const [timers, setTimers] = useState({});
  const [meds, setMeds] = useState({});
  const [puestoRec, setPuestoRec] = useState({});
  const [showImg, setShowImg] = useState(false);
  const [valBySel, setValBySel] = useState({});
  const [comments, setComments] = useState({});
  const [manualTime, setManualTime] = useState('');

  const puestos = study.puestos;
  const sel = puestos.find(p => p.id === selId) || puestos[0];

  // Mode is determined by whether the puesto has acciones defined
  const modo = sel.acciones.length > 0 ? 'elemento' : 'puesto';

  const currentVal = valBySel[sel.id] ?? (sel.valoracion || 100);
  const setCurrentVal = fn => setValBySel(v => ({ ...v, [sel.id]: fn(v[sel.id] ?? (sel.valoracion || 100)) }));
  const setValDirect = n => setValBySel(v => ({ ...v, [sel.id]: Math.min(150, Math.max(50, n)) }));

  const setComment = (id, text) => setComments(c => ({ ...c, [id]: text }));

  const getTimer = key => timers[key] || emptyTimer;
  const startTimer = key => setTimers(t => ({ ...t, [key]: { ...getTimer(key), startAt: Date.now(), running: true } }));
  const pauseTimer = key => {
    const tm = getTimer(key);
    if (!tm.running) return;
    const elapsed = tm.elapsed + (Date.now() - tm.startAt);
    setTimers(t => ({ ...t, [key]: { elapsed, startAt: null, running: false } }));
  };
  const resetTimer = key => setTimers(t => ({ ...t, [key]: emptyTimer }));
  const getElapsed = key => { const tm = getTimer(key); return tm.running ? tm.elapsed + (Date.now() - tm.startAt) : tm.elapsed; };
  const timerState = key => { const tm = getTimer(key); if (tm.running) return 'running'; if (tm.elapsed > 0) return 'paused'; return 'idle'; };

  const globalKey = `${sel.id}:global`;
  const globalTm = getTimer(globalKey);
  const globalState = timerState(globalKey);
  const puestoTakes = puestoRec[sel.id] || [];

  const lapSavePuesto = () => {
    const tm = getTimer(globalKey);
    if (!tm.running && tm.elapsed === 0) return;
    const elapsed = getElapsed(globalKey);
    if (elapsed === 0) return;
    setTimers(t => ({ ...t, [globalKey]: { elapsed: 0, startAt: tm.running ? Date.now() : null, running: tm.running } }));
    setPuestoRec(r => ({ ...r, [sel.id]: [...(r[sel.id] || []), { ms: elapsed, val: currentVal }] }));
  };

  const recordPuesto = () => {
    const elapsed = getElapsed(globalKey);
    if (elapsed === 0) return;
    resetTimer(globalKey);
    setPuestoRec(r => ({ ...r, [sel.id]: [...(r[sel.id] || []), { ms: elapsed, val: currentVal }] }));
    setTimers(t => ({ ...t, [globalKey]: { elapsed: 0, startAt: Date.now(), running: true } }));
  };
  const deletePuestoTake = idx => setPuestoRec(r => ({ ...r, [sel.id]: (r[sel.id] || []).filter((_, i) => i !== idx) }));

  const accKey = aid => `${sel.id}:${aid}`;
  const takesOf = aid => meds[sel.id]?.[aid] || [];

  const lapSaveAction = (key, pId, aId) => {
    const tm = getTimer(key);
    const elapsed = getElapsed(key);
    if (elapsed === 0) return;
    setTimers(t => ({ ...t, [key]: { elapsed: 0, startAt: tm.running ? Date.now() : null, running: tm.running } }));
    setMeds(m => ({ ...m, [pId]: { ...(m[pId] || {}), [aId]: [...(m[pId]?.[aId] || []), { ms: elapsed, val: currentVal }] } }));
  };

  const recordTake = (key, pId, aId) => {
    const elapsed = getElapsed(key);
    if (elapsed === 0) return;
    setMeds(m => ({ ...m, [pId]: { ...(m[pId] || {}), [aId]: [...(m[pId]?.[aId] || []), { ms: elapsed, val: currentVal }] } }));
    setTimers(t => ({ ...t, [key]: { elapsed: 0, startAt: Date.now(), running: true } }));
  };
  const deleteTake = (pId, aId, idx) => {
    setMeds(m => { const takes = (m[pId]?.[aId] || []).filter((_, i) => i !== idx); return { ...m, [pId]: { ...(m[pId] || {}), [aId]: takes } }; });
  };

  const recordManualTimePuesto = () => {
    const ms = parseFloat(manualTime) * 1000;
    if (isNaN(ms) || ms <= 0) return;
    setPuestoRec(r => ({ ...r, [sel.id]: [...(r[sel.id] || []), { ms, val: currentVal }] }));
    setManualTime('');
  };

  const recordManualTimeAccion = (aid) => {
    const ms = parseFloat(manualTime) * 1000;
    if (isNaN(ms) || ms <= 0) return;
    setMeds(m => ({ ...m, [sel.id]: { ...(m[sel.id] || {}), [aid]: [...(m[sel.id]?.[aid] || []), { ms, val: currentVal }] } }));
    setManualTime('');
  };

  const avgMs = takes => takes.length ? takes.reduce((s, t) => s + t.ms, 0) / takes.length : null;
  const avgTNormS = takes => takes.length ? takes.reduce((s, t) => s + (t.ms / 1000) * (t.val / 100), 0) / takes.length : null;

  const selRealAvg = modo === 'puesto'
    ? (puestoTakes.length ? avgMs(puestoTakes) / 1000 : 0)
    : sel.acciones.reduce((s, a) => { const am = avgMs(takesOf(a.id)); return s + (am != null ? am / 1000 : 0); }, 0);
  const selTNorm = modo === 'puesto'
    ? (puestoTakes.length ? avgTNormS(puestoTakes) : 0)
    : sel.acciones.reduce((s, a) => s + (avgTNormS(takesOf(a.id)) || 0), 0);
  const doneCount = p => {
    const pModo = p.acciones.length > 0 ? 'elemento' : 'puesto';
    if (pModo === 'puesto') return (puestoRec[p.id]?.length || 0) > 0 ? 1 : 0;
    return Object.values(meds[p.id] || {}).filter(takes => takes.length > 0).length;
  };
  const totalOf = p => p.acciones.length > 0 ? p.acciones.length : 1;
  const totalDone = puestos.reduce((s, p) => s + doneCount(p), 0);
  const totalItems = puestos.reduce((s, p) => s + totalOf(p), 0);
  const selDone = doneCount(sel);
  const selTotal = totalOf(sel);

  return (
    <div className="screen study-screen">
      <header className="app-header row">
        <button className="ghost-btn" onClick={onBack}>← Config</button>
        <div className="grow">
          <h1>{sel.nombre}</h1>
          <p className="subtitle">
            {study.modelo} {study.capacidad} · {study.linea} · {study.analista}
            {sel.operario ? ` · Op: ${sel.operario}` : ''}
          </p>
        </div>
      </header>

      {/* Timer bar — running summary */}
      <div className="timer-bar">
        {modo === 'puesto' ? (
          <div className="elem-bar">
            <span className="elem-bar-label">
              {puestoTakes.length === 0
                ? 'Sin tomas registradas aún'
                : `${puestoTakes.length} toma${puestoTakes.length !== 1 ? 's' : ''} registrada${puestoTakes.length !== 1 ? 's' : ''}`}
            </span>
            {puestoTakes.length > 0 && (
              <span className="elem-bar-val">Prom: {(avgMs(puestoTakes) / 1000).toFixed(2)}s</span>
            )}
          </div>
        ) : (
          <div className="elem-bar">
            <span className="elem-bar-label">∑ Total medido del puesto</span>
            <span className="elem-bar-val">{selRealAvg.toFixed(2)}s</span>
          </div>
        )}
        <span className="modo-badge">{modo === 'puesto' ? '⏱ Por Puesto' : '📋 Por Elemento'}</span>
      </div>

      {/* Valorización */}
      <div className="val-bar">
        <span className="val-bar-lbl">Valoración operario:</span>
        <div className="val-stepper">
          <button onClick={() => setCurrentVal(v => Math.max(50, v - 1))}>−</button>
          <input
            type="number"
            className="val-input"
            min={50} max={150}
            value={currentVal}
            onChange={e => {
              const n = parseInt(e.target.value, 10);
              if (!isNaN(n)) setValDirect(n);
            }}
          />
          <span className="val-pct">%</span>
          <button onClick={() => setCurrentVal(v => Math.min(150, v + 1))}>+</button>
        </div>
        <span className="val-bar-hint">50–150 · 100 = ritmo normal · afecta T Normal</span>
      </div>

      {/* Puesto tabs */}
      <nav className="puesto-tabs">
        {puestos.map((p, i) => (
          <button
            key={p.id}
            className={`ptab${p.id === sel.id ? ' sel' : ''}${doneCount(p) === totalOf(p) && totalOf(p) > 0 ? ' done' : ''}`}
            onClick={() => setSelId(p.id)}
          >
            <span className="pnum">P{String(i + 1).padStart(2, '0')}</span>
            <span className="pname">{p.nombre}</span>
            <span className="pbadge">{doneCount(p)}/{totalOf(p)}</span>
          </button>
        ))}
      </nav>

      <div className="study-sub">
        <div className="progress-wrap">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: selTotal ? `${(selDone / selTotal) * 100}%` : '0%' }} />
          </div>
          <span className="progress-txt">
            {modo === 'puesto'
              ? `${puestoTakes.length} toma${puestoTakes.length !== 1 ? 's' : ''} registrada${puestoTakes.length !== 1 ? 's' : ''}`
              : `${selDone}/${sel.acciones.length} acciones`}
          </span>
        </div>
        {sel.imagen && (
          <button className="img-mini" onClick={() => setShowImg(true)}>
            <img src={sel.imagen} alt="" /> Ver referencia
          </button>
        )}
      </div>

      <main className="ops-list">

        {/* ─── Por Puesto ─── */}
        {modo === 'puesto' && (
          <div className="puesto-mode-panel">

            <div className="puesto-timer-card card">
              <div className="puesto-timer-display">
                <button className="tb-ctrl-btn" onClick={() => resetTimer(globalKey)} disabled={globalState === 'idle'} title="Resetear">↺</button>
                <TimerDisplay {...globalTm} large />
              </div>
              <div className="puesto-timer-btns">
                {globalState === 'idle' && (
                  <button className="tb-main-btn" onClick={() => startTimer(globalKey)}>▶ Iniciar</button>
                )}
                {globalState === 'running' && (
                  <>
                    <button className="tb-main-btn stop" onClick={() => pauseTimer(globalKey)}>⏸ Pausar</button>
                    <button className="tb-lap-btn" onClick={lapSavePuesto}>💾 Guardar</button>
                  </>
                )}
                {globalState === 'paused' && (
                  <>
                    <button className="tb-main-btn resume" onClick={() => startTimer(globalKey)}>▶ Reanudar</button>
                    <button className="tb-rec-btn" onClick={recordPuesto}>✓ Registrar</button>
                  </>
                )}
              </div>

              <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'var(--bg2)', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 500, marginBottom: '8px', color: 'var(--text2)' }}>O ingresar tiempo manual:</div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="number"
                    placeholder="segundos"
                    value={manualTime}
                    onChange={e => setManualTime(e.target.value)}
                    step="0.01"
                    min="0"
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--input-bg)', color: 'var(--text)' }}
                  />
                  <button className="tb-rec-btn" onClick={recordManualTimePuesto} disabled={!manualTime || parseFloat(manualTime) <= 0} style={{ whiteSpace: 'nowrap' }}>
                    ✓ Agregar
                  </button>
                </div>
              </div>
            </div>

            {puestoTakes.length > 0 && (
              <div className="takes-list card">
                <div className="takes-header">
                  <span className="refs-title">Tomas registradas ({puestoTakes.length})</span>
                  {puestoTakes.length > 1 && (
                    <span className="takes-avg">
                      Prom T Real: <strong>{(avgMs(puestoTakes) / 1000).toFixed(2)}s</strong>
                      {' · '}Prom T Normal: <strong>{avgTNormS(puestoTakes).toFixed(2)}s</strong>
                    </span>
                  )}
                </div>
                {puestoTakes.map((take, idx) => (
                  <div key={idx} className="take-row">
                    <span className="take-num">#{idx + 1}</span>
                    <span className="take-time mono">{fmtTimer(take.ms)}</span>
                    <span className="take-sec">{(take.ms / 1000).toFixed(2)}s</span>
                    <span className="take-val">Val: {take.val}%</span>
                    <span className="take-tnorm">T Norm: {((take.ms / 1000) * (take.val / 100)).toFixed(2)}s</span>
                    <button className="take-del" onClick={() => deletePuestoTake(idx)}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {sel.acciones.length > 0 && (
              <div className="puesto-refs card">
                <p className="refs-title">ACCIONES DEL PUESTO — REFERENCIA</p>
                {sel.acciones.map((a, i) => {
                  const std = parseFloat(a.tstd) || 0;
                  return (
                    <div key={a.id} className="ref-row">
                      <span className="anum">{i + 1}</span>
                      <span className="ref-desc">{a.desc || '(sin descripción)'}</span>
                      <span className="ref-meta">Cant: {a.cant}</span>
                      {std > 0 && <span className="ref-std">STD: {std.toFixed(2)}s</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── Por Elemento ─── */}
        {modo === 'elemento' && (
          <>
            {sel.acciones.length === 0 && <p className="hint pad">Este puesto no tiene acciones definidas.</p>}
            {sel.acciones.map((a, i) => {
              const key = accKey(a.id);
              const tm = getTimer(key);
              const state = timerState(key);
              const takes = takesOf(a.id);
              const std = parseFloat(a.tstd) || 0;
              const am = avgMs(takes);
              const avgRealS = am != null ? am / 1000 : null;
              const avgNorm = avgTNormS(takes);
              const delta = avgRealS != null && std > 0 ? ((avgRealS - std) / std) * 100 : null;
              return (
                <div key={a.id} className={`op-card${takes.length > 0 ? ' has-takes' : ''}${state === 'running' ? ' running' : ''}`}>
                  <div className="op-row-main">
                    <span className="anum">{i + 1}</span>
                    <div className="op-info">
                      <span className="op-desc">{a.desc || '(sin descripción)'}</span>
                      <span className="op-meta">Cant: {a.cant}{std > 0 ? ` · STD: ${std.toFixed(2)}s` : ''}</span>
                    </div>
                    <div className="op-timer-group">
                      <TimerDisplay {...tm} />
                      <div className="op-btn-row">
                        {state === 'idle' && (
                          <button className="op-btn" onClick={() => startTimer(key)}>▶ Iniciar</button>
                        )}
                        {state === 'running' && (
                          <>
                            <button className="op-btn stop" onClick={() => pauseTimer(key)}>⏸ Pausar</button>
                            <button className="op-btn lap" onClick={() => lapSaveAction(key, sel.id, a.id)}>💾 Guardar</button>
                            <button className="op-btn-sm reset" onClick={() => resetTimer(key)} title="Resetear">↺</button>
                          </>
                        )}
                        {state === 'paused' && (
                          <>
                            <button className="op-btn resume" onClick={() => startTimer(key)}>▶ Reanudar</button>
                            <button className="op-btn rec" onClick={() => recordTake(key, sel.id, a.id)}>✓ Registrar</button>
                            <button className="op-btn-sm reset" onClick={() => resetTimer(key)} title="Resetear">↺</button>
                          </>
                        )}
                      </div>

                      <div style={{ marginTop: '8px', padding: '8px 12px', backgroundColor: 'var(--bg2)', borderRadius: '4px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text2)' }}>Manual:</span>
                        <input
                          type="number"
                          placeholder="seg"
                          value={manualTime}
                          onChange={e => setManualTime(e.target.value)}
                          step="0.01"
                          min="0"
                          style={{ width: '60px', padding: '4px 6px', borderRadius: '3px', border: '1px solid var(--border)', backgroundColor: 'var(--input-bg)', color: 'var(--text)', fontSize: '0.85rem' }}
                        />
                        <button className="op-btn-sm rec" onClick={() => recordManualTimeAccion(a.id)} disabled={!manualTime || parseFloat(manualTime) <= 0} style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                  {takes.length > 0 && (
                    <div className="op-takes">
                      <div className="takes-row-head">
                        <span>Tomas ({takes.length})</span>
                        <span className="takes-avg-inline">
                          Prom T Real: <strong>{avgRealS.toFixed(2)}s</strong>
                          {' · '}T Normal: <strong>{avgNorm.toFixed(2)}s</strong>
                          {delta != null && (
                            <span className={`delta ${delta > 5 ? 'over' : delta < -5 ? 'ok' : ''}`} style={{ marginLeft: 6 }}>
                              {delta > 0 ? '+' : ''}{delta.toFixed(0)}%
                            </span>
                          )}
                        </span>
                      </div>
                      {takes.map((take, idx) => (
                        <div key={idx} className="take-row">
                          <span className="take-num">#{idx + 1}</span>
                          <span className="take-time mono">{fmtTimer(take.ms)}</span>
                          <span className="take-sec">{(take.ms / 1000).toFixed(2)}s</span>
                          <span className="take-val">Val: {take.val}%</span>
                          <span className="take-tnorm">T Norm: {((take.ms / 1000) * (take.val / 100)).toFixed(2)}s</span>
                          <button className="take-del" onClick={() => deleteTake(sel.id, a.id, idx)}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* ─── Comentarios del puesto (siempre visible) ─── */}
        <div className="comment-field card">
          <span className="comment-label">💬 Comentarios del puesto</span>
          <textarea
            className="comment-textarea"
            placeholder="Observaciones sobre el puesto, el operario, las condiciones de medición..."
            value={comments[sel.id] || ''}
            onChange={e => setComment(sel.id, e.target.value)}
            rows={3}
          />
        </div>

      </main>

      <footer className="study-footer">
        <div className="stat">
          <span className="stat-lbl">T Real (prom)</span>
          <span className="stat-val">{selRealAvg.toFixed(2)}s</span>
        </div>
        <div className="stat">
          <span className="stat-lbl">T Normal (prom)</span>
          <span className="stat-val">{selTNorm.toFixed(2)}s</span>
        </div>
        {study.taktTime && (
          <div className="stat">
            <span className="stat-lbl">Takt Time</span>
            <span className={`stat-val ${selRealAvg === 0 ? '' : selRealAvg <= study.taktTime ? 'ok' : 'over'}`}>
              {study.taktTime.toFixed(1)}s
            </span>
          </div>
        )}
        <button className="primary-btn" onClick={() => onResults({ meds, puestoRec, comments })}>
          Ver Resultados ({totalDone}/{totalItems})
        </button>
      </footer>

      {showImg && sel.imagen && (
        <div className="img-modal" onClick={() => setShowImg(false)}>
          <img src={sel.imagen} alt="Referencia ampliada" />
        </div>
      )}
    </div>
  );
}
