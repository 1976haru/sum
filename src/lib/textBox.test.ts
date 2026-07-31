import { describe, expect, it } from 'vitest';
import { resolveTextBox } from './textBox';

// resolveTextBox()가 프리셋 3종에 대해 renderThumbnail()의 기존 픽셀 상수와 완전히 동일한
// 값을 반환하는지 고정하는 회귀 테스트. 프리셋 좌표 숫자는 여기서 절대 바꾸지 않는다.
//
// 참고: renderThumbnail()의 실제 기준 해상도는 1280x720이다(REFERENCE_WIDTH/HEIGHT).
// scale = width / 1280 이므로 1920 출력에서는 scale=1.5가 곱해진다.
// (지시서 예시는 "1920 기준"으로 boxX=74/maxWidth=530을 기대했지만, 실제 코드의
// 기준 해상도는 1280이라 1920에서는 74*1.5=111, 530*1.5=795가 실제 값이다. 이 값은
// 최초 커밋부터 존재해온 상수이며, 이번 작업에서 바꾸지 말라고 명시된 "숫자"이므로
// 지시서 예시가 아니라 실제 코드 동작을 그대로 고정한다. 아래 top-center/center 값은
// width/height를 직접 곱하는 공식이라 기준 해상도와 무관하며 지시서 예시와 정확히 일치한다.)
describe('resolveTextBox — 프리셋 3종 회귀 고정', () => {
  it('1) left-third @ 1920x1080 (layout=editorial 기본값) — 실제 1280 기준 scale=1.5 적용값', () => {
    const box = resolveTextBox({ textZone: 'left-third', layout: 'editorial' }, 1920, 1080);
    expect(box.boxX).toBeCloseTo(74 * 1.5, 10); // = 111
    expect(box.maxWidth).toBeCloseTo(530 * 1.5, 10); // = 795
    expect(box.boxY).toBeCloseTo(205 * 1.5, 10); // = 307.5 (editorial)
    expect(box.align).toBe('left');
    expect(box.scrimMode).toBe('side');
  });

  it('2) top-center @ 1920x1080 — width/height 직접곱 공식이라 기준해상도 무관, 지시서 예시와 정확히 일치', () => {
    const box = resolveTextBox({ textZone: 'top-center', layout: 'editorial' }, 1920, 1080);
    expect(box.boxX).toBe(960);
    expect(box.maxWidth).toBeCloseTo(1382.4, 10);
    expect(box.boxY).toBeCloseTo(151.2, 10);
    expect(box.align).toBe('center');
    expect(box.scrimMode).toBe('band');
  });

  it('3) center @ 1920x1080 — 지시서 예시와 정확히 일치', () => {
    const box = resolveTextBox({ textZone: 'center', layout: 'editorial' }, 1920, 1080);
    expect(box.boxX).toBe(960);
    expect(box.boxY).toBe(432);
    expect(box.align).toBe('center');
    expect(box.scrimMode).toBe('band');
  });

  it('4) 같은 프리셋을 640x360에서 호출하면 1920x1080 값의 정확히 1/3이다(비례 일관성)', () => {
    for (const textZone of ['left-third', 'top-center', 'center'] as const) {
      for (const layout of ['editorial', 'story', 'minimal'] as const) {
        const big = resolveTextBox({ textZone, layout }, 1920, 1080);
        const small = resolveTextBox({ textZone, layout }, 640, 360);
        expect(small.boxX).toBeCloseTo(big.boxX / 3, 10);
        expect(small.boxY).toBeCloseTo(big.boxY / 3, 10);
        expect(small.maxWidth).toBeCloseTo(big.maxWidth / 3, 10);
        expect(small.align).toBe(big.align);
        expect(small.scrimMode).toBe(big.scrimMode);
      }
    }
  });

  it('5) textBox={x:0.05,y:0.2,width:0.3,align:"left"} → scrimMode="side" (좌측에 붙은 왼쪽 정렬)', () => {
    const box = resolveTextBox(
      { textZone: 'center', layout: 'editorial', textBox: { x: 0.05, y: 0.2, width: 0.3, align: 'left' } },
      1000,
      1000
    );
    expect(box.scrimMode).toBe('side');
    expect(box.align).toBe('left');
    expect(box.boxX).toBe(50);
    expect(box.boxY).toBe(200);
    expect(box.maxWidth).toBe(300);
  });

  it('6) textBox={x:0.5,y:0.2,width:0.6,align:"center"} → scrimMode="band"', () => {
    const box = resolveTextBox(
      { textZone: 'center', layout: 'editorial', textBox: { x: 0.5, y: 0.2, width: 0.6, align: 'center' } },
      1000,
      1000
    );
    expect(box.scrimMode).toBe('band');
    expect(box.align).toBe('center');
  });

  it("6-b) align='left'이어도 x>=0.4면 scrimMode는 'band'다(좌측 사이드 스크림은 좁은 왼쪽 영역 전용)", () => {
    const box = resolveTextBox(
      { textZone: 'center', layout: 'editorial', textBox: { x: 0.4, y: 0.2, width: 0.3, align: 'left' } },
      1000,
      1000
    );
    expect(box.scrimMode).toBe('band');
  });

  it('7) x, y, width가 0~1 범위를 벗어나면 clamp된다', () => {
    const box = resolveTextBox(
      { textZone: 'center', layout: 'editorial', textBox: { x: -0.5, y: 1.5, width: 2, align: 'left' } },
      1000,
      800
    );
    expect(box.boxX).toBe(0); // x clamp: -0.5 -> 0
    expect(box.boxY).toBe(800); // y clamp: 1.5 -> 1 -> 1*800
    expect(box.maxWidth).toBe(1000); // width clamp: 2 -> 1 -> 1*1000
  });

  it('8) left-third의 titleY는 layout에 따라 세 갈래이며 기존 값과 일치한다(1280 기준, scale=1)', () => {
    const editorial = resolveTextBox({ textZone: 'left-third', layout: 'editorial' }, 1280, 720);
    const minimal = resolveTextBox({ textZone: 'left-third', layout: 'minimal' }, 1280, 720);
    const story = resolveTextBox({ textZone: 'left-third', layout: 'story' }, 1280, 720);
    expect(editorial.boxY).toBe(205);
    expect(minimal.boxY).toBe(230);
    expect(story.boxY).toBe(172);
    // top-center/center는 layout에 영향받지 않는다(회귀 확인).
    for (const textZone of ['top-center', 'center'] as const) {
      const editorialY = resolveTextBox({ textZone, layout: 'editorial' }, 1280, 720).boxY;
      const minimalY = resolveTextBox({ textZone, layout: 'minimal' }, 1280, 720).boxY;
      const storyY = resolveTextBox({ textZone, layout: 'story' }, 1280, 720).boxY;
      expect(minimalY).toBe(editorialY);
      expect(storyY).toBe(editorialY);
    }
  });
});

