import React from 'react';
import { Icons, renderAvatar } from './icons';
import { RANDOM_EMOJIS } from './translations';

export default function EditProfileModal({ show, onClose, userProfile, tempEditAvatar, setTempEditAvatar, tempEditName, setTempEditName, handleEditAvatarUpload, saveEditProfile }) {
    if (!show || !userProfile) return null;
    return (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/80 backdrop-blur-md fade-in" onClick={onClose}>
            <div className="bg-[var(--surface-bg)] w-full max-w-sm rounded-3xl p-8 shadow-2xl relative border border-[var(--highlight)]" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 p-2 opacity-50 hover:opacity-100 transition"><Icons.Close /></button>
                <h2 className="text-2xl font-black mb-2 text-center" style={{ color: 'var(--highlight)' }}>Editar Perfil</h2>
                <p className="text-xs text-center opacity-60 mb-6">Cambia tu nombre o avatar</p>
                <div className="flex flex-col items-center gap-4 mb-6">
                    <div className="w-24 h-24 bg-black/5 dark:bg-white/5 rounded-full border-4 border-[var(--highlight)] shadow-xl flex items-center justify-center text-5xl overflow-hidden">{renderAvatar(tempEditAvatar)}</div>
                    <div className="flex gap-2">
                        <button onClick={() => setTempEditAvatar(RANDOM_EMOJIS[Math.floor(Math.random() * RANDOM_EMOJIS.length)])}
                            className="px-4 py-2 bg-black/5 dark:bg-white/5 rounded-xl text-xs font-bold hover:bg-black/10 flex items-center gap-2 transition">
                            <Icons.Dice /> Aleatorio
                        </button>
                        <label className="px-4 py-2 bg-black/5 dark:bg-white/5 rounded-xl text-xs font-bold hover:bg-black/10 flex items-center gap-2 transition cursor-pointer">
                            <Icons.Image /> Foto
                            <input type="file" accept="image/*" className="hidden" onChange={handleEditAvatarUpload} />
                        </label>
                    </div>
                    <div className="flex gap-2 w-full">
                        {RANDOM_EMOJIS.slice(0, 8).map(e => (
                            <button key={e} onClick={() => setTempEditAvatar(e)}
                                className={`flex-1 rounded-xl py-2 text-xl transition ${tempEditAvatar === e ? 'bg-[var(--highlight)]/20 scale-110' : 'bg-black/5 dark:bg-white/5 hover:bg-black/10'}`}>
                                {e}
                            </button>
                        ))}
                    </div>
                </div>
                <input type="text" placeholder="Tu nombre"
                    className="w-full bg-black/5 dark:bg-white/5 p-4 rounded-xl border border-transparent focus:border-[var(--highlight)] outline-none font-bold text-center text-lg transition mb-4"
                    value={tempEditName} onChange={e => setTempEditName(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEditProfile()} />
                <button onClick={saveEditProfile} disabled={!tempEditName.trim()}
                    className="w-full text-white font-black py-4 rounded-xl shadow-lg hover:brightness-110 transition text-lg disabled:opacity-50"
                    style={{ backgroundColor: 'var(--highlight)' }}>
                    Guardar cambios
                </button>
            </div>
        </div>
    );
}
