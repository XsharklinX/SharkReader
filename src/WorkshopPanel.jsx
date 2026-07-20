import React, { useCallback, useState } from 'react';
import { WORKSHOP_ADDONS, WORKSHOP_CATEGORIES, WORKSHOP_MATURITY, getLocalizedText, getWorkshopLocale, getAddonCapabilityLabels } from './workshopModules';
import { useModalA11y } from './hooks/useModalA11y';

const CONTEXT_COLORS = {
    reader: '#3b82f6',
    library: '#22c55e',
    global: '#a855f7',
};

const AddonIcon = ({ id }) => {
    const common = {
        width: 22,
        height: 22,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.9,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
    };

    switch (id) {
        case 'focusMode':
            return <svg {...common}><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.5" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" /></svg>;
        case 'autoBookmark':
            return <svg {...common}><path d="M7 4.5h10a1.5 1.5 0 0 1 1.5 1.5v14l-6.5-3.6L5.5 20V6A1.5 1.5 0 0 1 7 4.5Z" /><path d="M9 8h6" /></svg>;
        case 'netflixView':
            return <svg {...common}><rect x="4" y="5" width="16" height="14" rx="2.5" /><path d="M8 9h8M8 13h5M16 13h.01" /></svg>;
        case 'readingJournal':
            return <svg {...common}><path d="M7 4.5h9.5A2.5 2.5 0 0 1 19 7v12.5H7A2 2 0 0 1 5 17.5v-11a2 2 0 0 1 2-2Z" /><path d="M8.5 8h6M8.5 11.5h5M8.5 15h4" /></svg>;
        case 'reminders':
            return <svg {...common}><path d="M6.5 10.5a5.5 5.5 0 0 1 11 0c0 5 2 5.5 2 6.5h-15c0-1 2-1.5 2-6.5Z" /><path d="M10 20a2.2 2.2 0 0 0 4 0M9 4.5 7.5 3M15 4.5 16.5 3" /></svg>;
        case 'smartToc':
            return <svg {...common}><path d="M5 6h3M5 12h3M5 18h3M11 6h8M11 12h8M11 18h5" /><path d="M8 6h.01M8 12h.01M8 18h.01" /></svg>;
        case 'externalSources':
            return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M4 12h16M12 4a13 13 0 0 1 0 16M12 4a13 13 0 0 0 0 16" /></svg>;
        case 'dyslexiaMode':
            return <svg {...common}><path d="M5 18 9.5 6l4.5 12M6.5 14h6" /><path d="M15 9h4M17 7v7a3 3 0 0 0 3 3" /></svg>;
        case 'bookRoulette':
            return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 12 7.5 8M12 12l5-2M12 12l1.5 5.5" /><circle cx="12" cy="12" r="1.3" /></svg>;
        case 'dynamicCovers':
            return <svg {...common}><rect x="6" y="4" width="12" height="16" rx="2" /><path d="M9 8h6M9 15h4M18.5 6.5l2-1M18.5 17.5l2 1M5.5 6.5l-2-1M5.5 17.5l-2 1" /></svg>;
        case 'quotePosters':
            return <svg {...common}><rect x="4.5" y="5" width="15" height="14" rx="2" /><path d="M8 10h3v4H8zM13.5 10h3v4h-3zM8 17h8.5" /></svg>;
        case 'watchedFolder':
            return <svg {...common}><path d="M3.5 7.5h6l2 2H20a1.5 1.5 0 0 1 1.5 1.5v6A2.5 2.5 0 0 1 19 19.5H5A2.5 2.5 0 0 1 2.5 17V9a1.5 1.5 0 0 1 1-1.5Z" /><path d="M8.5 14s1.2-2 3.5-2 3.5 2 3.5 2-1.2 2-3.5 2-3.5-2-3.5-2Z" /><circle cx="12" cy="14" r="1" /></svg>;
        case 'autoBackup':
            return <svg {...common}><path d="M6 5h10l3 3v11H6z" /><path d="M9 5v5h6V5M9 19v-5h6v5" /><path d="M18.5 13.5a4.5 4.5 0 0 0-7.7-2.8" /></svg>;
        case 'levelSystem':
            return <svg {...common}><path d="M12 4.5 14.2 9l5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L4.8 9.7l5-.7Z" /><path d="M8 21h8" /></svg>;
        case 'soundFeedback':
            return <svg {...common}><path d="M5 10v4h3l4 3V7l-4 3Z" /><path d="M15.5 9.5a4 4 0 0 1 0 5M18 7a7 7 0 0 1 0 10" /></svg>;
        case 'sharkyMascot':
            return <svg {...common}><path d="M4 14c3.2-5.8 9.6-7.5 16-4-2.5 4.7-8.4 7.3-14 5.2L3 18Z" /><path d="M13 9 11.5 5.5M8.5 14.5 6.5 18M16.5 10.5h.01" /></svg>;
        default:
            return <svg {...common}><path d="M12 4.5 19.5 9v6L12 19.5 4.5 15V9Z" /><path d="M12 4.5v15M4.5 9l7.5 4.5L19.5 9" /></svg>;
    }
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
    addonHistory = {},
    lang = 'es',
}) => {
    const [activeCategory, setActiveCategory] = useState('all');
    const [addonScope, setAddonScope] = useState('all');
    const [lastToggled, setLastToggled] = useState(null);
    const [configAddonId, setConfigAddonId] = useState(null);
    const [detailAddonId, setDetailAddonId] = useState(null);
    // Escape solo cierra el Workshop cuando no hay un modal anidado (config o
    // detalle) encima — si no, se limitaría a no hacer nada en vez de cerrar
    // de golpe todo lo que había debajo.
    const dialogRef = useModalA11y(true, useCallback(() => {
        if (!configAddonId && !detailAddonId) onClose();
    }, [configAddonId, detailAddonId, onClose]));
    const [sourceDraft, setSourceDraft] = useState({ name: '', url: '', type: 'opds', allowPrivateNetwork: false });
    const copy = getWorkshopLocale(lang);

    const handleToggle = (id) => {
        const addon = WORKSHOP_ADDONS.find(item => item.id === id);
        const enabling = !addons?.[id];
        if (enabling && addon?.maturity === 'experimental') {
            const ok = window.confirm(lang === 'en'
                ? 'This addon is experimental and may change. Activate it anyway?'
                : 'Este addon es experimental y puede cambiar. Activarlo de todos modos?');
            if (!ok) return;
            onToggle(id, { allowExperimental: true });
        } else {
            onToggle(id);
        }
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

    const PRESETS = [
        {
            id: 'focused',
            iconId: 'focusMode',
            label: lang === 'es' ? 'Lector enfocado' : 'Focused reader',
            desc: lang === 'es' ? 'Lectura sin distracciones' : 'Distraction-free reading',
            color: '#3b82f6',
            addons: ['focusMode', 'autoBookmark', 'smartToc', 'soundFeedback'],
        },
        {
            id: 'collector',
            iconId: 'dynamicCovers',
            label: lang === 'es' ? 'Coleccionista' : 'Collector',
            desc: lang === 'es' ? 'Organiza tu biblioteca' : 'Organize your library',
            color: '#22c55e',
            addons: ['dynamicCovers', 'netflixView', 'watchedFolder', 'readingJournal'],
        },
        {
            id: 'gamer',
            iconId: 'levelSystem',
            label: 'Gamer',
            desc: lang === 'es' ? 'Logros, niveles y mascota' : 'Achievements, levels & mascot',
            color: '#f59e0b',
            addons: ['levelSystem', 'sharkyMascot', 'soundFeedback', 'bookRoulette', 'dynamicCovers'],
        },
    ];

    const isPresetApplied = (preset) => preset.addons.every(id => !!addons?.[id]);

    const applyPreset = (preset) => {
        const applied = isPresetApplied(preset);
        preset.addons.forEach(id => {
            const isEnabled = !!addons?.[id];
            if (applied) {
                if (isEnabled) onToggle(id);
            } else if (!isEnabled) {
                onToggle(id, { allowExperimental: true });
            }
        });
        setLastToggled('__preset__');
        setTimeout(() => setLastToggled(null), 1200);
    };

    const activeCount = WORKSHOP_ADDONS.filter(addon => addons?.[addon.id]).length;
    const filtered = WORKSHOP_ADDONS.filter(addon => {
        if (activeCategory !== 'all' && addon.category !== activeCategory) return false;
        if (addonScope === 'installed' && !addons?.[addon.id]) return false;
        if (addonScope === 'stable' && addon.maturity !== 'stable') return false;
        if (addonScope === 'experimental' && addon.maturity !== 'experimental') return false;
        return true;
    });
    const activeAddonsList = WORKSHOP_ADDONS.filter(addon => addons?.[addon.id] && addon.status === 'active');
    const stableCount = WORKSHOP_ADDONS.filter(addon => addon.maturity === 'stable').length;
    const experimentalCount = WORKSHOP_ADDONS.filter(addon => addon.maturity === 'experimental').length;
    const configAddon = WORKSHOP_ADDONS.find(addon => addon.id === configAddonId);
    const configSchemaEntries = configAddon
        ? Object.entries(configAddon.configSchema || {}).filter(([, rule]) => !rule.hidden)
        : [];
    const detailAddon = WORKSHOP_ADDONS.find(addon => addon.id === detailAddonId);
    const detailCapabilities = detailAddon ? getAddonCapabilityLabels(detailAddon, lang) : [];
    const detailHistory = detailAddon ? (addonHistory?.[detailAddon.id] || []) : [];
    const HISTORY_LABELS = {
        enabled: lang === 'es' ? 'Activado' : 'Enabled',
        disabled: lang === 'es' ? 'Desactivado' : 'Disabled',
        config: lang === 'es' ? 'Configuración actualizada' : 'Configuration updated',
    };
    const formatHistoryDate = (ts) => new Date(ts).toLocaleString(lang === 'es' ? 'es-ES' : 'en-US', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });

    const SECTIONS = [
        { id: 'stable', label: lang === 'es' ? 'Estables' : 'Stable', match: addon => addon.status !== 'soon' && addon.maturity === 'stable' },
        { id: 'experimental', label: lang === 'es' ? 'Experimentales' : 'Experimental', match: addon => addon.status !== 'soon' && addon.maturity === 'experimental' },
        { id: 'soon', label: lang === 'es' ? 'Próximamente' : 'Coming soon', match: addon => addon.status === 'soon' },
    ];

    const renderConfigField = (addon, key, rule) => {
        const config = addonConfig?.[addon.id] || {};
        const value = config[key] ?? rule.fallback;
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, char => char.toUpperCase());

        if (key === 'folder') {
            return (
                <div key={key} className="rounded-2xl bg-black/5 p-3 dark:bg-white/5">
                    <p className="text-xs font-black opacity-65">{lang === 'es' ? 'Carpeta' : 'Folder'}</p>
                    <p className="mt-1 truncate text-[11px] opacity-50">{value || (lang === 'es' ? 'Sin carpeta configurada' : 'No folder configured')}</p>
                    <button
                        onClick={() => onPickAddonFolder(addon.id, 'folder')}
                        className="mt-2 rounded-xl bg-[var(--highlight)] px-3 py-2 text-xs font-black text-white">
                        {value ? (lang === 'es' ? 'Cambiar carpeta' : 'Change folder') : (lang === 'es' ? 'Elegir carpeta' : 'Choose folder')}
                    </button>
                </div>
            );
        }

        if (rule.type === 'boolean') {
            return (
                <label key={key} className="flex items-center justify-between rounded-2xl bg-black/5 p-3 text-sm font-bold dark:bg-white/5">
                    <span>{label}</span>
                    <input type="checkbox" checked={!!value} onChange={event => onUpdateAddonConfig(addon.id, { [key]: event.target.checked })} />
                </label>
            );
        }

        if (rule.type === 'enum') {
            return (
                <label key={key} className="block rounded-2xl bg-black/5 p-3 text-sm font-bold dark:bg-white/5">
                    <span className="mb-2 block opacity-65">{label}</span>
                    <select value={value} onChange={event => onUpdateAddonConfig(addon.id, { [key]: event.target.value })} className="w-full rounded-xl bg-black/10 px-3 py-2 text-xs outline-none dark:bg-white/10">
                        {rule.values.map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                </label>
            );
        }

        if (rule.type === 'string') {
            return (
                <label key={key} className="block rounded-2xl bg-black/5 p-3 text-sm font-bold dark:bg-white/5">
                    <span className="mb-2 block opacity-65">{label}</span>
                    <input type="text" value={value || ''} onChange={event => onUpdateAddonConfig(addon.id, { [key]: event.target.value })} className="w-full rounded-xl bg-black/10 px-3 py-2 text-xs outline-none dark:bg-white/10" />
                </label>
            );
        }

        return (
            <label key={key} className="block rounded-2xl bg-black/5 p-3 text-sm font-bold dark:bg-white/5">
                <span className="mb-2 block opacity-65">{label}</span>
                <input
                    type="number"
                    min={rule.min}
                    max={rule.max}
                    value={value ?? ''}
                    onChange={event => onUpdateAddonConfig(addon.id, { [key]: Number(event.target.value) })}
                    className="w-full rounded-xl bg-black/10 px-3 py-2 text-xs outline-none dark:bg-white/10"
                />
            </label>
        );
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/60 backdrop-blur-sm fade-in sm:items-center" onClick={onClose} onWheel={e => e.stopPropagation()}>
            <div
                ref={dialogRef}
                role="dialog" aria-modal="true" aria-label={copy.title} tabIndex={-1}
                className="flex w-full flex-col rounded-t-3xl border border-[var(--border-color)] bg-[var(--surface-bg)] shadow-2xl outline-none sm:max-w-3xl sm:rounded-3xl"
                style={{ maxHeight: '90vh' }}
                onClick={e => e.stopPropagation()} onWheel={e => e.stopPropagation()}>
                <div className="flex flex-shrink-0 items-center justify-between border-b px-6 py-4" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-black shadow-md" style={{ background: 'linear-gradient(135deg, var(--topbar-bg), var(--highlight))' }}>WS</div>
                        <div>
                            <h2 className="text-xl font-black leading-none">{copy.title}</h2>
                            <p className="mt-0.5 text-[11px] opacity-50">
                                {activeCount > 0 ? `${activeCount} ${activeCount === 1 ? copy.activeSingular : copy.activePlural}` : copy.subtitleEmpty}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Cerrar Workshop" className="rounded-full p-2 text-xl leading-none opacity-60 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/5">x</button>
                </div>

                {activeAddonsList.length > 0 && (
                    <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b px-5 py-3" style={{ borderColor: 'var(--border-color)', backgroundColor: 'color-mix(in srgb, var(--highlight) 4%, var(--surface-bg))' }}>
                        <span className="text-[9px] font-black uppercase tracking-widest opacity-35">{copy.active}</span>
                        {activeAddonsList.map(addon => {
                            const ctxColor = CONTEXT_COLORS[addon.context] || CONTEXT_COLORS.global;
                            return (
                                <div
                                    key={addon.id}
                                    className="flex h-7 items-center gap-1.5 rounded-full py-0 pl-1 pr-1.5 text-[11px] font-bold leading-none transition"
                                    style={{ backgroundColor: `${ctxColor}18`, border: `1px solid ${ctxColor}40`, color: ctxColor }}>
                                    <span
                                        className="flex h-5 w-5 flex-shrink-0 items-center justify-center overflow-hidden rounded-full [&>svg]:h-3 [&>svg]:w-3 [&>svg]:flex-shrink-0"
                                        style={{ backgroundColor: `${ctxColor}28` }}>
                                        <AddonIcon id={addon.id} />
                                    </span>
                                    <span className="max-w-[110px] truncate leading-none">{getLocalizedText(addon.name, lang)}</span>
                                    <button
                                        onClick={() => handleToggle(addon.id)}
                                        title={copy.clickToDisable}
                                        aria-label={copy.clickToDisable}
                                        className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-black leading-none transition hover:brightness-125"
                                        style={{ backgroundColor: `${ctxColor}30` }}>
                                        ×
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="flex flex-shrink-0 flex-col gap-2.5 border-b px-5 py-3" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="inline-flex w-fit flex-shrink-0 gap-0.5 rounded-full p-0.5" style={{ backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)' }}>
                        {[
                            ['all', lang === 'es' ? 'Todos' : 'All', WORKSHOP_ADDONS.length],
                            ['installed', lang === 'es' ? 'Instalados' : 'Installed', activeCount],
                            ['stable', lang === 'es' ? 'Estables' : 'Stable', stableCount],
                            ['experimental', lang === 'es' ? 'Experimental' : 'Experimental', experimentalCount],
                        ].map(([id, label, count]) => (
                            <button
                                key={id}
                                onClick={() => setAddonScope(id)}
                                className={`flex-shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-bold transition ${addonScope === id ? 'text-white shadow-sm' : 'opacity-55 hover:opacity-90'}`}
                                style={addonScope === id ? { backgroundColor: id === 'experimental' ? '#f59e0b' : 'var(--highlight)' } : {}}>
                                {label} <span className="opacity-70">{count}</span>
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-shrink-0 gap-4 overflow-x-auto">
                        {WORKSHOP_CATEGORIES.map(category => (
                            <button
                                key={category.id}
                                onClick={() => setActiveCategory(category.id)}
                                className="relative flex-shrink-0 whitespace-nowrap pb-1.5 text-[12px] font-bold transition"
                                style={{ color: activeCategory === category.id ? 'var(--highlight)' : 'var(--text-color)', opacity: activeCategory === category.id ? 1 : 0.45 }}>
                                {getLocalizedText(category.label, lang)}
                                {activeCategory === category.id && (
                                    <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full" style={{ backgroundColor: 'var(--highlight)' }} />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4" style={{ overscrollBehavior: 'contain' }}>
                    <div className="mb-4">
                        <p className="mb-2.5 text-[10px] font-black uppercase tracking-widest opacity-40">
                            {activeCount === 0
                                ? (lang === 'es' ? 'Empieza con un preset' : 'Start with a preset')
                                : (lang === 'es' ? 'Presets' : 'Presets')}
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                            {PRESETS.map(preset => {
                                const applied = isPresetApplied(preset);
                                const appliedCount = preset.addons.filter(id => !!addons?.[id]).length;
                                return (
                                    <button
                                        key={preset.id}
                                        onClick={() => applyPreset(preset)}
                                        title={applied ? (lang === 'es' ? 'Clic para quitar este preset' : 'Click to remove this preset') : undefined}
                                        className={`group relative flex flex-col items-center gap-1.5 rounded-2xl border p-3 transition hover:scale-[1.02] active:scale-[0.98] ${applied ? 'ring-1 ring-offset-0' : ''}`}
                                        style={{
                                            borderColor: applied ? preset.color : `${preset.color}30`,
                                            background: applied ? `${preset.color}14` : `${preset.color}08`,
                                            ...(applied ? { '--tw-ring-color': preset.color } : {}),
                                        }}>
                                        {applied && (
                                            <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black text-white" style={{ backgroundColor: preset.color }}>✓</span>
                                        )}
                                        <span className="flex h-9 w-9 items-center justify-center rounded-2xl border" style={{ borderColor: `${preset.color}35`, color: preset.color, backgroundColor: `${preset.color}12` }}>
                                            <AddonIcon id={preset.iconId} />
                                        </span>
                                        <span className="text-xs font-black">{preset.label}</span>
                                        <span className="text-[10px] opacity-50 leading-tight text-center">{preset.desc}</span>
                                        <span className="mt-1 rounded-full px-2 py-0.5 text-[9px] font-bold text-white" style={{ backgroundColor: preset.color }}>
                                            {applied
                                                ? (lang === 'es' ? 'Aplicado' : 'Applied')
                                                : appliedCount > 0
                                                    ? `${appliedCount}/${preset.addons.length}`
                                                    : `${preset.addons.length} addons`}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    {(() => {
                        const renderCard = (addon) => {
                            const enabled = !!addons?.[addon.id];
                            const isSoon = addon.status === 'soon';
                            const justToggled = lastToggled === addon.id;
                            const ctxColor = CONTEXT_COLORS[addon.context] || CONTEXT_COLORS.global;
                            const addonName = getLocalizedText(addon.name, lang);
                            const addonDesc = getLocalizedText(addon.desc, lang);
                            const contextLabel = copy.contexts[addon.context] || copy.contexts.global;
                            const maturityLabel = getLocalizedText(WORKSHOP_MATURITY[addon.maturity], lang);
                            const categoryLabel = getLocalizedText(WORKSHOP_CATEGORIES.find(category => category.id === addon.category)?.label, lang);
                            return (
                                <div
                                    key={addon.id}
                                    role={isSoon ? undefined : 'switch'}
                                    aria-checked={isSoon ? undefined : enabled}
                                    aria-label={isSoon ? undefined : addonName}
                                    tabIndex={isSoon ? undefined : 0}
                                    className={`relative overflow-hidden rounded-2xl border p-4 transition-all ${isSoon ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${enabled ? 'ring-1 ring-[var(--highlight)]/25' : ''}`}
                                    style={{
                                        borderColor: enabled ? 'color-mix(in srgb, var(--highlight) 55%, var(--border-color))' : 'var(--border-color)',
                                        background: enabled ? 'color-mix(in srgb, var(--highlight) 7%, var(--bg-color))' : 'var(--bg-color)',
                                        boxShadow: justToggled ? '0 0 0 3px var(--highlight)' : 'none',
                                    }}
                                    onClick={() => !isSoon && handleToggle(addon.id)}
                                    onKeyDown={(e) => { if (!isSoon && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handleToggle(addon.id); } }}>
                                    {justToggled && <div className="pointer-events-none absolute inset-0 rounded-2xl" style={{ background: 'var(--highlight)', opacity: 0.12, animation: 'fadeOut 1.2s forwards' }} />}

                                    <button
                                        onClick={(event) => { event.stopPropagation(); setDetailAddonId(addon.id); }}
                                        title={lang === 'es' ? 'Ver detalles' : 'View details'}
                                        aria-label={lang === 'es' ? 'Ver detalles del addon' : 'View addon details'}
                                        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black opacity-40 transition hover:bg-black/10 hover:opacity-90 dark:hover:bg-white/10">
                                        i
                                    </button>

                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border" style={{ borderColor: `${ctxColor}35`, color: ctxColor, backgroundColor: `${ctxColor}12` }}>
                                            <AddonIcon id={addon.id} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="mb-1 flex items-start justify-between gap-3 pr-5">
                                                <div className="min-w-0">
                                                    <span className="block truncate text-sm font-black">{addonName}</span>
                                                    <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-[0.16em] opacity-40">{categoryLabel || contextLabel}</span>
                                                </div>
                                                {isSoon && <span className="rounded-full bg-yellow-500/20 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-yellow-500">{copy.soon}</span>}
                                            </div>
                                            <p className="text-[11px] leading-relaxed opacity-55">{addonDesc}</p>
                                            {addon.maturity === 'experimental' && <p className="mt-2 text-[10px] font-black uppercase tracking-[0.16em] text-amber-400">{maturityLabel}</p>}

                                            {enabled && addon.lifecycle?.configurable && (
                                                <button
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        setConfigAddonId(addon.id);
                                                    }}
                                                    className="mt-3 rounded-xl border px-3 py-1.5 text-[10px] font-black transition hover:bg-black/5 dark:hover:bg-white/5"
                                                    style={{ borderColor: 'var(--border-color)' }}>
                                                    {copy.configure || (lang === 'es' ? 'Configurar' : 'Configure')}
                                                </button>
                                            )}

                                            {addon.id === 'externalSources' && enabled && (
                                                <p className="mt-2 text-[10px] font-bold text-sky-400">
                                                    {(externalSources || []).filter(source => source.enabled).length} {copy.external.activeSources}
                                                </p>
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
                        };

                        if (addonScope !== 'all') {
                            return <div className="grid gap-2.5 sm:grid-cols-2">{filtered.map(renderCard)}</div>;
                        }

                        return SECTIONS.map(section => {
                            const sectionAddons = filtered.filter(section.match);
                            if (sectionAddons.length === 0) return null;
                            return (
                                <div key={section.id} className="mb-5 last:mb-0">
                                    <p className="mb-2.5 text-[10px] font-black uppercase tracking-widest opacity-40">{section.label} <span className="opacity-60">{sectionAddons.length}</span></p>
                                    <div className="grid gap-2.5 sm:grid-cols-2">{sectionAddons.map(renderCard)}</div>
                                </div>
                            );
                        });
                    })()}

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

            {detailAddon && (
                <div className="fixed inset-0 z-[340] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" onClick={(event) => { event.stopPropagation(); setDetailAddonId(null); }}>
                    <div
                        className="w-full max-w-md rounded-3xl border p-5 shadow-2xl"
                        style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}
                        onClick={event => event.stopPropagation()}>
                        <div className="mb-4 flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border" style={{ borderColor: `${CONTEXT_COLORS[detailAddon.context] || CONTEXT_COLORS.global}35`, color: CONTEXT_COLORS[detailAddon.context] || CONTEXT_COLORS.global, backgroundColor: `${CONTEXT_COLORS[detailAddon.context] || CONTEXT_COLORS.global}12` }}>
                                    <AddonIcon id={detailAddon.id} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.22em] opacity-45">
                                        {getLocalizedText(WORKSHOP_MATURITY[detailAddon.maturity], lang)}
                                    </p>
                                    <h3 className="mt-1 text-xl font-black">{getLocalizedText(detailAddon.name, lang)}</h3>
                                </div>
                            </div>
                            <button onClick={() => setDetailAddonId(null)} aria-label={lang === 'es' ? 'Cerrar detalle del addon' : 'Close addon details'} className="rounded-full p-2 text-xl leading-none opacity-60 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/5">×</button>
                        </div>

                        <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1" style={{ overscrollBehavior: 'contain' }}>
                            <div>
                                <p className="mb-1 text-[10px] font-black uppercase tracking-widest opacity-40">{lang === 'es' ? 'Qué hace' : 'What it does'}</p>
                                <p className="text-sm leading-relaxed opacity-80">{getLocalizedText(detailAddon.desc, lang)}</p>
                            </div>

                            {detailAddon.docs && (
                                <div>
                                    <p className="mb-1 text-[10px] font-black uppercase tracking-widest opacity-40">{lang === 'es' ? 'Cómo usarlo' : 'How to use it'}</p>
                                    <p className="rounded-2xl bg-black/5 p-3 text-sm leading-relaxed opacity-80 dark:bg-white/5">{getLocalizedText(detailAddon.docs, lang)}</p>
                                </div>
                            )}

                            <div>
                                <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest opacity-40">{lang === 'es' ? 'Permisos y capacidades' : 'Permissions & capabilities'}</p>
                                {detailCapabilities.length > 0 ? (
                                    <ul className="space-y-1.5">
                                        {detailCapabilities.map(cap => (
                                            <li key={cap.id} className="flex items-center gap-2 rounded-xl bg-black/5 px-3 py-2 text-xs font-bold opacity-75 dark:bg-white/5">
                                                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: CONTEXT_COLORS[detailAddon.context] || CONTEXT_COLORS.global }} />
                                                {cap.label}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="rounded-xl bg-black/5 px-3 py-2 text-xs font-bold opacity-50 dark:bg-white/5">
                                        {lang === 'es' ? 'No requiere permisos especiales.' : 'No special permissions required.'}
                                    </p>
                                )}
                            </div>

                            {detailHistory.length > 0 && (
                                <div>
                                    <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest opacity-40">{lang === 'es' ? 'Historial de cambios' : 'Change history'}</p>
                                    <ul className="space-y-1.5">
                                        {detailHistory.map(entry => (
                                            <li key={entry.id} className="flex items-center justify-between gap-2 rounded-xl bg-black/5 px-3 py-2 text-xs font-bold dark:bg-white/5">
                                                <span className="opacity-75">{HISTORY_LABELS[entry.type] || entry.type}</span>
                                                <span className="flex-shrink-0 opacity-40">{formatHistoryDate(entry.timestamp)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        <div className="mt-5 flex gap-2">
                            {addons?.[detailAddon.id] && detailAddon.lifecycle?.configurable && (
                                <button
                                    onClick={() => { setDetailAddonId(null); setConfigAddonId(detailAddon.id); }}
                                    className="flex-1 rounded-2xl border py-3 text-sm font-black transition hover:bg-black/5 dark:hover:bg-white/5"
                                    style={{ borderColor: 'var(--border-color)' }}>
                                    {copy.configure || (lang === 'es' ? 'Configurar' : 'Configure')}
                                </button>
                            )}
                            <button onClick={() => setDetailAddonId(null)} className="flex-1 rounded-2xl bg-[var(--highlight)] py-3 text-sm font-black text-white transition hover:brightness-110">
                                {lang === 'es' ? 'Listo' : 'Done'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {configAddon && (
                <div className="fixed inset-0 z-[340] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" onClick={(event) => { event.stopPropagation(); setConfigAddonId(null); }}>
                    <div
                        className="w-full max-w-md rounded-3xl border p-5 shadow-2xl"
                        style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}
                        onClick={event => event.stopPropagation()}>
                        <div className="mb-4 flex items-start justify-between gap-4">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.22em] opacity-45">Addon</p>
                                <h3 className="mt-1 text-xl font-black">{getLocalizedText(configAddon.name, lang)}</h3>
                                <p className="mt-1 text-xs opacity-55">{getLocalizedText(configAddon.desc, lang)}</p>
                            </div>
                            <button onClick={() => setConfigAddonId(null)} aria-label={lang === 'es' ? 'Cerrar configuración del addon' : 'Close addon configuration'} className="rounded-full p-2 text-xl leading-none opacity-60 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/5">×</button>
                        </div>

                        <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1" style={{ overscrollBehavior: 'contain' }}>
                            {configSchemaEntries.length > 0
                                ? configSchemaEntries.map(([key, rule]) => renderConfigField(configAddon, key, rule))
                                : <p className="rounded-2xl bg-black/5 p-4 text-sm font-bold opacity-60 dark:bg-white/5">{lang === 'es' ? 'Este addon no tiene opciones configurables.' : 'This addon has no configurable options.'}</p>}
                        </div>

                        <button onClick={() => setConfigAddonId(null)} className="mt-5 w-full rounded-2xl bg-[var(--highlight)] py-3 text-sm font-black text-white transition hover:brightness-110">
                            {lang === 'es' ? 'Listo' : 'Done'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorkshopPanel;
