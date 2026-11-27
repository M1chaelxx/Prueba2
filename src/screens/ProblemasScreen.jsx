import { useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { genId } from '../utils/id';
import { firebaseReady } from '../firebase';
import { fmtDate } from '../utils/timer';
import {
  ESTADOS, TIPOS, SEVERIDADES, CATEGORIAS_6M,
  ESNO_DIM, withDefaults, newProblema, subscribeProblemas, saveProblema, deleteProblema, addComentario,
} from '../utils/problemas';

const estadoOf = id => ESTADOS.find(e => e.id === id) || ESTADOS[0];
const getUser = () => { try { return localStorage.getItem('usuario') || ''; } catch { return ''; } };
const fmtTs = ts => { const d = new Date(ts); return `${fmtDate(d)} ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`; };

function Guia({ titulo = '¿Cómo se usa?', children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`guia${open ? ' open' : ''}`}>
      <button type="button" className="guia-head" onClick={() => setOpen(!open)}>
        <span>💡 {titulo}</span><span>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="guia-body">{children}</div>}
    </div>
  );
}

function ParetoChart({ items }) {
  const data = [...items].filter(i => i.n > 0).sort((a, b) => b.n - a.n);
  const total = data.reduce((t, i) => t + i.n, 0);
  if (!total) return <p className="hint">Cargá categorías con su cantidad para ver el gráfico.</p>;
  const W = Math.max(320, data.length * 64 + 70), H = 230, base = 170, top = 20, left = 36;
  const bw = (W - left - 36) / data.length;
  const max = data[0].n;
  let acc = 0;
  const pts = data.map((d, i) => { acc += d.n; return [left + i * bw + bw / 2, base - (acc / total) * (base - top)]; });
  return (
    <div className="pareto-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: Math.min(W, 520) }}>
        <line x1={left} y1={base} x2={W - 30} y2={base} stroke="var(--border)" />
        <line x1={left} y1={top} x2={W - 30} y2={top} stroke="var(--border)" strokeDasharray="3,3" />
        <line x1={left} y1={base - 0.8 * (base - top)} x2={W - 30} y2={base - 0.8 * (base - top)} stroke="#dc2626" strokeDasharray="4,3" />
        <text x={W - 30} y={base - 0.8 * (base - top) - 3} fontSize="8" fill="#dc2626" textAnchor="end">80%</text>
        {data.map((d, i) => {
          const h = (d.n / max) * (base - top);
          return (
            <g key={d.label + i}>
              <rect x={left + i * bw + bw * 0.15} y={base - h} width={bw * 0.7} height={h} rx="3" fill={i === 0 ? '#dc2626' : '#2563eb'} opacity=".9" />
              <text x={left + i * bw + bw / 2} y={base - h - 4} fontSize="9" fontWeight="700" textAnchor="middle" fill="var(--text)">{d.n}</text>
              <text x={left + i * bw + bw / 2} y={base + 12} fontSize="8" textAnchor="middle" fill="var(--text2)">{d.label.length > 11 ? `${d.label.slice(0, 10)}…` : d.label}</text>
            </g>
          );
        })}
        <polyline points={pts.map(x => x.join(',')).join(' ')} fill="none" stroke="#16a34a" strokeWidth="2" />
        {pts.map((x, i) => <circle key={i} cx={x[0]} cy={x[1]} r="3" fill="#16a34a" />)}
        <text x="4" y={top + 3} fontSize="8" fill="var(--text2)">100%</text>
        <text x="4" y={base} fontSize="8" fill="var(--text2)">0</text>
      </svg>
      <p className="hint">Barra roja = la causa/categoría más frecuente. Línea verde = % acumulado. Lo que cruza el 80% son los &ldquo;pocos vitales&rdquo;.</p>
    </div>
  );
}

