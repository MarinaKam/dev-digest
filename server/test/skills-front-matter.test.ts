import { describe, it, expect } from 'vitest';
import { parseFrontMatter } from '../src/modules/skills/import/front-matter.js';

const fm = (...lines: string[]) => ['---', ...lines, '---', 'Body line'].join('\n');

describe('parseFrontMatter — values it reads', () => {
  it('reads a plain value', () => {
    const r = parseFrontMatter(fm('name: edge-case-coverage'));
    expect(r.fields.name).toBe('edge-case-coverage');
    expect(r.body).toBe('Body line');
  });

  it('reads a double-quoted value with escapes', () => {
    const r = parseFrontMatter(fm('description: "Flag \\"x\\"\\n\\\\ ok"'));
    expect(r.fields.description).toBe('Flag "x"\n\\ ok');
  });

  it("reads a single-quoted value with '' for a quote", () => {
    expect(parseFrontMatter(fm("description: 'It''s fine'")).fields.description).toBe("It's fine");
  });

  it('reads a folded block (>)', () => {
    const r = parseFrontMatter(fm('description: >', '  a', '  b', '', '  c', 'name: x'));
    expect(r.fields.description).toBe('a b\nc\n');
    expect(r.fields.name).toBe('x');
  });

  it('strips the final line break with >-', () => {
    expect(parseFrontMatter(fm('description: >-', '  a', '  b', '', '  c')).fields.description).toBe('a b\nc');
  });

  it('keeps line breaks in a literal block (|)', () => {
    expect(parseFrontMatter(fm('description: |', '  a', '  b', '', '  c')).fields.description).toBe('a\nb\n\nc\n');
  });

  it('keeps trailing blank lines with |+', () => {
    expect(parseFrontMatter(fm('description: |+', '  a', '', '', 'name: x')).fields.description).toBe('a\n\n\n');
  });

  it('lists other keys as ignored', () => {
    const r = parseFrontMatter(fm('name: x', 'version: 2', 'license: MIT'));
    expect(r.ignoredKeys).toEqual(['version', 'license']);
  });

  it('treats a file without front matter as all body', () => {
    const r = parseFrontMatter('# Title\nText');
    expect(r).toEqual({ fields: {}, body: '# Title\nText', ignoredKeys: [], unreadable: [] });
  });
});

describe('parseFrontMatter — values it does not guess', () => {
  it.each([
    ['a flow list', ['description: [a, b]']],
    ['a flow map', ['description: {a: 1}']],
    ['a nested key', ['description:', '  nested: x']],
    ['an unterminated quote', ['description: "open']],
    ['an anchor', ['description: &d text']],
    ['a block with no indented line', ['description: >', 'name: x']],
  ])('%s leaves the field empty and reports the line', (_label, lines) => {
    const r = parseFrontMatter(fm(...lines));
    expect(r.fields.description).toBeUndefined();
    expect(r.unreadable[0]).toMatchObject({ key: 'description', line: 2 });
  });

  it('reports an unclosed front matter block instead of eating the file', () => {
    const r = parseFrontMatter('---\nname: x\nBody');
    expect(r.fields).toEqual({});
    expect(r.body).toBe('---\nname: x\nBody');
    expect(r.unreadable[0]).toMatchObject({ key: '---', line: 1 });
  });
});
