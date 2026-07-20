import { describe, expect, it } from 'vitest';
import { WORKSHOP_ADDONS, getAddonCapabilityLabels } from './workshopModules';

describe('WORKSHOP_ADDONS registry', () => {
    it('cada addon trae descripción, icono/estado, maturity y config schema (Fase 7)', () => {
        WORKSHOP_ADDONS.forEach(addon => {
            expect(addon.id).toBeTruthy();
            expect(addon.name).toBeTruthy();
            expect(addon.desc).toBeTruthy();
            expect(['stable', 'experimental']).toContain(addon.maturity);
            expect(addon.status).toBeTruthy();
            expect(Array.isArray(addon.api)).toBe(true);
            expect(typeof addon.configSchema).toBe('object');
            expect(addon.lifecycle).toHaveProperty('configurable');
        });
    });

    it('cada addon tiene documentación corta de uso (docs)', () => {
        WORKSHOP_ADDONS.forEach(addon => {
            expect(addon.docs, `addon "${addon.id}" sin docs`).toBeTruthy();
            expect(addon.docs.es).toBeTruthy();
            expect(addon.docs.en).toBeTruthy();
        });
    });

    it('no hay ids de addon duplicados', () => {
        const ids = WORKSHOP_ADDONS.map(a => a.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe('getAddonCapabilityLabels', () => {
    it('traduce las capacidades declaradas a etiquetas legibles', () => {
        const addon = WORKSHOP_ADDONS.find(a => a.id === 'soundFeedback');
        const labels = getAddonCapabilityLabels(addon, 'es');
        expect(labels).toHaveLength(1);
        expect(labels[0].id).toBe('audio.play');
        expect(labels[0].label).toBe('Reproducir sonidos cortos');
    });

    it('devuelve el id crudo como fallback si no hay traducción', () => {
        const labels = getAddonCapabilityLabels({ api: ['unknown.capability'] }, 'es');
        expect(labels[0].label).toBe('unknown.capability');
    });

    it('devuelve vacío para un addon sin capacidades declaradas', () => {
        expect(getAddonCapabilityLabels({ api: [] })).toEqual([]);
        expect(getAddonCapabilityLabels(null)).toEqual([]);
    });

    it('respeta el idioma solicitado', () => {
        const addon = WORKSHOP_ADDONS.find(a => a.id === 'audioPlay' ) || WORKSHOP_ADDONS.find(a => a.id === 'soundFeedback');
        const es = getAddonCapabilityLabels(addon, 'es');
        const en = getAddonCapabilityLabels(addon, 'en');
        expect(es[0].label).not.toBe(en[0].label);
    });

    it('cada capacidad usada por algún addon tiene traducción conocida (no cae al fallback silenciosamente)', () => {
        const allCapabilities = new Set(WORKSHOP_ADDONS.flatMap(a => a.api));
        allCapabilities.forEach(capability => {
            const labels = getAddonCapabilityLabels({ api: [capability] }, 'es');
            expect(labels[0].label, `capacidad "${capability}" sin traducción`).not.toBe(capability);
        });
    });
});