/* ───────────── Lista ───────────── */
function Lista({ problemas, onOpen, onNew, onBack, status }) {
  const [fEstado, setFEstado] = useState('todos');
  const [fLinea, setFLinea] = useState('todas');
  const [q, setQ] = useState('');
  const lineas = useMemo(() => [...new Set(problemas.map(p => [p.modelo, p.capacidad, p.linea].filter(Boolean).join(' ')).filter(Boolean))], [problemas]);
  const shown = problemas.filter(p => {
    const l = [p.modelo, p.capacidad, p.linea].filter(Boolean).join(' ');
    return (fEstado === 'todos' || p.estado === fEstado)
      && (fLinea === 'todas' || l === fLinea)
      && (!q || `${p.titulo} ${p.puesto} ${p.responsable}`.toLowerCase().includes(q.toLowerCase()));
  });
  const count = id => problemas.filter(p => p.estado === id).length;
  const [showPareto, setShowPareto] = useState(false);
  const [paretoBy, setParetoBy] = useState('puesto');
  const paretoItems = Object.entries(problemas.reduce((m, p) => {
    const k = (paretoBy === 'puesto' ? p.puesto : paretoBy === 'tipo' ? p.tipo : paretoBy === 'severidad' ? p.severidad : [p.modelo, p.capacidad, p.linea].filter(Boolean).join(' ')) || 'Sin dato';
    m[k] = (m[k] || 0) + 1; return m;
  }, {})).map(([label, n]) => ({ label, n }));

  return (
    <div className="screen problemas-screen">
      <header className="app-header row">
        <button className="ghost-btn" onClick={onBack}>← Menú</button>
        <div className="grow">
          <h1>Problemas y Análisis</h1>
          <p className="subtitle">{status === 'ok' ? '☁ Sincronizado con el equipo' : status === 'local' ? 'Guardado solo en este dispositivo' : '⚠ Sin conexión'}</p>
        </div>
        <button className="primary-btn" onClick={() => onNew()}>+ Nuevo problema</button>
      </header>

      <div className="prob-body">
        <div className="prob-kpis">
          {ESTADOS.map(e => (
            <button key={e.id} className={`kpi${fEstado === e.id ? ' sel' : ''}`} style={{ '--c': e.color }} onClick={() => setFEstado(fEstado === e.id ? 'todos' : e.id)}>
              <span className="kpi-n">{count(e.id)}</span><span className="kpi-l">{e.label}</span>
            </button>
          ))}
        </div>

        <div className="prob-filters">
          <input placeholder="Buscar por título, puesto o responsable…" value={q} onChange={e => setQ(e.target.value)} />
          <select value={fLinea} onChange={e => setFLinea(e.target.value)}>
            <option value="todas">Todas las líneas</option>
            {lineas.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <button className="ghost-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setShowPareto(!showPareto)}>📊 {showPareto ? 'Ocultar' : 'Ver'} Pareto de problemas</button>
        {showPareto && (
          <div className="card form-card">
            <label>Agrupar por
              <select value={paretoBy} onChange={e => setParetoBy(e.target.value)}>
                <option value="puesto">Puesto</option><option value="tipo">Tipo</option><option value="severidad">Severidad</option><option value="linea">Línea</option>
              </select>
            </label>
            <ParetoChart items={paretoItems} />
          </div>
        )}
        {shown.length === 0 ? (
          <div className="card prob-empty">
            <p style={{ fontSize: '2rem' }}>🔎</p>
            <p>{problemas.length === 0 ? 'Todavía no hay problemas cargados.' : 'Ningún problema coincide con el filtro.'}</p>
            {problemas.length === 0 && <button className="primary-btn" onClick={() => onNew()}>Cargar el primero</button>}
          </div>
        ) : shown.map(p => {
          const est = estadoOf(p.estado);
          const hechas = (p.acciones || []).filter(a => a.estado === 'hecha').length;
          return (
            <button key={p.id} className="prob-card" style={{ '--c': est.color }} onClick={() => onOpen(p.id)}>
              <div className="prob-card-top">
                <span className="prob-estado">{est.label}</span>
                <span className={`prob-sev sev-${p.severidad}`}>{p.severidad}</span>
                <span className="prob-tipo">{p.tipo}</span>
              </div>
              <h3>{p.titulo || '(sin título)'}</h3>
              <p className="prob-meta">
                {[p.modelo, p.capacidad, p.linea].filter(Boolean).join(' ')}{p.puesto ? ` · ${p.puesto}` : ''}
              </p>
              <p className="prob-meta">
                👤 {p.responsable || 'Sin responsable'} · 🛠 {hechas}/{(p.acciones || []).length} acciones · 💬 {(p.comentarios || []).length} · {fmtTs(p.actualizado)}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────── Detalle ───────────── */
const TABS = [
  ['resumen', '📋 Resumen'], ['esno', '⚖ Es / No es'], ['w2h', '🧭 5W2H'], ['porques', '❓ 5 Porqués'],
  ['ishikawa', '🐟 Ishikawa'], ['pareto', '📊 Pareto'], ['d8', '8️⃣ 8D'],
  ['acciones', '🛠 Acciones'], ['comentarios', '💬 Comentarios'],
];

function Detalle({ problema, onBack, onDeleted, isNew }) {
  const [p, setP] = useState(() => withDefaults(problema));
  const [dirty, setDirty] = useState(isNew);
  const [remoteNew, setRemoteNew] = useState(false);
  const [tab, setTab] = useState('resumen');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [user, setUser] = useState(getUser);

  // Si otra persona actualiza y no hay cambios míos sin guardar, se refleja al instante.
  useEffect(() => {
    if (problema.actualizado === p.actualizado) return;
    if (!dirty) setP(withDefaults(problema)); else setRemoteNew(true);
  }, [problema.actualizado]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = patch => { setP(x => ({ ...x, ...patch })); setDirty(true); };
  const flash = t => { setToast(t); setTimeout(() => setToast(''), 2500); };

  const setUserName = v => { setUser(v); try { localStorage.setItem('usuario', v); } catch { /* ignore */ } };

  const save = async () => {
    if (!p.titulo.trim()) { flash('Poné un título al problema'); setTab('resumen'); return; }
    setSaving(true);
    try {
      await saveProblema({ ...p, creador: p.creador || user });
      setDirty(false); setRemoteNew(false); flash('✓ Guardado');
    } catch { flash('⚠ No se pudo guardar. Revisá la conexión.'); }
    setSaving(false);
  };

  const exportPdf = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const m = 14; let y = m;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text('Análisis de problema', m, y); y += 7;
    doc.setFontSize(11); doc.text(p.titulo || '(sin título)', m, y, { maxWidth: 180 }); y += 8;
    const body = (rows) => autoTable(doc, { startY: y, margin: { left: m, right: m }, body: rows, styles: { fontSize: 9, cellPadding: 2 }, columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } }, theme: 'grid' });
    body([
      ['Estado', estadoOf(p.estado).label], ['Tipo / Severidad', `${p.tipo} / ${p.severidad}`],
      ['Línea', [p.modelo, p.capacidad, p.linea].filter(Boolean).join(' ') || '-'], ['Puesto', p.puesto || '-'],
      ['Responsable', p.responsable || '-'], ['Creado por', p.creador || '-'], ['Fecha', fmtTs(p.creado)],
      ['Cantidad afectada', p.cantidad || '-'], ['Detectado en', p.detectadoEn || '-'],
      ['Descripción', p.descripcion || '-'], ['Contención inmediata', p.contencion || '-'],
      ...(p.medicion ? [['Medición', `T Real ${p.medicion.tReal}s${p.medicion.takt ? ` · Takt ${p.medicion.takt}s` : ''}`]] : []),
    ]);
    y = doc.lastAutoTable.finalY + 6;
    const whys = p.porques.filter(w => w.trim());
    if (whys.length) {
      doc.setFont('helvetica', 'bold'); doc.text('5 Porqués', m, y); y += 2;
      body([...whys.map((w, i) => [`Porqué ${i + 1}`, w]), ['Causa raíz', p.causaRaiz || '-']]); y = doc.lastAutoTable.finalY + 6;
    }
    const causas = CATEGORIAS_6M.flatMap(c => (p.ishikawa[c] || []).map(t => [c, t]));
    if (causas.length) {
      if (y > 250) { doc.addPage(); y = m; }
      doc.setFont('helvetica', 'bold'); doc.text('Ishikawa (6M)', m, y); y += 2; body(causas); y = doc.lastAutoTable.finalY + 6;
    }
    const extra = [];
    ESNO_DIM.forEach(d => { if (p.esno[d.id].es || p.esno[d.id].no) extra.push([`Es/No es · ${d.label}`, `ES: ${p.esno[d.id].es || '-'}\nNO ES: ${p.esno[d.id].no || '-'}`]); });
    Object.entries(p.w2h).forEach(([k, v]) => { if (v) extra.push([`5W2H · ${k}`, v]); });
    if (p.pareto.length) extra.push(['Pareto', [...p.pareto].sort((a, b) => b.n - a.n).map(x => `${x.cat}: ${x.n}`).join(' | ')]);
    [['d1', 'D1 Equipo'], ['escape', 'D4 Punto de escape'], ['d5', 'D5 Correctivas'], ['d6', 'D6 Validación'], ['d7', 'D7 Prevención'], ['d8', 'D8 Cierre']].forEach(([k, l]) => { if (p.d8[k]) extra.push([l, p.d8[k]]); });
    if (extra.length) {
      if (y > 230) { doc.addPage(); y = m; }
      doc.setFont('helvetica', 'bold'); doc.text('Otras herramientas de análisis', m, y); y += 2; body(extra); y = doc.lastAutoTable.finalY + 6;
    }
    if (p.acciones.length) {
      if (y > 240) { doc.addPage(); y = m; }
      doc.setFont('helvetica', 'bold'); doc.text('Plan de acción', m, y); y += 2;
      autoTable(doc, { startY: y, margin: { left: m, right: m }, head: [['Acción', 'Responsable', 'Fecha', 'Estado']], body: p.acciones.map(a => [a.desc, a.resp || '-', a.fecha || '-', a.estado]), styles: { fontSize: 8.5 }, headStyles: { fillColor: [30, 64, 175] } });
    }
    doc.save(`problema-${(p.titulo || 'sin-titulo').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.pdf`);
    flash('✓ PDF exportado');
  };

  const comentarios = problema.comentarios || p.comentarios || [];
  const [texto, setTexto] = useState('');
  const sendComment = async () => {
    if (!texto.trim() || isNew && dirty) { if (isNew && dirty) flash('Guardá el problema antes de comentar'); return; }
    if (!user.trim()) { flash('Escribí tu nombre arriba para comentar'); return; }
    await addComentario(p.id, user.trim(), texto.trim()); setTexto('');
  };

  const est = estadoOf(p.estado);
  return (
    <div className="screen problemas-screen">
      <header className="app-header row">
        <button className="ghost-btn" onClick={() => (dirty && !window.confirm('Hay cambios sin guardar. ¿Salir igual?') ? null : onBack())}>← Problemas</button>
        <div className="grow">
          <h1>{p.titulo || 'Nuevo problema'}</h1>
          <p className="subtitle"><span className="est-dot" style={{ background: est.color }} /> {est.label}{dirty ? ' · cambios sin guardar' : ''}</p>
        </div>
        <button className="primary-btn" onClick={save} disabled={saving || !dirty}>{saving ? 'Guardando…' : '💾 Guardar'}</button>
      </header>

      {remoteNew && <div className="prob-banner">Otra persona actualizó este problema. Guardá tus cambios y reabrilo para ver los suyos.</div>}

      <nav className="prob-tabs">
        {TABS.map(([id, l]) => <button key={id} className={tab === id ? 'sel' : ''} onClick={() => setTab(id)}>{l}{id === 'comentarios' && comentarios.length ? ` (${comentarios.length})` : ''}</button>)}
      </nav>

      <div className="prob-body">
        {tab === 'resumen' && (
          <>
            <div className="card form-card">
              <label>Título del problema *<input value={p.titulo} onChange={e => set({ titulo: e.target.value })} placeholder="Ej: Pérdida de aceite en compresor" /></label>
              <label>Descripción<textarea rows={3} value={p.descripcion} onChange={e => set({ descripcion: e.target.value })} placeholder="¿Qué pasa, cuándo, con qué frecuencia?" /></label>
              <div className="grid2">
                <label>Estado<select value={p.estado} onChange={e => set({ estado: e.target.value })}>{ESTADOS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
                <label>Tipo<select value={p.tipo} onChange={e => set({ tipo: e.target.value })}>{TIPOS.map(t => <option key={t}>{t}</option>)}</select></label>
                <label>Severidad<select value={p.severidad} onChange={e => set({ severidad: e.target.value })}>{SEVERIDADES.map(t => <option key={t}>{t}</option>)}</select></label>
                <label>Responsable<input value={p.responsable} onChange={e => set({ responsable: e.target.value })} placeholder="Quién lo sigue" /></label>
                <label>Modelo<input value={p.modelo} onChange={e => set({ modelo: e.target.value })} placeholder="Ej: Inverter" /></label>
                <label>Capacidad<input value={p.capacidad} onChange={e => set({ capacidad: e.target.value })} placeholder="Ej: 12FC" /></label>
                <label>Línea<input value={p.linea} onChange={e => set({ linea: e.target.value })} placeholder="Ej: IDU" /></label>
                <label>Puesto<input value={p.puesto} onChange={e => set({ puesto: e.target.value })} placeholder="Ej: Brazing" /></label>
                <label>Cantidad afectada<input value={p.cantidad} onChange={e => set({ cantidad: e.target.value })} placeholder="Ej: 12 equipos" /></label>
                <label>Detectado en<input value={p.detectadoEn} onChange={e => set({ detectadoEn: e.target.value })} placeholder="Ej: Prueba de estanqueidad" /></label>
              </div>
              <label>Contención inmediata<textarea rows={2} value={p.contencion} onChange={e => set({ contencion: e.target.value })} placeholder="Qué se hizo para que no siga pasando mientras se analiza" /></label>
            </div>
            {p.medicion && (
              <div className="card medicion-card">
                <strong>⏱ Medición de origen</strong>
                <p>T Real {p.medicion.tReal}s{p.medicion.takt ? ` · Takt Time ${p.medicion.takt}s` : ''}{p.medicion.estudio ? ` · ${p.medicion.estudio}` : ''}</p>
              </div>
            )}
            <div className="card form-card">
              <label>Tu nombre (para firmar comentarios y cambios)<input value={user} onChange={e => setUserName(e.target.value)} placeholder="Ej: Michael" /></label>
              <p className="hint">Creado por {p.creador || user || '—'} · {fmtTs(p.creado)}</p>
            </div>
            {!isNew && (
              <button className="danger-btn" onClick={async () => { if (window.confirm('¿Eliminar este problema para todos?')) { await deleteProblema(p.id); onDeleted(); } }}>🗑 Eliminar problema</button>
            )}
          </>
        )}

        {tab === 'porques' && (
          <>
            <Guia titulo="¿Cómo se usa 5 Porqués?">
              <p>Sirve para llegar a la <strong>causa raíz</strong> preguntando &ldquo;¿por qué?&rdquo; una y otra vez, cada respuesta explica la anterior.</p>
              <ol>
                <li>Partí del problema concreto (ej: <em>“El compresor pierde aceite”</em>).</li>
                <li>Respondé el 1.º porqué con un <strong>hecho verificado</strong>, no una suposición.</li>
                <li>Preguntá por qué ocurrió esa respuesta, y repetí. Normalmente en el 4.º o 5.º llegás a un proceso o método y no a una persona.</li>
                <li>Frená cuando la respuesta es algo que podés corregir y que, si se arregla, evita que el problema vuelva.</li>
              </ol>
              <p><strong>Ejemplo:</strong> ¿Por qué pierde aceite? → La unión está floja. ¿Por qué? → No se aplicó el torque. ¿Por qué? → El torquímetro no estaba en el puesto. ¿Por qué? → No hay lugar fijo asignado. ¿Por qué? → No está definido en la hoja del proceso. <em>Causa raíz: falta de estándar de herramienta en el puesto.</em></p>
              <p className="guia-warn">Evitá culpar a una persona (“el operario se olvidó”). Preguntá por qué el proceso permitió que se olvidara.</p>
            </Guia>
            <div className="card form-card">
              <p className="hint"><strong>Problema:</strong> {p.titulo || '(poné un título en Resumen)'}</p>
              {p.porques.map((w, i) => (
                <div className="why-row" key={i}>
                  <span className="why-n">{i + 1}</span>
                  <label>¿Por qué? <input value={w} onChange={e => set({ porques: p.porques.map((x, j) => (j === i ? e.target.value : x)) })} placeholder={i === 0 ? '¿Por qué ocurre el problema?' : '¿Por qué ocurrió lo anterior?'} /></label>
                  {p.porques.length > 1 && <button className="take-del" onClick={() => set({ porques: p.porques.filter((_, j) => j !== i) })}>✕</button>}
                </div>
              ))}
              {p.porques.length < 7 && <button className="ghost-btn" onClick={() => set({ porques: [...p.porques, ''] })}>+ Agregar otro porqué</button>}
              <label className="causa-raiz">🎯 Causa raíz<textarea rows={2} value={p.causaRaiz} onChange={e => set({ causaRaiz: e.target.value })} placeholder="Conclusión: la causa que, si se corrige, evita que el problema vuelva" /></label>
            </div>
          </>
        )}

        {tab === 'ishikawa' && (
          <>
            <Guia titulo="¿Cómo se usa Ishikawa (6M)?">
              <p>Ordena <strong>todas las causas posibles</strong> en 6 familias. Es ideal cuando no sabés por dónde empezar o cuando participa un grupo (lluvia de ideas).</p>
              <ol>
                <li>Escribí el problema como “cabeza del pez” (ya está en el título).</li>
                <li>Recorré cada &ldquo;M&rdquo; y anotá las causas posibles: <strong>Mano de obra</strong> (capacitación, fatiga), <strong>Máquina</strong> (desgaste, calibración), <strong>Método</strong> (procedimiento, secuencia), <strong>Material</strong> (proveedor, lote), <strong>Medición</strong> (instrumentos, criterios), <strong>Medio ambiente</strong> (temperatura, orden, iluminación).</li>
                <li>Una idea por línea, sin juzgar al principio.</li>
                <li>Después marcá las más probables y verificalas en el puesto. Las confirmadas pasan al 5 Porqués o al plan de acción.</li>
              </ol>
            </Guia>
            <div className="ishi-grid">
              {CATEGORIAS_6M.map(c => (
                <div className="card ishi-cat" key={c}>
                  <h3>{c}</h3>
                  {(p.ishikawa[c] || []).map((t, i) => (
                    <div className="ishi-row" key={i}>
                      <input value={t} onChange={e => set({ ishikawa: { ...p.ishikawa, [c]: p.ishikawa[c].map((x, j) => (j === i ? e.target.value : x)) } })} placeholder="Posible causa" />
                      <button className="take-del" onClick={() => set({ ishikawa: { ...p.ishikawa, [c]: p.ishikawa[c].filter((_, j) => j !== i) } })}>✕</button>
                    </div>
                  ))}
                  <button className="ghost-btn small" onClick={() => set({ ishikawa: { ...p.ishikawa, [c]: [...(p.ishikawa[c] || []), ''] } })}>+ Causa</button>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'esno' && (
          <>
            <Guia titulo="¿Cómo se usa Es / No es?">
              <p>Sirve para <strong>acotar el problema</strong> antes de buscar causas: comparás dónde, cuándo y cuánto <em>sí</em> ocurre contra dónde podría ocurrir pero <em>no</em> ocurre. La causa suele estar en la diferencia.</p>
              <ol>
                <li>En cada fila (Qué, Dónde, Cuándo, Cuánto) escribí qué <strong>ES</strong> afectado.</li>
                <li>En la otra columna anotá qué <strong>NO ES</strong> afectado pero sería razonable que lo estuviera (otro puesto, otro turno, otro modelo).</li>
                <li>Mirá las diferencias: ¿qué cambió entre lo que falla y lo que no? Eso orienta el Ishikawa y los 5 Porqués.</li>
              </ol>
              <p><strong>Ejemplo:</strong> Dónde → ES: unidades del turno tarde en línea IDU · NO ES: turno mañana ni línea ODU. Pista: algo propio del turno tarde (herramienta, lote, temperatura).</p>
            </Guia>
            <div className="card form-card">
              {ESNO_DIM.map(d => (
                <div className="esno-row" key={d.id}>
                  <strong className="esno-dim">{d.label}</strong>
                  <label>ES<textarea rows={2} value={p.esno[d.id].es} onChange={e => set({ esno: { ...p.esno, [d.id]: { ...p.esno[d.id], es: e.target.value } } })} placeholder={d.ph} /></label>
                  <label>NO ES<textarea rows={2} value={p.esno[d.id].no} onChange={e => set({ esno: { ...p.esno, [d.id]: { ...p.esno[d.id], no: e.target.value } } })} placeholder="Podría ocurrir pero no ocurre" /></label>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'w2h' && (
          <>
            <Guia titulo="¿Cómo se usa 5W2H?">
              <p>Describe el problema o la acción respondiendo 7 preguntas, para que <strong>nadie interprete cosas distintas</strong>. Se usa para definir bien el problema o para detallar una solución.</p>
              <ol>
                <li><strong>What</strong> (Qué) · <strong>Why</strong> (Por qué importa) · <strong>Where</strong> (Dónde) · <strong>When</strong> (Cuándo) · <strong>Who</strong> (Quién) · <strong>How</strong> (Cómo) · <strong>How much</strong> (Cuánto: cantidad, costo, impacto).</li>
                <li>Contestá con datos concretos, no con generalidades.</li>
                <li>Si una respuesta es &ldquo;no sé&rdquo;, es una tarea de investigación pendiente: pasala al plan de acción.</li>
              </ol>
            </Guia>
            <div className="card form-card">
              {[['que', 'What · ¿Qué pasa?'], ['porque', 'Why · ¿Por qué es un problema?'], ['donde', 'Where · ¿Dónde ocurre?'], ['cuando', 'When · ¿Cuándo / con qué frecuencia?'], ['quien', 'Who · ¿Quién lo detecta / lo afecta?'], ['como', 'How · ¿Cómo se manifiesta?'], ['cuanto', 'How much · ¿Cuánto (cantidad / costo)?']].map(([k, l]) => (
                <label key={k}>{l}<textarea rows={2} value={p.w2h[k]} onChange={e => set({ w2h: { ...p.w2h, [k]: e.target.value } })} /></label>
              ))}
            </div>
          </>
        )}

        {tab === 'pareto' && (
          <>
            <Guia titulo="¿Cómo se usa Pareto?">
              <p>Muestra que <strong>pocas causas generan la mayoría del problema</strong> (regla 80/20), para que ataques primero lo que más pesa.</p>
              <ol>
                <li>Definí las categorías (tipos de defecto, causas, paradas, etc.) y cargá <strong>cuántas veces</strong> ocurrió cada una en un período.</li>
                <li>El gráfico ordena de mayor a menor y dibuja el % acumulado.</li>
                <li>Las barras que llegan hasta cerca del 80% son tus prioridades: enfocá el análisis y las acciones ahí.</li>
                <li>Repetí después de aplicar acciones para confirmar que bajó.</li>
              </ol>
              <p><strong>Ejemplo:</strong> Pérdida de aceite 18 · Rayado 5 · Falta de tornillo 3 · Otros 2. Con una sola causa explicás más del 60%.</p>
              <p className="hint">Para ver un Pareto de <em>todos</em> los problemas (por puesto, tipo o línea), usá el botón 📊 de la lista.</p>
            </Guia>
            <div className="card form-card">
              {p.pareto.map(it => (
                <div className="ishi-row" key={it.id}>
                  <input value={it.cat} onChange={e => set({ pareto: p.pareto.map(x => (x.id === it.id ? { ...x, cat: e.target.value } : x)) })} placeholder="Categoría (ej: Pérdida de aceite)" />
                  <input type="number" min="0" value={it.n} onChange={e => set({ pareto: p.pareto.map(x => (x.id === it.id ? { ...x, n: e.target.value } : x)) })} placeholder="Cant." style={{ maxWidth: 90 }} />
                  <button className="take-del" onClick={() => set({ pareto: p.pareto.filter(x => x.id !== it.id) })}>✕</button>
                </div>
              ))}
              <button className="ghost-btn" onClick={() => set({ pareto: [...p.pareto, { id: genId(), cat: '', n: '' }] })}>+ Agregar categoría</button>
              <ParetoChart items={p.pareto.map(x => ({ label: x.cat || '—', n: parseFloat(x.n) || 0 }))} />
            </div>
          </>
        )}

        {tab === 'd8' && (
          <>
            <Guia titulo="¿Cómo se usa el 8D?">
              <p>Es el reporte formal de resolución de problemas (el que suelen pedir clientes y calidad). Ordena todo el trabajo en 8 disciplinas. Varias se completan solas con lo que ya cargaste.</p>
              <ol>
                <li><strong>D1 Equipo:</strong> quiénes trabajan el problema.</li>
                <li><strong>D2 Descripción:</strong> qué pasa (usa la Descripción del Resumen; el Es / No es y 5W2H ayudan).</li>
                <li><strong>D3 Contención:</strong> acción inmediata para proteger al cliente.</li>
                <li><strong>D4 Causa raíz:</strong> con 5 Porqués/Ishikawa; indicá también por qué no se detectó (punto de escape).</li>
                <li><strong>D5 Acciones correctivas:</strong> las elegidas para eliminar la causa (ver Acciones).</li>
                <li><strong>D6 Implementación y validación:</strong> evidencia de que funcionan.</li>
                <li><strong>D7 Prevención:</strong> cómo evitar que vuelva en otros puestos/modelos (estándares, hojas de proceso).</li>
                <li><strong>D8 Cierre:</strong> reconocimiento al equipo y lecciones aprendidas.</li>
              </ol>
            </Guia>
            <div className="card form-card">
              <label>D1 · Equipo<textarea rows={2} value={p.d8.d1} onChange={e => set({ d8: { ...p.d8, d1: e.target.value } })} placeholder="Nombres y roles" /></label>
              <label>D2 · Descripción del problema<textarea rows={2} value={p.descripcion} onChange={e => set({ descripcion: e.target.value })} /></label>
              <label>D3 · Contención inmediata<textarea rows={2} value={p.contencion} onChange={e => set({ contencion: e.target.value })} /></label>
              <label>D4 · Causa raíz<textarea rows={2} value={p.causaRaiz} onChange={e => set({ causaRaiz: e.target.value })} /></label>
              <label>D4 · Punto de escape (¿por qué no se detectó?)<textarea rows={2} value={p.d8.escape} onChange={e => set({ d8: { ...p.d8, escape: e.target.value } })} /></label>
              <label>D5 · Acciones correctivas permanentes<textarea rows={2} value={p.d8.d5} onChange={e => set({ d8: { ...p.d8, d5: e.target.value } })} placeholder={p.acciones.length ? `Plan de acción: ${p.acciones.length} acciones cargadas` : 'Ver pestaña Acciones'} /></label>
              <label>D6 · Implementación y validación<textarea rows={2} value={p.d8.d6} onChange={e => set({ d8: { ...p.d8, d6: e.target.value } })} /></label>
              <label>D7 · Prevención de recurrencia<textarea rows={2} value={p.d8.d7} onChange={e => set({ d8: { ...p.d8, d7: e.target.value } })} /></label>
              <label>D8 · Cierre y reconocimiento<textarea rows={2} value={p.d8.d8} onChange={e => set({ d8: { ...p.d8, d8: e.target.value } })} /></label>
            </div>
          </>
        )}

        {tab === 'acciones' && (
          <>
            <Guia titulo="¿Cómo se usa el plan de acción?">
              <p>Convierte el análisis en <strong>tareas concretas</strong> con dueño y fecha. Sin esto el análisis queda en un papel.</p>
              <ol>
                <li>Por cada causa raíz confirmada, definí una acción que la elimine (no solo que tape el síntoma).</li>
                <li>Cada acción tiene que tener <strong>un responsable</strong> y <strong>una fecha</strong>.</li>
                <li>Actualizá el estado: Pendiente → En curso → Hecha.</li>
                <li>Cuando todas estén hechas, verificá en el puesto que el problema no vuelve a aparecer y recién ahí pasá el problema a <em>Cerrado</em>.</li>
              </ol>
              <p><strong>Ejemplo:</strong> “Asignar soporte fijo para el torquímetro y agregarlo a la hoja de proceso” · Responsable: Ingeniería · Fecha: 15/12.</p>
            </Guia>
            <div className="card form-card">
              {p.acciones.length === 0 && <p className="hint">Sin acciones todavía.</p>}
              {p.acciones.map(a => {
                const upd = patch => set({ acciones: p.acciones.map(x => (x.id === a.id ? { ...x, ...patch } : x)) });
                return (
                  <div className={`act-card est-${a.estado}`} key={a.id}>
                    <textarea rows={2} value={a.desc} onChange={e => upd({ desc: e.target.value })} placeholder="¿Qué hay que hacer?" />
                    <div className="act-row">
                      <input value={a.resp} onChange={e => upd({ resp: e.target.value })} placeholder="Responsable" />
                      <input type="date" value={a.fecha} onChange={e => upd({ fecha: e.target.value })} />
                      <select value={a.estado} onChange={e => upd({ estado: e.target.value })}>
                        <option value="pendiente">Pendiente</option><option value="curso">En curso</option><option value="hecha">Hecha</option>
                      </select>
                      <button className="take-del" onClick={() => set({ acciones: p.acciones.filter(x => x.id !== a.id) })}>✕</button>
                    </div>
                    <div className="act-row2">
                      <label>Impacto<select value={a.impacto || ''} onChange={e => upd({ impacto: e.target.value })}><option value="">—</option><option value="alto">Alto</option><option value="bajo">Bajo</option></select></label>
                      <label>Esfuerzo<select value={a.esfuerzo || ''} onChange={e => upd({ esfuerzo: e.target.value })}><option value="">—</option><option value="bajo">Bajo</option><option value="alto">Alto</option></select></label>
                    </div>
                  </div>
                );
              })}
              <button className="ghost-btn" onClick={() => set({ acciones: [...p.acciones, { id: genId(), desc: '', resp: '', fecha: '', estado: 'pendiente', impacto: '', esfuerzo: '' }] })}>+ Agregar acción</button>
            </div>
            <Guia titulo="¿Cómo se usa la matriz impacto / esfuerzo?">
              <p>Te ayuda a decidir <strong>por cuál acción empezar</strong> cuando hay varias.</p>
              <ol>
                <li>A cada acción asignale Impacto (cuánto reduce el problema) y Esfuerzo (tiempo, costo, complejidad).</li>
                <li>Hacé primero los <strong>Quick wins</strong> (alto impacto, bajo esfuerzo).</li>
                <li>Planificá los <strong>Proyectos grandes</strong> (alto impacto, alto esfuerzo) con responsable y fecha.</li>
                <li>Los <strong>Rellenos</strong> se hacen si sobra tiempo; lo de <strong>Evitar</strong> (bajo impacto, alto esfuerzo) conviene descartarlo.</li>
              </ol>
            </Guia>
            <div className="matriz">
              {[['alto', 'bajo', '⚡ Quick wins', 'ok'], ['alto', 'alto', '🏗 Proyectos grandes', 'blue'], ['bajo', 'bajo', '🧩 Rellenos', 'gray'], ['bajo', 'alto', '🚫 Evitar', 'over']].map(([imp, esf, label, c]) => (
                <div key={label} className={`mcell ${c}`}>
                  <strong>{label}</strong>
                  <div className="mchips">
                    {p.acciones.map((a, i) => (a.impacto === imp && a.esfuerzo === esf ? <span key={a.id} title={a.desc}>#{i + 1} {a.desc.slice(0, 22) || 'sin desc.'}</span> : null))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'comentarios' && (
          <div className="card form-card">
            <p className="hint">Seguimiento del equipo. Los comentarios se ven en vivo para todos.</p>
            {comentarios.length === 0 && <p className="hint">Todavía no hay comentarios.</p>}
            {[...comentarios].sort((a, b) => a.ts - b.ts).map(c => (
              <div className="coment" key={c.id}><strong>{c.autor}</strong><span>{fmtTs(c.ts)}</span><p>{c.texto}</p></div>
            ))}
            <textarea rows={2} value={texto} onChange={e => setTexto(e.target.value)} placeholder={user ? `Comentar como ${user}…` : 'Escribí tu nombre en Resumen para comentar'} />
            <button className="primary-btn" onClick={sendComment} disabled={!texto.trim()}>Enviar comentario</button>
          </div>
        )}

        <button className="ghost-btn pdf-btn" onClick={exportPdf}>⬇ Exportar análisis a PDF</button>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

/* ───────────── Contenedor ───────────── */
export default function ProblemasScreen({ onBack, prefill }) {
  const [problemas, setProblemas] = useState([]);
  const [status, setStatus] = useState(firebaseReady ? 'connecting' : 'local');
  const [openId, setOpenId] = useState(null);
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    const unsub = subscribeProblemas(
      list => { setProblemas(list); setStatus(firebaseReady ? 'ok' : 'local'); },
      () => setStatus('offline')
    );
    return () => unsub && unsub();
  }, []);

  // Al guardar un problema nuevo, pasa a abrirse desde la lista (ya con datos en vivo)
  useEffect(() => {
    if (draft && problemas.some(p => p.id === draft.id)) { setOpenId(draft.id); setDraft(null); }
  }, [problemas, draft]);

  useEffect(() => { if (prefill) setDraft(newProblema({ ...prefill, creador: getUser() })); }, [prefill]);

  if (draft) {
    return <Detalle key={draft.id} problema={draft} isNew onBack={() => setDraft(null)} onDeleted={() => setDraft(null)} />;
  }
  const current = problemas.find(p => p.id === openId);
  if (current) return <Detalle key={current.id} problema={current} onBack={() => setOpenId(null)} onDeleted={() => setOpenId(null)} />;

  return <Lista problemas={problemas} status={status} onBack={onBack} onOpen={setOpenId} onNew={() => setDraft(newProblema({ creador: getUser() }))} />;
}
