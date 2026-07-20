// Redimensiona las portadas extraídas de EPUB antes de guardarlas: sin esto,
// una portada a resolución original (800×1200+, cientos de KB) queda cargada
// en memoria/estado de React para cada libro de la biblioteca — con 1000+
// libros eso son cientos de MB solo en strings base64 de portada. Bajarlas a
// un tamaño de miniatura reduce ese costo entre 60-90% sin pérdida visible en
// las tarjetas de biblioteca (que muestran las portadas mucho más pequeñas).

export const COVER_MAX_DIM = 480;
export const COVER_JPEG_QUALITY = 0.82;

// Dimensiones de salida manteniendo proporción, sin superar maxDim en el lado
// mayor. Lógica pura y testeable — el resto de resizeCoverDataUrl depende del DOM.
export function computeResizedDimensions(width, height, maxDim = COVER_MAX_DIM) {
    if (!width || !height || width <= 0 || height <= 0) return { width: 0, height: 0 };
    if (width <= maxDim && height <= maxDim) return { width: Math.round(width), height: Math.round(height) };
    const scale = maxDim / Math.max(width, height);
    return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

// Redimensiona un data URL de portada vía canvas. Nunca lanza: si algo falla
// (formato no decodificable, sin DOM, SVG vectorial) devuelve el original.
export async function resizeCoverDataUrl(dataUrl, { maxDim = COVER_MAX_DIM, quality = COVER_JPEG_QUALITY } = {}) {
    if (!dataUrl || typeof dataUrl !== 'string') return dataUrl;
    if (dataUrl.startsWith('data:image/svg+xml')) return dataUrl; // vectorial: no tiene sentido rasterizar
    if (typeof document === 'undefined' || typeof Image === 'undefined') return dataUrl;

    try {
        const img = await new Promise((resolve, reject) => {
            const el = new Image();
            el.onload = () => resolve(el);
            el.onerror = reject;
            el.src = dataUrl;
        });
        const { width, height } = computeResizedDimensions(img.naturalWidth || img.width, img.naturalHeight || img.height, maxDim);
        if (!width || !height) return dataUrl;
        if (width >= (img.naturalWidth || img.width) && height >= (img.naturalHeight || img.height)) return dataUrl; // ya es pequeña

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const resized = canvas.toDataURL('image/jpeg', quality);
        return resized.length < dataUrl.length ? resized : dataUrl;
    } catch (_) {
        return dataUrl;
    }
}
