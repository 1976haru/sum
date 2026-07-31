import { describe, expect, it } from 'vitest';
import { fontSpecFor, normalizeFontStyleId, titleFont } from './fonts';

describe('normalizeFontStyleId', () => {
  it('구 id "gothic"을 신 id "gothic-bold"로 매핑한다', () => {
    expect(normalizeFontStyleId('gothic')).toBe('gothic-bold');
  });

  it('신 id는 그대로 통과한다', () => {
    expect(normalizeFontStyleId('serif-thin')).toBe('serif-thin');
    expect(normalizeFontStyleId('serif-regular')).toBe('serif-regular');
    expect(normalizeFontStyleId('serif-bold')).toBe('serif-bold');
    expect(normalizeFontStyleId('gothic-regular')).toBe('gothic-regular');
    expect(normalizeFontStyleId('gothic-bold')).toBe('gothic-bold');
  });

  it('빈 값/undefined는 기본값(serif-thin)으로 떨어진다', () => {
    expect(normalizeFontStyleId(undefined)).toBe('serif-thin');
    expect(normalizeFontStyleId(null)).toBe('serif-thin');
    expect(normalizeFontStyleId('')).toBe('serif-thin');
  });
});

describe('fontSpecFor', () => {
  it('5종 id의 weight가 지시서 표(2-2)와 일치한다', () => {
    expect(fontSpecFor('serif-thin').weight).toBe(300);
    expect(fontSpecFor('serif-regular').weight).toBe(400);
    expect(fontSpecFor('serif-bold').weight).toBe(600);
    expect(fontSpecFor('gothic-regular').weight).toBe(400);
    expect(fontSpecFor('gothic-bold').weight).toBe(700);
  });

  it('구 id로 들어와도 정규화를 거쳐 유효한 weight를 반환한다', () => {
    // @ts-expect-error 구 id는 타입에는 없지만 저장된 템플릿에는 남아있을 수 있다
    expect(fontSpecFor('gothic').weight).toBe(700);
  });

  it('세리프 계열은 KR+JP 폰트를 한 목록에 나란히 둔다(글자 단위 자동 폴백)', () => {
    expect(fontSpecFor('serif-thin').family).toContain('Noto Serif KR');
    expect(fontSpecFor('serif-thin').family).toContain('Noto Serif JP');
  });

  it('titleFont는 "weight size family" 순서의 캔버스 font 문자열을 만든다', () => {
    expect(titleFont('serif-thin', 72)).toMatch(/^300 72px /);
    expect(titleFont('gothic-bold', 40)).toMatch(/^700 40px /);
  });
});
