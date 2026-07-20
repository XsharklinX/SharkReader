import { describe, it, expect } from 'vitest';
import { computeResizedDimensions, resizeCoverDataUrl } from './coverResize';

describe('computeResizedDimensions', () => {
    it('no cambia una imagen ya más pequeña que el máximo', () => {
        expect(computeResizedDimensions(300, 200, 480)).toEqual({ width: 300, height: 200 });
    });

    it('escala manteniendo proporción cuando el ancho supera el máximo', () => {
        const result = computeResizedDimensions(1600, 800, 480);
        expect(result.width).toBe(480);
        expect(result.height).toBe(240);
    });

    it('escala manteniendo proporción cuando el alto supera el máximo', () => {
        const result = computeResizedDimensions(800, 1600, 480);
        expect(result.width).toBe(240);
        expect(result.height).toBe(480);
    });

    it('devuelve 0x0 para dimensiones inválidas', () => {
        expect(computeResizedDimensions(0, 100)).toEqual({ width: 0, height: 0 });
        expect(computeResizedDimensions(100, 0)).toEqual({ width: 0, height: 0 });
        expect(computeResizedDimensions(null, null)).toEqual({ width: 0, height: 0 });
    });

    it('nunca deja un lado en 0 al escalar una imagen muy alargada', () => {
        const result = computeResizedDimensions(5000, 10, 480);
        expect(result.width).toBe(480);
        expect(result.height).toBeGreaterThanOrEqual(1);
    });
});

describe('resizeCoverDataUrl', () => {
    it('devuelve el valor original para entradas vacías o no-string', async () => {
        expect(await resizeCoverDataUrl(null)).toBeNull();
        expect(await resizeCoverDataUrl('')).toBe('');
        expect(await resizeCoverDataUrl(undefined)).toBeUndefined();
    });

    it('no toca portadas SVG (vectoriales)', async () => {
        const svg = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';
        expect(await resizeCoverDataUrl(svg)).toBe(svg);
    });

    it('devuelve el original si no hay DOM disponible (entorno de test sin document/Image)', async () => {
        const fakeCover = 'data:image/jpeg;base64,AAAA';
        const result = await resizeCoverDataUrl(fakeCover);
        expect(result).toBe(fakeCover);
    });
});