// ExportStep(단일 저장·세트 일괄 생성)은 `{ ...config, imageDataUrl, width: 1920, height: 1080 }`
// 형태로 renderThumbnail()을 호출한다. renderThumbnail은 canvas/Image가 필요해 vitest(node
// 환경)에서 직접 실행할 수 없으므로, 여기서는 ExportStep과 정확히 같은 스프레드 패턴을 재현해
// textBox가 그 과정에서 유실되지 않고 resolveTextBox까지 그대로 전달되는지 확인한다.
describe('ExportStep 스프레드 패턴으로 textBox가 유실 없이 전달되는지', () => {
  it('config.textBox가 있으면 스프레드 후에도 커스텀 박스 경로로 해석된다', () => {
    const config = {
      textZone: 'left-third' as const,
      layout: 'editorial' as const,
      textBox: { x: 0.1, y: 0.3, width: 0.4, align: 'left' as const }
    };
    // ExportStep.saveSingle / runBatch가 실제로 하는 것과 동일한 스프레드.
    const input = { ...config, imageDataUrl: 'data:image/jpeg;base64,x', width: 1920, height: 1080 };
    const box = resolveTextBox(input, input.width, input.height);
    expect(box.boxX).toBe(0.1 * 1920);
    expect(box.boxY).toBe(0.3 * 1080);
    expect(box.maxWidth).toBe(0.4 * 1920);
    expect(box.align).toBe('left');
  });

  it('config.textBox가 없으면 스프레드 후에도 프리셋 경로가 그대로 유지된다', () => {
    const config = { textZone: 'center' as const, layout: 'editorial' as const };
    const input = { ...config, imageDataUrl: 'data:image/jpeg;base64,x', width: 1920, height: 1080 };
    const box = resolveTextBox(input, input.width, input.height);
    expect(box.boxX).toBe(960);
    expect(box.boxY).toBe(432);
  });
});
