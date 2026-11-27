import { useState, useEffect } from 'react';
import { subscribeStudies, deleteStudy } from '../utils/sync';
import { firebaseReady } from '../firebase';

function loadLocal() {
  try { return JSON.parse(localStorage.getItem('saved-studies') || '[]'); } catch { return []; }
}

const normTakes = v => (!v ? [] : Array.isArray(v) ? v : [{ ms: v, val: 100 }]);
const avgMs = takes => (takes.length ? takes.reduce((s, t) => s + t.ms, 0) / takes.length : 0);

function calcEff(study, result) {
  if (!study || !result) return null;
  const { meds = {}, puestoRec = {}, modo = 'elemento' } = result;
  let std = 0;
  let real = 0;
  study.puestos?.forEach(p => {
    p.acciones?.forEach(a => { std += parseFloat(a.tstd) || 0; });
    if (modo === 'puesto') real += avgMs(normTakes(puestoRec[p.id])) / 1000;
    else {
      const pm = meds[p.id] || {};
      p.acciones?.forEach(a => { real += avgMs(normTakes(pm[a.id])) / 1000; });
    }
  });
  return real > 0 && std > 0 ? (std / real) * 100 : null;
}

export default function HomeScreen({ onStudy, onInstructivo, onProblemas, onViewSaved }) {
  const [saved, setSaved] = useState(loadLocal);
  const [sync, setSync] = useState(firebaseReady ? 'connecting' : 'local');

  useEffect(() => {
    if (!firebaseReady) return;
    const unsub = subscribeStudies(
      list => { setSaved(list); setSync('ok'); },
      () => { setSaved(loadLocal()); setSync('offline'); }
    );
    return () => { unsub && unsub(); };
  }, []);

  const remove = async id => {
    if (firebaseReady) {
      try { await deleteStudy(id); return; } catch { /* cae a local */ }
    }
    const next = saved.filter(s => s.id !== id);
    setSaved(next);
    try { localStorage.setItem('saved-studies', JSON.stringify(next)); } catch { /* ignore */ }
  };

  return (
    <div className="screen home-screen">
      <header className="home-header">
        <span className="home-logo-icon">⏱</span>
        <div>
          <h1>Estudio de Tiempos en Línea</h1>
          <p>Sistema de medición y análisis de tiempos en línea</p>
        </div>
        {sync !== 'local' && (
          <div className={`sync-badge ${sync}`}>
            {sync === 'connecting' && '🔄 Conectando…'}
            {sync === 'ok' && '☁ Sincronizado'}
            {sync === 'offline' && '⚠ Sin conexión'}
          </div>
        )}
      </header>

      <main className="home-body">
        <button className="home-card primary" onClick={onStudy}>
          <span className="hc-icon">📋</span>
          <div className="hc-text">
            <h2>Toma de Tiempo</h2>
            <p>Configurar puestos, acciones y ejecutar el estudio de tiempos en línea de producción</p>
          </div>
          <span className="hc-arrow">→</span>
        </button>

        <button className="home-card" onClick={onProblemas}>
          <span className="hc-icon">🔎</span>
          <div className="hc-text">
            <h2>Problemas y Análisis</h2>
            <p>5 Porqués, Ishikawa y plan de acción por puesto, con seguimiento del equipo</p>
          </div>
          <span className="hc-arrow">→</span>
        </button>

        <button className="home-card secondary" onClick={onInstructivo}>
          <span className="hc-icon">📖</span>
          <div className="hc-text">
            <h2>Instructivo de Uso</h2>
            <p>Interpretación de resultados, variables del estudio y metodología de análisis</p>
          </div>
          <span className="hc-arrow">→</span>
        </button>

        {saved.length > 0 && (
          <div className="saved-section">
            <h3 className="saved-title">📂 Estudios guardados ({saved.length})</h3>
            <div className="saved-list">
              {saved.map(e => {
                const eff = calcEff(e.study, e.result);
                const d = new Date(e.timestamp);
                const dateStr = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const timeStr = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
                return (
                  <div className="saved-card" key={e.id}>
                    <div className="sc-main">
                      <div className="sc-header">
                        <span className="sc-model">{e.study?.modelo} {e.study?.capacidad} · {e.study?.linea}</span>
                        <span className="sc-date">{dateStr} {timeStr}</span>
                      </div>
                      <div className="sc-meta">
                        <span>Analista: {e.study?.analista}</span>
                        {e.study?.taktTime && <span> · TT: {e.study.taktTime}s</span>}
                        {e.study?.puestos?.some(p => p.operario) && (
                          <span> · Ops: {e.study.puestos.filter(p => p.operario).map(p => p.operario).join(', ')}</span>
                        )}
                      </div>
                      {eff != null && (
                        <span className={`sc-eff ${eff >= 95 ? 'ok' : eff >= 80 ? 'warn' : 'over'}`}>
                          Eficiencia: {eff.toFixed(0)}%
                        </span>
                      )}
                    </div>
                    <div className="sc-actions">
                      <button className="primary-btn small" onClick={() => onViewSaved(e)}>Ver</button>
                      <button className="danger-btn small" onClick={() => remove(e.id)}>✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <footer className="home-footer">
        <p>Líneas: OnOff · Inverter · Wrac · Portátil &nbsp;|&nbsp; 09FC · 12FC · 18FC · 22FC · 09FS · 12FS · 18FS</p>
      </footer>
    </div>
  );
}
