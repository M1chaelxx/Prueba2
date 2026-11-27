import { useState, useEffect } from 'react';
import { genId } from '../utils/id';
import MediaPicker from '../components/MediaPicker';
import { getMedia } from '../utils/cloudinary';
import { savePuestoTemplate, loadPuestosTemplates, deletePuestoTemplate } from '../utils/sync';

export default function PuestosEditor({ study, onChange, onBack, onStart }) {
  const [selId, setSelId] = useState(study.puestos[0]?.id);
  const [templates, setTemplates] = useState([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [saveTplName, setSaveTplName] = useState('');

  useEffect(() => {
    loadPuestosTemplates(study.modelo).then(setTemplates);
  }, [study.modelo]);

  const puestos = study.puestos;
  const sel = puestos.find(p => p.id === selId) || puestos[0];

  const updatePuesto = (id, patch) => {
    onChange({
      ...study,
      puestos: puestos.map(p => (p.id === id ? { ...p, ...patch } : p)),
    });
  };

  const addPuesto = () => {
    const newP = { id: genId(), nombre: `Puesto ${puestos.length + 1}`, imagen: null, acciones: [] };
    onChange({ ...study, puestos: [...puestos, newP] });
    setSelId(newP.id);
  };

  const removePuesto = id => {
    if (puestos.length <= 1) return;
    const next = puestos.filter(p => p.id !== id);
    onChange({ ...study, puestos: next });
    if (selId === id) setSelId(next[0].id);
  };

  const addAccion = () => {
    updatePuesto(sel.id, {
      acciones: [...sel.acciones, { id: genId(), desc: '', cant: 1, tstd: '' }],
    });
  };

  const updateAccion = (aid, patch) => {
    updatePuesto(sel.id, {
      acciones: sel.acciones.map(a => (a.id === aid ? { ...a, ...patch } : a)),
    });
  };

  const removeAccion = aid => {
    updatePuesto(sel.id, { acciones: sel.acciones.filter(a => a.id !== aid) });
  };

  const moveAccion = (idx, dir) => {
    const arr = [...sel.acciones];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    updatePuesto(sel.id, { acciones: arr });
  };

  const canStart = puestos.length > 0;

  const handleSaveTemplate = async () => {
    if (!saveTplName.trim()) return;
    await savePuestoTemplate(study.modelo, saveTplName, puestos);
    setSaveTplName('');
    loadPuestosTemplates(study.modelo).then(setTemplates);
    setShowTemplates(false);
  };

  const handleLoadTemplate = (tpl) => {
    const newPuestos = tpl.puestos.map(p => ({ ...p, id: genId() }));
    onChange({ ...study, puestos: newPuestos });
    setSelId(newPuestos[0].id);
    setShowTemplates(false);
  };

  const handleDeleteTemplate = async (tplName) => {
    await deletePuestoTemplate(study.modelo, tplName);
    loadPuestosTemplates(study.modelo).then(setTemplates);
  };

  return (
    <div className="screen editor-screen">
      <header className="app-header row">
        <button className="ghost-btn" onClick={onBack}>← Volver</button>
        <div className="grow">
          <h1>Acciones por puesto</h1>
          <p className="subtitle">{study.modelo} {study.capacidad} · Línea {study.linea} · Analista: {study.analista}</p>
        </div>
        <button className="primary-btn" disabled={!canStart} onClick={onStart}>
          ▶ Iniciar Estudio
        </button>
      </header>

      <div className="editor-body">
        <aside className="puesto-list">
          {puestos.map((p, i) => (
            <div
              key={p.id}
              role="button"
              className={`puesto-item${p.id === sel?.id ? ' sel' : ''}`}
              onClick={() => setSelId(p.id)}
            >
              <span className="pnum">P{String(i + 1).padStart(2, '0')}</span>
              <span className="pname">{p.nombre}</span>
              <span className="pcount">{p.acciones.length} acc.</span>
              {puestos.length > 1 && (
                <button
                  className="puesto-del"
                  title="Eliminar puesto"
                  onClick={e => { e.stopPropagation(); removePuesto(p.id); }}
                >×</button>
              )}
            </div>
          ))}
          <button className="puesto-add-btn" onClick={addPuesto}>+ Agregar puesto</button>
          <button className="puesto-add-btn" onClick={() => setShowTemplates(!showTemplates)} style={{ backgroundColor: '#2563eb', borderColor: '#2563eb', color: 'white' }}>
            📋 Plantillas ({templates.length})
          </button>
        </aside>

        {sel && (
          <main className="puesto-detail">

            {/* ── Datos del puesto ── */}
            <div className="detail-section">
              <div className="section-header">👤 Datos del puesto</div>
              <div className="field-row">
                <span className="fr-label">Nombre del puesto</span>
                <input
                  value={sel.nombre}
                  onChange={e => updatePuesto(sel.id, { nombre: e.target.value })}
                  style={{ maxWidth: '60%' }}
                />
              </div>
              <div className="field-row">
                <span className="fr-label">Operario</span>
                <input
                  value={sel.operario || ''}
                  onChange={e => updatePuesto(sel.id, { operario: e.target.value })}
                  placeholder="Nombre del operario (opcional)"
                  style={{ maxWidth: '60%' }}
                />
              </div>
            </div>

            {/* ── Fotos y videos de referencia ── */}
            <div className="detail-section">
              <div className="section-header">📷 Fotos y videos de referencia ({getMedia(sel).length})</div>
              <div style={{ padding: '12px 16px' }}>
                <MediaPicker target={{ type: 'puesto', id: sel.id }} items={getMedia(sel)} onChange={items => updatePuesto(sel.id, { media: items, imagen: null })} />
              </div>
            </div>

            {/* ── Acciones ── */}
            <div className="detail-section">
              <div className="section-header">
                📋 Acciones ({sel.acciones.length})
                <button className="primary-btn small" style={{ marginLeft: 'auto' }} onClick={addAccion}>
                  + Agregar acción
                </button>
              </div>
              <div style={{ padding: '8px 16px 14px' }}>
                {sel.acciones.length === 0 ? (
                  <p className="hint" style={{ paddingTop: 8 }}>Sin acciones todavía. Agregá las operaciones de este puesto.</p>
                ) : (
                  <div className="acc-table">
                    <div className="acc-row head">
                      <span>#</span><span>DESCRIPCIÓN</span><span></span>
                    </div>
                    {sel.acciones.map((a, i) => (
                      <div className="acc-row" key={a.id}>
                        <span className="anum">{i + 1}</span>
                        <input
                          value={a.desc}
                          onChange={e => updateAccion(a.id, { desc: e.target.value })}
                          placeholder="Descripción de la acción"
                        />
                        <span className="acc-btns">
                          <button onClick={() => moveAccion(i, -1)} disabled={i === 0}>↑</button>
                          <button onClick={() => moveAccion(i, 1)} disabled={i === sel.acciones.length - 1}>↓</button>
                          <button className="del" onClick={() => removeAccion(a.id)}>✕</button>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </main>
        )}
      </div>

      {showTemplates && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
          <div style={{ backgroundColor: 'var(--bg)', color: 'var(--text)', borderRadius: '8px', padding: '24px', maxWidth: '500px', width: '100%', maxHeight: '80vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0 }}>Plantillas de Puestos</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="ghost-btn" onClick={() => { setShowTemplates(false); setSaveTplName(''); }} style={{ padding: '4px 8px', fontSize: '0.8rem' }}>← Volver</button>
                <button className="ghost-btn" onClick={() => setShowTemplates(false)} style={{ padding: '4px 8px' }}>✕</button>
              </div>
            </div>

            {templates.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '8px' }}>Cargar plantilla:</h3>
                {templates.map(tpl => (
                  <div key={tpl.nombre} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: 'var(--bg2)', borderRadius: '4px', marginBottom: '6px' }}>
                    <div>
                      <strong>{tpl.nombre}</strong>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text2)' }}>{tpl.puestos.length} puestos</span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="ghost-btn" onClick={() => handleLoadTemplate(tpl)}>Cargar</button>
                      <button className="danger-btn" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => handleDeleteTemplate(tpl.nombre)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '8px' }}>Guardar configuración actual:</h3>
              <input
                type="text"
                placeholder="Nombre de la plantilla"
                value={saveTplName}
                onChange={e => setSaveTplName(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', marginBottom: '8px', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--input-bg)', color: 'var(--text)' }}
              />
              <button className="primary-btn" onClick={handleSaveTemplate} disabled={!saveTplName.trim()} style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}>💾 Guardar plantilla</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
