import { useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { genId } from '../utils/id';
import { firebaseReady } from '../firebase';
import { fmtDate } from '../utils/timer';
import {
  ESTADOS, TIPOS, SEVERIDADES, CATEGORIAS_6M,
  newProblema, subscribeProblemas, saveProblema, deleteProblema, addComentario,
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
  ['resumen', '📋 Resumen'], ['porques', '❓ 5 Porqués'], ['ishikawa', '🐟 Ishikawa'],
  ['acciones', '🛠 Acciones'], ['comentarios', '💬 Comentarios'],
];

function Detalle({ problema, onBack, onDeleted, isNew }) {
  const [p, setP] = useState(problema);
  const [dirty, setDirty] = useState(isNew);
  const [remoteNew, setRemoteNew] = useState(false);
  const [tab, setTab] = useState('resumen');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [user, setUser] = useState(getUser);

  // Si otra persona actualiza y no hay cambios míos sin guardar, se refleja al instante.
  useEffect(() => {
    if (problema.actualizado === p.actualizado) return;
    if (!dirty) setP(problema); else setRemoteNew(true);
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
                  </div>
                );
              })}
              <button className="ghost-btn" onClick={() => set({ acciones: [...p.acciones, { id: genId(), desc: '', resp: '', fecha: '', estado: 'pendiente' }] })}>+ Agregar acción</button>
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
