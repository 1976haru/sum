import { useEffect, useState } from 'react';
import type { DragEvent } from 'react';
import { ClipboardCopy, ImagePlus, Trash2, UploadCloud, Wand2 } from 'lucide-react';
import type { AIImageSettings, AspectKind, BackgroundImage, LocationPresetId, PromptVariant, SeasonPresetId, TextZone, TimePresetId } from '../../types';
import { LOCATION_PRESETS, NEGATIVE_PROMPT, SEASON_PRESETS, TIME_PRESETS, buildPromptVariants } from '../../lib/promptBuilder';

interface BackgroundStepProps {
  images: BackgroundImage[];
  onImagesChange: (images: BackgroundImage[]) => void;
  textZone: TextZone;
  aspect: AspectKind;
}

type SourceTab = 'upload' | 'ai' | 'prompt';

const VARIANT_LABELS: Record<PromptVariant, string> = { generic: 'Generic (ChatGPT·DALL-E)', midjourney: 'Midjourney', qwen: 'Qwen' };

function imageFileName(name: string) {
  return /\.(png|jpe?g|webp)$/i.test(name);
}

export default function BackgroundStep({ images, onImagesChange, textZone, aspect }: BackgroundStepProps) {
  const [tab, setTab] = useState<SourceTab>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [aiSettings, setAiSettings] = useState<(AIImageSettings & { hasQwenKey: boolean; hasGeminiKey: boolean }) | null>(null);

  const [locationId, setLocationId] = useState<LocationPresetId>('rome');
  const [seasonId, setSeasonId] = useState<SeasonPresetId>('winter');
  const [timeId, setTimeId] = useState<TimePresetId>('golden-hour');
  const [extra, setExtra] = useState('');
  const [variantTab, setVariantTab] = useState<PromptVariant>('generic');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { void window.sumAPI.loadAISettings().then(setAiSettings); }, []);

  const aiReady = Boolean(aiSettings && (aiSettings.provider === 'gemini' ? aiSettings.hasGeminiKey : aiSettings.hasQwenKey));
  const prompts = buildPromptVariants({ locationId, seasonId, timeId, textZone, aspect, extra });

  async function addFiles(files: Array<{ path: string; name: string }>) {
    const valid = files.filter(f => f.path && imageFileName(f.name)).slice(0, 60);
    if (!valid.length) return;
    const loaded = await Promise.all(valid.map(async file => ({ ...file, dataUrl: await window.sumAPI.readImage(file.path) })));
    onImagesChange([...loaded, ...images]);
  }

  async function pickViaDialog() {
    const picked = await window.sumAPI.pickImages();
    await addFiles(picked);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    const files = Array.from(event.dataTransfer?.files || [])
      .map(file => ({ path: (file as File & { path?: string }).path || '', name: file.name }));
    void addFiles(files);
  }

  function removeImage(path: string) {
    onImagesChange(images.filter(image => image.path !== path));
  }

  function selectAsCurrent(path: string) {
    const target = images.find(image => image.path === path);
    if (!target) return;
    onImagesChange([target, ...images.filter(image => image.path !== path)]);
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
      onImagesChange([{ path: `ai://${Date.now()}`, name: `AI 배경 ${images.length + 1}`, dataUrl }, ...images]);
      setMessage('AI 배경을 생성해 목록 맨 앞에 추가했습니다.');
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
          <label>추가 지시(선택)<input value={extra} onChange={event => setExtra(event.target.value)} placeholder="예: 창가 자리, 따뜻한 조명" /></label>
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
          <label>추가 지시(선택)<input value={extra} onChange={event => setExtra(event.target.value)} placeholder="예: 창가 자리, 따뜻한 조명" /></label>

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
