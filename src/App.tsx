import { useEffect, useMemo, useState } from 'react';
import { Clapperboard, Coffee, LayoutGrid } from 'lucide-react';
import VideoStudio from './components/VideoStudio';
import Sidebar from './components/Sidebar';
import PreviewPanel from './components/PreviewPanel';
import SettingsScreen from './components/SettingsScreen';
import StepShell from './components/steps/StepShell';
import BackgroundStep from './components/steps/BackgroundStep';
import CaptionStep from './components/steps/CaptionStep';
import StyleStep from './components/steps/StyleStep';
import ExportStep from './components/steps/ExportStep';
import { defaultSubline } from './lib/headlines';
import { defaultCoverConfig } from './lib/cover';
import { normalizeFontStyleId } from './lib/fonts';
import type { AIImageSettings, AspectKind, BackgroundImage, ChannelBrandTemplate, ChannelPresetId, Language, ProjectConfig } from './types';

const DEFAULT_CONFIG: ProjectConfig = {
  projectName: 'Winter_Cafe_Playlist',
  channelPreset: 'light-pop-lounge',
  language: 'ko',
  season: '겨울',
  mood: '밝고 따뜻한 카페',
  headline: '문득, 그날이 떠올랐다',
  subline: '카페에서 듣기 좋은 감성 팝 플레이리스트',
  textZone: 'left-third',
  layout: 'editorial',
  background: '#f4ead8',
  accent: '#b4833f',
  textColor: '#17304f',
  overlayStrength: 0.72,
  fontStyle: 'serif-thin',
  autoTextColor: true,
  brandLine: 'P L A Y L I S T',
  showBadge: true,
  showDivider: true,
  showSubline: true
};

type View = 'studio' | 'video' | 'settings';

