import { Component, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { runMigrations } from './lib/schema';
import './styles/index.css';

// localStorage-Schema migrieren/validieren, BEVOR React (und damit die Hooks)
// die App-Daten erstmals lesen. Idempotent und defensiv – wirft nie.
runMigrations();

/**
 * Fängt Render-Fehler ab und zeigt sie an, statt einen weißen Bildschirm zu
 * hinterlassen – erleichtert die Diagnose beim lokalen Start.
 */
class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Listly ist abgestürzt:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            fontFamily: 'system-ui, sans-serif',
            maxWidth: '40rem',
            margin: '10vh auto',
            padding: '0 1.5rem',
            lineHeight: 1.5,
          }}
        >
          <h1 style={{ fontSize: '1.3rem' }}>Listly konnte nicht geladen werden</h1>
          <p>Bitte melde diese Fehlermeldung, dann lässt sich die Ursache beheben:</p>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              background: '#f4eede',
              color: '#292420',
              padding: '1rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
            }}
          >
            {String(this.state.error?.stack || this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
