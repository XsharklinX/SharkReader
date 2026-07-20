import React from 'react';

// Anillo de progreso circular — se lee de un vistazo cuánto llevas de cada
// libro abierto sin tener que entrar a la pestaña.
const TabProgressRing = ({ progress = 0 }) => {
    const size = 15;
    const stroke = 2;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const clamped = Math.min(100, Math.max(0, progress));
    const offset = c - (clamped / 100) * c;
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0" style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={stroke} />
            {clamped > 0 && (
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--highlight)" strokeWidth={stroke}
                    strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" />
            )}
        </svg>
    );
};

const TabBar = React.memo(({ tabs, activeTabId, books, onSwitch, onClose, onGoToLibrary }) => (
    <div role="tablist" aria-label="Libros abiertos" className="flex items-stretch flex-shrink-0 overflow-x-auto overflow-y-hidden select-none"
        style={{ height: '36px', backgroundColor: 'rgba(0,0,0,0.35)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {tabs.map(tab => {
            const book = books.find(b => b.id === tab.bookId);
            const isActive = tab.id === activeTabId;
            return (
                <div key={tab.id}
                    role="tab"
                    aria-selected={isActive}
                    title={book ? `${book.name} — ${Math.round(book.progress || 0)}%` : 'Libro'}
                    tabIndex={0}
                    className={`flex items-center gap-1.5 px-3 flex-shrink-0 max-w-[180px] min-w-[80px] cursor-pointer group border-r border-white/10 relative transition-all ${isActive ? 'bg-white/15' : 'hover:bg-white/8'}`}
                    onClick={() => onSwitch(tab.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSwitch(tab.id); } }}>
                    {isActive && <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: 'var(--highlight)' }} />}
                    {book && <TabProgressRing progress={book.progress || 0} />}
                    <span className="text-white text-[11px] font-semibold truncate flex-1 leading-none">
                        {book?.name || 'Cargando…'}
                    </span>
                    <button
                        onClick={(e) => onClose(tab.id, e)}
                        aria-label={`Cerrar pestaña: ${book?.name || 'Libro'}`}
                        className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-white hover:bg-white/20 rounded w-4 h-4 flex items-center justify-center flex-shrink-0 transition text-xs leading-none">
                        ×
                    </button>
                </div>
            );
        })}
        <button
            onClick={onGoToLibrary}
            title="Abrir biblioteca / añadir libro"
            className="px-3 h-full text-white/50 hover:text-white hover:bg-white/10 transition flex-shrink-0 flex items-center justify-center text-xl font-light leading-none">
            +
        </button>
    </div>
));

export default TabBar;
