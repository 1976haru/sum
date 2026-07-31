import { useEffect, useState } from 'react';
import type { DragEvent } from 'react';
import { AlertTriangle, ClipboardCopy, ImagePlus, ShieldCheck, Trash2, UploadCloud, Wand2 } from 'lucide-react';
import type { AIImageSettings, AspectKind, BackgroundImage, BackgroundInspection, LocationPresetId, PromptVariant, SeasonPresetId, TextZone, TimePresetId } from '../../types';
import { LOCATION_PRESETS, NEGATIVE_PROMPT, SEASON_PRESETS, TIME_PRESETS, buildPromptVariants } from '../../lib/promptBuilder';
import { dedupeImages } from '../../lib/imageList';

interface BackgroundStepProps {
  images: BackgroundImage[];
  onImagesChange: (images: BackgroundImage[]) => void;
  textZone: TextZone;
  aspect: AspectKind;
  extra: string;
  onExtraChange: (value: string) => void;
}

type SourceTab = 'upload' | 'ai' | 'prompt';

type InspectionState =
  | { kind: 'pending' }
  | { kind: 'skipped'; reason: string }
  | { kind: 'failed'; reason: string }
  | { kind: 'done'; result: BackgroundInspection };

const VARIANT_LABELS: Record<PromptVariant, string> = { generic: 'Generic (ChatGPT·DALL-E)', midjourney: 'Midjourney', qwen: 'Qwen' };

function imageFileName(name: string) {
  return /\.(png|jpe?g|webp)$/i.test(name);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`${file.name} 읽기에 실패했습니다.`));
    reader.readAsDataURL(file);
  });
}

function renderInspectionBadges(state: InspectionState | undefined) {
  if (!state) return null;
  if (state.kind === 'pending') return <span className="inspection-dot pending" title="검수 중...">·</span>;
  if (state.kind === 'skipped') return <span className="inspection-dot muted" title={state.reason}>–</span>;
  if (state.kind === 'failed') return <span className="inspection-dot muted" title={`검수 불가 — ${state.reason}`}>–</span>;

  const { result } = state;
  const warnings: string[] = [];
  if (result.hasText) warnings.push('문구가 구워졌을 수 있습니다 — 재생성 권장');
  if (result.objectCount > 5) warnings.push('168px 축소 시 뭉개질 수 있습니다');
  if (!result.textZoneClear) warnings.push('텍스트존이 복잡할 수 있습니다');

  if (result.hasText) return <span className="inspection-dot danger" title={warnings.join(' / ')}><AlertTriangle size={12} /></span>;
  if (warnings.length) return <span className="inspection-dot warn" title={warnings.join(' / ')}><AlertTriangle size={12} /></span>;
  return <span className="inspection-dot ok" title={`검수 통과 — ${result.notes || '이상 없음'}`}><ShieldCheck size={12} /></span>;
}

