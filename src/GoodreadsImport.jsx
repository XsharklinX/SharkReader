import React, { useState } from 'react';

const EXAMPLE = `El nombre del viento, Patrick Rothfuss
La sombra del viento, Carlos Ruiz Zafón
Dune, Frank Herbert`;

const GoodreadsImport = ({ onImport, onClose }) => {
    const [text, setText] = useState('');
    const [result, setResult] = useState(null);

    const handleImport = () => {
        if (!text.trim()) return;
        const count = onImport(text);
        setResult(count);
    };

    return (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/70 backdrop-blur-sm fade-in" onClick={onClose}>
            <div className="bg-[var(--surface-bg)] w-full max-w-lg rounded-3xl p-7 shadow-2xl border border-[var(--border-color)] mx-4"
                onClick={e => e.stopPropagation()}>

                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h2 className="text-xl font-black">Importar lista de lectura</h2>
                        <p className="text-xs opacity-50 mt-0.5">Goodreads, listas manuales, cualquier formato</p>
                    </div>
                    <button onClick={onClose} className="p-2 opacity-50 hover:opacity-100 transition text-xl leading-none">×</button>
                </div>

                {result !== null ? (
                    <div className="text-center py-8">
                        <div className="text-5xl mb-4">{result > 0 ? '📚' : '🤔'}</div>
                        <p className="text-xl font-black mb-2">
                            {result > 0 ? `¡${result} libro${result !== 1 ? 's' : ''} añadido${result !== 1 ? 's' : ''}!` : 'No se encontraron libros'}
                        </p>
                        <p className="text-sm opacity-60 mb-6">
                            {result > 0 ? 'Los libros aparecen en tu biblioteca como "Pendientes". Cuando los consigas, añade el archivo EPUB/PDF.' : 'Revisa el formato e inténtalo de nuevo.'}
                        </p>
                        <button onClick={onClose}
                            className="px-6 py-3 rounded-2xl font-black text-sm text-white"
                            style={{ backgroundColor: 'var(--highlight)' }}>
                            Cerrar
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
                            <p className="text-xs font-bold text-blue-500 mb-2">📋 Formatos aceptados:</p>
                            <ul className="text-xs opacity-70 space-y-1 list-disc list-inside">
                                <li>Una línea por libro: <code>Título, Autor</code></li>
                                <li>Solo títulos (un título por línea)</li>
                                <li>CSV de Goodreads (exportar → «Mis Libros»)</li>
                                <li>Separadores: coma, punto y coma, barra vertical</li>
                            </ul>
                        </div>

                        <textarea
                            value={text}
                            onChange={e => setText(e.target.value)}
                            placeholder={EXAMPLE}
                            className="w-full h-40 bg-black/5 dark:bg-white/5 rounded-2xl p-4 text-sm font-medium outline-none border border-transparent focus:border-[var(--highlight)] transition resize-none mb-4"
                            style={{ color: 'var(--text-color)', fontFamily: 'monospace' }}
                        />

                        <div className="flex gap-3">
                            <button onClick={onClose} className="flex-1 py-3 rounded-2xl font-bold text-sm bg-black/5 dark:bg-white/5 hover:opacity-80 transition">
                                Cancelar
                            </button>
                            <button onClick={handleImport} disabled={!text.trim()}
                                className="flex-1 py-3 rounded-2xl font-bold text-sm text-white transition hover:brightness-110 disabled:opacity-40"
                                style={{ backgroundColor: 'var(--highlight)' }}>
                                Importar lista
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default GoodreadsImport;
