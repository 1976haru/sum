import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { RotateCcw } from 'lucide-react';
import type { LayoutId, TextBox, TextZone } from '../types';
import { YOUTUBE_DURATION_BADGE_AREA, YOUTUBE_PROGRESS_BAR_AREA, effectiveTextBox, presetNormalizedPosition } from '../lib/textBox';

interface TextBoxOverlayProps {
  imgRef: RefObject<HTMLImageElement>;
  textZone: TextZone;
  textBox?: TextBox;
  layout: LayoutId;
  onCommit: (patch: { textBox?: TextBox; textZone?: TextZone }) => void;
}

const PRESET_ZONES: TextZone[] = ['left-third', 'top-center', 'center'];
// 정규화 좌표계(0~1) 기준. 드래그 중 캔버스 렌더는 절대 부르지 않고 CSS 박스만 움직인다(성능).
const SNAP_THRESHOLD = 0.03;
const CLICK_THRESHOLD = 0.002; // 이보다 적게 움직이면 클릭으로 보고 커밋하지 않는다.
const MIN_WIDTH = 0.05;

type DragKind = 'move' | 'resize-left' | 'resize-right';

interface DragState {
  kind: DragKind;
  startNX: number;
  startNY: number;
  startLeft: number;
  startRight: number;
  startY: number;
  align: 'left' | 'center';
  moved: boolean;
}

function toRect(box: TextBox): { left: number; right: number } {
  return box.align === 'left' ? { left: box.x, right: box.x + box.width } : { left: box.x - box.width / 2, right: box.x + box.width / 2 };
}

function fromRect(left: number, right: number, align: 'left' | 'center'): { x: number; width: number } {
  const width = Math.max(MIN_WIDTH, right - left);
  return { x: align === 'left' ? left : (left + right) / 2, width };
}

function findPresetSnap(x: number, y: number, layout: LayoutId): { x: number; y: number; zone: TextZone } | null {
  for (const zone of PRESET_ZONES) {
    const preset = presetNormalizedPosition(zone, layout);
    if (Math.hypot(preset.x - x, preset.y - y) <= SNAP_THRESHOLD) return { x: preset.x, y: preset.y, zone };
  }
  return null;
}

// 유튜브 그리드 썸네일 UI가 가리는 영역을 점선으로만 안내한다(넘어가도 막지 않음).
// 좌표 출처: src/lib/textBox.ts의 YOUTUBE_DURATION_BADGE_AREA / YOUTUBE_PROGRESS_BAR_AREA 주석 참고.
function SafeAreaGuides() {
  const badgeStyle = {
    left: `${YOUTUBE_DURATION_BADGE_AREA.x0 * 100}%`,
    top: `${YOUTUBE_DURATION_BADGE_AREA.y0 * 100}%`,
    width: `${(YOUTUBE_DURATION_BADGE_AREA.x1 - YOUTUBE_DURATION_BADGE_AREA.x0) * 100}%`,
    height: `${(YOUTUBE_DURATION_BADGE_AREA.y1 - YOUTUBE_DURATION_BADGE_AREA.y0) * 100}%`
  };
  const progressStyle = {
    left: `${YOUTUBE_PROGRESS_BAR_AREA.x0 * 100}%`,
    top: `${YOUTUBE_PROGRESS_BAR_AREA.y0 * 100}%`,
    width: `${(YOUTUBE_PROGRESS_BAR_AREA.x1 - YOUTUBE_PROGRESS_BAR_AREA.x0) * 100}%`,
    height: `${(YOUTUBE_PROGRESS_BAR_AREA.y1 - YOUTUBE_PROGRESS_BAR_AREA.y0) * 100}%`
  };
  return (
    <>
      <div className="safe-area-guide" style={badgeStyle} title="유튜브 재생시간 배지가 가리는 영역(실측)" />
      <div className="safe-area-guide" style={progressStyle} title="유튜브 시청 진행바 영역(근사)" />
    </>
  );
}

