import React, { useState, useRef, useEffect } from 'react';

const QuickEditCard = ({ book, onSave, onCancel }) => {
    const [name, setName] = useState(book.name || '');
    const [author, setAuthor] = useState(book.author || '');
    const [tags, setTags] = useState(book.tags || '');
    const [rating, setRating] = useState(book.rating || 0);
    const nameRef = useRef(null);

    useEffect(() => {
        nameRef.current?.focus();
    }, []);

    const handleSave = () => {
        if (!name.trim()) return;
        onSave(book.id, { name: name.trim(), author: author.trim(), tags, rating });
    };

    const handleKey = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave(); }
        if (e.key === 'Escape') onCancel();
    };

    return (
        <div className="book-container" style={{ backgroundColor: 'var(--surface-bg)', border: '2px solid var(--highlight)', borderRadius: '8px', overflow: 'hidden' }}>
            <div className="p-2 flex flex-col gap-1.5 h-full" style={{ minHeight: '200px' }}>
                <input
                    ref={nameRef}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Título"
                    className="w-full text-xs font-bold rounded-lg px-2 py-1 outline-none border border-transparent focus:border-[var(--highlight)] transition"
                    style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-color)' }}
                />
                <input
                    value={author}
                    onChange={e => setAuthor(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Autor"
                    className="w-full text-xs rounded-lg px-2 py-1 outline-none border border-transparent focus:border-[var(--highlight)] transition"
                    style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-color)' }}
                />
                <input
                    value={tags}
                    onChange={e => setTags(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Tags (coma separados)"
                    className="w-full text-xs rounded-lg px-2 py-1 outline-none border border-transparent focus:border-[var(--highlight)] transition"
                    style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-color)' }}
                />
                <div className="flex gap-0.5 justify-center">
                    {[1, 2, 3, 4, 5].map(n => (
                        <button key={n} onClick={() => setRating(n === rating ? 0 : n)}
                            className="text-base transition hover:scale-125"
                            style={{ color: n <= rating ? '#f59e0b' : 'rgba(128,128,128,0.3)' }}>★</button>
                    ))}
                </div>
                <div className="flex gap-1 mt-auto">
                    <button onClick={handleSave}
                        className="flex-1 py-1.5 text-xs font-black rounded-lg text-white transition hover:opacity-90"
                        style={{ backgroundColor: 'var(--highlight)' }}>
                        Guardar
                    </button>
                    <button onClick={onCancel}
                        className="px-3 py-1.5 text-xs font-black rounded-lg transition hover:opacity-80"
                        style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-color)' }}>
                        ×
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QuickEditCard;
