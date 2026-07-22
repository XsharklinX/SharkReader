import React from 'react';
import { Icons } from './icons';

// Vista previa antes de aplicar un backup importado.
//
// RECONSTRUIDO tras pérdida del archivo. Muestra el resumen que calcula
// computeBackupDiff (libros nuevos / actualizados / sin cambios / borrados y
// qué secciones opcionales trae), el estado de integridad del ZIP y las
// advertencias de validación, y deja que el usuario confirme o cancele.
//
// Props: { pendingImport, busy, onConfirm, onCancel }

const CHECKSUM_UI = {
    ok: { label: 'Integridad verificada', cls: 'text-green-600 dark:text-green-400 bg-green-500/10' },
    mismatch: { label: 'El checksum no coincide — el archivo pudo alterarse', cls: 'text-red-600 dark:text-red-400 bg-red-500/10' },
    unavailable: { label: 'Sin verificación de integridad', cls: 'opacity-50 bg-black/5 dark:bg-white/5' },
};

function StatTile({ value, label, accent }) {
    return (
        <div className="flex-1 min-w-[70px] bg-black/5 dark:bg-white/5 rounded-2xl p-3 text-center">
            <span className={`text-3xl font-black ${accent || ''}`}>{value}</span>
            <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest mt-1">{label}</p>
        </div>
    );
}

export default function BackupPreviewModal({ pendingImport, busy, onConfirm, onCancel }) {
    if (!pendingImport) return null;
    const { diff = {}, checksumStatus = 'unavailable', warnings = [], fileName = '', bookEntryCount = 0, kind } = pendingImport;

    const sections = [
        diff.hasCategories && 'Categorías',
        diff.hasCollections && 'Colecciones',
        diff.hasStats && 'Estadísticas',
        diff.hasUser && 'Perfil',
        diff.hasWorkshop && 'Workshop / ajustes',
        diff.hasAchievements && `Logros (${diff.achievementCount})`,
    ].filter(Boolean);

    const checksum = CHECKSUM_UI[checksumStatus] || CHECKSUM_UI.unavailable;

    return (
        <div className="fixed inset-0 z-[320] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 fade-in" onClick={busy ? undefined : onCancel}>
            <div role="dialog" aria-modal="true" aria-label="Vista previa de importación" className="bg-[var(--surface-bg)] w-full max-w-md rounded-3xl p-7 shadow-2xl relative border border-[var(--border-color)] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <button onClick={onCancel} disabled={busy} aria-label="Cerrar" className="absolute top-4 right-4 p-2 opacity-50 hover:opacity-100 transition disabled:opacity-20"><Icons.Close /></button>

                <h2 className="text-2xl font-black mb-1 text-blue-500 flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-full"><Icons.Import /></div> Importar backup
                </h2>
                {fileName && <p className="text-xs font-bold opacity-50 mb-5 truncate pl-1">{fileName}</p>}

                <div className={`text-xs font-bold rounded-xl px-3 py-2 mb-5 flex items-center gap-2 ${checksum.cls}`}>
                    <Icons.Info /> {checksum.label}
                </div>

                <div className="flex gap-2 mb-4">
                    <StatTile value={diff.newBooks || 0} label="Nuevos" accent="text-green-500" />
                    <StatTile value={diff.updatedBooks || 0} label="Actualizados" accent="text-blue-500" />
                    <StatTile value={diff.unchangedBooks || 0} label="Sin cambios" />
                </div>

                <div className="flex gap-2 mb-5">
                    <StatTile value={diff.totalIncomingBooks || 0} label="Libros en backup" />
                    {(diff.deletedBooks || 0) > 0 && (
                        <StatTile value={diff.deletedBooks} label="Borrados" accent="text-red-500" />
                    )}
                    {kind === 'zip' && (
                        <StatTile value={bookEntryCount} label="Archivos incluidos" />
                    )}
                </div>

                {sections.length > 0 && (
                    <div className="mb-5">
                        <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest mb-2">También se restaura</p>
                        <div className="flex flex-wrap gap-2">
                            {sections.map(section => (
                                <span key={section} className="text-[11px] font-bold bg-black/5 dark:bg-white/5 rounded-full px-3 py-1">{section}</span>
                            ))}
                        </div>
                    </div>
                )}

                {warnings.length > 0 && (
                    <div className="mb-5 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3">
                        <p className="text-[11px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">Advertencias</p>
                        <ul className="text-xs opacity-80 list-disc list-inside space-y-0.5">
                            {warnings.slice(0, 6).map((w, i) => <li key={i}>{String(w)}</li>)}
                        </ul>
                    </div>
                )}

                <p className="text-[11px] text-center opacity-50 mb-4">
                    La importación fusiona los datos con tu biblioteca actual: gana siempre la versión más reciente de cada libro. No se pierde lo que ya tienes.
                </p>

                <div className="flex gap-3">
                    <button onClick={onCancel} disabled={busy} className="flex-1 py-3 rounded-2xl font-bold bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition disabled:opacity-40">
                        Cancelar
                    </button>
                    <button onClick={onConfirm} disabled={busy} className="flex-1 py-3 rounded-2xl font-black bg-blue-500 text-white hover:bg-blue-600 transition disabled:opacity-50 flex items-center justify-center gap-2">
                        {busy ? 'Restaurando…' : 'Importar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
