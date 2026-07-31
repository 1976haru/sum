import { useEffect, useRef, useState } from 'react';
import { Layers3, TriangleAlert } from 'lucide-react';
import type { AspectKind, BackgroundImage, CoverConfig, ProjectConfig, TextBox, TextZone } from '../types';
import { renderThumbnail } from '../lib/thumbnail';
import { renderCover } from '../lib/cover';
import { ensureFontsLoaded } from '../lib/fonts';
import TextBoxOverlay, { TextBoxToolbar } from './TextBoxOverlay';

interface PreviewPanelProps {
  aspect: AspectKind;
  onAspectChange: (aspect: AspectKind) => void;
  config: ProjectConfig;
  coverBase: CoverConfig;
  coverHeadline: string;
  image?: BackgroundImage;
  onTextBoxCommit: (patch: { textBox?: TextBox; textZone?: TextZone }) => void;
}

// 스텝 우측에 항상 붙어있는 실시간 미리보기: 16:9/1:1 탭 전환 + 168px 축소 토글.
export default function PreviewPanel({ aspect, onAspectChange, config, coverBase, coverHeadline, image, onTextBoxCommit }: PreviewPanelProps) {
  const [mini, setMini] = useState(false);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [fontWarning, setFontWarning] = useState('');
  const [thumbWarnings, setThumbWarnings] = useState<string[]>([]);
  const imgRef = useRef<HTMLImageElement>(null);

  // 렌더 파이프라인(thumbnail.ts/cover.ts)도 내부적으로 같은 폰트 로드를 기다리지만,
  // 조용히 폴백될 뿐 throw하지 않으므로 여기서 별도로 상태를 확인해 화면에 안내한다.
  useEffect(() => {
    let cancelled = false;
    void ensureFontsLoaded(config.fontStyle, 72).then(result => {
      if (cancelled) return;
      setFontWarning(result.ok ? '' : `번들 폰트(${result.family.split(',')[0]}, ${result.weight}) 로드 실패 — 시스템 폰트로 표시 중입니다.`);
    });
    return () => { cancelled = true; };
  }, [config.fontStyle]);

  // Phase 1-3: 배경 이미지가 없어도 폴백 그라디언트로 계속 렌더한다(더 이상 빈 화면으로 막지 않는다).
  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    const task = aspect === '16x9'
      ? renderThumbnail({ ...config, imageDataUrl: image?.dataUrl, width: 640, height: 360 })
        .then(result => { setThumbWarnings(result.diagnostics.warnings); return result.dataUrl; })
      : renderCover({ ...coverBase, headline: coverHeadline, imageDataUrl: image?.dataUrl }, 640)
        .then(dataUrl => { setThumbWarnings([]); return dataUrl; });
    void task
      .then(dataUrl => { if (!cancelled) setPreview(dataUrl); })
      .catch(() => { if (!cancelled) { setPreview(''); setThumbWarnings([]); } })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [config, coverBase, coverHeadline, image, aspect]);

  // 문구 드래그 배치는 16:9 썸네일 · 168px 축소가 아닐 때만 지원한다(1:1 커버는 Phase 1-2 이후,
  // 168px에서는 손가락/마우스로 폭 조정 핸들을 잡기에 너무 작아 편집을 막는다).
  const dragEditable = aspect === '16x9' && !mini && Boolean(preview);

  return (
    <aside className="preview-rail panel">
      <div className="preview-tabs">
        <button className={aspect === '16x9' ? 'active' : ''} onClick={() => onAspectChange('16x9')}>16:9 썸네일</button>
        <button className={aspect === '1x1' ? 'active' : ''} onClick={() => onAspectChange('1x1')}>1:1 커버</button>
      </div>
      <div className={`preview-frame ${aspect === '1x1' ? 'square' : 'wide'}${mini ? ' mini168' : ''}`}>
        {preview
          ? <img ref={imgRef} src={preview} alt="미리보기" />
          : <div className="preview-placeholder"><Layers3 size={36} /><p>배경 이미지를 선택하면 실시간으로 반영됩니다.</p></div>}
        {dragEditable && (
          <TextBoxOverlay
            imgRef={imgRef}
            textZone={config.textZone}
            textBox={config.textBox}
            layout={config.layout}
            onCommit={onTextBoxCommit}
          />
        )}
      </div>
      {dragEditable && <TextBoxToolbar visible={Boolean(config.textBox)} onRevert={() => onTextBoxCommit({ textBox: undefined })} />}
      <label className="checkbox-row"><input type="checkbox" checked={mini} onChange={event => setMini(event.target.checked)} /> 168px 축소 미리보기</label>
      {busy && <p className="supporting">렌더링 중...</p>}
      {!image && preview && <p className="supporting">배경 이미지 없음 — 단색 배경으로 생성 중</p>}
      {fontWarning && <p className="supporting font-warning"><TriangleAlert size={14} /> {fontWarning}</p>}
      {thumbWarnings.map(warning => (
        <p key={warning} className="supporting font-warning"><TriangleAlert size={14} /> {warning}</p>
      ))}
    </aside>
  );
}
