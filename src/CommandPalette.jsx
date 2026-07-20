// Paleta de comandos (Ctrl+K): buscador de acciones y libros.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icons } from './icons';
import { filterCommands, filterBooksForPalette } from './commandPaletteSearch';

export default function CommandPalette({
    open,
    onClose,
    books = [],
    lastReadId,
    openBook,
    setView,
    setSettingsOpen,
    setShowWorkshop,
    setShowAnnotationsModal,
    setTheme,
    exportZipBackup,
    spinBookRoulette,
    openFilePicker,
    openFolderPicker,
    onOpenLibraryRepair,
    lang,
}) {
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef(null);
    const listRef = useRef(null);

    useEffect(() => {
        if (open) {
            setQuery('');
            setActiveIndex(0);
            const timer = setTimeout(() => inputRef.current?.focus(), 30);
            return () => clearTimeout(timer);
        }
    }, [open]);

    const lastBook = useMemo(() => books.find(b => b.id === lastReadId) || null, [books, lastReadId]);

    const commands = useMemo(() => {
        const run = (fn) => () => { fn(); onClose(); };
        const list = [];
        if (lastBook) {
            list.push({ id: 'continue', icon: '▶️', label: `Continuar leyendo: ${lastBook.name}`, hint: `${lastBook.progress || 0}%`, keywords: 'continuar leer seguir ultimo', action: run(() => openBook(lastBook.id)) });
        }
        list.push(
            { id: 'go-library', icon: '📚', label: 'Ir a la Biblioteca', keywords: 'biblioteca library inicio home', action: run(() => setView('library')) },
            { id: 'go-analytics', icon: '📊', label: 'Abrir Analíticas', keywords: 'analiticas estadisticas stats analytics', action: run(() => setView('analytics')) },
            { id: 'go-achievements', icon: '🏆', label: 'Ver Logros', keywords: 'logros achievements trofeos', action: run(() => setView('achievements')) },
        );
        if (openFilePicker) list.push({ id: 'add-book', icon: '➕', label: 'Añadir libro', keywords: 'añadir agregar importar libro epub pdf archivo', action: run(() => openFilePicker()) });
        if (openFolderPicker) list.push({ id: 'add-folder', icon: '📂', label: 'Añadir carpeta', keywords: 'añadir agregar importar carpeta folder libros', action: run(() => openFolderPicker()) });
        if (setShowAnnotationsModal) list.push({ id: 'open-annotations', icon: '📝', label: 'Buscar en mis anotaciones', keywords: 'anotaciones subrayados notas marcadores buscar highlights bookmarks', action: run(() => setShowAnnotationsModal(true)) });
        list.push(
            { id: 'open-settings', icon: '⚙️', label: 'Abrir Configuración', keywords: 'configuracion ajustes settings opciones', action: run(() => setSettingsOpen(true)) },
            { id: 'open-workshop', icon: '🧩', label: 'Abrir Workshop', keywords: 'workshop addons modulos extensiones', action: run(() => setShowWorkshop(true)) },
        );
        if (onOpenLibraryRepair) list.push({ id: 'library-repair', icon: '🔧', label: 'Reparador de biblioteca', keywords: 'reparar biblioteca portadas duplicados huerfanos repair', action: run(() => onOpenLibraryRepair()) });
        list.push(
            { id: 'theme-dark', icon: '🌙', label: 'Tema oscuro', keywords: 'tema oscuro dark modo noche', action: run(() => setTheme('dark')) },
            { id: 'theme-light', icon: '☀️', label: 'Tema claro', keywords: 'tema claro light dia', action: run(() => setTheme('light')) },
            { id: 'theme-sepia', icon: '📜', label: 'Tema sepia', keywords: 'tema sepia papel calido', action: run(() => setTheme('sepia')) },
            { id: 'roulette', icon: '🎡', label: 'Ruleta: elegir un libro al azar', keywords: 'ruleta azar random roulette sorpresa', action: run(() => spinBookRoulette()) },
            { id: 'backup', icon: '💾', label: 'Exportar backup ZIP', keywords: 'backup exportar copia seguridad zip', action: run(() => exportZipBackup(false)) },
            { id: 'backup-full', icon: '🗄️', label: 'Exportar backup completo (con libros)', keywords: 'backup exportar completo libros epub pdf zip', action: run(() => exportZipBackup(true)) },
        );
        return list;
    }, [lastBook, onClose, openBook, setView, setSettingsOpen, setShowWorkshop, setShowAnnotationsModal, setTheme, exportZipBackup, spinBookRoulette, openFilePicker, openFolderPicker, onOpenLibraryRepair]);

    const results = useMemo(() => {
        const matchedCommands = filterCommands(query, commands).map(cmd => ({ kind: 'command', ...cmd }));
        const matchedBooks = filterBooksForPalette(query, books).map(b => ({
            kind: 'book',
            ...b,
            action: () => { openBook(b.bookId); onClose(); },
        }));
        return [...matchedCommands, ...matchedBooks];
    }, [query, commands, books, openBook, onClose]);

    useEffect(() => { setActiveIndex(0); }, [query]);

    useEffect(() => {
        if (!open) return;
        const el = listRef.current?.children?.[activeIndex];
        el?.scrollIntoView?.({ block: 'nearest' });
    }, [activeIndex, open]);

    if (!open) return null;

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, results.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
        else if (e.key === 'Enter') { e.preventDefault(); results[activeIndex]?.action?.(); }
        else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };

    return (
        <div className="fixed inset-0 z-[700] flex items-start justify-center bg-black/50 backdrop-blur-sm pt-[12vh] fade-in" onClick={onClose}>
            <div role="dialog" aria-modal="true" aria-label={lang === 'en' ? 'Command palette' : 'Paleta de comandos'} className="w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden"
                style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-2.5 px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <Icons.Search />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={lang === 'en' ? 'Type a command or book name…' : 'Escribe un comando o el nombre de un libro…'}
                        aria-label={lang === 'en' ? 'Search commands or books' : 'Buscar comandos o libros'}
                        className="flex-1 bg-transparent outline-none text-sm font-medium"
                        style={{ color: 'var(--text-color)' }}
                    />
                    <kbd className="text-[9px] font-black uppercase tracking-widest opacity-35 border rounded px-1.5 py-0.5" style={{ borderColor: 'var(--border-color)' }}>Esc</kbd>
                </div>
                <div ref={listRef} className="max-h-[46vh] overflow-y-auto p-1.5">
                    {results.length === 0 && (
                        <p className="px-4 py-6 text-center text-sm opacity-45 font-medium">Sin resultados para “{query}”.</p>
                    )}
                    {results.map((item, index) => {
                        const showSectionHeader = index === 0 || results[index - 1].kind !== item.kind;
                        return (
                            <React.Fragment key={item.id}>
                                {showSectionHeader && (
                                    <p className="px-3 pb-1 pt-2.5 text-[9px] font-black uppercase tracking-widest opacity-35 first:pt-1">
                                        {item.kind === 'book' ? 'Libros' : 'Comandos'}
                                    </p>
                                )}
                                <button
                                    onClick={item.action}
                                    onMouseMove={() => setActiveIndex(index)}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition ${index === activeIndex ? 'bg-[var(--highlight)]/15' : ''}`}>
                                    <span className="text-base flex-shrink-0 w-6 text-center">{item.icon}</span>
                                    <span className="flex-1 min-w-0 text-sm font-semibold truncate" style={{ color: 'var(--text-color)' }}>{item.label}</span>
                                    {item.hint && <span className="text-[10px] font-bold opacity-40 flex-shrink-0">{item.hint}</span>}
                                    {index === activeIndex && <span className="text-[10px] font-black opacity-40 flex-shrink-0">↵</span>}
                                </button>
                            </React.Fragment>
                        );
                    })}
                </div>
                <div className="flex items-center gap-3 px-4 py-2 border-t text-[9px] font-bold uppercase tracking-widest opacity-35" style={{ borderColor: 'var(--border-color)' }}>
                    <span>↑↓ navegar</span>
                    <span>↵ ejecutar</span>
                    <span className="ml-auto">Ctrl+K</span>
                </div>
            </div>
        </div>
    );
}