// 스텝③ 미리보기 위에서 문구 위치를 직접 드래그로 잡는다. 캔버스 재렌더(renderThumbnail)는
// pointerup에서 한 번만 일어난다 — pointermove 중에는 이 컴포넌트의 로컬 state만 바뀐다.
export default function TextBoxOverlay({ imgRef, textZone, textBox, layout, onCommit }: TextBoxOverlayProps) {
  const [dragBox, setDragBox] = useState<TextBox | null>(null);
  const [guides, setGuides] = useState<{ v: boolean; h: boolean; snapped: boolean }>({ v: false, h: false, snapped: false });
  const dragRef = useRef<DragState | null>(null);

  const base = textBox ?? effectiveTextBox({ textZone, layout });
  const display = dragBox ?? base;
  const rect = toRect(display);

  // <img>는 object-fit:contain이라 프레임 안에서 레터박스가 생길 수 있다(예: 168px 정사각 미리보기에
  // 16:9 이미지). 오버레이는 프레임이 아니라 <img>의 실제 렌더 박스에 정확히 겹쳐야 한다.
  const [imgBox, setImgBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const parent = img.parentElement;
    function measure() {
      if (!img || !parent) return;
      const imgRect = img.getBoundingClientRect();
      const parentRect = parent.getBoundingClientRect();
      setImgBox({ left: imgRect.left - parentRect.left, top: imgRect.top - parentRect.top, width: imgRect.width, height: imgRect.height });
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(img);
    if (parent) observer.observe(parent);
    window.addEventListener('resize', measure);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [imgRef]);

  function normalizedPointer(event: ReactPointerEvent): { nx: number; ny: number } | null {
    const img = imgRef.current;
    if (!img) return null;
    const imgRect = img.getBoundingClientRect(); // 프레임이 아니라 반드시 <img> 기준
    if (imgRect.width === 0 || imgRect.height === 0) return null;
    return {
      nx: (event.clientX - imgRect.left) / imgRect.width,
      ny: (event.clientY - imgRect.top) / imgRect.height
    };
  }

  const beginDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>, kind: DragKind) => {
    const pointer = normalizedPointer(event);
    if (!pointer) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const startBox = base;
    const { left, right } = toRect(startBox);
    dragRef.current = {
      kind,
      startNX: pointer.nx,
      startNY: pointer.ny,
      startLeft: left,
      startRight: right,
      startY: startBox.y,
      align: startBox.align,
      moved: false
    };
    setDragBox(startBox);
    event.preventDefault();
    event.stopPropagation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  const onMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const pointer = normalizedPointer(event);
    if (!pointer) return;
    const dx = pointer.nx - drag.startNX;
    const dy = pointer.ny - drag.startNY;
    if (Math.hypot(dx, dy) > CLICK_THRESHOLD) drag.moved = true;

    let left = drag.startLeft;
    let right = drag.startRight;
    let y = drag.startY;

    if (drag.kind === 'move') {
      left = drag.startLeft + dx;
      right = drag.startRight + dx;
      y = drag.startY + dy;
    } else if (drag.kind === 'resize-left') {
      left = drag.startLeft + dx;
    } else {
      right = drag.startRight + dx;
    }

    left = Math.max(0, Math.min(left, right - MIN_WIDTH));
    right = Math.min(1, Math.max(right, left + MIN_WIDTH));
    y = Math.max(0, Math.min(1, y));

    const { x, width } = fromRect(left, right, drag.align);
    let nextX = x;
    let nextY = y;
    let snapped = false;
    let vLine = false;
    let hLine = false;

    if (drag.kind === 'move') {
      const preset = findPresetSnap(x, y, layout);
      if (preset) {
        nextX = preset.x;
        nextY = preset.y;
        snapped = true;
      } else {
        if (Math.abs(x - 0.5) <= SNAP_THRESHOLD) { nextX = 0.5; vLine = true; }
        if (Math.abs(y - 0.5) <= SNAP_THRESHOLD) { nextY = 0.5; hLine = true; }
      }
    }

    setDragBox({ x: nextX, y: nextY, width, align: drag.align });
    setGuides({ v: vLine, h: hLine, snapped });
  }, [layout]);

  const endDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setGuides({ v: false, h: false, snapped: false });
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* 캡처가 이미 풀렸을 수 있다 — 무시해도 안전 */ }
    if (!drag) return;

    if (!drag.moved) {
      // 클릭으로 간주 — 아무것도 커밋하지 않는다(기존 상태 그대로 유지).
      setDragBox(null);
      return;
    }

    const finalBox = dragBox;
    setDragBox(null);
    if (!finalBox) return;

    const preset = drag.kind === 'move' ? findPresetSnap(finalBox.x, finalBox.y, layout) : null;
    if (preset) {
      // 프리셋에 스냅됐다면 textBox를 지우고 textZone만 남겨 프리셋으로 완전히 복귀한다.
      onCommit({ textZone: preset.zone, textBox: undefined });
    } else {
      onCommit({ textBox: finalBox });
    }
  }, [dragBox, layout, onCommit]);

  const boxStyle = {
    left: `${rect.left * 100}%`,
    top: `${display.y * 100}%`,
    width: `${(rect.right - rect.left) * 100}%`
  };

  if (!imgBox) return null; // 아직 <img> 크기를 측정하지 못했다 — 다음 렌더에서 측정된다.

  const overlayStyle = { left: imgBox.left, top: imgBox.top, width: imgBox.width, height: imgBox.height };

  return (
    <div className="textbox-overlay" style={overlayStyle}>
      <SafeAreaGuides />
      {guides.v && <div className="textbox-guide-line vertical" />}
      {guides.h && <div className="textbox-guide-line horizontal" />}
      <div
        className={`textbox-drag-box${guides.snapped ? ' snapped' : ''}`}
        style={boxStyle}
        onPointerDown={event => beginDrag(event, 'move')}
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        title="드래그해서 문구 위치를 옮기세요"
      >
        <span className="textbox-drag-label">문구 위치</span>
        <div
          className="textbox-handle left"
          onPointerDown={event => beginDrag(event, 'resize-left')}
          onPointerMove={onMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          title="폭 조정"
        />
        <div
          className="textbox-handle right"
          onPointerDown={event => beginDrag(event, 'resize-right')}
          onPointerMove={onMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          title="폭 조정"
        />
      </div>
    </div>
  );
}

// 배지·되돌리기 버튼은 프레임 바깥(overflow:hidden에 잘리지 않는 위치)에 별도로 그린다.
// PreviewPanel이 .preview-frame 아래에 형제 엘리먼트로 렌더한다.
export function TextBoxToolbar({ visible, onRevert }: { visible: boolean; onRevert: () => void }) {
  if (!visible) return null;
  return (
    <div className="textbox-toolbar-row">
      <span className="textbox-custom-badge">직접 조정됨</span>
      <button type="button" className="secondary" onClick={onRevert}><RotateCcw size={13} /> 프리셋으로 되돌리기</button>
    </div>
  );
}
