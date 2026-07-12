import React, { useEffect, useRef, useState } from 'react';
import { Icons } from './icons';
import { translations, languageNames } from './translations';
import { saveAppData } from './db';

const ACCENT_PRESETS = [
    { name: 'Cielo', value: '#0ea5e9', topbar: '#0284c7' },
    { name: 'Violeta', value: '#a855f7', topbar: '#7c3aed' },
    { name: 'Verde', value: '#22c55e', topbar: '#16a34a' },
    { name: 'Rosa', value: '#f43f5e', topbar: '#e11d48' },
    { name: 'Naranja', value: '#f97316', topbar: '#ea580c' },
    { name: 'Ámbar', value: '#f59e0b', topbar: '#d97706' },
    { name: 'Índigo', value: '#6366f1', topbar: '#4f46e5' },
    { name: 'Cian', value: '#06b6d4', topbar: '#0891b2' },
];

const PAGE_TRANSITIONS = [
    { id: 'none', label: 'Ninguna', icon: '□' },
    { id: 'fade', label: 'Fade', icon: '~' },
    { id: 'slide', label: 'Deslizar', icon: '>' },
    { id: 'flip', label: 'Voltear', icon: 'B' },
    { id: 'zoom', label: 'Zoom', icon: '+' },
    { id: 'rise', label: 'Subir', icon: '^' },
    { id: 'curl', label: 'Rizar', icon: '@' },
    { id: 'cover', label: 'Cubrir', icon: '#' },
];

const SECTIONS = [
    { id: 'lectura', label: 'Lectura' },
    { id: 'biblioteca', label: 'Biblioteca' },
    { id: 'datos', label: 'Datos' },
    { id: 'avanzado', label: 'Avanzado' },
];

