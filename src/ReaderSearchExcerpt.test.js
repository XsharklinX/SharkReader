import { describe, expect, it } from 'vitest';
import { splitSearchExcerpt } from './ReaderSearchExcerpt';

describe('splitSearchExcerpt', () => {
    it('marks matches without interpreting regex characters', () => {
        const parts = splitSearchExcerpt('Usa C++ y luego C++ otra vez', 'C++');
        expect(parts.filter(part => part.match).map(part => part.text)).toEqual(['C++', 'C++']);
    });

    it('matches without case sensitivity', () => {
        const parts = splitSearchExcerpt('SharkReader sharkreader', 'sharkreader');
        expect(parts.filter(part => part.match)).toHaveLength(2);
    });

    it('returns plain text when query is empty', () => {
        expect(splitSearchExcerpt('<script>alert(1)</script>', '')).toEqual([
            { text: '<script>alert(1)</script>', match: false },
        ]);
    });
});
