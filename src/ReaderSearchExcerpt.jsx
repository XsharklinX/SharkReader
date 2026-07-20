import React, { useMemo } from 'react';

const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const splitSearchExcerpt = (text, query) => {
    const source = String(text || '');
    const needle = String(query || '').trim();
    if (!needle) return [{ text: source, match: false }];
    const expression = new RegExp(`(${escapeRegExp(needle)})`, 'gi');
    return source.split(expression).filter(Boolean).map(part => ({
        text: part,
        match: part.toLowerCase() === needle.toLowerCase(),
    }));
};

export default function ReaderSearchExcerpt({ text, query, className = '' }) {
    const parts = useMemo(() => splitSearchExcerpt(text, query), [query, text]);

    return (
        <p className={className}>
            {parts.map((part, index) => part.match ? (
                <mark
                    key={`${index}-${part.text}`}
                    className="rounded px-0.5"
                    style={{ backgroundColor: 'rgba(250,204,21,0.65)', color: 'inherit' }}
                >
                    {part.text}
                </mark>
            ) : (
                <React.Fragment key={`${index}-${part.text}`}>{part.text}</React.Fragment>
            ))}
        </p>
    );
}
