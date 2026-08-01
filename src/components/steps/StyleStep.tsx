import { useEffect, useState } from 'react';
import { Save, Trash2, Upload } from 'lucide-react';
import { normalizeFontStyleId } from '../../lib/fonts';
import type { ChannelBrandTemplate, FontStyleId, ProjectConfig, TextZone } from '../../types';

const FONT_STYLE_LABELS: Record<FontStyleId, string> = {
  'serif-thin': '얇은 한글 세리프(기본)',
  'serif-regular': '보통 세리프',
  'serif-bold': '굵은 세리프',
  'gothic-regular': '고딕 보통',
  'gothic-bold': '고딕 굵게'
};

interface StyleStepProps {
  config: ProjectConfig;
  onConfigChange: (patch: Partial<ProjectConfig>) => void;
  artistName: string;
  onArtistNameChange: (value: string) => void;
}

const TEXT_ZONE_LABELS: Record<TextZone, string> = { 'left-third': '좌측 1/3', 'top-center': '상단 중앙', center: '중앙' };

function templateFromConfig(config: ProjectConfig, artistName: string): ChannelBrandTemplate {
  return {
    channelPreset: config.channelPreset,
    fontStyle: config.fontStyle,
    letterSpacing: config.letterSpacing,
    lineHeightRatio: config.lineHeightRatio,
    textColor: config.textColor,
    accent: config.accent,
    overlayStrength: config.overlayStrength,
    autoTextColor: config.autoTextColor,
    textZone: config.textZone,
    textBox: config.textBox,
    subline: config.subline,
    brandLine: config.brandLine,
    artistName,
    showBadge: config.showBadge,
    showDivider: config.showDivider,
    showSubline: config.showSubline,
    channelGreeting: config.channelGreeting,
    channelFooter: config.channelFooter,
    updatedAt: new Date().toISOString()
  };
}

