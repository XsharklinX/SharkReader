// src/pdfTts.js
// Convierte la capa de texto de una página PDF (pdf.js getTextContent().items)
// en bloques de línea con geometría normalizada, y esos bloques en una cola de
// "chunks" hablables (≤ maxLen caracteres) para el lector por voz. Cada chunk
// lleva un `rect` normalizado (0..1, origen arriba-izquierda) que PdfReader usa
// para resaltar lo que se está leyendo.
//
// RECONSTRUIDO tras pérdida del archivo. Firmas usadas por PdfReader:
//   buildPdfTtsBlocks(items, pageWidth, pageHeight) -> [{ text, rect }]
//   buildPdfTtsQueue(blocks, maxLen)                -> [{ text, rect }]
// con rect = { xp, yp, wp, hp }.

// Geometría de un item de pdf.js a partir de su transform [a,b,c,d,e,f].
function itemGeometry(item, pageWidth, pageHeight) {
    const t = item.transform || [1, 0, 0, 1, 0, 0];
    const fontHeight = item.height || Math.abs(t[3]) || Math.hypot(t[1], t[3]) || 10;
    const x = t[4];
    const yFromBottom = t[5];
    const width = item.width || (String(item.str || '').length * fontHeight * 0.5);
    // pdf.js mide Y desde abajo; la UI lo quiere desde arriba.
    const top = pageHeight - yFromBottom - fontHeight;
    return {
        left: x,
        top,
        width,
        height: fontHeight,
        yBottom: yFromBottom,
    };
}

const clamp01 = (value) => Math.max(0, Math.min(1, value));

function normalizeRect(box, pageWidth, pageHeight) {
    const w = pageWidth || 1;
    const h = pageHeight || 1;
    const xp = clamp01(box.left / w);
    const yp = clamp01(box.top / h);
    return {
        xp,
        yp,
        wp: clamp01(box.width / w),
        hp: clamp01(box.height / h),
    };
}

function unionBox(a, b) {
    const left = Math.min(a.left, b.left);
    const top = Math.min(a.top, b.top);
    const right = Math.max(a.left + a.width, b.left + b.width);
    const bottom = Math.max(a.top + a.height, b.top + b.height);
    return { left, top, width: right - left, height: bottom - top };
}

function unionRect(a, b) {
    const left = Math.min(a.xp, b.xp);
    const top = Math.min(a.yp, b.yp);
    const right = Math.max(a.xp + a.wp, b.xp + b.wp);
    const bottom = Math.max(a.yp + a.hp, b.yp + b.hp);
    return { xp: left, yp: top, wp: right - left, hp: bottom - top };
}

// Agrupa los items en líneas (misma altura de base ≈ misma línea) y devuelve un
// bloque por línea, en orden de lectura (de arriba abajo).
export function buildPdfTtsBlocks(items = [], pageWidth = 1, pageHeight = 1) {
    const measured = (Array.isArray(items) ? items : [])
        .filter(item => item && typeof item.str === 'string' && item.str.trim())
        .map(item => ({ str: item.str, box: itemGeometry(item, pageWidth, pageHeight) }))
        // Orden de lectura: primero lo más alto de la página, luego de izq. a der.
        .sort((a, b) => (b.box.yBottom - a.box.yBottom) || (a.box.left - b.box.left));

    const lines = [];
    let current = null;
    for (const { str, box } of measured) {
        const tolerance = Math.max(2, box.height * 0.6);
        if (current && Math.abs(current.yBottom - box.yBottom) <= tolerance) {
            // Misma línea: añade un espacio si hace falta y une la caja.
            const needsSpace = current.text && !current.text.endsWith(' ') && !str.startsWith(' ');
            current.text += (needsSpace ? ' ' : '') + str;
            current.box = unionBox(current.box, box);
        } else {
            if (current) lines.push(current);
            current = { text: str, box, yBottom: box.yBottom };
        }
    }
    if (current) lines.push(current);

    return lines
        .map(line => ({ text: line.text.replace(/\s+/g, ' ').trim(), rect: normalizeRect(line.box, pageWidth, pageHeight) }))
        .filter(block => block.text);
}

// Parte un texto largo en trozos <= maxLen, respetando frases y, si no, palabras.
function splitLongText(text, maxLen) {
    const pieces = [];
    const sentences = String(text).match(/[^.!?…]+[.!?…]*\s*/g) || [String(text)];
    let buffer = '';
    const flush = () => { if (buffer.trim()) pieces.push(buffer.trim()); buffer = ''; };
    for (const sentence of sentences) {
        if (sentence.length > maxLen) {
            flush();
            // Frase enorme: trocear por palabras.
            let wordBuf = '';
            for (const word of sentence.split(/\s+/)) {
                if ((wordBuf + ' ' + word).trim().length > maxLen) {
                    if (wordBuf.trim()) pieces.push(wordBuf.trim());
                    wordBuf = word;
                } else {
                    wordBuf = (wordBuf ? wordBuf + ' ' : '') + word;
                }
            }
            if (wordBuf.trim()) pieces.push(wordBuf.trim());
        } else if ((buffer + sentence).length > maxLen) {
            flush();
            buffer = sentence;
        } else {
            buffer += sentence;
        }
    }
    flush();
    return pieces;
}

// Une bloques consecutivos en chunks hablables de como máximo `maxLen`
// caracteres, combinando sus rects para que el resaltado cubra lo que suena.
export function buildPdfTtsQueue(blocks = [], maxLen = 200) {
    const limit = Number(maxLen) > 0 ? Number(maxLen) : 200;
    const queue = [];
    let current = null;

    const push = () => { if (current && current.text.trim()) queue.push(current); current = null; };

    for (const block of Array.isArray(blocks) ? blocks : []) {
        const text = String(block?.text || '').trim();
        if (!text) continue;
        const rect = block.rect;

        if (text.length > limit) {
            // Bloque demasiado largo para un solo chunk: trocéalo, compartiendo rect.
            push();
            for (const piece of splitLongText(text, limit)) {
                queue.push({ text: piece, rect });
            }
            continue;
        }

        if (!current) {
            current = { text, rect };
        } else if ((current.text.length + 1 + text.length) <= limit) {
            current.text += ' ' + text;
            current.rect = rect ? unionRect(current.rect, rect) : current.rect;
        } else {
            push();
            current = { text, rect };
        }
    }
    push();

    return queue;
}

export default { buildPdfTtsBlocks, buildPdfTtsQueue };
