import type { FontStyleId } from '../types';

export interface FontSpec {
  weight: number;
  family: string;
}

// 번들 폰트(src/assets/fonts/fonts.css, SIL OFL 1.1) 우선, 없으면 시스템 폰트로 폴백.
// Batang/Malgun Gothic/Yu Mincho/Yu Gothic은 Microsoft 시스템 폰트라 번들하지 않고
// 폴백 체인의 이름으로만 남겨둔다(재배포 라이선스 없음).
// 한글/일본어 세리프를 한 목록에 나란히 두면 브라우저가 글자 단위로 자동 폴백한다
// (Noto Serif KR에 없는 한자·가나는 다음 순번인 Noto Serif JP에서 찾는다).
const SERIF_FAMILY = '"Noto Serif KR", "Noto Serif JP", "Batang", "Yu Mincho", Georgia, serif';
// 주의: 일본어용 고딕(Noto Sans JP)은 이번 Phase에서 번들하지 않았다 — 일본 채널에서
// gothic-* 스타일을 쓰면 한글 외 글자는 시스템 Yu Gothic으로 폴백한다(ensureFontsLoaded가
// 감지해 화면에 경고를 띄운다). 번들 목록은 보고서 참고.
const GOTHIC_FAMILY = '"Noto Sans KR", "Malgun Gothic", "Yu Gothic", sans-serif';

// 구 FontStyleId('gothic')는 저장된 브랜드 템플릿(brand-templates.json)에 남아있을 수 있다.
// 구 → 신 매핑. serif-thin/serif-bold는 id는 그대로 두되 실제 weight만 바뀐다(의도된 변경,
// Phase 1-2 지시서 2-2 참고 — 400→300, 700→600).
export const LEGACY_FONT_STYLE_MAP: Record<string, FontStyleId> = {
  'gothic': 'gothic-bold'
};

export function normalizeFontStyleId(value: string | undefined | null): FontStyleId {
  if (!value) return 'serif-thin';
  if (value in LEGACY_FONT_STYLE_MAP) return LEGACY_FONT_STYLE_MAP[value];
  return value as FontStyleId;
}

const FONT_SPECS: Record<FontStyleId, FontSpec> = {
  'serif-thin': { weight: 300, family: SERIF_FAMILY },
  'serif-regular': { weight: 400, family: SERIF_FAMILY },
  'serif-bold': { weight: 600, family: SERIF_FAMILY },
  'gothic-regular': { weight: 400, family: GOTHIC_FAMILY },
  'gothic-bold': { weight: 700, family: GOTHIC_FAMILY }
};

export function fontSpecFor(fontStyle: FontStyleId): FontSpec {
  return FONT_SPECS[normalizeFontStyleId(fontStyle)] ?? FONT_SPECS['serif-thin'];
}

export function titleFont(fontStyle: FontStyleId, sizePx: number): string {
  const spec = fontSpecFor(fontStyle);
  return `${spec.weight} ${sizePx}px ${spec.family}`;
}

// document.fonts.load()가 실제로 어떤 얼굴을 로드할지는 전달한 샘플 문자열의 스크립트에
// 좌우된다(폭 계산이 아니라 "이 문자들을 그리는 데 필요한 얼굴들"을 로드하므로, 한글만 주면
// Noto Serif JP는 로드되지 않는다). 한글+일본어(가나+한자)+라틴을 모두 포함해 세리프 목록의
// 두 얼굴을 한 번에 트리거한다.
const SERIF_SAMPLE = '가나다ABCあ日';
const GOTHIC_SAMPLE = '가나다ABC';

export interface FontLoadResult {
  ok: boolean;
  family: string;
  weight: number;
  reason?: string;
}

// renderThumbnail()/renderCover()가 fillText를 부르기 전에 호출한다. 실패해도 throw하지
// 않는다 — 폰트가 없어도 시스템 폴백으로라도 그려야 한다. 다만 조용히 넘기지 않고 콘솔 경고를
// 남기고, ok:false를 반환해 호출부(PreviewPanel)가 화면에 안내를 띄울 수 있게 한다.
export async function ensureFontsLoaded(fontStyle: FontStyleId, sizePx: number, timeoutMs = 3000): Promise<FontLoadResult> {
  const spec = fontSpecFor(fontStyle);
  const result: FontLoadResult = { ok: true, family: spec.family, weight: spec.weight };
  if (typeof document === 'undefined' || !document.fonts) return result;

  const font = `${spec.weight} ${sizePx}px ${spec.family}`;
  const sample = spec.family === SERIF_FAMILY ? SERIF_SAMPLE : GOTHIC_SAMPLE;

  try {
    if (document.fonts.check(font, sample)) return result;
    await Promise.race([
      document.fonts.load(font, sample),
      new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error(`font-load-timeout(${timeoutMs}ms)`)), timeoutMs);
      })
    ]);
    const ok = document.fonts.check(font, sample);
    if (!ok) {
      console.warn(`[fonts] "${font}" 로드는 끝났지만 사용 가능한 얼굴이 없습니다 — 시스템 폰트로 표시 중.`);
      return { ...result, ok: false, reason: 'not-available-after-load' };
    }
    return result;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[fonts] "${font}" 로드 실패 — 시스템 폰트로 표시 중. (${reason})`);
    return { ...result, ok: false, reason };
  }
}
