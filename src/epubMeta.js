// SharkReader - Direct EPUB metadata extractor (ZIP-only, no epubjs dependency)
// Extracts metadata directly from the EPUB ZIP structure.
// Does NOT use epubjs, so it works identically in dev and packaged Electron builds.

import JSZip from 'jszip';

const DC = 'http://purl.org/dc/elements/1.1/';

async function loadZip(file) {
    if (!file) throw new Error("File is null");
    const buffer = await file.arrayBuffer();
    if (buffer.byteLength === 0) throw new Error("Buffer is empty!");
    const jsz = JSZip.loadAsync ? JSZip : (JSZip.default || JSZip);
    return jsz.loadAsync(buffer);
}

function getTextNS(doc, ns, tag) {
    const el =
        doc.getElementsByTagNameNS(ns, tag)[0] ||
        doc.getElementsByTagName(`dc:${tag}`)[0] ||
        doc.getElementsByTagName(tag)[0] ||
        getFirstByLocalName(doc, tag);
    return el?.textContent?.trim() || '';
}

function getByLocalName(parent, localName) {
    if (!parent) return [];
    return Array.from(parent.getElementsByTagName('*'))
        .filter(el => el.localName?.toLowerCase() === localName.toLowerCase());
}

function getFirstByLocalName(parent, localName) {
    return getByLocalName(parent, localName)[0] || null;
}

function parseXml(xml) {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    if (doc.getElementsByTagName('parsererror').length) return null;
    return doc;
}

function stripHtml(value) {
    return String(value || '').replace(/<\/?[^>]+(>|$)/g, '').trim();
}

function normalizeZipPath(baseDir, href) {
    if (!href) return '';
    const decoded = decodeURIComponent(href.split('#')[0].split('?')[0]);
    const rawPath = decoded.startsWith('/') ? decoded.slice(1) : `${baseDir}${decoded}`;
    const parts = [];

    for (const part of rawPath.replace(/\\/g, '/').split('/')) {
        if (!part || part === '.') continue;
        if (part === '..') parts.pop();
        else parts.push(part);
    }

    return parts.join('/');
}

function findCaseInsensitive(zip, wantedPath) {
    const normalized = wantedPath.toLowerCase();
    return zip.file(wantedPath) || Object.values(zip.files).find(f => f.name.toLowerCase() === normalized);
}

function getSubjects(opfDoc) {
    return [
        ...Array.from(opfDoc.getElementsByTagNameNS(DC, 'subject')),
        ...Array.from(opfDoc.getElementsByTagName('dc:subject')),
        ...Array.from(opfDoc.getElementsByTagName('subject')),
        ...getByLocalName(opfDoc, 'subject'),
    ].map(el => el.textContent?.trim()).filter(Boolean);
}

export async function extractEpubMeta(file) {
    try {
        const zip = await loadZip(file);

        // 1. Find container.xml
        const containerKey = Object.keys(zip.files).find(k => k.toLowerCase() === 'meta-inf/container.xml');
        const containerStr = containerKey ? await zip.files[containerKey].async('string') : null;
        if (!containerStr) { alert('No container.xml'); return null; }

        // 2. Parse OPF path from container
        const containerDoc = parseXml(containerStr);
        const rootFile =
            containerDoc?.getElementsByTagName('rootfile')[0] ||
            containerDoc?.getElementsByTagNameNS('*', 'rootfile')[0] ||
            getFirstByLocalName(containerDoc, 'rootfile');
        let opfPath = rootFile?.getAttribute('full-path');

        if (!opfPath) {
            opfPath = Object.keys(zip.files).find(k => /\.opf$/i.test(k)) || '';
        }
        if (!opfPath) { alert('No opfPath'); return null; }

        // 3. Parse OPF
        const opfFile = findCaseInsensitive(zip, opfPath);
        const opfStr = await opfFile?.async('string');
        if (!opfStr) { alert('No opfStr'); return null; }

        const opfDoc = parseXml(opfStr);
        if (!opfDoc) { alert('No opfDoc'); return null; }

        const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';

        // 4. Extract metadata
        const title = getTextNS(opfDoc, DC, 'title');
        const creator = getTextNS(opfDoc, DC, 'creator');
        const description = stripHtml(getTextNS(opfDoc, DC, 'description'));
        const publisher = getTextNS(opfDoc, DC, 'publisher');
        const subject = [...new Set(getSubjects(opfDoc))].join(', ');

        // 5. Find cover image
        const manifest =
            opfDoc.getElementsByTagName('manifest')[0] ||
            opfDoc.getElementsByTagNameNS('*', 'manifest')[0] ||
            getFirstByLocalName(opfDoc, 'manifest');

        const items = manifest ? [
            ...Array.from(manifest.getElementsByTagName('item')),
            ...Array.from(manifest.getElementsByTagNameNS('*', 'item')),
            ...getByLocalName(manifest, 'item'),
        ].filter((item, index, arr) => arr.indexOf(item) === index) : [];

        let coverHref = null;

        // Strategy 1: item with properties="cover-image"
        for (const item of items) {
            const props = item.getAttribute('properties') || '';
            const mime = item.getAttribute('media-type') || '';
            if (props.includes('cover-image') && mime.startsWith('image/')) {
                coverHref = item.getAttribute('href');
                break;
            }
        }

        // Strategy 2: meta name="cover" pointing to manifest item
        if (!coverHref) {
            const coverId = [
                ...Array.from(opfDoc.getElementsByTagName('meta')),
                ...Array.from(opfDoc.getElementsByTagNameNS('*', 'meta')),
                ...getByLocalName(opfDoc, 'meta'),
            ].find(meta => meta.getAttribute('name')?.toLowerCase() === 'cover')
                ?.getAttribute('content');
            const coverItem = coverId ? items.find(item => item.getAttribute('id') === coverId) : null;
            if (coverItem?.getAttribute('media-type')?.startsWith('image/')) {
                coverHref = coverItem.getAttribute('href');
            }
        }

        // Strategy 3: item with id/href containing "cover"
        if (!coverHref) {
            const hinted = items.find(item => {
                const mime = item.getAttribute('media-type') || '';
                const id = (item.getAttribute('id') || '').toLowerCase();
                const href = (item.getAttribute('href') || '').toLowerCase();
                return mime.startsWith('image/') && (
                    id.includes('cover') || href.includes('cover') ||
                    href.includes('portada') || href.includes('front')
                );
            });
            coverHref = hinted?.getAttribute('href') || null;
        }

        // Strategy 4: first image in manifest
        if (!coverHref) {
            const first = items.find(item => (item.getAttribute('media-type') || '').startsWith('image/'));
            coverHref = first?.getAttribute('href') || null;
        }

        // 6. Read cover bytes and convert to base64 data URL
        let coverBase64 = null;
        if (coverHref) {
            const fullPath = normalizeZipPath(opfDir, coverHref);
            const coverFile = findCaseInsensitive(zip, fullPath);
            const data = await coverFile?.async('base64');

            if (data) {
                const ext = fullPath.split('.').pop().toLowerCase();
                const mime = {
                    jpg: 'image/jpeg', jpeg: 'image/jpeg',
                    png: 'image/png', gif: 'image/gif',
                    webp: 'image/webp', svg: 'image/svg+xml',
                }[ext] || 'image/jpeg';
                coverBase64 = `data:${mime};base64,${data}`;
            }
        }

        return { title, creator, description, publisher, subject, coverBase64 };
    } catch (err) {
        alert('EpubMeta Error: ' + err.message + '\n' + err.stack);
        console.error('[SharkReader] extractEpubMeta failed:', err);
        return null;
    }
}
