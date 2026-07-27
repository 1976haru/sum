import { useEffect, useMemo, useState } from 'react';
import { Download, ImagePlus, Layers3, Sparkles } from 'lucide-react';
import type { BackgroundImage, ProjectConfig } from '../types';
import { renderThumbnail } from '../lib/thumbnail';
import { headlineSuggestions, shortHeadlineSuggestions } from '../lib/headlines';

interface ThumbnailStudioProps {
  config: ProjectConfig;
  onConfigChange: (patch: Partial<ProjectConfig>) => void;
  outputDir: string;
  onOutputDirChange: (value: string) => void;
  onThumbnailSaved: (path: string) => void;
}

export default function ThumbnailStudio({ config, onConfigChange, outputDir, onOutputDirChange, onThumbnailSaved }: ThumbnailStudioProps) {
  const [images, setImages] = useState<BackgroundImage[]>([]);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const suggestions = useMemo(
    () => headlineSuggestions(config.language, config.channelPreset, config.season, config.mood),
    [config.language, config.channelPreset, config.season, config.mood]
  );
  const shortSuggestions = useMemo(() => shortHeadlineSuggestions(config.language), [config.language]);

  useEffect(() => {
    let cancelled = false;
    if (!images[0]) { setPreview(''); return; }
    void renderThumbnail({ ...config, imageDataUrl: images[0].dataUrl }).then(dataUrl => {
      if (!cancelled) setPreview(dataUrl);
    });
    return () => { cancelled = true; };
  }, [config, images]);

  async function pickImages() {
    const picked = await window.sumAPI.pickImages();
    const loaded = await Promise.all(picked.slice(0, 12).map(async file => ({ ...file, dataUrl: await window.sumAPI.readImage(file.path) })));
    setImages(loaded);
  }

  async function ensureOutputDir() {
    if (outputDir) return outputDir;
    const picked = await window.sumAPI.pickOutputDir();
    if (picked) onOutputDirChange(picked);
    return picked || '';
  }

  async function saveOne() {
    if (!images[0]) return alert('배경 이미지를 먼저 선택하세요.');
    const dir = await ensureOutputDir();
    if (!dir) return;
    setBusy(true);
    try {
      const dataUrl = await renderThumbnail({ ...config, imageDataUrl: images[0].dataUrl });
      const saved = await window.sumAPI.saveThumbnail({ dataUrl, outputDir: dir, fileName: `${config.projectName}_thumbnail`, format: 'jpg' });
      onThumbnailSaved(saved);
    } finally { setBusy(false); }
  }

  async function saveThree() {
    if (!images[0]) return alert('배경 이미지를 먼저 선택하세요.');
    const dir = await ensureOutputDir();
    if (!dir) return;
    setBusy(true);
    try {
      const titles = [config.headline, suggestions[1] || config.headline, shortSuggestions[0] || config.headline];
      const layouts: ProjectConfig['layout'][] = ['editorial', 'story', 'minimal'];
      let last = '';
      for (let index = 0; index < 3; index++) {
        const image = images[index % images.length];
        const dataUrl = await renderThumbnail({
          ...config,
          headline: titles[index],
          layout: layouts[index],
          imageDataUrl: image.dataUrl,
          variantIndex: index
        });
        last = await window.sumAPI.saveThumbnail({
          dataUrl,
          outputDir: dir,
          fileName: `${config.projectName}_thumbnail_${String(index + 1).padStart(2, '0')}`,
          format: 'jpg'
        });
      }
      onThumbnailSaved(last);
    } finally { setBusy(false); }
  }

  return (
    <section className="workspace-grid">
      <div className="panel controls-panel">
        <div className="panel-heading">
          <div><span className="eyebrow">THUMBNAIL</span><h2>썸네일 자동 조판</h2></div>
          <button className="secondary" onClick={pickImages}><ImagePlus size={17} /> 배경 사진</button>
        </div>

        <label>메인 문구<input value={config.headline} maxLength={32} onChange={event => onConfigChange({ headline: event.target.value })} /></label>
        <label>보조 문구<input value={config.subline} maxLength={46} onChange={event => onConfigChange({ subline: event.target.value })} /></label>

        <div className="field-grid">
          <label>문구 위치<select value={config.textSide} onChange={event => onConfigChange({ textSide: event.target.value as ProjectConfig['textSide'] })}><option value="left">왼쪽</option><option value="right">오른쪽</option></select></label>
          <label>레이아웃<select value={config.layout} onChange={event => onConfigChange({ layout: event.target.value as ProjectConfig['layout'] })}><option value="editorial">에디토리얼</option><option value="story">스토리형</option><option value="minimal">미니멀</option></select></label>
        </div>

        <label>텍스트 배경 농도<input type="range" min="0.3" max="0.9" step="0.05" value={config.overlayStrength} onChange={event => onConfigChange({ overlayStrength: Number(event.target.value) })} /></label>

        <div className="suggestion-block">
          <h3><Sparkles size={16} /> 문장형 추천</h3>
          <div className="chips">{suggestions.map(text => <button key={text} className="chip" onClick={() => onConfigChange({ headline: text })}>{text}</button>)}</div>
        </div>
        <div className="suggestion-block">
          <h3>10자 안팎 짧은 문구</h3>
          <div className="chips">{shortSuggestions.map(text => <button key={text} className="chip" onClick={() => onConfigChange({ headline: text })}>{text}</button>)}</div>
        </div>

        <div className="image-strip">
          {images.map((image, index) => <button key={image.path} className={index === 0 ? 'image-thumb active' : 'image-thumb'} onClick={() => setImages(current => [image, ...current.filter(item => item.path !== image.path)])}><img src={image.dataUrl} alt={image.name} /></button>)}
          {!images.length && <p className="empty-note">카페·창가·겨울 배경 사진을 1~3장 넣으면 서로 다른 3종 썸네일을 만들 수 있어요.</p>}
        </div>
      </div>

      <div className="panel preview-panel">
        <div className="panel-heading"><div><span className="eyebrow">1280 × 720</span><h2>미리보기</h2></div></div>
        <div className="canvas-preview">{preview ? <img src={preview} alt="썸네일 미리보기" /> : <div className="preview-placeholder"><Layers3 size={42} /><p>배경 사진을 선택하세요.</p></div>}</div>
        <div className="action-row">
          <button className="secondary" disabled={busy || !preview} onClick={saveOne}><Download size={17} /> JPG 1장 저장</button>
          <button className="primary" disabled={busy || !preview} onClick={saveThree}><Sparkles size={17} /> 서로 다른 3장 자동 생성</button>
        </div>
        {outputDir && <button className="path-button" onClick={() => void window.sumAPI.openPath(outputDir)}>저장 폴더: {outputDir}</button>}
      </div>
    </section>
  );
}
