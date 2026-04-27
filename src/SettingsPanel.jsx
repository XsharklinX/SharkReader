import React, { useState } from 'react';
import { Icons } from './icons';
import { translations, languageNames } from './translations';

const ACCENT_PRESETS = [
    { name: 'Cielo',   value: '#0ea5e9', topbar: '#0284c7' },
    { name: 'Violeta', value: '#a855f7', topbar: '#7c3aed' },
    { name: 'Verde',   value: '#22c55e', topbar: '#16a34a' },
    { name: 'Rosa',    value: '#f43f5e', topbar: '#e11d48' },
    { name: 'Naranja', value: '#f97316', topbar: '#ea580c' },
    { name: 'Ámbar',   value: '#f59e0b', topbar: '#d97706' },
    { name: 'Índigo',  value: '#6366f1', topbar: '#4f46e5' },
    { name: 'Cian',    value: '#06b6d4', topbar: '#0891b2' },
];

const PAGE_TRANSITIONS = [
    { id: 'none',  label: 'Ninguna',  emoji: '⬜' },
    { id: 'fade',  label: 'Fade',     emoji: '🌫️' },
    { id: 'slide', label: 'Deslizar', emoji: '➡️' },
    { id: 'flip',  label: 'Voltear',  emoji: '📖' },
    { id: 'zoom',  label: 'Zoom',     emoji: '🔍' },
    { id: 'rise',  label: 'Subir',    emoji: '⬆️' },
];

