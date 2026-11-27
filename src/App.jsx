import { Component, useEffect, useRef, useState } from 'react';
import HomeScreen from './screens/HomeScreen';
import InstructivoScreen from './screens/InstructivoScreen';
import SetupScreen from './screens/SetupScreen';
import PuestosEditor from './screens/PuestosEditor';
import StudyScreen from './screens/StudyScreen';
import ResultsScreen from './screens/ResultsScreen';
import ProblemasScreen from './screens/ProblemasScreen';
import UploadTray from './components/UploadTray';
import { setPuestoHandler } from './utils/uploadQueue';
import { getMedia } from './utils/cloudinary';

class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace' }}>
          <h2 style={{ color: '#b91c1c' }}>Error en la aplicación</h2>
          <pre style={{ background: '#fee2e2', padding: 16, borderRadius: 8, whiteSpace: 'pre-wrap', fontSize: 13 }}>
            {this.state.error.message}
          </pre>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 16, padding: '8px 16px' }}>Reintentar</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Main() {
  const [screen, setScreen] = useState('home');
  const [study, setStudy] = useState(null);
  const [result, setResult] = useState(null);
  const [fromSaved, setFromSaved] = useState(false);
  const [prefill, setPrefill] = useState(null); // problema nuevo precargado desde Resultados
  const [draft, setDraft] = useState(null);
  const studyRef = useRef(null); studyRef.current = study;

  // Cuando una subida termina (aunque estés en otra pantalla), el archivo se agrega a su puesto
  useEffect(() => {
    setPuestoHandler((puestoId, item) => {
      if (!studyRef.current?.puestos.some(p => p.id === puestoId)) return false;
      setStudy(s => (s ? { ...s, puestos: s.puestos.map(p => (p.id === puestoId ? { ...p, imagen: null, media: [...getMedia(p), item] } : p)) } : s));
      return true;
    });
  }, []); // mediciones en curso (sobreviven a volver a Config)

  if (screen === 'home') {
    return (
      <HomeScreen
        onStudy={() => setScreen('setup')}
        onInstructivo={() => setScreen('instructivo')}
        onProblemas={() => { setPrefill(null); setScreen('problemas'); }}
        onViewSaved={e => {
          setStudy(e.study);
          setResult({ ...e.result, _savedId: e.id });
          setFromSaved(true);
          setScreen('results');
        }}
      />
    );
  }
  if (screen === 'problemas') return <ProblemasScreen prefill={prefill} onBack={() => (prefill ? (setPrefill(null), setScreen('results')) : setScreen('home'))} />;
  if (screen === 'instructivo') return <InstructivoScreen onBack={() => setScreen('home')} />;
  if (screen === 'setup') {
    return <SetupScreen initial={study} onBack={() => setScreen('home')} onNext={s => { if (!study) setDraft(null); setStudy(s); setScreen('editor'); }} />;
  }
  if (screen === 'editor') {
    return <PuestosEditor study={study} onChange={setStudy} onBack={() => setScreen('setup')} onStart={() => setScreen('study')} />;
  }
  if (screen === 'study') {
    return <StudyScreen study={study} draft={draft} onDraft={setDraft} onBack={() => setScreen('editor')} onResults={r => { setResult(r); setFromSaved(false); setScreen('results'); }} />;
  }
  return (
    <ResultsScreen
      study={study}
      result={result}
      onBack={() => (fromSaved ? (setFromSaved(false), setScreen('home')) : setScreen('study'))}
      onProblema={pf => { setPrefill(pf); setScreen('problemas'); }}
      backLabel={fromSaved ? '← Estudios guardados' : '← Volver a medir'}
      onNew={() => { setDraft(null); setStudy(null); setResult(null); setFromSaved(false); setScreen('home'); }}
    />
  );
}

// Aviso cuando se publica una versión nueva con la app abierta (no recarga sola para no perder datos)
function UpdateBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const had = !!navigator.serviceWorker.controller;
    const h = () => { if (had) setShow(true); };
    navigator.serviceWorker.addEventListener('controllerchange', h);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', h);
  }, []);
  if (!show) return null;
  return (
    <div className="update-banner" role="status">
      <span>🔄 Hay una versión nueva de la app. Guardá lo que estés haciendo y actualizá.</span>
      <button type="button" onClick={() => window.location.reload()}>Actualizar</button>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Main />
      <UploadTray />
      <UpdateBanner />
    </ErrorBoundary>
  );
}