export default function App() {
  const [view, setView] = useState<View>('studio');
  const [config, setConfig] = useState<ProjectConfig>(DEFAULT_CONFIG);
  const [images, setImages] = useState<BackgroundImage[]>([]);
  // 파트E: 커버 문구는 releaseTitle 파생값이 기본이다. 분리 편집은 명시적으로 체크해야만 가능하다.
  const [releaseTitle, setReleaseTitle] = useState('그날, 로마에서');
  const [artistName, setArtistName] = useState('');
  const [coverHeadlineOverride, setCoverHeadlineOverride] = useState(false);
  const [coverHeadlineOverrideValue, setCoverHeadlineOverrideValue] = useState('');
  const coverHeadline = coverHeadlineOverride ? coverHeadlineOverrideValue : releaseTitle;
  const [outputDir, setOutputDir] = useState('');
  const [thumbnailPath, setThumbnailPath] = useState('');
  const [expandedStep, setExpandedStep] = useState(0);
  const [exported, setExported] = useState(false);
  const [aiSettings, setAiSettings] = useState<(AIImageSettings & { hasQwenKey?: boolean; hasGeminiKey?: boolean }) | null>(null);
  const [aspect, setAspect] = useState<AspectKind>('16x9');
  const [backgroundExtra, setBackgroundExtra] = useState('');
  // 체크리스트 F열(곡수목표) — ExportStep에 갇혀 있던 체크리스트 상태 전체를 끌어올리는 대신,
  // VideoStudio가 실제로 필요한 이 값 하나만 세트 적용 시점에 끌어올린다.
  const [trackTarget, setTrackTarget] = useState('');

  const channelLabel = useMemo(() => {
    if (config.channelPreset === 'morning-showa-cafe') return '아침의쇼와카페';
    if (config.channelPreset === 'custom') return 'Custom';
    return '굿모닝추억라디오';
  }, [config.channelPreset]);

  function patchConfig(patch: Partial<ProjectConfig>) {
    setConfig(current => ({ ...current, ...patch }));
  }

  function refreshAiSettings() {
    void window.sumAPI.loadAISettings().then(setAiSettings);
  }
  useEffect(refreshAiSettings, []);
  const aiReady = Boolean(aiSettings && (aiSettings.provider === 'gemini' ? aiSettings.hasGeminiKey : aiSettings.hasQwenKey));

  function changePreset(value: ChannelPresetId) {
    const language: Language = value === 'morning-showa-cafe' ? 'ja' : value === 'light-pop-lounge' ? 'ko' : config.language;
    setConfig(current => ({
      ...current,
      channelPreset: value,
      language,
      subline: defaultSubline(language, value),
      headline: language === 'ja' ? 'ふと、あの日を思い出す' : language === 'ko' ? '문득, 그날이 떠올랐다' : 'Some Days Stay With Us'
    }));
  }

  // 파트D: 채널을 바꾸면 저장된 브랜드 템플릿을 자동으로 적용해 동일 톤을 유지한다.
  useEffect(() => {
    let cancelled = false;
    void window.sumAPI.loadBrandTemplates().then((templates: ChannelBrandTemplate[]) => {
      if (cancelled) return;
      const match = templates.find(item => item.channelPreset === config.channelPreset);
      if (!match) return;
      setConfig(current => ({
        ...current,
        // Phase 1-1의 textBox 누락 재발을 막기 위한 체크리스트: StyleStep의 수동 불러오기와
        // 여기(채널 전환 자동 적용) 양쪽 모두 같은 필드 목록을 갖고 있어야 한다.
        fontStyle: normalizeFontStyleId(match.fontStyle),
        letterSpacing: match.letterSpacing,
        lineHeightRatio: match.lineHeightRatio,
        textColor: match.textColor,
        accent: match.accent,
        overlayStrength: match.overlayStrength,
        autoTextColor: match.autoTextColor,
        textZone: match.textZone,
        textBox: match.textBox,
        subline: match.subline,
        brandLine: match.brandLine,
        showBadge: match.showBadge,
        showDivider: match.showDivider,
        showSubline: match.showSubline
      }));
      if (match.artistName) setArtistName(match.artistName);
    });
    return () => { cancelled = true; };
  }, [config.channelPreset]);

  const coverBase = useMemo(() => defaultCoverConfig(config), [config]);

  const stepComplete = [images.length > 0, config.headline.trim().length > 0, images.length > 0 && config.headline.trim().length > 0, exported];

  if (view === 'settings') {
    return (
      <main className="app-shell">
        <SettingsScreen onBack={() => setView('studio')} onSaved={refreshAiSettings} />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand"><div className="brand-mark"><Coffee size={24} /></div><div><span>Sound · Thumbnail · Movie</span><h1>SUM Playlist Studio</h1></div></div>
        <div className="channel-pill">{channelLabel}</div>
      </header>

      <section className="project-bar panel">
        <div className="project-field wide"><label>프로젝트 이름</label><input value={config.projectName} onChange={event => patchConfig({ projectName: event.target.value })} /></div>
        <div className="project-field"><label>계절</label><input value={config.season} onChange={event => patchConfig({ season: event.target.value })} /></div>
        <div className="project-field wide"><label>분위기</label><input value={config.mood} onChange={event => patchConfig({ mood: event.target.value })} /></div>
      </section>

      <nav className="main-tabs">
        <button className={view === 'studio' ? 'active' : ''} onClick={() => setView('studio')}><LayoutGrid size={18} /> 썸네일·커버 스튜디오</button>
        <button className={view === 'video' ? 'active' : ''} onClick={() => setView('video')}><Clapperboard size={18} /> 영상·CapCut 자동화</button>
        <span>로컬 처리</span>
      </nav>

      {view === 'video' && (
        <VideoStudio projectName={config.projectName} outputDir={outputDir} onOutputDirChange={setOutputDir} thumbnailPath={thumbnailPath} onThumbnailPathChange={setThumbnailPath} trackTarget={trackTarget} />
      )}

      {view === 'studio' && (
        <div className="studio-shell">
          <Sidebar config={config} onChannelChange={changePreset} onOpenSettings={() => setView('settings')} aiReady={aiReady} />

          <div className="studio-steps">
            <StepShell index={1} title="배경 이미지" subtitle="내 사진 · AI 생성 · 프롬프트 복사" complete={stepComplete[0]} expanded={expandedStep === 0} onToggle={() => setExpandedStep(current => current === 0 ? -1 : 0)}>
              <BackgroundStep images={images} onImagesChange={setImages} textZone={config.textZone} aspect={aspect} extra={backgroundExtra} onExtraChange={setBackgroundExtra} />
            </StepShell>

            <StepShell index={2} title="문구" subtitle="메인 제목 · 부제 · 커버 문구" complete={stepComplete[1]} expanded={expandedStep === 1} onToggle={() => setExpandedStep(current => current === 1 ? -1 : 1)}>
              <CaptionStep
                language={config.language}
                onLanguageChange={language => patchConfig({ language, subline: defaultSubline(language, config.channelPreset) })}
                headline={config.headline}
                onHeadlineChange={headline => patchConfig({ headline })}
                subline={config.subline}
                onSublineChange={subline => patchConfig({ subline })}
                brandLine={config.brandLine}
                onBrandLineChange={brandLine => patchConfig({ brandLine })}
                releaseTitle={releaseTitle}
                onReleaseTitleChange={setReleaseTitle}
                artistName={artistName}
                onArtistNameChange={setArtistName}
                coverHeadlineOverride={coverHeadlineOverride}
                onCoverHeadlineOverrideChange={override => {
                  setCoverHeadlineOverride(override);
                  if (override) setCoverHeadlineOverrideValue(current => current || releaseTitle);
                }}
                coverHeadlineOverrideValue={coverHeadlineOverrideValue}
                onCoverHeadlineOverrideValueChange={setCoverHeadlineOverrideValue}
              />
            </StepShell>

            <StepShell index={3} title="스타일 조정" subtitle="채널 브랜드 템플릿" complete={stepComplete[2]} expanded={expandedStep === 2} onToggle={() => setExpandedStep(current => current === 2 ? -1 : 2)}>
              <StyleStep config={config} onConfigChange={patchConfig} artistName={artistName} onArtistNameChange={setArtistName} />
            </StepShell>

            <StepShell index={4} title="내보내기" subtitle="단일 저장 · 세트 일괄 생성" complete={stepComplete[3]} expanded={expandedStep === 3} onToggle={() => setExpandedStep(current => current === 3 ? -1 : 3)}>
              <ExportStep
                config={config}
                coverBase={coverBase}
                coverHeadline={coverHeadline}
                releaseTitle={releaseTitle}
                artistName={artistName}
                images={images}
                outputDir={outputDir}
                onOutputDirChange={setOutputDir}
                channelLabel={channelLabel}
                onExported={() => setExported(true)}
                onApplyChecklistSet={patch => {
                  patchConfig({ projectName: patch.projectName, season: patch.season });
                  setBackgroundExtra(patch.backgroundExtra);
                  setTrackTarget(patch.trackTarget);
                }}
              />
            </StepShell>
          </div>

          <PreviewPanel aspect={aspect} onAspectChange={setAspect} config={config} coverBase={coverBase} coverHeadline={coverHeadline} image={images[0]} onTextBoxCommit={patchConfig} />
        </div>
      )}
    </main>
  );
}
