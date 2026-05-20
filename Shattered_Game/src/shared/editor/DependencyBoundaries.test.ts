import { describe, expect, it } from 'vitest';

const editorSources = import.meta.glob('../../editor/**/*.ts', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const sharedSources = import.meta.glob('../../shared/**/*.ts', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const appSources = import.meta.glob('../../apps/**/*.ts', {
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

  it('keeps shared source independent from app and gameplay runtime folders', () => {
    for (const [filePath, source] of Object.entries(sharedSources)) {
      if (filePath.endsWith('.test.ts')) {
        continue;
      }

      expect(source).not.toMatch(/from ['"]\.\.\/\.\.\/apps\//);
      expect(source).not.toMatch(/from ['"]\.\.\/\.\.\/editor\//);
      expect(source).not.toMatch(/from ['"]\.\.\/\.\.\/scenes\//);
      expect(source).not.toMatch(/from ['"]\.\.\/\.\.\/combat\//);
      expect(source).not.toMatch(/from ['"]\.\.\/\.\.\/player\//);
      expect(source).not.toMatch(/from ['"]\.\.\/\.\.\/persistence\//);
    }
  });

  it('keeps app entrypoints one-way into game or editor runtime', () => {
    for (const [filePath, source] of Object.entries(appSources)) {
      if (filePath.includes('/apps/editor/')) {
        expect(source).not.toMatch(/\.\.\/\.\.\/scenes\//);
        expect(source).not.toMatch(/\.\.\/\.\.\/combat\//);
        expect(source).not.toMatch(/\.\.\/\.\.\/player\//);
      }

      if (filePath.includes('/apps/game/')) {
        expect(source).not.toMatch(/\.\.\/\.\.\/editor\//);
      }
    }
  });
});