const SettingsPanel = ({
    open, onClose,
    theme, setTheme, warmMode, setWarmMode,
    autoDarkMode, setAutoDarkMode,
    readFlow, setReadFlow, readLayout, setReadLayout,
    pageTransition, setPageTransition,
    lang, setLang,
    aiProvider, setAiProvider, aiApiKey, setAiApiKey,
    syncFolder, setSyncFolder,
    webdavConfig, setWebdavConfig,
    accentColor, setAccentColor,
    tutorialEnabled, setTutorialEnabled,
    onRestartTutorial,
    onExportDiagnostics,
    onClearDiagnostics,
    onExportZipBackup,
    onDeleteAccount,
    t
}) => {
    const [activeSection, setActiveSection] = useState('lectura');
    const [showLangMenu, setShowLangMenu] = useState(false);
    const [assocStatus, setAssocStatus] = useState('');
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [appVersion, setAppVersion] = useState('');
    const [updateState, setUpdateState] = useState({ status: 'idle', info: null });
    const [webdavDraft, setWebdavDraft] = useState({ url: '', username: '', password: '' });
    const [webdavTesting, setWebdavTesting] = useState(false);
    const [webdavStatus, setWebdavStatus] = useState('');
    const [webdavErrorMsg, setWebdavErrorMsg] = useState('');
    const assocStatusTimerRef = useRef(null);

    useEffect(() => {
        window.electronAPI?.getAppVersion?.().then(v => setAppVersion(v)).catch(() => {});
        const handler = (payload) => setUpdateState(payload || { status: 'idle' });
        window.electronAPI?.onUpdateStatus?.(handler);
        return () => window.electronAPI?.offUpdateStatus?.();
    }, []);

    const showAssocStatus = (value, ms = 0) => {
        clearTimeout(assocStatusTimerRef.current);
        setAssocStatus(value);
        if (ms > 0) assocStatusTimerRef.current = setTimeout(() => setAssocStatus(''), ms);
    };

    useEffect(() => () => clearTimeout(assocStatusTimerRef.current), []);

    if (!open) return null;

    const renderToggle = ({ active, onClick, title, description, tone = 'highlight' }) => (
        <button
            onClick={onClick}
            className={`w-full flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${active ? 'border-[var(--highlight)] bg-[var(--highlight)]/10 text-[var(--highlight)]' : 'border-transparent bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'}`}>
            <div>
                <p className="text-sm font-bold">{title}</p>
                {description && <p className="text-xs opacity-60">{description}</p>}
            </div>
            <div className={`relative h-6 w-10 rounded-full transition-all ${active ? (tone === 'warm' ? 'bg-orange-500' : 'bg-[var(--highlight)]') : 'bg-gray-400/30'}`}>
                <div className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${active ? 'left-5' : 'left-1'}`} />
            </div>
        </button>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm fade-in" onClick={onClose} onWheel={e => e.stopPropagation()}>
            <div
                role="dialog" aria-modal="true" aria-label={t.settings}
                className="relative max-h-[90vh] w-[720px] max-w-[95%] overflow-hidden rounded-3xl p-0 shadow-2xl"
                style={{ backgroundColor: 'var(--surface-bg)', border: '1px solid var(--border-color)' }}
                onClick={e => e.stopPropagation()}
                onWheel={e => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b px-6 py-5" style={{ borderColor: 'var(--border-color)' }}>
                    <div>
                        <h2 className="text-2xl font-black">{t.settings}</h2>
                        <p className="mt-1 text-xs opacity-50">Preferencias de lectura, datos y diagnóstico.</p>
                    </div>
                    <button onClick={onClose} className="rounded-full p-2 transition hover:bg-black/5 dark:hover:bg-white/5" aria-label="Cerrar configuración">
                        <Icons.Close />
                    </button>
                </div>

                <div className="flex gap-2 overflow-x-auto border-b px-5 py-3" style={{ borderColor: 'var(--border-color)' }}>
                    {SECTIONS.map(section => (
                        <button
                            key={section.id}
                            onClick={() => setActiveSection(section.id)}
                            className={`rounded-full px-4 py-2 text-xs font-black transition ${activeSection === section.id ? 'text-white' : 'bg-black/5 opacity-65 hover:opacity-100 dark:bg-white/5'}`}
                            style={activeSection === section.id ? { background: 'linear-gradient(135deg, var(--topbar-bg), var(--highlight))' } : {}}>
                            {section.label}
                        </button>
                    ))}
                </div>

                <div className="max-h-[70vh] overflow-y-auto p-6" style={{ overscrollBehavior: 'contain' }}>
                    {activeSection === 'lectura' && (
                        <div className="space-y-6">
                            <section>
                                <label className="mb-3 block pl-1 text-xs font-black uppercase tracking-widest opacity-50">{t.theme}</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        ['light', <Icons.Sun />, t.light],
                                        ['dark', <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>, t.dark],
                                        ['sepia', <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>, t.sepia],
                                    ].map(([val, icon, label]) => (
                                        <label key={val} className={`flex cursor-pointer items-center gap-2 rounded-2xl border p-3 font-semibold transition ${theme === val ? 'border-[var(--highlight)] bg-[var(--highlight)]/10 text-[var(--highlight)]' : 'border-transparent bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10'}`}>
                                            <input type="radio" name="theme" checked={theme === val} onChange={() => setTheme(val)} className="hidden" />
                                            {icon} <span className="text-sm">{label}</span>
                                        </label>
                                    ))}
                                </div>
                                <div className="mt-3 space-y-3">
                                    {renderToggle({
                                        active: autoDarkMode,
                                        onClick: () => setAutoDarkMode(prev => !prev),
                                        title: 'Dark mode automático',
                                        description: 'Cambia entre claro y oscuro según la hora del día.',
                                    })}
                                    {renderToggle({
                                        active: warmMode,
                                        onClick: () => setWarmMode(prev => !prev),
                                        title: 'Modo nocturno cálido',
                                        description: 'Reduce el azul para leer con menos fatiga visual.',
                                        tone: 'warm',
                                    })}
                                </div>
                            </section>

                            <section>
                                <label className="mb-3 block pl-1 text-xs font-black uppercase tracking-widest opacity-50">Configuración de lector</label>
                                <div className="space-y-4 rounded-2xl bg-black/5 p-5 dark:bg-white/5">
                                    <div>
                                        <label className="mb-2 block text-sm font-bold opacity-80">{t.flow}</label>
                                        <div className="flex rounded-xl bg-black/10 p-1 dark:bg-black/40">
                                            {[['paginated', <Icons.FlowHorizontal />, t.horizontal], ['scrolled-doc', <Icons.FlowVertical />, t.vertical]].map(([val, icon, label]) => (
                                                <button key={val} onClick={() => setReadFlow(val)} className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-bold transition ${readFlow === val ? 'bg-white text-blue-600 dark:bg-slate-700 dark:text-blue-400' : 'opacity-60 hover:opacity-100'}`}>
                                                    {icon} {label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className={readFlow !== 'paginated' ? 'pointer-events-none opacity-50' : ''}>
                                        <label className="mb-2 block text-sm font-bold opacity-80">{t.layout}</label>
                                        <div className="flex rounded-xl bg-black/10 p-1 dark:bg-black/40">
                                            {[['none', <Icons.SinglePage />, t.single], ['auto', <Icons.DoublePage />, t.double]].map(([val, icon, label]) => (
                                                <button key={val} onClick={() => setReadLayout(val)} className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-bold transition ${readLayout === val ? 'bg-white text-blue-600 dark:bg-slate-700 dark:text-blue-400' : 'opacity-60 hover:opacity-100'}`}>
                                                    {icon} {label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className={readFlow !== 'paginated' ? 'pointer-events-none opacity-50' : ''}>
                                        <label className="mb-2 block text-sm font-bold opacity-80">Animación de página</label>
                                        <div className="grid grid-cols-4 gap-2">
                                            {PAGE_TRANSITIONS.map(pt => (
                                                <button key={pt.id} onClick={() => setPageTransition(pt.id)} className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs font-bold transition ${pageTransition === pt.id ? 'border-[var(--highlight)] bg-[var(--highlight)]/10 text-[var(--highlight)]' : 'border-transparent bg-black/5 opacity-70 hover:opacity-100 dark:bg-white/5'}`}>
                                                    <span className="text-base">{pt.icon}</span>
                                                    {pt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}

                    {activeSection === 'biblioteca' && (
                        <div className="space-y-6">
                            <section>
                                <label className="mb-3 block pl-1 text-xs font-black uppercase tracking-widest opacity-50">Color de acento</label>
                                <div className="flex flex-wrap gap-2">
                                    {ACCENT_PRESETS.map(p => (
                                        <button key={p.value} onClick={() => setAccentColor(p)} title={p.name} aria-label={`Usar color ${p.name}`} className={`h-8 w-8 rounded-full transition-transform hover:scale-110 ${accentColor?.value === p.value ? 'scale-125 ring-2 ring-[var(--highlight)] ring-offset-2' : ''}`} style={{ backgroundColor: p.value }} />
                                    ))}
                                </div>
                                <p className="mt-2 pl-1 text-[10px] opacity-40">Acento actual: <b>{accentColor?.name || 'Cielo'}</b></p>
                            </section>

                            <section>
                                <label className="mb-3 block pl-1 text-xs font-black uppercase tracking-widest opacity-50">{t.language}</label>
                                <button onClick={() => setShowLangMenu(prev => !prev)} className={`flex w-full items-center justify-between rounded-2xl border p-4 font-bold transition-all ${showLangMenu ? 'border-[var(--highlight)] bg-[var(--highlight)] text-white' : 'border-transparent bg-black/5 dark:bg-white/5'}`}>
                                    <span className="text-lg">{languageNames[lang]}</span>
                                    <Icons.ChevronRight className={`transition-transform ${showLangMenu ? 'rotate-90' : ''}`} />
                                </button>
                                <div className={`overflow-hidden transition-all duration-300 ${showLangMenu ? 'mt-3 max-h-64 opacity-100' : 'max-h-0 opacity-0'}`}>
                                    <div className="flex flex-col gap-2 rounded-2xl border border-black/10 bg-black/5 p-2 dark:border-white/10 dark:bg-white/5">
                                        {Object.keys(translations).map(l => (
                                            <button key={l} onClick={() => { setLang(l); setShowLangMenu(false); }} className={`flex items-center gap-4 rounded-xl px-4 py-3 text-sm font-bold transition ${lang === l ? 'bg-[var(--highlight)] text-white shadow-lg' : 'hover:bg-black/10 dark:hover:bg-white/10'}`}>
                                                <span>{l.toUpperCase()}</span>
                                                <span>{languageNames[l]}</span>
                                                {lang === l && <span className="ml-auto font-black">OK</span>}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </section>

                            <section>
                                <label className="mb-3 block pl-1 text-xs font-black uppercase tracking-widest opacity-50">Tutorial y ayuda</label>
                                {renderToggle({
                                    active: tutorialEnabled,
                                    onClick: () => setTutorialEnabled(prev => !prev),
                                    title: 'Tutorial interactivo',
                                    description: 'Muestra ayudas al abrir la app y al entrar a funciones nuevas.',
                                })}
                                <button onClick={onRestartTutorial} className="mt-3 w-full rounded-xl bg-black/5 py-2.5 text-sm font-bold transition hover:opacity-80 dark:bg-white/5">
                                    Ver tutorial de nuevo
                                </button>
                            </section>
                        </div>
                    )}

                    {activeSection === 'datos' && (
                        <div className="space-y-6">
                            {typeof window !== 'undefined' && window.electronAPI && (
                                <section>
                                    <label className="mb-1 block pl-1 text-xs font-black uppercase tracking-widest opacity-50">Sync de progreso local</label>
                                    <p className="mb-3 px-1 text-xs opacity-50">Guarda tu progreso en una carpeta propia como OneDrive o Dropbox.</p>
                                    {syncFolder && (
                                        <div className="mb-3 flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-2.5">
                                            <span className="text-sm text-green-500">OK</span>
                                            <span className="flex-1 truncate font-mono text-xs opacity-70">{syncFolder}</span>
                                            <button onClick={() => setSyncFolder('')} className="text-xs text-red-500 opacity-60 hover:opacity-100">Quitar</button>
                                        </div>
                                    )}
                                    <button onClick={async () => {
                                        try {
                                            const folder = await window.electronAPI.pickFolder();
                                            if (folder) { setSyncFolder(folder); showAssocStatus('sync_ok', 2500); }
                                        } catch {
                                            showAssocStatus('sync_err');
                                        }
                                    }} className="w-full rounded-xl py-2.5 text-sm font-bold text-white transition hover:brightness-110" style={{ backgroundColor: 'var(--highlight)' }}>
                                        {syncFolder ? 'Cambiar carpeta' : 'Elegir carpeta'}
                                    </button>
                                    {assocStatus === 'sync_ok' && <p className="mt-2 text-xs font-bold text-green-500">Carpeta guardada. El progreso se sincronizará automáticamente.</p>}
                                    {assocStatus === 'sync_err' && <p className="mt-2 text-xs font-bold text-red-500">Error al seleccionar carpeta.</p>}
                                </section>
                            )}

                            {typeof window !== 'undefined' && window.electronAPI?.webdavTestConnection && (
                                <section>
                                    <label className="mb-1 block pl-1 text-xs font-black uppercase tracking-widest opacity-50">Sync WebDAV</label>
                                    <p className="mb-3 px-1 text-xs opacity-50">Alternativa sin terceros: sincroniza con tu propio Nextcloud, ownCloud o cualquier servidor WebDAV (puede estar en tu red local).</p>
                                    {webdavConfig?.url ? (
                                        <div className="mb-3 flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-2.5">
                                            <span className="text-sm text-green-500">OK</span>
                                            <span className="flex-1 truncate font-mono text-xs opacity-70">{webdavConfig.url}</span>
                                            <button onClick={() => { setWebdavConfig({ url: '', username: '', password: '' }); setWebdavDraft({ url: '', username: '', password: '' }); setWebdavStatus(''); }} className="text-xs text-red-500 opacity-60 hover:opacity-100">Quitar</button>
                                        </div>
                                    ) : (
                                        <div className="mb-3 space-y-2">
                                            <input type="text" value={webdavDraft.url} onChange={e => setWebdavDraft(prev => ({ ...prev, url: e.target.value }))}
                                                placeholder="https://mi-nextcloud.com/remote.php/dav/files/usuario/"
                                                className="w-full rounded-xl bg-black/5 dark:bg-white/5 px-3 py-2.5 text-xs font-mono outline-none border border-transparent focus:border-[var(--highlight)] transition"
                                                style={{ color: 'var(--text-color)' }} />
                                            <input type="text" value={webdavDraft.username} onChange={e => setWebdavDraft(prev => ({ ...prev, username: e.target.value }))}
                                                placeholder="Usuario (opcional)"
                                                className="w-full rounded-xl bg-black/5 dark:bg-white/5 px-3 py-2.5 text-xs outline-none border border-transparent focus:border-[var(--highlight)] transition"
                                                style={{ color: 'var(--text-color)' }} />
                                            <input type="password" value={webdavDraft.password} onChange={e => setWebdavDraft(prev => ({ ...prev, password: e.target.value }))}
                                                placeholder="Contraseña (opcional)"
                                                className="w-full rounded-xl bg-black/5 dark:bg-white/5 px-3 py-2.5 text-xs outline-none border border-transparent focus:border-[var(--highlight)] transition"
                                                style={{ color: 'var(--text-color)' }} />
                                        </div>
                                    )}
                                    {!webdavConfig?.url && (
                                        <button onClick={async () => {
                                            if (!webdavDraft.url.trim()) return;
                                            setWebdavTesting(true);
                                            setWebdavStatus('');
                                            const result = await window.electronAPI.webdavTestConnection(webdavDraft).catch(err => ({ ok: false, msg: err?.message }));
                                            setWebdavTesting(false);
                                            if (result?.ok) {
                                                setWebdavConfig({ ...webdavDraft });
                                                setWebdavStatus('ok');
                                            } else {
                                                setWebdavStatus('err');
                                                setWebdavErrorMsg(result?.msg || 'No se pudo conectar.');
                                            }
                                        }} disabled={webdavTesting || !webdavDraft.url.trim()}
                                            className="w-full rounded-xl py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50"
                                            style={{ backgroundColor: 'var(--highlight)' }}>
                                            {webdavTesting ? 'Probando conexión…' : 'Conectar'}
                                        </button>
                                    )}
                                    {webdavStatus === 'ok' && <p className="mt-2 text-xs font-bold text-green-500">Conectado. El progreso se sincronizará automáticamente.</p>}
                                    {webdavStatus === 'err' && <p className="mt-2 text-xs font-bold text-red-500">{webdavErrorMsg || 'No se pudo conectar al servidor.'}</p>}
                                </section>
                            )}

                            <section className="rounded-2xl border border-white/5 bg-black/5 p-4 dark:bg-white/[0.03]">
                                <label className="mb-3 block text-xs font-black uppercase tracking-widest opacity-50">Backups</label>
                                <p className="mb-3 text-xs opacity-60">Exporta metadata, progreso, configuración, Workshop y diagnóstico en un ZIP local.</p>
                                <button onClick={() => onExportZipBackup(false)} className="w-full rounded-xl bg-[var(--highlight)] py-2.5 text-sm font-black text-white transition hover:brightness-110">
                                    Exportar backup ZIP (solo datos)
                                </button>
                                <p className="mb-3 mt-4 text-xs opacity-60">O incluye también los archivos EPUB/PDF para poder restaurar el 100% de tu biblioteca en otro PC. Puede tardar y ocupar bastante según tu biblioteca.</p>
                                <button onClick={() => onExportZipBackup(true)} className="w-full rounded-xl border border-[var(--highlight)]/40 bg-[var(--highlight)]/10 py-2.5 text-sm font-black text-[var(--highlight)] transition hover:bg-[var(--highlight)]/20">
                                    Exportar backup completo (con libros)
                                </button>
                                <p className="mt-3 text-[11px] opacity-45">Para restaurar cualquiera de los dos: menú de usuario → Importar y selecciona el .json o .zip.</p>
                            </section>

                            <section>
                                <label className="mb-3 block pl-1 text-xs font-black uppercase tracking-widest opacity-50">Cuenta y datos</label>
                                {!confirmDelete ? (
                                    <button onClick={() => setConfirmDelete(true)} className="w-full rounded-2xl border border-red-500/25 bg-red-500/10 py-3 text-sm font-bold text-red-400 transition hover:bg-red-500/15">
                                        Eliminar la cuenta y los datos
                                    </button>
                                ) : (
                                    <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4">
                                        <p className="text-sm font-bold text-red-300">Se borrarán el perfil, la biblioteca, el progreso, los logros y los ajustes locales.</p>
                                        <p className="mt-1 text-xs opacity-70">La acción no se puede deshacer.</p>
                                        <div className="mt-4 flex gap-2">
                                            <button onClick={() => setConfirmDelete(false)} className="flex-1 rounded-xl bg-black/10 py-2.5 text-sm font-bold transition hover:opacity-80 dark:bg-white/5">Cancelar</button>
                                            <button onClick={onDeleteAccount} className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white transition hover:bg-red-600">Sí, eliminar todo</button>
                                        </div>
                                    </div>
                                )}
                            </section>
                        </div>
                    )}

                    {activeSection === 'avanzado' && (
                        <div className="space-y-6">
                            <section>
                                <label className="mb-3 block pl-1 text-xs font-black uppercase tracking-widest opacity-50">AI Assistant</label>
                                <select value={aiProvider} onChange={e => setAiProvider(e.target.value)} className="mb-3 w-full rounded-xl border p-3 text-sm font-semibold outline-none transition" style={{ backgroundColor: 'var(--surface-bg)', color: 'var(--text-color)', borderColor: 'var(--border-color)' }}>
                                    <option value="groq">Groq - Llama 3</option>
                                    <option value="openrouter">OpenRouter - Llama / Mistral</option>
                                    <option value="gemini">Google Gemini</option>
                                    <option value="xai">xAI Grok</option>
                                </select>
                                <input type="password" placeholder={aiProvider === 'groq' ? 'gsk_...' : aiProvider === 'openrouter' ? 'sk-or-v1-...' : aiProvider === 'xai' ? 'xai-...' : 'AIza...'} value={aiApiKey} onChange={e => setAiApiKey(e.target.value)} className="mb-2 w-full rounded-xl border border-transparent bg-black/5 p-3 font-mono text-sm outline-none transition focus:border-[var(--highlight)] dark:bg-white/5" style={{ color: 'var(--text-color)' }} />
                                <button onClick={() => {
                                    saveAppData('aiApiKey', aiApiKey);
                                    saveAppData('aiProvider', aiProvider);
                                    showAssocStatus('saved', 2000);
                                }} className="w-full rounded-xl py-2.5 text-sm font-bold text-white transition hover:opacity-90" style={{ backgroundColor: 'var(--highlight)' }}>
                                    {assocStatus === 'saved' ? 'Clave guardada' : 'Guardar clave'}
                                </button>
                            </section>

                            {typeof window !== 'undefined' && window.electronAPI && (
                                <section>
                                    <label className="mb-3 block pl-1 text-xs font-black uppercase tracking-widest opacity-50">Asociación de archivos</label>
                                    <div className="flex gap-2">
                                        <button onClick={async () => {
                                            try {
                                                const result = await window.electronAPI.registerFileAssociations();
                                                setAssocStatus(result.ok ? 'Registrado' : `Error: ${result.msg}`);
                                            } catch (error) {
                                                setAssocStatus(`Error: ${error.message}`);
                                            }
                                        }} className="flex-1 rounded-xl py-3 text-sm font-bold text-white transition hover:brightness-110" style={{ backgroundColor: 'var(--highlight)' }}>
                                            Registrar .epub y .pdf
                                        </button>
                                        <button onClick={async () => {
                                            try {
                                                await window.electronAPI.removeFileAssociations();
                                                setAssocStatus('Eliminado');
                                            } catch (error) {
                                                setAssocStatus(`Error: ${error.message}`);
                                            }
                                        }} className="rounded-xl bg-black/5 px-4 py-3 text-sm font-bold transition hover:opacity-70 dark:bg-white/5">
                                            Eliminar
                                        </button>
                                    </div>
                                    {assocStatus && !['saved', 'sync_ok', 'sync_err'].includes(assocStatus) && <p className={`mt-2 px-1 text-xs font-bold ${assocStatus.startsWith('Error') ? 'text-red-500' : 'text-green-500'}`}>{assocStatus}</p>}
                                </section>
                            )}

                            <section className="rounded-2xl border border-white/5 bg-black/5 p-4 dark:bg-white/[0.03]">
                                <label className="mb-3 block text-xs font-black uppercase tracking-widest opacity-50">Diagnóstico</label>
                                <p className="mb-3 text-xs opacity-60">Exporta errores y warnings recientes para revisar bugs sin abrir DevTools.</p>
                                <div className="flex gap-2">
                                    <button onClick={onExportDiagnostics} className="flex-1 rounded-xl bg-[var(--highlight)] py-2.5 text-sm font-black text-white transition hover:brightness-110">
                                        Exportar diagnóstico
                                    </button>
                                    <button onClick={onClearDiagnostics} className="rounded-xl bg-black/5 px-4 py-2.5 text-sm font-bold transition hover:opacity-80 dark:bg-white/5">
                                        Limpiar
                                    </button>
                                </div>
                            </section>

                            <section className="rounded-2xl border border-white/5 bg-black/5 p-4 dark:bg-white/[0.03]">
                                <label className="mb-3 block text-xs font-black uppercase tracking-widest opacity-50">Acerca de</label>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between"><span className="text-xs font-black opacity-60">Versión</span><span className="text-xs font-bold opacity-90">{appVersion || '-'}</span></div>
                                    <div className="flex items-center justify-between"><span className="text-xs font-black opacity-60">Desarrollador</span><span className="text-xs font-bold opacity-90">David Bonilla</span></div>
                                    <div className="flex items-center justify-between"><span className="text-xs font-black opacity-60">Stack</span><span className="text-xs font-bold opacity-60">Electron · React · Vite</span></div>
                                </div>
                                <div className="mt-3 border-t border-white/5 pt-3">
                                    {(() => {
                                        const status = updateState.status;
                                        if (status === 'available' || status === 'downloading') {
                                            const pct = updateState.info?.percent != null ? Math.round(updateState.info.percent) : null;
                                            return <div className="py-1.5 text-xs font-bold opacity-70">{status === 'downloading' && pct != null ? `Descargando actualización... ${pct}%` : 'Descargando actualización...'}</div>;
                                        }
                                        if (status === 'downloaded') {
                                            return <button onClick={() => window.electronAPI?.quitAndInstallUpdate?.()} className="w-full rounded-xl bg-green-500/20 py-2 text-sm font-bold text-green-600 transition hover:bg-green-500/30 dark:text-green-300">Actualización lista - Reiniciar e instalar</button>;
                                        }
                                        return <button onClick={() => { setUpdateState({ status: 'checking' }); window.electronAPI?.checkForUpdates?.(); }} disabled={status === 'checking'} className="w-full rounded-xl bg-black/5 py-2 text-sm font-bold transition hover:bg-black/10 disabled:opacity-50 dark:bg-white/5 dark:hover:bg-white/10">{status === 'checking' ? 'Buscando...' : status === 'not-available' ? 'Estás al día' : status === 'error' ? 'Error al buscar - reintentar' : 'Buscar actualizaciones'}</button>;
                                    })()}
                                </div>
                            </section>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SettingsPanel;
