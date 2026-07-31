import { describe, expect, it } from 'vitest';
import {
  analyzeLuminance,
  contrastRatio,
  decideReadability,
  decideReadabilityFromProfile,
  hexToRgb,
  MAX_AUTO_ALPHA,
  READABLE_LIGHT_TEXT,
  relativeLuminance,
  requiredScrimAlpha,
  TARGET_CONTRAST,
  type LuminanceProfile
} from './readability';

function solidRgba(r: number, g: number, b: number, count: number): number[] {
  const data: number[] = [];
  for (let i = 0; i < count; i++) data.push(r, g, b, 255);
  return data;
}

describe('analyzeLuminance', () => {
  it('균일한 회색 배열은 p10=p50=p90=mean이다', () => {
    const data = solidRgba(128, 128, 128, 100);
    const profile = analyzeLuminance(data);
    expect(profile.p10).toBeCloseTo(profile.p50, 6);
    expect(profile.p50).toBeCloseTo(profile.p90, 6);
    expect(profile.p50).toBeCloseTo(profile.mean, 6);
  });

  it('빈 배열은 중간값(0.5) 프로필을 반환한다(조용히 죽지 않는다)', () => {
    expect(analyzeLuminance([])).toEqual({ p10: 0.5, p50: 0.5, p90: 0.5, mean: 0.5 });
  });

  // 완료 기준의 핵심 테스트: 절반 검정 + 절반 흰색.
  // 평균은 약 0.5로 나와 "무난한 중간 배경"처럼 보이지만, 실제로는 두 극단으로 쪼개진
  // 반반 배경이다 — p10=0(완전 검정), p90=1(완전 흰색)이어야 이 사실이 드러난다.
  it('반반(검정+흰색) 배경: 평균은 중간이지만 p10/p90은 극단을 그대로 보여준다', () => {
    const data = [...solidRgba(0, 0, 0, 50), ...solidRgba(255, 255, 255, 50)];
    const profile = analyzeLuminance(data);
    expect(profile.mean).toBeCloseTo(0.5, 2);
    expect(profile.p10).toBeCloseTo(0, 6);
    expect(profile.p90).toBeCloseTo(1, 6);
  });
});

describe('contrastRatio', () => {
  it('WCAG 공식과 일치한다: 흰색 대 검정은 21:1', () => {
    expect(contrastRatio(1, 0)).toBeCloseTo(21, 6);
  });
  it('인자 순서를 바꿔도 결과가 같다', () => {
    expect(contrastRatio(0.2, 0.8)).toBeCloseTo(contrastRatio(0.8, 0.2), 10);
  });
  it('같은 휘도끼리는 대비비가 1이다', () => {
    expect(contrastRatio(0.4, 0.4)).toBeCloseTo(1, 10);
  });
});

describe('hexToRgb', () => {
  it('#rrggbb를 [r,g,b]로 변환한다', () => {
    expect(hexToRgb('#fffaf1')).toEqual([255, 250, 241]);
    expect(hexToRgb('#2a1c10')).toEqual([42, 28, 16]);
  });
  it('3자리 축약형도 지원한다', () => {
    expect(hexToRgb('#fff')).toEqual([255, 255, 255]);
  });
});

describe('requiredScrimAlpha', () => {
  it('반복 상한(20회) 안에서 종료하고, 못 맞추면 maxAlpha와 warning:true를 반환한다', () => {
    // 텍스트와 배경 휘도가 거의 같아 어떤 스크림으로도 대비 4.5를 만들 수 없는 극단 상황.
    const profile: LuminanceProfile = { p10: 0.5, p50: 0.5, p90: 0.5, mean: 0.5 };
    const start = Date.now();
    const result = requiredScrimAlpha(profile, 0.5, 0.5, 100 /* 도달 불가능한 목표 */, 0.25, MAX_AUTO_ALPHA);
    expect(Date.now() - start).toBeLessThan(200);
    expect(result.warning).toBe(true);
    expect(result.alpha).toBe(MAX_AUTO_ALPHA);
  });

  it('currentAlpha에서 이미 목표를 만족하면 그대로 반환한다(불필요하게 올리지 않는다)', () => {
    const profile: LuminanceProfile = { p10: 0, p50: 0, p90: 0, mean: 0 };
    const result = requiredScrimAlpha(profile, 1, 0, 4.5, 0.6, MAX_AUTO_ALPHA);
    expect(result.alpha).toBe(0.6);
    expect(result.warning).toBe(false);
  });

  it('maxAlpha를 currentAlpha와 같은 값으로 고정하면 알파를 올리지 않고 진단만 한다', () => {
    const profile: LuminanceProfile = { p10: 0, p50: 0.9, p90: 1, mean: 0.5 };
    const result = requiredScrimAlpha(profile, 1, 0, 4.5, 0.25, 0.25);
    expect(result.alpha).toBe(0.25);
  });
});

describe('decideReadabilityFromProfile — 반반 배경에서 기존 로직 vs 새 로직', () => {
  const data = [...solidRgba(0, 0, 0, 50), ...solidRgba(255, 255, 255, 50)];
  const profile = analyzeLuminance(data);

  it('기존 decideReadability(평균)은 흰 글자를 고른다(0.5는 0.55 문턱 아래)', () => {
    const legacy = decideReadability(profile.mean);
    expect(legacy.textColor).toBe(READABLE_LIGHT_TEXT);
  });

  it('새 로직은 낮은 시작 알파(0.25)에서 대비 부족을 감지해 스크림을 끌어올리거나 경고한다', () => {
    const baseAlpha = 0.25;
    const result = decideReadabilityFromProfile(profile, baseAlpha);
    // 흰 배경(p90=1) 위 흰 글자는 낮은 알파에서 거의 안 보인다 — 기존 로직처럼 조용히
    // overlayStrength를 그대로 쓰지 않고, 알파를 올렸거나(성공) 못 올렸으면 경고해야 한다.
    expect(result.scrimAlpha > baseAlpha || result.contrastWarning).toBe(true);
    expect(result.contrastRatio).toBeGreaterThanOrEqual(1);
    if (!result.contrastWarning) expect(result.contrastRatio).toBeGreaterThanOrEqual(TARGET_CONTRAST - 1e-6);
  });
});

describe('relativeLuminance (회귀 — 삭제되지 않았는지 확인)', () => {
  it('흰색은 1, 검정은 0에 가깝다', () => {
    expect(relativeLuminance(255, 255, 255)).toBeCloseTo(1, 6);
    expect(relativeLuminance(0, 0, 0)).toBeCloseTo(0, 6);
  });
});
