import { useEffect, useState } from 'react';
import { Save, Trash2, Upload } from 'lucide-react';
import type { ChannelBrandTemplate, FontStyleId, ProjectConfig, TextZone } from '../../types';

interface StyleStepProps {
  config: ProjectConfig;
  onConfigChange: (patch: Partial<ProjectConfig>) => void;
}

const TEXT_ZONE_LABELS: Record<TextZone, string> = { 'left-third': '좌측 1/3', 'top-center': '상단 중앙', center: '중앙' };

function templateFromConfig(config: ProjectConfig): ChannelBrandTemplate {
  return {
    channelPreset: config.channelPreset,
    fontStyle: config.fontStyle,
    textColor: config.textColor,
    accent: config.accent,
    overlayStrength: config.overlayStrength,
    autoTextColor: config.autoTextColor,
    textZone: config.textZone,
    subline: config.subline,
    brandLine: config.brandLine,
    showBadge: config.showBadge,
    showDivider: config.showDivider,
    showSubline: config.showSubline,
    updatedAt: new Date().toISOString()
  };
}

// 스텝③ 스타일 조정 + 채널 브랜드 템플릿 저장. 저장하지 않고 값만 바꾸면 "이번만 다르게" 1회 오버라이드가 된다.
export default function StyleStep({ config, onConfigChange }: StyleStepProps) {
  const [templates, setTemplates] = useState<ChannelBrandTemplate[]>([]);
  const [status, setStatus] = useState('');

  useEffect(() => { void window.sumAPI.loadBrandTemplates().then(setTemplates); }, []);
  const current = templates.find(item => item.channelPreset === config.channelPreset);

  function applyTemplate(template: ChannelBrandTemplate) {
    onConfigChange({
      fontStyle: template.fontStyle,
      textColor: template.textColor,
      accent: template.accent,
      overlayStrength: template.overlayStrength,
      autoTextColor: template.autoTextColor,
      textZone: template.textZone,
      subline: template.subline,
      brandLine: template.brandLine,
      showBadge: template.showBadge,
      showDivider: template.showDivider,
      showSubline: template.showSubline
    });
    setStatus(`"${template.channelPreset}" 템플릿을 불러왔습니다.`);
  }

  async function saveTemplate() {
    const list = await window.sumAPI.saveBrandTemplate(templateFromConfig(config));
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
          <option value="serif-thin">얇은 한글 세리프(기본)</option>
          <option value="serif-bold">굵은 세리프</option>
          <option value="gothic">고딕</option>
        </select></label>
        <label>텍스트 위치<select value={config.textZone} onChange={event => onConfigChange({ textZone: event.target.value as TextZone })}>
          {Object.entries(TEXT_ZONE_LABELS).map(([zone, label]) => <option key={zone} value={zone}>{label}</option>)}
        </select></label>
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

      <div className="action-row">
        <button className="secondary" onClick={() => current && applyTemplate(current)} disabled={!current}><Upload size={16} /> 템플릿 불러오기</button>
        <button className="primary" onClick={() => void saveTemplate()}><Save size={16} /> 이 채널 템플릿으로 저장</button>
        <button className="secondary" onClick={() => void deleteTemplate()} disabled={!current}><Trash2 size={16} /> 삭제</button>
      </div>
      {status && <p className="supporting">{status}</p>}
    </div>
  );
}
