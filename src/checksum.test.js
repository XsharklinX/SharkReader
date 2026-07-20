import { describe, expect, it } from 'vitest';
import { sha256Hex } from './checksum';

describe('sha256Hex', () => {
    it('produce el hash SHA-256 conocido de un string vacío', async () => {
        expect(await sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('produce el hash SHA-256 conocido de "hello"', async () => {
        expect(await sha256Hex('hello')).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
    });

    it('es determinista para el mismo contenido', async () => {
        const a = await sha256Hex('{"a":1}');
        const b = await sha256Hex('{"a":1}');
        expect(a).toBe(b);
    });

    it('cambia si el contenido cambia', async () => {
        const a = await sha256Hex('{"a":1}');
        const b = await sha256Hex('{"a":2}');
        expect(a).not.toBe(b);
    });
});
