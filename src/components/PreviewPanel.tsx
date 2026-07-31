import { useEffect, useRef, useState } from 'react';
import { Layers3 } from 'lucide-react';
import type { AspectKind, BackgroundImage, CoverConfig, ProjectConfig, TextBox, TextZone } from '../types';
import { renderThumbnail } from '../lib/thumbnail';
import { renderCover } from '../lib/cover';
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
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (!image) { setPreview(''); return; }
    setBusy(true);
    const task = aspect === '16x9'
      ? renderThumbnail({ ...config, imageDataUrl: image.dataUrl, width: 640, height: 360 })
      : renderCover({ ...coverBase, headline: coverHeadline, imageDataUrl: image.dataUrl }, 640);
    void task
      .then(dataUrl => { if (!cancelled) setPreview(dataUrl); })
      .catch(() => { if (!cancelled) setPreview(''); })
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
    </aside>
  );
}
