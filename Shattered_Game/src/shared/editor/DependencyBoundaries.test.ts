import { describe, expect, it } from 'vitest';

const editorSources = import.meta.glob('../../editor/**/*.ts', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

describe('editor dependency boundaries', () => {
  it('keeps editor code out of gameplay runtime imports', () => {
    for (const source of Object.values(editorSources)) {
      expect(source).not.toMatch(/\.\.\/combat\//);
      expect(source).not.toMatch(/\.\.\/player\//);
      expect(source).not.toMatch(/\.\.\/interactions\//);
      expect(source).not.toMatch(/\.\.\/persistence\//);
      expect(source).not.toMatch(/\.\.\/scenes\//);
    }
  });
});
