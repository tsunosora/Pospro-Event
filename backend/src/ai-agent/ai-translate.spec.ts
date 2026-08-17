import { translateMessages, parseTranslations, LANG_NAMES } from './ai-translate';

describe('translateMessages', () => {
  it('satu pesan user, menyebut target & input JSON', () => {
    const m = translateMessages(['Layar LED 3x3', 'hari'], 'en');
    expect(m).toHaveLength(1);
    expect(m[0].role).toBe('user');
    expect(m[0].content).toContain('English');
    expect(m[0].content).toContain('["Layar LED 3x3","hari"]');
    expect(m[0].content).toMatch(/HANYA array JSON/i);
  });
  it('kode bahasa tak dikenal dipakai apa adanya', () => {
    expect(translateMessages(['x'], 'de')[0].content).toContain(' de.');
    expect(LANG_NAMES.en).toBe('English');
  });
});

describe('parseTranslations', () => {
  it('array valid dgn panjang cocok', () => {
    expect(parseTranslations('["LED Screen 3x3","day"]', 2)).toEqual(['LED Screen 3x3', 'day']);
  });
  it('mengekstrak dari teks berisik (code fence / prefix)', () => {
    expect(parseTranslations('Output:\n```json\n["a","b"]\n```', 2)).toEqual(['a', 'b']);
  });
  it('panjang tak cocok → null', () => {
    expect(parseTranslations('["a"]', 2)).toBeNull();
  });
  it('bukan array / json rusak → null', () => {
    expect(parseTranslations('{"a":1}', 1)).toBeNull();
    expect(parseTranslations('bukan json', 1)).toBeNull();
    expect(parseTranslations('', 1)).toBeNull();
  });
  it('elemen non-string dikoersi ke string', () => {
    expect(parseTranslations('["a", 5]', 2)).toEqual(['a', '5']);
  });
});