const SettingsPanel = ({
    open, onClose,
    theme, setTheme, warmMode, setWarmMode,
    readFlow, setReadFlow, readLayout, setReadLayout,
    pageTransition, setPageTransition,
    lang, setLang,
    aiProvider, setAiProvider, aiApiKey, setAiApiKey,
    syncFolder, setSyncFolder,
    accentColor, setAccentColor,
    t
}) => {
    const [showLangMenu, setShowLangMenu] = useState(false);
    const [assocStatus, setAssocStatus] = useState('');

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm fade-in" onClick={onClose} onWheel={e => e.stopPropagation()}>
            <div className="rounded-3xl shadow-2xl p-8 w-[540px] max-w-[95%] relative max-h-[90vh] overflow-y-auto"
                style={{ backgroundColor: 'var(--surface-bg)', border: '1px solid var(--border-color)' }}
                onClick={e => e.stopPropagation()} onWheel={e => e.stopPropagation()}>

                <div className="flex justify-between items-center mb-6 border-b pb-4" style={{ borderColor: 'var(--border-color)' }}>
                    <h2 className="text-2xl font-black">{t.settings}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition"><Icons.Close /></button>
                </div>

                {/* ── TEMA ── */}
                <div className="mb-6">
                    <label className="block text-xs font-black mb-3 opacity-50 uppercase tracking-widest pl-1">{t.theme}</label>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            ['light', <Icons.Sun />, t.light],
                            ['dark', <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>, t.dark],
                            ['sepia', <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>, t.sepia],
                        ].map(([val, icon, label]) => (
                            <label key={val} className={`flex items-center gap-2 cursor-pointer p-3 border rounded-2xl transition font-semibold ${theme === val ? 'border-[var(--highlight)] bg-[var(--highlight)]/10 text-[var(--highlight)]' : 'border-transparent bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'}`}>
                                <input type="radio" name="theme" checked={theme === val} onChange={() => setTheme(val)} className="hidden" />
                                {icon} <span className="text-sm">{label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* ── ACENTO ── */}
                <div className="mb-6">
                    <label className="block text-xs font-black mb-3 opacity-50 uppercase tracking-widest pl-1">Color de acento</label>
                    <div className="flex gap-2 flex-wrap">
                        {ACCENT_PRESETS.map(p => (
                            <button key={p.value} onClick={() => setAccentColor(p)}
                                title={p.name}
                                className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${accentColor?.value === p.value ? 'scale-125 ring-2 ring-offset-2 ring-[var(--highlight)]' : ''}`}
                                style={{ backgroundColor: p.value }} />
                        ))}
                    </div>
                    <p className="text-[10px] opacity-40 mt-2 pl-1">Acento actual: <b>{accentColor?.name || 'Cielo'}</b></p>
                </div>

                {/* ── WARM MODE ── */}
                <div className="mb-6">
                    <label className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition ${warmMode ? 'border-orange-400 bg-orange-500/10' : 'border-transparent bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'}`}
                        onClick={() => setWarmMode(p => !p)}>
                        <div className="flex items-center gap-3">
                            <span className="text-xl">🌙</span>
                            <div>
                                <p className="font-bold text-sm">Modo Nocturno Cálido</p>
                                <p className="text-xs opacity-50">Reduce el azul (estilo f.lux)</p>
                            </div>
                        </div>
                        <div className={`w-10 h-6 rounded-full transition-all ${warmMode ? 'bg-orange-500' : 'bg-gray-400/30'} relative`}>
                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${warmMode ? 'left-5' : 'left-1'}`} />
                        </div>
                    </label>
                </div>

                {/* ── LECTOR ── */}
                <div className="mb-6">
                    <label className="block text-xs font-black mb-3 opacity-50 uppercase tracking-widest pl-1">Configuración de Lector</label>
                    <div className="bg-black/5 dark:bg-white/5 p-5 rounded-2xl space-y-4">
                        <div>
                            <label className="block text-sm font-bold mb-2 opacity-80">{t.flow}</label>
                            <div className="flex bg-black/10 dark:bg-black/40 rounded-xl p-1">
                                {[['paginated', <Icons.FlowHorizontal />, t.horizontal], ['scrolled-doc', <Icons.FlowVertical />, t.vertical]].map(([val, icon, label]) => (
                                    <button key={val} onClick={() => setReadFlow(val)}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition ${readFlow === val ? 'bg-white text-blue-600 dark:bg-slate-700 dark:text-blue-400' : 'opacity-60 hover:opacity-100'}`}>
                                        {icon} {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className={readFlow !== 'paginated' ? 'opacity-50 pointer-events-none' : ''}>
                            <label className="block text-sm font-bold mb-2 opacity-80">{t.layout}</label>
                            <div className="flex bg-black/10 dark:bg-black/40 rounded-xl p-1">
                                {[['none', <Icons.SinglePage />, t.single], ['auto', <Icons.DoublePage />, t.double]].map(([val, icon, label]) => (
                                    <button key={val} onClick={() => setReadLayout(val)}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition ${readLayout === val ? 'bg-white text-blue-600 dark:bg-slate-700 dark:text-blue-400' : 'opacity-60 hover:opacity-100'}`}>
                                        {icon} {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className={readFlow !== 'paginated' ? 'opacity-50 pointer-events-none' : ''}>
                            <label className="block text-sm font-bold mb-2 opacity-80">Animación de página</label>
                            <div className="grid grid-cols-3 gap-2">
                                {PAGE_TRANSITIONS.map(pt => (
                                    <button key={pt.id} onClick={() => setPageTransition(pt.id)}
                                        className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-bold transition ${pageTransition === pt.id ? 'border-[var(--highlight)] bg-[var(--highlight)]/10 text-[var(--highlight)]' : 'border-transparent bg-black/5 dark:bg-white/5 opacity-70 hover:opacity-100'}`}>
                                        <span className="text-base">{pt.emoji}</span>
                                        {pt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── IDIOMA ── */}
                <div className="mb-6">
                    <label className="block text-xs font-black mb-3 opacity-50 uppercase tracking-widest pl-1">{t.language}</label>
                    <button onClick={() => setShowLangMenu(p => !p)}
                        className={`w-full flex items-center justify-between p-4 rounded-2xl border font-bold transition-all ${showLangMenu ? 'bg-[var(--highlight)] text-white border-[var(--highlight)]' : 'bg-black/5 dark:bg-white/5 border-transparent'}`}>
                        <span className="text-lg">{languageNames[lang]}</span>
                        <Icons.ChevronRight className={`transition-transform ${showLangMenu ? 'rotate-90' : ''}`} />
                    </button>
                    <div className={`overflow-hidden transition-all duration-300 ${showLangMenu ? 'max-h-64 opacity-100 mt-3' : 'max-h-0 opacity-0'}`}>
                        <div className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl p-2 flex flex-col gap-2">
                            {Object.keys(translations).map(l => (
                                <button key={l} onClick={() => { setLang(l); setShowLangMenu(false); }}
                                    className={`flex items-center gap-4 px-4 py-3 rounded-xl font-bold text-sm transition ${lang === l ? 'bg-[var(--highlight)] text-white shadow-lg' : 'hover:bg-black/10 dark:hover:bg-white/10'}`}>
                                    <span className="text-2xl">{l === 'es' ? '🇪🇸' : l === 'en' ? '🇺🇸' : '🇨🇳'}</span>
                                    <span>{languageNames[l]}</span>
                                    {lang === l && <span className="ml-auto font-black">✓</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── AI ASSISTANT ── */}
                <div className="mb-6 pt-5 border-t" style={{ borderColor: 'var(--border-color)' }}>
                    <label className="block text-xs font-black mb-3 opacity-50 uppercase tracking-widest pl-1">🤖 AI Assistant</label>
                    <select value={aiProvider} onChange={e => setAiProvider(e.target.value)}
                        className="w-full p-3 text-sm rounded-xl border outline-none transition mb-3 font-semibold"
                        style={{ backgroundColor: 'var(--surface-bg)', color: 'var(--text-color)', borderColor: 'var(--border-color)' }}>
                        <option value="groq">⚡ Groq — Llama 3 (100% gratis, recomendado)</option>
                        <option value="openrouter">🌐 OpenRouter — Llama / Mistral (gratis)</option>
                        <option value="gemini">✨ Google Gemini (gratis con cuenta)</option>
                        <option value="xai">🤖 xAI Grok (crédito gratuito)</option>
                    </select>
                    <div className="bg-black/5 dark:bg-white/5 rounded-xl p-3 mb-3 text-[11px] leading-relaxed">
                        {aiProvider === 'groq' && <><b>Groq</b> — Completamente gratis. Regístrate en <b>console.groq.com</b> → API Keys. Clave: <code>gsk_...</code></>}
                        {aiProvider === 'openrouter' && <><b>OpenRouter</b> — Modelos gratuitos. Regístrate en <b>openrouter.ai</b> → Keys. Clave: <code>sk-or-v1-...</code></>}
                        {aiProvider === 'gemini' && <><b>Google Gemini</b> — Gratis. Ve a <b>aistudio.google.com</b> → Get API key. Clave: <code>AIza...</code></>}
                        {aiProvider === 'xai' && <><b>xAI Grok</b> — $25 gratis al registrarse. Ve a <b>console.x.ai</b>. Clave: <code>xai-...</code></>}
                    </div>
                    <input type="password"
                        placeholder={aiProvider === 'groq' ? 'gsk_...' : aiProvider === 'openrouter' ? 'sk-or-v1-...' : aiProvider === 'xai' ? 'xai-...' : 'AIza...'}
                        value={aiApiKey} onChange={e => setAiApiKey(e.target.value)}
                        className="w-full bg-black/5 dark:bg-white/5 p-3 text-sm rounded-xl border border-transparent focus:border-[var(--highlight)] outline-none transition font-mono mb-2"
                        style={{ color: 'var(--text-color)' }} />
                    <button onClick={() => { localStorage.setItem('sharkreader_ai_key', JSON.stringify(aiApiKey)); localStorage.setItem('sharkreader_ai_provider', JSON.stringify(aiProvider)); setAssocStatus('saved'); setTimeout(() => setAssocStatus(''), 2000); }}
                        className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
                        style={{ backgroundColor: 'var(--highlight)' }}>
                        {assocStatus === 'saved' ? '✅ Clave guardada' : '💾 Guardar clave'}
                    </button>
                </div>

                {/* ── SYNC CARPETA LOCAL ── */}
                {typeof require !== 'undefined' && (
                    <div className="mb-6 pt-5 border-t" style={{ borderColor: 'var(--border-color)' }}>
                        <label className="block text-xs font-black mb-1 opacity-50 uppercase tracking-widest pl-1">📁 Sync de progreso local</label>
                        <p className="text-xs opacity-50 mb-3 px-1">Guarda tu progreso en una carpeta (Dropbox, OneDrive, etc.)</p>
                        {syncFolder && (
                            <div className="flex items-center gap-2 mb-3 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-2.5">
                                <span className="text-green-500 text-sm">✓</span>
                                <span className="text-xs font-mono truncate opacity-70 flex-1">{syncFolder}</span>
                                <button onClick={() => setSyncFolder('')} className="text-xs opacity-50 hover:opacity-100 text-red-500">✕</button>
                            </div>
                        )}
                        <div className="flex gap-2">
                            <button onClick={async () => {
                                try {
                                    const { ipcRenderer } = require('electron');
                                    const folder = await ipcRenderer.invoke('pick-folder');
                                    if (folder) { setSyncFolder(folder); setAssocStatus('sync_ok'); setTimeout(() => setAssocStatus(''), 2500); }
                                } catch (e) { setAssocStatus('sync_err'); }
                            }} className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white hover:brightness-110 transition"
                                style={{ backgroundColor: 'var(--highlight)' }}>
                                📂 {syncFolder ? 'Cambiar carpeta' : 'Elegir carpeta'}
                            </button>
                        </div>
                        {assocStatus === 'sync_ok' && <p className="text-xs mt-2 font-bold text-green-500">✓ Carpeta guardada. El progreso se sincronizará automáticamente.</p>}
                        {assocStatus === 'sync_err' && <p className="text-xs mt-2 font-bold text-red-500">✗ Error al seleccionar carpeta.</p>}
                    </div>
                )}

                {/* ── ASOCIACIÓN DE ARCHIVOS ── */}
                {typeof require !== 'undefined' && (
                    <div className="pt-5 border-t" style={{ borderColor: 'var(--border-color)' }}>
                        <label className="block text-xs font-black mb-3 opacity-50 uppercase tracking-widest pl-1">Asociación de archivos</label>
                        <div className="flex gap-2">
                            <button onClick={async () => { try { const { ipcRenderer } = require('electron'); const r = await ipcRenderer.invoke('register-file-associations'); setAssocStatus(r.ok ? '✓ Registrado' : '✗ ' + r.msg); } catch (e) { setAssocStatus('✗ ' + e.message); } }}
                                className="flex-1 py-3 rounded-xl font-bold text-sm text-white hover:brightness-110 transition" style={{ backgroundColor: 'var(--highlight)' }}>
                                🔗 Registrar .epub y .mobi
                            </button>
                            <button onClick={async () => { try { const { ipcRenderer } = require('electron'); await ipcRenderer.invoke('remove-file-associations'); setAssocStatus('✓ Eliminado'); } catch (e) { setAssocStatus('✗ ' + e.message); } }}
                                className="py-3 px-4 rounded-xl font-bold text-sm bg-black/5 dark:bg-white/5 hover:opacity-70 transition">
                                Eliminar
                            </button>
                        </div>
                        {assocStatus && !['saved', 'sync_ok', 'sync_err'].includes(assocStatus) && (
                            <p className={`text-xs mt-2 px-1 font-bold ${assocStatus.startsWith('✓') ? 'text-green-500' : 'text-red-500'}`}>{assocStatus}</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SettingsPanel;
