import { useState } from 'react';
import { genId } from '../utils/id';

const MODELOS = {
  OnOff: { capacidades: ['09FC', '12FC', '18FC', '22FC'], lineas: ['IDU', 'ODU'] },
  Inverter: { capacidades: ['09FC', '12FC', '18FC', '22FC'], lineas: ['IDU', 'ODU'] },
  Wrac: { capacidades: ['09FS', '12FS', '18FS'], lineas: ['ODU2'] },
  Portatil: { capacidades: ['12FC'], lineas: ['ODU2'] },
};
const MODELO_KEYS = Object.keys(MODELOS);
const modeloLabel = m => (m === 'Portatil' ? 'Portátil' : m);
const taktKey = (m, c, l) => `takt-${m}-${c}-${l}`;

export default function SetupScreen({ onNext, onBack, initial }) {
  const m0 = initial?.modelo || MODELO_KEYS[0];
  const c0 = initial?.capacidad || MODELOS[m0].capacidades[0];
  const l0 = initial?.linea || MODELOS[m0].lineas[0];

  const [analista, setAnalista] = useState(initial?.analista || '');
  const [modelo, setModelo] = useState(m0);
  const [capacidad, setCapacidad] = useState(c0);
  const [linea, setLinea] = useState(l0);
  const [saved, setSaved] = useState(false);
  const [takt, setTakt] = useState(() =>
    initial?.taktTime == null ? localStorage.getItem(taktKey(m0, c0, l0)) || '' : String(initial.taktTime)
  );

  const reloadTakt = (m, c, l) => {
    setTakt(localStorage.getItem(taktKey(m, c, l)) || '');
    setSaved(false);
  };

  const changeModelo = m => {
    const c = MODELOS[m].capacidades.includes(capacidad) ? capacidad : MODELOS[m].capacidades[0];
    const l = MODELOS[m].lineas.includes(linea) ? linea : MODELOS[m].lineas[0];
    setModelo(m); setCapacidad(c); setLinea(l);
    reloadTakt(m, c, l);
  };
  const changeCapacidad = c => { setCapacidad(c); reloadTakt(modelo, c, linea); };
  const changeLinea = l => { setLinea(l); reloadTakt(modelo, capacidad, l); };

  const analistaOk = analista.trim();

  const next = () => {
    if (!analistaOk) return;
    const t = parseFloat(takt) || null;
    if (t) localStorage.setItem(taktKey(modelo, capacidad, linea), String(t));
    const puestos = initial?.puestos?.length > 0
      ? initial.puestos
      : [{ id: genId(), nombre: 'Puesto 1', imagen: null, acciones: [] }];
    onNext({ analista: analista.trim(), modelo, capacidad, linea, taktTime: t, puestos });
  };

  const label = `${modelo} ${capacidad} · ${linea}`;
  const hasSaved = !!localStorage.getItem(taktKey(modelo, capacidad, linea));

  return (
    <div className="screen setup-screen">
      <header className="app-header row">
        <button className="ghost-btn" onClick={onBack}>← Menú</button>
        <div className="grow">
          <h1>Toma de Tiempo en Línea</h1>
          <p className="subtitle">Configuración del estudio</p>
        </div>
      </header>

      <div className="setup-body">
        <div className="detail-section">
          <div className="section-header">📋 Datos del estudio</div>
          <div className="field-row">
            <span className="fr-label">Analista *</span>
            <input value={analista} onChange={e => setAnalista(e.target.value)} placeholder="Nombre del analista" style={{ maxWidth: '240px' }} />
          </div>
          <div className="chips-section">
            <span className="chips-label">Modelo</span>
            <div className="model-grid">
              {MODELO_KEYS.map(m => (
                <button key={m} type="button" className={`model-btn${modelo === m ? ' sel' : ''}`} onClick={() => changeModelo(m)}>
                  {modeloLabel(m)}
                </button>
              ))}
            </div>
          </div>
          <div className="chips-section">
            <span className="chips-label">Capacidad</span>
            <div className="model-grid caps">
              {MODELOS[modelo].capacidades.map(c => (
                <button key={c} type="button" className={`model-btn${capacidad === c ? ' sel' : ''}`} onClick={() => changeCapacidad(c)}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="chips-section">
            <span className="chips-label">Línea</span>
            <div className="model-grid caps">
              {MODELOS[modelo].lineas.map(l => (
                <button key={l} type="button" className={`model-btn${linea === l ? ' sel' : ''}`} onClick={() => changeLinea(l)}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="detail-section">
          <div className="section-header">
            ⏱ Takt Time
            {hasSaved && (
              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="takt-saved-badge">💾 Guardado para {label}</span>
                <button
                  type="button"
                  className="danger-btn"
                  style={{ padding: '2px 10px', fontSize: '0.78rem' }}
                  onClick={() => { localStorage.removeItem(taktKey(modelo, capacidad, linea)); setTakt(''); setSaved(false); }}
                >
                  ✕ Eliminar
                </button>
              </span>
            )}
          </div>
          <div className="field-row">
            <span className="fr-label">Segundos — <em>{label}</em></span>
            <div className="tt-input-row" style={{ justifyContent: 'flex-end' }}>
              <input
                type="number" min={1} step="0.1" value={takt}
                onChange={e => { setTakt(e.target.value); setSaved(false); }}
                placeholder="Ej: 120"
                style={{ maxWidth: '110px', textAlign: 'center' }}
              />
              <button
                type="button" className="ghost-btn tt-save-btn" disabled={!takt}
                onClick={() => {
                  const v = parseFloat(takt);
                  if (v) { localStorage.setItem(taktKey(modelo, capacidad, linea), String(v)); setSaved(true); }
                }}
              >
                {saved ? '✓ Guardado' : '💾 Guardar'}
              </button>
            </div>
          </div>
          <div style={{ padding: '8px 16px 10px', borderTop: '1px solid #f0f0f0' }}>
            <p className="hint" style={{ fontSize: '0.8rem' }}>
              Se guarda y recarga automáticamente por cada combinación Modelo · Capacidad · Línea. Dejalo vacío si no necesitás análisis de Takt Time.
            </p>
          </div>
        </div>

        <button className="primary-btn big" disabled={!analistaOk} onClick={next}>Configurar Puestos →</button>
        {!analistaOk && <p className="hint">Completá el nombre del analista.</p>}
      </div>
    </div>
  );
}
