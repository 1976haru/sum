import { useMemo, useState } from 'react';
import { Clapperboard, Coffee, Image, Settings2 } from 'lucide-react';
import ThumbnailStudio from './components/ThumbnailStudio';
import VideoStudio from './components/VideoStudio';
import { defaultSubline } from './lib/headlines';
import type { ChannelPresetId, Language, ProjectConfig } from './types';

const DEFAULT_CONFIG: ProjectConfig = {
  projectName: 'Winter_Cafe_Playlist',
  channelPreset: 'light-pop-lounge',
  language: 'ko',
  season: '겨울',
  mood: '밝고 따뜻한 카페',
  headline: '문득, 그날이 떠올랐다',
  subline: '카페에서 듣기 좋은 감성 팝 플레이리스트',
  textSide: 'left',
  layout: 'editorial',
  background: '#f4ead8',
  accent: '#b4833f',
  textColor: '#17304f',
  overlayStrength: 0.72
};

export default function App() {
  const [tab, setTab] = useState<'thumbnail' | 'video'>('thumbnail');
  const [config, setConfig] = useState<ProjectConfig>(DEFAULT_CONFIG);
  const [outputDir, setOutputDir] = useState('');
  const [thumbnailPath, setThumbnailPath] = useState('');

  const channelLabel = useMemo(() => {
    if (config.channelPreset === 'morning-showa-cafe') return 'Morning Showa Café';
    if (config.channelPreset === 'custom') return 'Custom Channel';
    return 'Light Pop Lounge';
  }, [config.channelPreset]);

  function patchConfig(patch: Partial<ProjectConfig>) {
    setConfig(current => ({ ...current, ...patch }));
  }

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

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand"><div className="brand-mark"><Coffee size={24} /></div><div><span>Sound · Thumbnail · Movie</span><h1>SUM Playlist Studio</h1></div></div>
        <div className="channel-pill">{channelLabel}</div>
      </header>

      <section className="project-bar panel">
        <div className="project-field wide"><label>프로젝트 이름</label><input value={config.projectName} onChange={event => patchConfig({ projectName: event.target.value })} /></div>
        <div className="project-field"><label>채널</label><select value={config.channelPreset} onChange={event => changePreset(event.target.value as ChannelPresetId)}><option value="light-pop-lounge">Light Pop Lounge</option><option value="morning-showa-cafe">Morning Showa Café</option><option value="custom">직접 설정</option></select></div>
        <div className="project-field"><label>언어</label><select value={config.language} onChange={event => { const language = event.target.value as Language; patchConfig({ language, subline: defaultSubline(language, config.channelPreset) }); }}><option value="ko">한국어</option><option value="ja">日本語</option><option value="en">English</option></select></div>
        <div className="project-field"><label>계절</label><input value={config.season} onChange={event => patchConfig({ season: event.target.value })} /></div>
        <div className="project-field wide"><label>분위기</label><input value={config.mood} onChange={event => patchConfig({ mood: event.target.value })} /></div>
        <div className="palette-fields"><label title="제목 색"><input type="color" value={config.textColor} onChange={event => patchConfig({ textColor: event.target.value })} /></label><label title="포인트 색"><input type="color" value={config.accent} onChange={event => patchConfig({ accent: event.target.value })} /></label></div>
      </section>

      <nav className="main-tabs">
        <button className={tab === 'thumbnail' ? 'active' : ''} onClick={() => setTab('thumbnail')}><Image size={18} /> 썸네일 자동생성</button>
        <button className={tab === 'video' ? 'active' : ''} onClick={() => setTab('video')}><Clapperboard size={18} /> 영상·CapCut 자동화</button>
        <span><Settings2 size={16} /> 로컬 처리 · API 불필요</span>
      </nav>

      {tab === 'thumbnail' ? (
        <ThumbnailStudio config={config} onConfigChange={patchConfig} outputDir={outputDir} onOutputDirChange={setOutputDir} onThumbnailSaved={setThumbnailPath} />
      ) : (
        <VideoStudio projectName={config.projectName} outputDir={outputDir} onOutputDirChange={setOutputDir} thumbnailPath={thumbnailPath} onThumbnailPathChange={setThumbnailPath} />
      )}
    </main>
  );
}