export default function BackgroundStep({ images, onImagesChange, textZone, aspect, extra, onExtraChange }: BackgroundStepProps) {
  const [tab, setTab] = useState<SourceTab>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [aiSettings, setAiSettings] = useState<(AIImageSettings & { hasQwenKey: boolean; hasGeminiKey: boolean }) | null>(null);

  const [locationId, setLocationId] = useState<LocationPresetId>('rome');
  const [seasonId, setSeasonId] = useState<SeasonPresetId>('winter');
  const [timeId, setTimeId] = useState<TimePresetId>('golden-hour');
  const [variantTab, setVariantTab] = useState<PromptVariant>('generic');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [inspections, setInspections] = useState<Record<string, InspectionState>>({});

  useEffect(() => { void window.sumAPI.loadAISettings().then(setAiSettings); }, []);

  const aiReady = Boolean(aiSettings && (aiSettings.provider === 'gemini' ? aiSettings.hasGeminiKey : aiSettings.hasQwenKey));
  const prompts = buildPromptVariants({ locationId, seasonId, timeId, textZone, aspect, extra });

  async function addFiles(files: Array<{ path: string; name: string }>) {
    const valid = files.filter(f => f.path && imageFileName(f.name)).slice(0, 60);
    if (!valid.length) {
      setMessage('이미지 파일(png/jpg/webp)만 올릴 수 있습니다.');
      return;
    }
    const loaded = await Promise.all(valid.map(async file => ({ ...file, dataUrl: await window.sumAPI.readImage(file.path) })));
    onImagesChange(dedupeImages([...loaded, ...images]));
    setMessage(`${loaded.length}장을 목록에 추가했습니다.`);
  }

  async function pickViaDialog() {
    const picked = await window.sumAPI.pickImages();
    await addFiles(picked);
  }

  // File.path는 Electron 32에서 제거되어 드롭된 File 객체에서 항상 빈 문자열이 된다.
  // IPC 왕복 없이 렌더러에서 직접 FileReader로 dataUrl을 만들고, path에는 중복 방지용 합성 키를 넣는다.
  async function addDroppedFiles(fileList: FileList) {
    const files = Array.from(fileList)
      .filter(f => imageFileName(f.name))
      .slice(0, 60);
    if (!files.length) {
      setMessage('이미지 파일(png/jpg/webp)만 올릴 수 있습니다.');
      return;
    }
    const loaded = await Promise.all(files.map(async (file, i) => ({
      path: `drop://${Date.now()}-${i}-${file.name}`,
      name: file.name,
      dataUrl: await readFileAsDataUrl(file)
    })));
    onImagesChange(dedupeImages([...loaded, ...images]));
    setMessage(`${loaded.length}장을 목록에 추가했습니다.`);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    const files = event.dataTransfer?.files;
    if (!files || !files.length) {
      setMessage('드롭한 항목에서 파일을 찾지 못했습니다.');
      return;
    }
    void addDroppedFiles(files);
  }

  function removeImage(path: string) {
    onImagesChange(images.filter(image => image.path !== path));
  }

  function selectAsCurrent(path: string) {
    const target = images.find(image => image.path === path);
    if (!target) return;
    onImagesChange([target, ...images.filter(image => image.path !== path)]);
  }

  // 파트F: 생성 직후 Gemini로 자동 검수한다. 검수는 참고용 경고일 뿐 자동 재생성을 트리거하지 않는다.
  async function inspect(path: string, dataUrl: string) {
    setInspections(current => ({ ...current, [path]: { kind: 'pending' } }));
    const outcome = await window.sumAPI.inspectBackground({ dataUrl, textZone });
    setInspections(current => ({
      ...current,
      [path]: 'skipped' in outcome
        ? { kind: 'skipped', reason: outcome.reason }
        : 'failed' in outcome
          ? { kind: 'failed', reason: outcome.reason }
          : { kind: 'done', result: outcome }
    }));
  }

  async function generate() {
    setBusy(true);
    setMessage('');
    try {
      const dataUrl = await window.sumAPI.generateAIBackground({
        prompt: prompts[aiSettings?.provider === 'gemini' ? 'generic' : 'qwen'],
        negativePrompt: NEGATIVE_PROMPT,
        size: aspect === '1x1' ? '1328*1328' : '1664*928',
        aspect
      });
      const path = `ai://${Date.now()}`;
      onImagesChange([{ path, name: `AI 배경 ${images.length + 1}`, dataUrl }, ...images]);
      setMessage('AI 배경을 생성해 목록 맨 앞에 추가했습니다.');
      void inspect(path, dataUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function copyPrompt(variant: PromptVariant) {
    await window.sumAPI.copyText(prompts[variant]);
    setMessage(`${VARIANT_LABELS[variant]} 프롬프트를 복사했습니다.`);
  }

  return (
    <div className="background-step">
      <div className="tab-strip">
        <button className={tab === 'upload' ? 'active' : ''} onClick={() => setTab('upload')}>내 사진 올리기</button>
        <button className={tab === 'ai' ? 'active' : ''} onClick={() => setTab('ai')}>AI로 생성{!aiReady && ' (키 필요)'}</button>
        <button className={tab === 'prompt' ? 'active' : ''} onClick={() => setTab('prompt')}>프롬프트만 복사</button>
      </div>

      {tab === 'upload' && (
        <div className="source-pane">
          <div
            className={dragOver ? 'dropzone dragover' : 'dropzone'}
            onDragOver={event => { event.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <UploadCloud size={30} />
            <p>이미지를 여기로 끌어다 놓거나</p>
            <button className="secondary" onClick={() => void pickViaDialog()}><ImagePlus size={16} /> 파일 선택(여러 장 가능)</button>
          </div>
          <div className="image-strip">
            {images.map((image, index) => (
              <div key={image.path} className={index === 0 ? 'image-thumb active' : 'image-thumb'}>
                <button onClick={() => selectAsCurrent(image.path)}><img src={image.dataUrl} alt={image.name} /></button>
                <button className="image-thumb-remove" onClick={() => removeImage(image.path)} title="삭제"><Trash2 size={13} /></button>
                {renderInspectionBadges(inspections[image.path])}
              </div>
            ))}
            {!images.length && <p className="empty-note">사진을 올리면 여기 목록에 쌓입니다. 클릭한 사진이 현재 작업 대상이 됩니다.</p>}
          </div>
        </div>
      )}

      {tab === 'ai' && (
        <div className="source-pane">
          {!aiReady && <p className="supporting">이미지 생성 키가 없어도 괜찮습니다 — 설정 화면에서 키를 등록하면 여기서 바로 생성할 수 있고, 지금은 "프롬프트만 복사" 탭으로 외부 도구를 이용할 수 있습니다.</p>}
          <div className="field-grid">
            <label>장소<select value={locationId} onChange={event => setLocationId(event.target.value as LocationPresetId)}>
              {Object.entries(LOCATION_PRESETS).map(([id, preset]) => <option key={id} value={id}>{preset.label}</option>)}
            </select></label>
            <label>계절<select value={seasonId} onChange={event => setSeasonId(event.target.value as SeasonPresetId)}>
              {Object.entries(SEASON_PRESETS).map(([id, preset]) => <option key={id} value={id}>{preset.label}</option>)}
            </select></label>
          </div>
          <label>시간대<select value={timeId} onChange={event => setTimeId(event.target.value as TimePresetId)}>
            {Object.entries(TIME_PRESETS).map(([id, preset]) => <option key={id} value={id}>{preset.label}</option>)}
          </select></label>
          <label>추가 지시(선택)<input value={extra} onChange={event => onExtraChange(event.target.value)} placeholder="예: 창가 자리, 따뜻한 조명" /></label>
          <button className="primary" disabled={busy || !aiReady} onClick={() => void generate()}><Wand2 size={16} /> {busy ? '생성 중...' : 'AI로 배경 생성'}</button>
        </div>
      )}

      {tab === 'prompt' && (
        <div className="source-pane">
          <div className="field-grid">
            <label>장소<select value={locationId} onChange={event => setLocationId(event.target.value as LocationPresetId)}>
              {Object.entries(LOCATION_PRESETS).map(([id, preset]) => <option key={id} value={id}>{preset.label}</option>)}
            </select></label>
            <label>계절<select value={seasonId} onChange={event => setSeasonId(event.target.value as SeasonPresetId)}>
              {Object.entries(SEASON_PRESETS).map(([id, preset]) => <option key={id} value={id}>{preset.label}</option>)}
            </select></label>
          </div>
          <label>시간대<select value={timeId} onChange={event => setTimeId(event.target.value as TimePresetId)}>
            {Object.entries(TIME_PRESETS).map(([id, preset]) => <option key={id} value={id}>{preset.label}</option>)}
          </select></label>
          <label>추가 지시(선택)<input value={extra} onChange={event => onExtraChange(event.target.value)} placeholder="예: 창가 자리, 따뜻한 조명" /></label>

          <div className="tab-strip small">
            {(Object.keys(VARIANT_LABELS) as PromptVariant[]).map(variant => (
              <button key={variant} className={variantTab === variant ? 'active' : ''} onClick={() => setVariantTab(variant)}>{VARIANT_LABELS[variant]}</button>
            ))}
          </div>
          <pre className="prompt-preview">{prompts[variantTab]}</pre>
          <button className="secondary" onClick={() => void copyPrompt(variantTab)}><ClipboardCopy size={16} /> 복사</button>
          <p className="supporting">이미지에는 문구를 절대 굽지 않습니다. 생성된 배경을 업로드 탭에 저장한 뒤, 문구는 다음 스텝에서 캔버스로 합성하세요.</p>
        </div>
      )}

      {message && <p className="supporting step-message">{message}</p>}
    </div>
  );
}
