import { Component, useState } from 'react';
import HomeScreen from './screens/HomeScreen';
import InstructivoScreen from './screens/InstructivoScreen';
import SetupScreen from './screens/SetupScreen';
import PuestosEditor from './screens/PuestosEditor';
import StudyScreen from './screens/StudyScreen';
import ResultsScreen from './screens/ResultsScreen';

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
  const [draft, setDraft] = useState(null); // mediciones en curso (sobreviven a volver a Config)

  if (screen === 'home') {
    return (
      <HomeScreen
        onStudy={() => setScreen('setup')}
        onInstructivo={() => setScreen('instructivo')}
        onViewSaved={e => {
          setStudy(e.study);
          setResult({ ...e.result, _savedId: e.id });
          setFromSaved(true);
          setScreen('results');
        }}
      />
    );
  }
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
      backLabel={fromSaved ? '← Estudios guardados' : '← Volver a medir'}
      onNew={() => { setDraft(null); setStudy(null); setResult(null); setFromSaved(false); setScreen('home'); }}
    />
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Main />
    </ErrorBoundary>
  );
}
