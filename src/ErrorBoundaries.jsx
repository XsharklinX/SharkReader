import React from 'react';

export class EpubReaderBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error('[EpubReaderBoundary]', error, info);
    }

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <div className="flex h-full flex-col items-center justify-center gap-5 p-8 text-center" style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-color)' }}>
                <span className="text-6xl">📕</span>
                <h2 className="text-xl font-black">Error inesperado en el lector</h2>
                <p className="max-w-sm text-sm font-medium opacity-60">{this.state.error.message}</p>
                <button
                    onClick={this.props.onClose}
                    className="rounded-2xl px-6 py-3 text-sm font-black text-white"
                    style={{ backgroundColor: 'var(--highlight)' }}>
                    ← Volver a la biblioteca
                </button>
            </div>
        );
    }
}

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, errorInfo: error };
    }

    componentDidCatch(error, info) {
        console.error('ErrorBoundary:', error, info);
    }

    render() {
        if (!this.state.hasError) return this.props.children;

        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f172a', color: 'white', textAlign: 'center', padding: '20px' }}>
                <h1 style={{ fontSize: '2.5rem', color: '#ef4444', marginBottom: '10px' }}>¡Error Crítico! 🦈</h1>
                <p style={{ background: 'rgba(255,0,0,0.1)', padding: '15px', borderRadius: '10px', fontFamily: 'monospace', fontSize: '12px', marginBottom: '30px' }}>
                    {this.state.errorInfo && this.state.errorInfo.toString()}
                </p>
                <button
                    onClick={() => {
                        localStorage.clear();
                        indexedDB.deleteDatabase('SharkReaderDB');
                        window.location.reload();
                    }}
                    style={{ padding: '15px 30px', background: '#ef4444', border: 'none', borderRadius: '12px', color: 'white', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }}>
                    Resetear Datos y Reiniciar
                </button>
            </div>
        );
    }
}

export class PanelErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error(`[${this.props.name || 'Panel'}ErrorBoundary]`, error, info);
    }

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
                <div
                    className="max-w-md rounded-3xl border p-6 text-center shadow-2xl"
                    style={{
                        backgroundColor: 'var(--surface-bg)',
                        borderColor: 'var(--border-color)',
                        color: 'var(--text-color)',
                    }}>
                    <h2 className="text-xl font-black">No se pudo abrir {this.props.label || 'este panel'}</h2>
                    <p className="mt-3 text-sm opacity-60">
                        El resto de la app sigue activo. Cierra este panel y revisamos el error sin resetear tus datos.
                    </p>
                    <p className="mt-4 rounded-2xl bg-red-500/10 p-3 text-left font-mono text-xs text-red-400">
                        {this.state.error?.message || String(this.state.error)}
                    </p>
                    <button
                        onClick={this.props.onClose}
                        className="mt-5 rounded-2xl px-5 py-3 text-sm font-black text-white"
                        style={{ backgroundColor: 'var(--highlight)' }}>
                        Cerrar panel
                    </button>
                </div>
            </div>
        );
    }
}
