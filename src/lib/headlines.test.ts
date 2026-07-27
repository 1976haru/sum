import { describe, expect, it } from 'vitest';
import { defaultSubline, headlineSuggestions, shortHeadlineSuggestions } from './headlines';

describe('headline suggestions', () => {
  it('returns deterministic unique Korean suggestions', () => {
    const first = headlineSuggestions('ko', 'light-pop-lounge', '겨울', '따뜻함');
    const second = headlineSuggestions('ko', 'light-pop-lounge', '겨울', '따뜻함');
    expect(first).toEqual(second);
    expect(new Set(first).size).toBe(first.length);
  });

  it('keeps short Korean options compact', () => {
    expect(shortHeadlineSuggestions('ko').every(text => text.replace(/[\s,]/g, '').length <= 8)).toBe(true);
  });

  it('localizes default subline', () => {
    expect(defaultSubline('ja', 'morning-showa-cafe')).toContain('昭和喫茶');
  });
});
