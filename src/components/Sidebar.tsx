import { Coffee, Settings2, Sparkles } from 'lucide-react';
import type { ChannelPresetId, ProjectConfig } from '../types';

interface SidebarProps {
  config: ProjectConfig;
  onChannelChange: (value: ChannelPresetId) => void;
  onOpenSettings: () => void;
  aiReady: boolean;
}

export default function Sidebar({ config, onChannelChange, onOpenSettings, aiReady }: SidebarProps) {
  return (
    <nav className="sidebar panel">
      <div className="sidebar-brand"><Coffee size={20} /> SUM Studio</div>

      <label>채널<select value={config.channelPreset} onChange={event => onChannelChange(event.target.value as ChannelPresetId)}>
        <option value="light-pop-lounge">굿모닝 추억라디오</option>
        <option value="morning-showa-cafe">아침의 쇼와 카페</option>
        <option value="custom">직접 설정</option>
      </select></label>

      <div className={aiReady ? 'ai-badge ready' : 'ai-badge'}><Sparkles size={14} /> {aiReady ? '이미지 생성 준비됨' : '이미지 생성 키 없음'}</div>

      <button className="secondary sidebar-settings" onClick={onOpenSettings}><Settings2 size={16} /> 설정(이미지 생성 키)</button>
    </nav>
  );
}
