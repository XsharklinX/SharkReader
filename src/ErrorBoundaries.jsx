import React from 'react';

export class EpubReaderBoundary extends React.Component {
    constructor(props) { super(props); this.state = { error: null }; }
    static getDerivedStateFromError(error) { return { error }; }
    componentDidCatch(error, info) { console.error('[EpubReaderBoundary]', error, info); }
    render() {
        if (this.state.error) {
            return (
                <div className="flex flex-col items-center justify-center h-full gap-5 p-8 text-center" style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-color)' }}>
                    <span className="text-6xl">📕</span>
                    <h2 className="text-xl font-black">Error inesperado en el lector</h2>
                    <p className="text-sm opacity-60 max-w-sm font-medium">{this.state.error.message}</p>
                    <button onClick={this.props.onClose}
                        className="px-6 py-3 rounded-2xl font-black text-sm text-white"
                        style={{ backgroundColor: 'var(--highlight)' }}>
                        ← Volver a la biblioteca
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

export class ErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { hasError: false, errorInfo: null }; }
    static getDerivedStateFromError(error) { return { hasError: true, errorInfo: error }; }
    componentDidCatch(error, info) { console.error('ErrorBoundary:', error, info); }
    render() {
        if (this.state.hasError) return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f172a', color: 'white', textAlign: 'center', padding: '20px' }}>
                <h1 style={{ fontSize: '2.5rem', color: '#ef4444', marginBottom: '10px' }}>¡Error Crítico! 🦈</h1>
                <p style={{ background: 'rgba(255,0,0,0.1)', padding: '15px', borderRadius: '10px', fontFamily: 'monospace', fontSize: '12px', marginBottom: '30px' }}>
                    {this.state.errorInfo && this.state.errorInfo.toString()}
                </p>
                <button onClick={() => { localStorage.clear(); indexedDB.deleteDatabase('SharkReaderDB'); window.location.reload(); }}
                    style={{ padding: '15px 30px', background: '#ef4444', border: 'none', borderRadius: '12px', color: 'white', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }}>
                    Resetear Datos y Reiniciar
                </button>
            </div>
        );
        return this.props.children;
    }
}
