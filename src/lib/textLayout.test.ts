import { describe, expect, it } from 'vitest';
import { applyKinsoku, clampVerticalSafeArea, layoutText, letterSpacingPx, type MeasureFn } from './textLayout';

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

describe('applyKinsoku', () => {
  const measure = syntheticMeasure(10);

  it('1) 行頭禁則: 줄 첫머리의 「、」를 앞줄로 끌어올린다 (일본어 예문1)', () => {
    const lines = ['ふと', '、あの日を思い出す'];
    const fixed = applyKinsoku(lines, 16, 1000, measure);
    for (const line of fixed) expect(line.startsWith('、')).toBe(false);
    expect(fixed.join('')).toBe(lines.join(''));
  });

  it('2) 行末禁則: 줄 끝의 여는 괄호「「」를 다음 줄로 내린다 (일본어 예문2)', () => {
    const lines = ['窓辺の「', '静かな朝」'];
    const fixed = applyKinsoku(lines, 16, 1000, measure);
    for (const line of fixed.slice(0, -1)) expect(line.endsWith('「')).toBe(false);
    expect(fixed.join('')).toBe(lines.join(''));
  });

  it('3) 금칙 문자만으로 된 줄은 무한루프 없이 즉시 반환하고 그대로 둔다', () => {
    const lines = ['abc', '、。', 'def'];
    const start = Date.now();
    const fixed = applyKinsoku(lines, 16, 1000, measure);
    expect(Date.now() - start).toBeLessThan(500);
    expect(fixed[1]).toBe('、。'); // 줄 전체가 금칙 문자라 손대지 않는다
    expect(fixed.join('')).toBe(lines.join(''));
  });

  it('4) 이동 결과가 maxWidth를 넘으면 이동을 포기하고(원상 복구) 폭 제약은 항상 지킨다', () => {
    // 'ふと'(20)와 '、あ'(20)는 각각 maxWidth=25 안에 있지만, '、'를 앞줄로 옮기면
    // 'ふと、'(30)가 되어 넘친다 — 이동이 취소되고 두 줄 다 원래 폭 그대로 유지돼야 한다.
    const lines = ['ふと', '、あ'];
    const tightMaxWidth = 25;
    const fixed = applyKinsoku(lines, 16, tightMaxWidth, measure);
    for (const line of fixed) expect(measure(line, 16)).toBeLessThanOrEqual(tightMaxWidth + 1e-6);
    expect(fixed).toEqual(lines); // 넘쳐서 이동하지 않았으므로 원본 그대로
  });

  it('5) 한국어 문장에서도 마침표가 줄 첫머리에 오지 않는다', () => {
    const lines = ['안녕하세요', '.정말 그렇습니다'];
    const fixed = applyKinsoku(lines, 16, 1000, measure);
    for (const line of fixed) expect(line.startsWith('.')).toBe(false);
    expect(fixed.join('')).toBe(lines.join(''));
  });

  it('연속된 금칙 문자는 통째로 이동한다', () => {
    const lines = ['ABC', '、。あ'];
    const fixed = applyKinsoku(lines, 16, 1000, measure);
    expect(fixed[0]).toBe('ABC、。');
    expect(fixed[1]).toBe('あ');
  });

  it('줄이 1개뿐이면 그대로 반환한다', () => {
    expect(applyKinsoku(['한 줄'], 16, 1000, measure)).toEqual(['한 줄']);
  });

  it('layoutText 통합: 어절 단위 줄바꿈이 만든 行頭禁則 위반을 실제로 고치고, applyKinsokuRule:false면 남겨둔다', () => {
    // 문장부호는 좁게(4), 나머지 글자는 넓게(12) 잡은 측정 함수 — 어절이 통째로 다음 줄로
    // 넘어갈 때 생기는 여유폭이 실제 폰트에서도 흔히 생기는 상황을 재현한다.
    const NARROW = new Set(Array.from('、。.,！？!?」』）'));
    const weighted: MeasureFn = (text, fontSizePx) => {
      let units = 0;
      for (const ch of Array.from(text)) units += NARROW.has(ch) ? 4 : 12;
      return units * (fontSizePx / 16);
    };
    const opts = {
      measure: weighted,
      maxWidth: 64,
      maxHeight: 2000,
      startFontSize: 16,
      minFontSize: 16,
      maxLines: 10
    };
    const text = '안녕하세요 ,정말 그렇습니다';

    const withRule = layoutText(text, opts);
    expect(withRule.lines.some(line => line.startsWith(','))).toBe(false);
    for (const line of withRule.lines) expect(weighted(line, withRule.fontSize)).toBeLessThanOrEqual(64 + 1e-6);

    const withoutRule = layoutText(text, { ...opts, applyKinsokuRule: false });
    expect(withoutRule.lines.some(line => line.startsWith(','))).toBe(true); // 후처리를 껐으니 위반이 그대로 남는다

    expect(withRule.lines.join('').replace(/\s+/g, '')).toBe(withoutRule.lines.join('').replace(/\s+/g, ''));
  });
});

describe('letterSpacingPx', () => {
  it('em 값을 폰트 크기에 비례한 px 문자열로 변환한다', () => {
    expect(letterSpacingPx(0.1, 100)).toBe('10.00px');
    expect(letterSpacingPx(0.2, 100)).toBe('20.00px');
    expect(letterSpacingPx(0, 100)).toBe('0px');
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
