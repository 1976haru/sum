import type { FontStyleId } from '../types';

export interface FontSpec {
  weight: number;
  family: string;
}

const SERIF_FAMILY = '"Noto Serif KR", "Batang", "Yu Mincho", Georgia, serif';
const GOTHIC_FAMILY = '"Malgun Gothic", "Noto Sans KR", "Yu Gothic", sans-serif';

// 파트C 기본 프리셋: 얇은 세리프 한글 + 가는 구분선 + 작은 부제.
export function fontSpecFor(fontStyle: FontStyleId): FontSpec {
  if (fontStyle === 'gothic') return { weight: 700, family: GOTHIC_FAMILY };
  if (fontStyle === 'serif-bold') return { weight: 700, family: SERIF_FAMILY };
  return { weight: 400, family: SERIF_FAMILY };
}

export function titleFont(fontStyle: FontStyleId, sizePx: number): string {
  const spec = fontSpecFor(fontStyle);
  return `${spec.weight} ${sizePx}px ${spec.family}`;
}