// 스텝③ 스타일 조정 + 채널 브랜드 템플릿 저장. 저장하지 않고 값만 바꾸면 "이번만 다르게" 1회 오버라이드가 된다.
export default function StyleStep({ config, onConfigChange, artistName, onArtistNameChange }: StyleStepProps) {
  const [templates, setTemplates] = useState<ChannelBrandTemplate[]>([]);
  const [status, setStatus] = useState('');

  useEffect(() => { void window.sumAPI.loadBrandTemplates().then(setTemplates); }, []);
  const current = templates.find(item => item.channelPreset === config.channelPreset);

  function applyTemplate(template: ChannelBrandTemplate) {
    onConfigChange({
      // Phase 1-1에서 textBox가 이 경로에서 누락됐던 실수를 반복하지 않도록: 여기(수동 불러오기)와
      // App.tsx의 채널 자동 적용 useEffect 양쪽 모두에 신규 필드를 넣는다. 구 fontStyle('gothic')도
      // 여기서 정규화해 <select>가 항상 유효한 값을 갖게 한다.
      fontStyle: normalizeFontStyleId(template.fontStyle),
      letterSpacing: template.letterSpacing,
      lineHeightRatio: template.lineHeightRatio,
      textColor: template.textColor,
      accent: template.accent,
      overlayStrength: template.overlayStrength,
      autoTextColor: template.autoTextColor,
      textZone: template.textZone,
      textBox: template.textBox,
      subline: template.subline,
      brandLine: template.brandLine,
      showBadge: template.showBadge,
      showDivider: template.showDivider,
      showSubline: template.showSubline,
      channelGreeting: template.channelGreeting,
      channelFooter: template.channelFooter
    });
    if (template.artistName) onArtistNameChange(template.artistName);
    setStatus(`"${template.channelPreset}" 템플릿을 불러왔습니다.`);
  }

  async function saveTemplate() {
    const list = await window.sumAPI.saveBrandTemplate(templateFromConfig(config, artistName));
    setTemplates(list);
    setStatus('현재 설정을 채널 템플릿으로 저장했습니다. 앱을 다시 실행해도 유지됩니다.');
  }

  async function deleteTemplate() {
    const list = await window.sumAPI.deleteBrandTemplate(config.channelPreset);
    setTemplates(list);
    setStatus('템플릿을 삭제했습니다.');
  }

  return (
    <div className="style-step">
      <p className="supporting">{current ? `이 채널 템플릿 저장됨: ${new Date(current.updatedAt).toLocaleString()}` : '이 채널에는 아직 저장된 템플릿이 없습니다.'}</p>

      <div className="field-grid">
        <label>폰트<select value={config.fontStyle} onChange={event => onConfigChange({ fontStyle: event.target.value as FontStyleId })}>
          {(Object.entries(FONT_STYLE_LABELS) as Array<[FontStyleId, string]>).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select></label>
        <label>텍스트 위치<select value={config.textZone} onChange={event => onConfigChange({ textZone: event.target.value as TextZone })}>
          {Object.entries(TEXT_ZONE_LABELS).map(([zone, label]) => <option key={zone} value={zone}>{label}</option>)}
        </select></label>
      </div>
      {config.textBox && (
        <p className="supporting">
          <span className="textbox-custom-badge">직접 조정됨</span> 미리보기에서 드래그로 위치를 직접 잡았습니다 — 위 프리셋 선택은 무시됩니다.
          <button type="button" className="secondary" onClick={() => onConfigChange({ textBox: undefined })}>프리셋으로 되돌리기</button>
        </p>
      )}

      <div className="field-grid">
        <label>자간<input type="range" min="-0.05" max="0.3" step="0.01" value={config.letterSpacing ?? 0} onChange={event => onConfigChange({ letterSpacing: Number(event.target.value) })} /> {(config.letterSpacing ?? 0).toFixed(2)}em</label>
        <label>줄 간격<input type="range" min="1" max="2" step="0.02" value={config.lineHeightRatio ?? 1.28} onChange={event => onConfigChange({ lineHeightRatio: Number(event.target.value) })} /> ×{(config.lineHeightRatio ?? 1.28).toFixed(2)}</label>
      </div>

      <div className="field-grid">
        <label>글자 색<input type="color" value={config.textColor} onChange={event => onConfigChange({ textColor: event.target.value })} /></label>
        <label>포인트 색<input type="color" value={config.accent} onChange={event => onConfigChange({ accent: event.target.value })} /></label>
      </div>
      <label className="checkbox-row"><input type="checkbox" checked={config.autoTextColor} onChange={event => onConfigChange({ autoTextColor: event.target.checked })} /> 배경 밝기에 따라 글자색 자동 전환</label>
      <label>스크림(반투명 판) 강도<input type="range" min="0.25" max="0.9" step="0.05" value={config.overlayStrength} onChange={event => onConfigChange({ overlayStrength: Number(event.target.value) })} /></label>

      <div className="field-grid">
        <label className="checkbox-row"><input type="checkbox" checked={config.showDivider} onChange={event => onConfigChange({ showDivider: event.target.checked })} /> 가는 구분선 표시</label>
        <label className="checkbox-row"><input type="checkbox" checked={config.showSubline} onChange={event => onConfigChange({ showSubline: event.target.checked })} /> 부제 표시</label>
      </div>
      <label className="checkbox-row"><input type="checkbox" checked={config.showBadge} onChange={event => onConfigChange({ showBadge: event.target.checked })} /> 하단 브랜드 배지 표시</label>

      <h3 className="section-gap">설명문 고정 문구</h3>
      <p className="supporting">영상·CapCut 탭의 description.txt 조립에 쓰입니다. 채널 템플릿으로 저장하면 이 채널로 전환할 때마다 자동 적용됩니다.</p>
      <label>인사말 / 채널 소개<textarea rows={3} value={config.channelGreeting} onChange={event => onConfigChange({ channelGreeting: event.target.value })} placeholder="채널을 찾아주셔서 감사합니다..." /></label>
      <label>고정 푸터(저작권/AI 생성 고지 등)<textarea rows={3} value={config.channelFooter} onChange={event => onConfigChange({ channelFooter: event.target.value })} placeholder="ⓒ ... / 이 영상은 AI로 생성된 이미지를 포함합니다." /></label>

      <div className="action-row">
        <button className="secondary" onClick={() => current && applyTemplate(current)} disabled={!current}><Upload size={16} /> 템플릿 불러오기</button>
        <button className="primary" onClick={() => void saveTemplate()}><Save size={16} /> 이 채널 템플릿으로 저장</button>
        <button className="secondary" onClick={() => void deleteTemplate()} disabled={!current}><Trash2 size={16} /> 삭제</button>
      </div>
      {status && <p className="supporting">{status}</p>}
    </div>
  );
}
