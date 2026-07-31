import type { LayoutId, TextBox, TextZone } from '../types';

// renderThumbnail()의 기존 픽셀 상수(74, 530, 205/230/172...)는 1280x720을 기준 해상도로 삼는다.
// 1920x1080 내보내기는 scale = width / REFERENCE_WIDTH = 1.5가 곱해져서 나온다.
// thumbnail.ts도 이 상수를 그대로 가져다 쓴다 — 두 곳에 따로 선언하면 어긋날 수 있다.
export const REFERENCE_WIDTH = 1280;
export const REFERENCE_HEIGHT = 720;

export interface ResolvedBox {
  boxX: number;
  boxY: number;
  maxWidth: number;
  align: 'left' | 'center';
  scrimMode: 'side' | 'band';
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

// 모든 좌표 계산은 이 함수 하나만 통과한다. 프리셋(textZone) 값은 기존 renderThumbnail()이
// 계산하던 숫자와 한 자리도 다르지 않아야 한다 — 이게 이번 작업의 회귀 방지선이다.
export function resolveTextBox(
  config: { textZone: TextZone; textBox?: TextBox; layout: LayoutId },
  width: number,
  height: number
): ResolvedBox {
  if (config.textBox) {
    const x = clamp01(config.textBox.x);
    const y = clamp01(config.textBox.y);
    const boxWidth = clamp01(config.textBox.width);
    const align = config.textBox.align;
    // 좌측에 가깝게 붙은 왼쪽 정렬 박스만 "옆으로 퍼지는" 사이드 스크림을 쓴다.
    // 나머지는 텍스트 블록을 감싸는 밴드 스크림(프리셋의 top-center/center와 동일한 방식).
    const scrimMode: 'side' | 'band' = align === 'left' && x < 0.4 ? 'side' : 'band';
    return {
      boxX: x * width,
      boxY: y * height,
      maxWidth: boxWidth * width,
      align,
      scrimMode
    };
  }

  const scale = width / REFERENCE_WIDTH;
  const isLeftThird = config.textZone === 'left-third';

  if (isLeftThird) {
    const boxX = 74 * scale;
    const maxWidth = 530 * scale;
    const boxY = (config.layout === 'minimal' ? 230 : config.layout === 'story' ? 172 : 205) * scale;
    return { boxX, boxY, maxWidth, align: 'left', scrimMode: 'side' };
  }

  const boxX = width / 2;
  const maxWidth = width * 0.72;
  const boxY = config.textZone === 'top-center' ? height * 0.14 : height * 0.4;
  return { boxX, boxY, maxWidth, align: 'center', scrimMode: 'band' };
}

// 프리셋의 정규화 좌표(스냅 판정·UI 표시용). left-third는 layout에 따라 y가 세 갈래이므로
// 숫자를 따로 베껴두지 않고 resolveTextBox() 자체를 REFERENCE 해상도(scale=1)로 호출해
// 픽셀 결과를 0~1로 나눈다 — 값이 어긋날 여지가 없다.
export function presetNormalizedPosition(textZone: TextZone, layout: LayoutId): { x: number; y: number; align: 'left' | 'center' } {
  const resolved = resolveTextBox({ textZone, layout }, REFERENCE_WIDTH, REFERENCE_HEIGHT);
  return { x: resolved.boxX / REFERENCE_WIDTH, y: resolved.boxY / REFERENCE_HEIGHT, align: resolved.align };
}

// textBox가 있으면 그대로, 없으면 현재 프리셋을 정규화 TextBox 모양으로 환산해 반환한다.
// 드래그 UI가 "지금 실제로 렌더에 쓰이는 위치"를 항상 하나의 형태로 다루기 위한 헬퍼.
export function effectiveTextBox(config: { textZone: TextZone; textBox?: TextBox; layout: LayoutId }): TextBox {
  if (config.textBox) return config.textBox;
  const resolved = resolveTextBox(config, REFERENCE_WIDTH, REFERENCE_HEIGHT);
  return {
    x: resolved.boxX / REFERENCE_WIDTH,
    y: resolved.boxY / REFERENCE_HEIGHT,
    width: resolved.maxWidth / REFERENCE_WIDTH,
    align: resolved.align
  };
}

export interface SafeAreaRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

// 실측(2026-07-31, youtube.com 홈 피드, 로그인 없이 그리드 썸네일). Chrome DevTools로 그리드
// 썸네일 <img>의 getBoundingClientRect()(528.328125 x 297.171875px로 렌더됨)와, 그 안의
// 재생시간 배지 요소(badge-shape, 어두운 반투명 둥근 사각형, 배경 rgba(0,0,0,0.6))의
// getBoundingClientRect()를 직접 읽어 썸네일 대비 정규화 좌표로 환산했다.
// 측정 원값: x 0.863~0.985, y 0.906~0.973. 가이드에는 여유를 조금 더해 표시한다.
export const YOUTUBE_DURATION_BADGE_AREA: SafeAreaRect = { x0: 0.84, y0: 0.88, x1: 1, y1: 1 };

// 근사치 — 시청 진행바(하단의 얇은 빨간 줄)는 로그인 계정에 시청기록이 있어야 나타나는데,
// 이번 측정 세션(비로그인)에서는 재현하지 못했다. 일반적으로 알려진 형태(전체 폭, 하단
// 가장자리에 붙은 매우 얇은 띠)를 바탕으로 한 근사값이며 실측이 아니다.
export const YOUTUBE_PROGRESS_BAR_AREA: SafeAreaRect = { x0: 0, y0: 0.985, x1: 1, y1: 1 };
