import React, { useState } from 'react';
import { WORKSHOP_ADDONS, WORKSHOP_CATEGORIES, getLocalizedText, getWorkshopLocale } from './workshopModules';

const CONTEXT_COLORS = {
    reader: '#3b82f6',
    library: '#22c55e',
    global: '#a855f7',
};

const WorkshopPanel = ({
    addons = {},
    addonConfig = {},
    externalSources = [],
    onToggle = () => {},
    onUpdateAddonConfig = () => {},
    onUpdateExternalSources = () => {},
    catalogState,
    onBrowseSource = () => {},
    onNavigateCatalog = () => {},
    onImportCatalogEntry = () => {},
    onPickAddonFolder = () => {},
    onClose,
    lang = 'es',
}) => {
    const [activeCategory, setActiveCategory] = useState('all');
    const [lastToggled, setLastToggled] = useState(null);
    const [sourceDraft, setSourceDraft] = useState({ name: '', url: '', type: 'opds', allowPrivateNetwork: false });
    const copy = getWorkshopLocale(lang);

    const handleToggle = (id) => {
        onToggle(id);
        setLastToggled(id);
        setTimeout(() => setLastToggled(null), 1200);
    };

    const addExternalSource = () => {
        const name = sourceDraft.name.trim();
        const url = sourceDraft.url.trim();
        if (!name || !/^https?:\/\//i.test(url)) return;

        onUpdateExternalSources([
            ...(externalSources || []),
            {
                id: `source-${Date.now()}`,
                name,
                url,
                type: sourceDraft.type,
                enabled: true,
                publicDomainOnly: sourceDraft.type === 'public-domain',
                allowPrivateNetwork: !!sourceDraft.allowPrivateNetwork || sourceDraft.type === 'calibre',
            },
        ]);
        setSourceDraft({ name: '', url: '', type: 'opds', allowPrivateNetwork: false });
    };

    const activeCount = WORKSHOP_ADDONS.filter(addon => addons?.[addon.id]).length;
    const filtered = WORKSHOP_ADDONS.filter(addon => activeCategory === 'all' || addon.category === activeCategory);
    const activeAddonsList = WORKSHOP_ADDONS.filter(addon => addons?.[addon.id] && addon.status === 'active');

    return (
        <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/60 backdrop-blur-sm fade-in sm:items-center" onClick={onClose}>
            <div
                className="flex w-full flex-col rounded-t-3xl border border-[var(--border-color)] bg-[var(--surface-bg)] shadow-2xl sm:max-w-3xl sm:rounded-3xl"
                style={{ maxHeight: '90vh' }}
                onClick={e => e.stopPropagation()}>
                <div className="flex flex-shrink-0 items-center justify-between border-b px-6 py-4" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl text-xl shadow-md" style={{ background: 'linear-gradient(135deg, var(--topbar-bg), var(--highlight))' }}>🔧</div>
                        <div>
                            <h2 className="text-xl font-black leading-none">{copy.title}</h2>
                            <p className="mt-0.5 text-[11px] opacity-50">
                                {activeCount > 0 ? `${activeCount} ${activeCount === 1 ? copy.activeSingular : copy.activePlural}` : copy.subtitleEmpty}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="rounded-full p-2 text-xl leading-none opacity-60 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/5">×</button>
                </div>

                {activeAddonsList.length > 0 && (
                    <div className="flex flex-shrink-0 flex-wrap gap-2 border-b px-5 py-2.5" style={{ borderColor: 'var(--border-color)', backgroundColor: 'color-mix(in srgb, var(--highlight) 5%, var(--surface-bg))' }}>
                        <span className="self-center text-[9px] font-black uppercase tracking-widest opacity-40">{copy.active}</span>
                        {activeAddonsList.map(addon => (
                            <button
                                key={addon.id}
                                onClick={() => handleToggle(addon.id)}
                                title={copy.clickToDisable}
                                className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold text-white transition hover:opacity-80"
                                style={{ background: 'linear-gradient(135deg, var(--topbar-bg), var(--highlight))' }}>
                                {addon.emoji} {getLocalizedText(addon.name, lang)} ×
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex flex-shrink-0 gap-1.5 overflow-x-auto border-b px-5 py-2.5" style={{ borderColor: 'var(--border-color)' }}>
                    {WORKSHOP_CATEGORIES.map(category => (
                        <button
                            key={category.id}
                            onClick={() => setActiveCategory(category.id)}
                            className={`flex-shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold transition ${activeCategory === category.id ? 'text-white' : 'bg-black/5 opacity-60 hover:opacity-100 dark:bg-white/5'}`}
                            style={activeCategory === category.id ? { background: 'linear-gradient(135deg, var(--topbar-bg), var(--highlight))' } : {}}>
                            {getLocalizedText(category.label, lang)}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    <div className="grid gap-2.5 sm:grid-cols-2">
                        {filtered.map(addon => {
                            const enabled = !!addons?.[addon.id];
                            const isSoon = addon.status === 'soon';
                            const justToggled = lastToggled === addon.id;
                            const ctxColor = CONTEXT_COLORS[addon.context] || CONTEXT_COLORS.global;
                            const config = addonConfig?.[addon.id] || {};
                            const addonName = getLocalizedText(addon.name, lang);
                            const addonDesc = getLocalizedText(addon.desc, lang);
                            const contextLabel = copy.contexts[addon.context] || copy.contexts.global;

                            return (
                                <div
                                    key={addon.id}
                                    className={`relative overflow-hidden rounded-2xl border p-4 transition-all ${isSoon ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                                    style={{
                                        borderColor: enabled ? 'var(--highlight)' : 'var(--border-color)',
                                        background: enabled ? 'color-mix(in srgb, var(--highlight) 8%, var(--bg-color))' : 'var(--bg-color)',
                                        boxShadow: justToggled ? '0 0 0 3px var(--highlight)' : 'none',
                                    }}
                                    onClick={() => !isSoon && handleToggle(addon.id)}>
                                    {justToggled && <div className="pointer-events-none absolute inset-0 rounded-2xl" style={{ background: 'var(--highlight)', opacity: 0.12, animation: 'fadeOut 1.2s forwards' }} />}

                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5 flex w-9 flex-shrink-0 justify-center text-2xl">{addon.emoji}</div>
                                        <div className="min-w-0 flex-1">
                                            <div className="mb-1 flex flex-wrap items-center gap-1.5">
                                                <span className="text-sm font-black">{addonName}</span>
                                                {isSoon && <span className="rounded-full bg-yellow-500/20 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-yellow-500">{copy.soon}</span>}
                                                <span className="rounded-full px-1.5 py-0.5 text-[8px] font-bold" style={{ backgroundColor: `${ctxColor}20`, color: ctxColor }}>{contextLabel}</span>
                                            </div>
                                            <p className="text-[11px] leading-relaxed opacity-55">{addonDesc}</p>

                                            {addon.id === 'externalSources' && enabled && (
                                                <p className="mt-2 text-[10px] font-bold text-sky-400">
                                                    {(externalSources || []).filter(source => source.enabled).length} {copy.external.activeSources}
                                                </p>
                                            )}

                                            {addon.id === 'reminders' && enabled && (
                                                <label className="mt-3 flex items-center gap-2 text-[10px] font-bold opacity-70" onClick={e => e.stopPropagation()}>
                                                    {copy.fields.hours}
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="72"
                                                        value={config.minHoursSinceLastOpen || 1}
                                                        onChange={e => onUpdateAddonConfig(addon.id, { minHoursSinceLastOpen: Math.max(1, Number(e.target.value) || 1) })}
                                                        className="w-14 rounded-lg bg-black/10 px-2 py-1 outline-none dark:bg-white/10"
                                                    />
                                                </label>
                                            )}

                                            {addon.id === 'watchedFolder' && enabled && (
                                                <div className="mt-3 space-y-2 text-[10px] font-bold opacity-75" onClick={e => e.stopPropagation()}>
                                                    <button onClick={() => onPickAddonFolder(addon.id, 'folder')} className="rounded-lg bg-black/10 px-2 py-1 hover:bg-black/15 dark:bg-white/10 dark:hover:bg-white/15">
                                                        {config.folder ? copy.folder.change : copy.folder.choose}
                                                    </button>
                                                    <p className="truncate opacity-60">{config.folder || copy.folder.none}</p>
                                                    <label className="flex items-center gap-2">
                                                        {copy.fields.minutes}
                                                        <input
                                                            type="number"
                                                            min="5"
                                                            max="1440"
                                                            value={config.intervalMinutes || 30}
                                                            onChange={e => onUpdateAddonConfig(addon.id, { intervalMinutes: Math.max(5, Number(e.target.value) || 30) })}
                                                            className="w-16 rounded-lg bg-black/10 px-2 py-1 outline-none dark:bg-white/10"
                                                        />
                                                    </label>
                                                </div>
                                            )}

                                            {addon.id === 'autoBackup' && enabled && (
                                                <div className="mt-3 space-y-2 text-[10px] font-bold opacity-75" onClick={e => e.stopPropagation()}>
                                                    <button onClick={() => onPickAddonFolder(addon.id, 'folder')} className="rounded-lg bg-black/10 px-2 py-1 hover:bg-black/15 dark:bg-white/10 dark:hover:bg-white/15">
                                                        {config.folder ? copy.folder.changeDestination : copy.folder.chooseDestination}
                                                    </button>
                                                    <p className="truncate opacity-60">{config.folder || copy.folder.noDestination}</p>
                                                    <label className="flex items-center gap-2">
                                                        {copy.fields.days}
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            max="90"
                                                            value={config.everyDays || 7}
                                                            onChange={e => onUpdateAddonConfig(addon.id, { everyDays: Math.max(1, Number(e.target.value) || 7) })}
                                                            className="w-16 rounded-lg bg-black/10 px-2 py-1 outline-none dark:bg-white/10"
                                                        />
                                                    </label>
                                                </div>
                                            )}

                                            {addon.id === 'dyslexiaMode' && enabled && (
                                                <div className="mt-3 space-y-2 text-[10px] font-bold opacity-75" onClick={e => e.stopPropagation()}>
                                                    <div className="flex items-center gap-2">
                                                        <span>{lang === 'es' ? 'Tamaño de texto:' : 'Text size:'}</span>
                                                        <select
                                                            value={config.fontScale || '1.1'}
                                                            onChange={e => onUpdateAddonConfig(addon.id, { fontScale: e.target.value })}
                                                            className="rounded-lg bg-black/10 px-2 py-1 outline-none dark:bg-white/10">
                                                            <option value="1.0">{lang === 'es' ? 'Normal' : 'Normal'}</option>
                                                            <option value="1.1">{lang === 'es' ? 'Grande' : 'Large'}</option>
                                                            <option value="1.2">{lang === 'es' ? 'Más grande' : 'Larger'}</option>
                                                        </select>
                                                    </div>
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={config.strongerContrast !== false}
                                                            onChange={e => onUpdateAddonConfig(addon.id, { strongerContrast: e.target.checked })}
                                                        />
                                                        {lang === 'es' ? 'Mayor contraste' : 'Stronger contrast'}
                                                    </label>
                                                </div>
                                            )}

                                            {addon.id === 'bookRoulette' && enabled && (
                                                <div className="mt-3 space-y-1.5 text-[10px] font-bold opacity-75" onClick={e => e.stopPropagation()}>
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={config.onlyUnread !== false}
                                                            onChange={e => onUpdateAddonConfig(addon.id, { onlyUnread: e.target.checked })}
                                                        />
                                                        {lang === 'es' ? 'Solo no leídos' : 'Unread only'}
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={!!config.onlyFavorites}
                                                            onChange={e => onUpdateAddonConfig(addon.id, { onlyFavorites: e.target.checked })}
                                                        />
                                                        {lang === 'es' ? 'Solo favoritos' : 'Favorites only'}
                                                    </label>
                                                </div>
                                            )}

                                            {addon.id === 'levelSystem' && enabled && (
                                                <div className="mt-3 space-y-2 text-[10px] font-bold opacity-75" onClick={e => e.stopPropagation()}>
                                                    <label className="flex items-center gap-2">
                                                        {lang === 'es' ? 'XP por nivel:' : 'XP per level:'}
                                                        <input
                                                            type="number"
                                                            min="50"
                                                            max="1000"
                                                            step="50"
                                                            value={config.xpPerLevel || 100}
                                                            onChange={e => onUpdateAddonConfig(addon.id, { xpPerLevel: Math.max(50, Number(e.target.value) || 100) })}
                                                            className="w-16 rounded-lg bg-black/10 px-2 py-1 outline-none dark:bg-white/10"
                                                        />
                                                    </label>
                                                    <div className="flex items-center gap-2">
                                                        <span>{lang === 'es' ? 'Mostrar como:' : 'Display as:'}</span>
                                                        <select
                                                            value={config.displayStyle || 'full'}
                                                            onChange={e => onUpdateAddonConfig(addon.id, { displayStyle: e.target.value })}
                                                            className="rounded-lg bg-black/10 px-2 py-1 outline-none dark:bg-white/10">
                                                            <option value="full">{lang === 'es' ? 'Nivel + XP' : 'Level + XP'}</option>
                                                            <option value="minimal">{lang === 'es' ? 'Solo nivel' : 'Level only'}</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {!isSoon && (
                                            <div className="relative mt-0.5 flex-shrink-0" style={{ width: 38, height: 22, borderRadius: 11, backgroundColor: enabled ? 'var(--highlight)' : 'rgba(128,128,128,0.25)', transition: 'background-color 0.2s' }}>
                                                <div style={{ position: 'absolute', top: 3, left: enabled ? 19 : 3, width: 16, height: 16, borderRadius: '50%', backgroundColor: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.25)', transition: 'left 0.2s' }} />
                                            </div>
                                        )}
                                    </div>

                                    {enabled && <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl" style={{ backgroundColor: 'var(--highlight)' }} />}
                                </div>
                            );
                        })}
                    </div>

                    {addons?.externalSources && (
                        <div className="mt-4 rounded-2xl border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-color)' }}>
                            <h3 className="text-sm font-black">{copy.external.title}</h3>
                            <p className="mt-1 text-[11px] opacity-55">{copy.external.description}</p>

                            <div className="mt-3 space-y-2">
                                {(externalSources || []).map(source => (
                                    <div key={source.id} className="flex items-center gap-2 rounded-xl bg-black/5 p-2 dark:bg-white/5">
                                        <input
                                            type="checkbox"
                                            checked={!!source.enabled}
                                            onChange={e => onUpdateExternalSources((externalSources || []).map(item => item.id === source.id ? { ...item, enabled: e.target.checked } : item))}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-xs font-black">{source.name}</p>
                                            <p className="truncate text-[10px] opacity-45">{source.type} · {source.url}</p>
                                            {source.allowPrivateNetwork && <p className="text-[9px] font-bold text-amber-500">{copy.external.localNetworkAllowed}</p>}
                                        </div>
                                        <button
                                            onClick={() => onBrowseSource(source)}
                                            disabled={!source.enabled || catalogState?.loading}
                                            className="rounded-lg px-2 py-1 text-xs font-bold text-sky-500 hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:opacity-40">
                                            {copy.external.browse}
                                        </button>
                                        <button onClick={() => onUpdateExternalSources((externalSources || []).filter(item => item.id !== source.id))} className="rounded-lg px-2 py-1 text-xs font-bold text-red-500 hover:bg-red-500/10">{copy.external.remove}</button>
                                    </div>
                                ))}
                            </div>

                            {(catalogState?.loading || catalogState?.error || catalogState?.catalog) && (
                                <div className="mt-4 rounded-2xl border border-white/10 bg-black/5 p-3 dark:bg-white/5">
                                    {catalogState.loading && <p className="text-xs font-bold opacity-60">{copy.external.loading}</p>}
                                    {catalogState.error && <p className="text-xs font-bold text-red-500">{catalogState.error}</p>}
                                    {catalogState.catalog && (
                                        <>
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-black">{catalogState.catalog.title}</p>
                                                    <p className="truncate text-[10px] opacity-45">{catalogState.catalog.sourceUrl}</p>
                                                </div>
                                                <span className="rounded-full bg-black/5 px-2 py-1 text-[10px] font-bold opacity-60 dark:bg-white/10">
                                                    {catalogState.catalog.entries.length} {copy.external.books}
                                                </span>
                                            </div>

                                            {catalogState.catalog.navigation.length > 0 && (
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {catalogState.catalog.navigation.slice(0, 8).map(nav => (
                                                        <button
                                                            key={nav.id}
                                                            onClick={() => onNavigateCatalog(nav.url)}
                                                            className="rounded-full bg-black/5 px-3 py-1.5 text-[10px] font-bold hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15">
                                                            {nav.title}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
                                                {catalogState.catalog.entries.slice(0, 30).map(entry => (
                                                    <div key={entry.id} className="flex gap-3 rounded-xl bg-black/5 p-3 dark:bg-white/5">
                                                        {entry.coverUrl ? (
                                                            <img src={entry.coverUrl} alt="" className="h-16 w-11 flex-shrink-0 rounded-md object-cover" />
                                                        ) : (
                                                            <div className="flex h-16 w-11 flex-shrink-0 items-center justify-center rounded-md bg-slate-700 text-xs font-black text-white">OPDS</div>
                                                        )}
                                                        <div className="min-w-0 flex-1">
                                                            <p className="truncate text-xs font-black">{entry.title}</p>
                                                            <p className="truncate text-[11px] opacity-55">{entry.author || copy.external.unknownAuthor}</p>
                                                            {entry.summary && <p className="mt-1 line-clamp-2 text-[10px] opacity-45">{entry.summary}</p>}
                                                            <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-sky-400">{entry.format || copy.external.download}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => onImportCatalogEntry(entry)}
                                                            disabled={catalogState.importingId === entry.id}
                                                            className="self-center rounded-xl bg-[var(--highlight)] px-3 py-2 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
                                                            {catalogState.importingId === entry.id ? copy.external.importing : copy.external.import}
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[0.8fr_1.2fr_auto_auto]">
                                <select
                                    value={sourceDraft.type}
                                    onChange={e => setSourceDraft(prev => ({
                                        ...prev,
                                        type: e.target.value,
                                        allowPrivateNetwork: e.target.value === 'calibre' ? true : prev.allowPrivateNetwork,
                                    }))}
                                    className="rounded-xl bg-black/5 px-3 py-2 text-xs outline-none dark:bg-white/5">
                                    <option value="opds">OPDS</option>
                                    <option value="calibre">Calibre</option>
                                    <option value="cloud">{copy.external.cloud}</option>
                                    <option value="public-domain">{copy.external.publicDomain}</option>
                                </select>
                                <input value={sourceDraft.name} onChange={e => setSourceDraft(prev => ({ ...prev, name: e.target.value }))} placeholder={copy.external.namePlaceholder} className="rounded-xl bg-black/5 px-3 py-2 text-xs outline-none dark:bg-white/5" />
                                <input value={sourceDraft.url} onChange={e => setSourceDraft(prev => ({ ...prev, url: e.target.value }))} placeholder="https://servidor/opds" className="rounded-xl bg-black/5 px-3 py-2 text-xs outline-none dark:bg-white/5 sm:col-span-1" />
                                <button onClick={addExternalSource} className="rounded-xl bg-[var(--highlight)] px-4 py-2 text-xs font-black text-white">{copy.external.add}</button>
                            </div>
                            <label className="mt-2 flex items-center gap-2 text-[10px] font-bold opacity-65">
                                <input
                                    type="checkbox"
                                    checked={!!sourceDraft.allowPrivateNetwork}
                                    onChange={e => setSourceDraft(prev => ({ ...prev, allowPrivateNetwork: e.target.checked }))}
                                />
                                {copy.external.allowPrivateNetwork}
                            </label>
                        </div>
                    )}

                    <div className="mt-4 rounded-2xl p-3 text-center" style={{ backgroundColor: 'var(--surface-bg)', border: '1px solid var(--border-color)' }}>
                        <p className="text-[11px] font-bold opacity-40">{copy.footer}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WorkshopPanel;
