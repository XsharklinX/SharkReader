import React, { useEffect, useState } from 'react';
import { Icons } from './icons';

const BookCard = React.memo(({ book, isOpen, onOpen, onContextMenu }) => {
    const [imageFailed, setImageFailed] = useState(false);

    useEffect(() => {
        setImageFailed(false);
    }, [book.coverUrl]);

    const showCover = Boolean(book.coverUrl && !imageFailed);
    return (
        <div className={`book-container ${isOpen ? 'ring-2 ring-[var(--highlight)] ring-offset-2 ring-offset-[var(--bg-color)] rounded-lg' : ''}`}
            onClick={() => onOpen(book.id)} onContextMenu={(e) => onContextMenu(e, book)}>
            {book.isFav && <div className="favorite-badge"><Icons.Heart fill="white" className="w-3 h-3" /></div>}
            <div className={`book-cover ${showCover ? 'has-image' : ''} ${book.loading ? 'skeleton-loader' : ''}`}
                style={{ backgroundColor: showCover ? 'transparent' : book.color }}>
                {showCover && (
                    <img
                        src={book.coverUrl}
                        alt={book.name || 'Portada'}
                        className="absolute inset-0 h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                        onError={() => setImageFailed(true)}
                    />
                )}
                {!showCover && !book.loading && (
                    <div className="absolute inset-0 flex flex-col justify-between p-3"
                        style={{ background: `linear-gradient(160deg, ${book.color || '#334155'} 0%, color-mix(in srgb, ${book.color || '#334155'} 50%, #000) 100%)` }}>
                        <div className="text-[9px] font-black uppercase tracking-widest opacity-40 text-white">EPUB</div>
                        <div className="flex-1 flex items-center justify-center px-1 py-2">
                            <span className="text-white font-black text-center leading-tight"
                                style={{ fontSize: 'clamp(9px, 14%, 15px)', textShadow: '0 1px 4px rgba(0,0,0,0.5)', display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {book.name}
                            </span>
                        </div>
                        {book.author && (
                            <div className="text-white opacity-60 text-center font-semibold truncate"
                                style={{ fontSize: 'clamp(7px, 10%, 11px)', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                                {book.author}
                            </div>
                        )}
                    </div>
                )}
                {!book.loading && (book.progress > 0 || book.lastReadDate > 0) && (
                    <div className="cover-progress-wrapper">
                        <div className="cover-progress-fill" style={{ width: `${book.progress || 0}%` }}></div>
                        <div className="cover-progress-text">{book.progress || 0}%</div>
                    </div>
                )}
            </div>
            <div className="book-info-under">
                <div className="title" title={book.name}>{book.name}</div>
                <div className="author" title={book.author}>{book.author}</div>
                {book.series && <div className="text-[10px] opacity-45 mt-0.5 truncate italic">{book.series}{book.seriesIndex ? ` #${book.seriesIndex}` : ''}</div>}
                {book.rating > 0 && <div className="text-xs mt-1" style={{ color: '#f59e0b', letterSpacing: '-1px' }}>{'★'.repeat(book.rating)}{'☆'.repeat(5 - book.rating)}</div>}
            </div>
        </div>
    );
});

export default BookCard;
