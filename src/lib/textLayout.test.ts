import { describe, expect, it } from 'vitest';
import { clampVerticalSafeArea, layoutText, type MeasureFn } from './textLayout';

// 실제 폰트 없이도 검증 가능하도록, 문자 1개당 고정 폭을 갖는 합성 측정 함수를 사용한다.
function syntheticMeasure(charWidthAt16: number): MeasureFn {
  return (text, fontSizePx) => Array.from(text).length * charWidthAt16 * (fontSizePx / 16);
}

describe('layoutText', () => {
  const baseOpts = {
    measure: syntheticMeasure(10),
    maxWidth: 300,
    maxHeight: 400,
    startFontSize: 72,
    minFontSize: 28
  };

  it('공백이 있는 한글 문구를 3줄 이내로 조판한다', () => {
    const result = layoutText('이 멜로디 기억나?', baseOpts);
    expect(result.lines.length).toBeLessThanOrEqual(3);
    for (const line of result.lines) {
      expect(baseOpts.measure(line, result.fontSize)).toBeLessThanOrEqual(baseOpts.maxWidth + 1e-6);
    }
  });

  it('쉼표가 섞인 짧은 한글 문구를 정상 조판한다', () => {
    const result = layoutText('그날, 로마에서', baseOpts);
    expect(result.lines.length).toBeGreaterThan(0);
    expect(result.lines.length).toBeLessThanOrEqual(3);
    for (const line of result.lines) {
      expect(baseOpts.measure(line, result.fontSize)).toBeLessThanOrEqual(baseOpts.maxWidth + 1e-6);
    }
  });

  it('공백 없는 12자 한글 구절을 문자 단위로 줄바꿈해 영역 안에 넣는다', () => {
    const phrase = '오늘도어제처럼설레는하루';
    expect(Array.from(phrase).length).toBe(12);
    const result = layoutText(phrase, baseOpts);
    expect(result.lines.length).toBeLessThanOrEqual(3);
    for (const line of result.lines) {
      expect(baseOpts.measure(line, result.fontSize)).toBeLessThanOrEqual(baseOpts.maxWidth + 1e-6);
    }
    // 문자가 하나도 유실되지 않아야 한다(말줄임이 아니라면).
    if (!result.truncated) {
      expect(result.lines.join('').replace(/\s+/g, '')).toBe(phrase.replace(/\s+/g, ''));
    }
  });

  it('넘치는 긴 문장은 폰트를 축소하고 그래도 안 맞으면 말줄임 처리한다', () => {
    const longPhrase = '아주아주아주아주아주아주아주아주아주아주아주아주아주아주긴제목입니다예시';
    const result = layoutText(longPhrase, { ...baseOpts, maxHeight: 120 });
    expect(result.lines.length).toBeLessThanOrEqual(3);
    expect(result.fontSize).toBeGreaterThanOrEqual(baseOpts.minFontSize);
    for (const line of result.lines) {
      expect(baseOpts.measure(line, result.fontSize)).toBeLessThanOrEqual(baseOpts.maxWidth + 1e-6);
    }
  });

  it('극단적으로 긴 문자열도 무한 루프 없이 즉시 반환한다', () => {
    const huge = '가'.repeat(20000);
    const start = Date.now();
    const result = layoutText(huge, baseOpts);
    expect(Date.now() - start).toBeLessThan(2000);
    expect(result.lines.length).toBeLessThanOrEqual(3);
  });

  it('빈 문자열은 빈 라인 배열을 반환한다', () => {
    const result = layoutText('   ', baseOpts);
    expect(result.lines).toEqual([]);
  });
});

describe('clampVerticalSafeArea', () => {
  it('상단 5% 안전영역 위로 올라가지 못하게 한다', () => {
    const y = clampVerticalSafeArea(-50, 100, 1000, 0.05);
    expect(y).toBeGreaterThanOrEqual(50);
  });

  it('하단 5% 안전영역을 넘지 못하게 한다', () => {
    const y = clampVerticalSafeArea(960, 200, 1000, 0.05);
    expect(y + 200).toBeLessThanOrEqual(950 + 1e-6);
  });
});
