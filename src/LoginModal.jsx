import React from 'react';
import { Icons, renderAvatar } from './icons';

export default function LoginModal({ show, onClose, tempLoginName, setTempLoginName, tempLoginAvatar, avatarInputRef, handleRandomEmoji, handleLogin, t }) {
    if (!show) return null;
    return (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/80 backdrop-blur-md fade-in" onClick={onClose}>
            <div className="bg-[var(--surface-bg)] w-full max-w-sm rounded-3xl p-8 shadow-2xl relative border border-[var(--highlight)]" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 p-2 opacity-50 hover:opacity-100 transition"><Icons.Close /></button>
                <h2 className="text-2xl font-black mb-2 text-center text-[var(--highlight)]">{t.createProfile}</h2>
                <p className="text-xs text-center opacity-60 mb-6">{t.createProfileDesc}</p>
                <div className="flex flex-col items-center gap-4 mb-6">
                    <div className="w-24 h-24 bg-black/5 dark:bg-white/5 rounded-full border-4 border-[var(--highlight)] shadow-xl flex items-center justify-center text-5xl overflow-hidden">{renderAvatar(tempLoginAvatar)}</div>
                    <div className="flex gap-2">
                        <button onClick={handleRandomEmoji} className="px-4 py-2 bg-black/5 dark:bg-white/5 rounded-xl text-xs font-bold hover:bg-black/10 flex items-center gap-2 transition"><Icons.Dice /> Aleatorio</button>
                        <button onClick={() => avatarInputRef.current.click()} className="px-4 py-2 bg-black/5 dark:bg-white/5 rounded-xl text-xs font-bold hover:bg-black/10 flex items-center gap-2 transition"><Icons.Image /> Foto</button>
                    </div>
                </div>
                <input type="text" placeholder="Ej. El Gran Tiburón"
                    className="w-full bg-black/5 dark:bg-white/5 p-4 rounded-xl border border-transparent focus:border-[var(--highlight)] outline-none font-bold text-center text-lg transition mb-8"
                    value={tempLoginName} onChange={e => setTempLoginName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
                <button onClick={handleLogin} className="w-full bg-[var(--highlight)] text-white font-black py-4 rounded-xl shadow-lg hover:brightness-110 transition text-lg">{t.startReading}</button>
            </div>
        </div>
    );
}
