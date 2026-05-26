const MAX_INDEX_CHARS = 25000;
const MAX_PDF_PAGES = 40;

const normalizeText = (value) => String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const clampText = (value, maxChars = MAX_INDEX_CHARS) => {
    if (!value) return '';
    return value.length > maxChars ? value.slice(0, maxChars) : value;
};

async function extractEpubText(file) {
    const [{ default: ePub }] = await Promise.all([import('epubjs')]);
    const arrayBuffer = await file.arrayBuffer();
    const book = ePub();
    try {
        await book.open(arrayBuffer);
        await book.loaded.spine;
        let combined = '';
        for (const section of book.spine?.spineItems || []) {
            if (combined.length >= MAX_INDEX_CHARS) break;
            try {
                const loaded = await section.load(book.load.bind(book));
                const doc = loaded?.ownerDocument || loaded;
                const text = doc?.body?.textContent || doc?.documentElement?.textContent || '';
                combined += ` ${text}`;
                try { section.unload(); } catch (_) {}
            } catch (_) {}
        }
        return clampText(normalizeText(combined));
    } finally {
        try { book.destroy(); } catch (_) {}
    }
}

async function extractPdfText(file) {
    const pdfjsLib = await import('pdfjs-dist');
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let combined = '';
    const pages = Math.min(pdf.numPages || 0, MAX_PDF_PAGES);
    for (let pageIndex = 1; pageIndex <= pages; pageIndex += 1) {
        if (combined.length >= MAX_INDEX_CHARS) break;
        try {
            const page = await pdf.getPage(pageIndex);
            const textContent = await page.getTextContent();
            const pageText = (textContent.items || []).map(item => item?.str || '').join(' ');
            combined += ` ${pageText}`;
        } catch (_) {}
    }
    return clampText(normalizeText(combined));
}

export async function buildBookContentIndex(book) {
    if (!book?.file || book.loading) return '';
    if (book.type === 'pdf') return extractPdfText(book.file);
    if (book.type === 'epub') return extractEpubText(book.file);
    return '';
}

export function buildBookContentExcerpt(text, needle = '') {
    const normalized = String(text || '');
    if (!normalized) return '';
    if (!needle) return normalized.slice(0, 180);
    const idx = normalized.indexOf(String(needle || '').toLowerCase());
    if (idx === -1) return normalized.slice(0, 180);
    const start = Math.max(0, idx - 60);
    const end = Math.min(normalized.length, idx + 120);
    return normalized.slice(start, end).trim();
}

export const CONTENT_INDEX_CACHE_PREFIX = 'content-index:';
