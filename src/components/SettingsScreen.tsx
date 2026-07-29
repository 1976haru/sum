import { useEffect, useState } from 'react';
import { ArrowLeft, KeyRound, Sparkles } from 'lucide-react';
import type { AIImageSettings, AIProvider, AIRegion } from '../types';

interface SettingsScreenProps {
  onBack: () => void;
  onSaved: () => void;
}

const QWEN_MODELS = ['qwen-image-2.0-pro', 'qwen-image-2.0', 'qwen-image-plus', 'qwen-image-max'];
const GEMINI_MODELS = ['gemini-3.1-flash-image', 'gemini-3.1-flash-lite-image', 'gemini-3-pro-image'];

const DEFAULTS: AIImageSettings = {
  provider: 'qwen',
  qwenApiKey: '', qwenWorkspaceId: '', qwenRegion: 'singapore', qwenModel: QWEN_MODELS[0],
  geminiApiKey: '', geminiModel: GEMINI_MODELS[0]
};

// 파트F 설정 화면: Qwen·Gemini 키는 로컬(Electron userData)에만 암호화 저장되고, 화면에는 항상 마스킹되어 노출된다.
export default function SettingsScreen({ onBack, onSaved }: SettingsScreenProps) {
  const [settings, setSettings] = useState<AIImageSettings & { hasQwenKey?: boolean; hasGeminiKey?: boolean }>(DEFAULTS);
  const [status, setStatus] = useState('');

  useEffect(() => { void window.sumAPI.loadAISettings().then(setSettings); }, []);

  const ready = settings.provider === 'gemini' ? settings.hasGeminiKey : settings.hasQwenKey;

  async function save() {
    setStatus('저장 중...');
    await window.sumAPI.saveAISettings(settings);
    const reloaded = await window.sumAPI.loadAISettings();
    setSettings(reloaded);
    setStatus('저장했습니다.');
    onSaved();
  }

  return (
    <section className="settings-screen panel">
      <div className="panel-heading">
        <button className="secondary" onClick={onBack}><ArrowLeft size={16} /> 스튜디오로</button>
        <div className={ready ? 'ai-badge ready' : 'ai-badge'}><Sparkles size={14} /> {ready ? '이미지 생성 준비됨' : '이미지 생성 키 없음'}</div>
      </div>

      <h2>이미지 생성 API 키</h2>
      <p className="supporting">둘 다 선택 사항입니다. 키를 설정하지 않으면 배경 스텝의 "프롬프트만 복사" 경로로 자동 폴백합니다. 키는 로컬에만 저장되며 화면·로그에 원문이 노출되지 않습니다.</p>

      <div className="field-grid">
        <label className="checkbox-row"><input type="radio" name="ai-provider" checked={settings.provider === 'qwen'} onChange={() => setSettings(current => ({ ...current, provider: 'qwen' as AIProvider }))} /> 기본 공급자: Qwen</label>
        <label className="checkbox-row"><input type="radio" name="ai-provider" checked={settings.provider === 'gemini'} onChange={() => setSettings(current => ({ ...current, provider: 'gemini' as AIProvider }))} /> 기본 공급자: Gemini</label>
      </div>

      <h3>Qwen (Alibaba Model Studio)</h3>
      <label>API 키<input type="password" value={settings.qwenApiKey} onChange={event => setSettings(current => ({ ...current, qwenApiKey: event.target.value }))} placeholder="sk-xxxxxxxx" /></label>
      <label>워크스페이스 ID<input value={settings.qwenWorkspaceId} onChange={event => setSettings(current => ({ ...current, qwenWorkspaceId: event.target.value }))} placeholder="Model Studio 콘솔의 Workspace ID" /></label>
      <div className="field-grid">
        <label>리전<select value={settings.qwenRegion} onChange={event => setSettings(current => ({ ...current, qwenRegion: event.target.value as AIRegion }))}>
          <option value="singapore">싱가포르(기본)</option>
          <option value="beijing">베이징</option>
        </select></label>
        <label>모델<select value={settings.qwenModel} onChange={event => setSettings(current => ({ ...current, qwenModel: event.target.value }))}>
          {QWEN_MODELS.map(model => <option key={model} value={model}>{model}</option>)}
        </select></label>
      </div>

      <h3 className="section-gap">Gemini</h3>
      <label>API 키<input type="password" value={settings.geminiApiKey} onChange={event => setSettings(current => ({ ...current, geminiApiKey: event.target.value }))} placeholder="AIza..." /></label>
      <label>모델<select value={settings.geminiModel} onChange={event => setSettings(current => ({ ...current, geminiModel: event.target.value }))}>
        {GEMINI_MODELS.map(model => <option key={model} value={model}>{model}</option>)}
      </select></label>

      <div className="action-row">
        <button className="primary" onClick={() => void save()}><KeyRound size={16} /> 저장</button>
      </div>
      {status && <p className="supporting">{status}</p>}
      <p className="supporting">엔드포인트·모델 ID·단가는 각 공급자 공식 문서 기준(2026-07 확인)이며 수시로 바뀔 수 있으니 콘솔에서 최신 정보를 확인하세요.</p>
    </section>
  );
}
