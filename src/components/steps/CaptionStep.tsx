import { useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, Sparkles } from 'lucide-react';
import type { Language } from '../../types';
import { HEADLINE_STYLE_LABELS, shortHeadlineSuggestions, styledHeadlineSuggestions } from '../../lib/headlines';

interface CaptionStepProps {
  language: Language;
  onLanguageChange: (language: Language) => void;
  headline: string;
  onHeadlineChange: (value: string) => void;
  subline: string;
  onSublineChange: (value: string) => void;
  brandLine: string;
  onBrandLineChange: (value: string) => void;
  releaseTitle: string;
  onReleaseTitleChange: (value: string) => void;
  artistName: string;
  onArtistNameChange: (value: string) => void;
  coverHeadlineOverride: boolean;
  onCoverHeadlineOverrideChange: (value: boolean) => void;
  coverHeadlineOverrideValue: string;
  onCoverHeadlineOverrideValueChange: (value: string) => void;
}

function countChars(text: string) {
  return text.replace(/\s+/g, '').length;
}

export default function CaptionStep({
  language, onLanguageChange,
  headline, onHeadlineChange, subline, onSublineChange, brandLine, onBrandLineChange,
  releaseTitle, onReleaseTitleChange, artistName, onArtistNameChange,
  coverHeadlineOverride, onCoverHeadlineOverrideChange, coverHeadlineOverrideValue, onCoverHeadlineOverrideValueChange
}: CaptionStepProps) {
  const [seed, setSeed] = useState(0);
  const suggestions = useMemo(() => styledHeadlineSuggestions(language, seed), [language, seed]);
  const shortSuggestions = useMemo(() => shortHeadlineSuggestions(language), [language]);
  const headlineLen = countChars(headline);
  const sublineLen = countChars(subline);

  return (
    <div className="caption-step">
      <div className="field-grid">
        <label>언어<select value={language} onChange={event => onLanguageChange(event.target.value as Language)}>
          <option value="ko">한국어</option>
          <option value="ja">日本語</option>
          <option value="en">English</option>
        </select></label>
      </div>

      <label>메인 제목(6~10자 권장)<input value={headline} maxLength={32} onChange={event => onHeadlineChange(event.target.value)} /></label>
      <p className={headlineLen >= 6 && headlineLen <= 10 ? 'length-hint ok' : 'length-hint warn'}>현재 {headlineLen}자 — 과장된 클릭베이트 표현은 피해주세요.</p>

      <label>부제(8~14자 권장)<input value={subline} maxLength={46} onChange={event => onSublineChange(event.target.value)} /></label>
      <p className={sublineLen >= 8 && sublineLen <= 14 ? 'length-hint ok' : 'length-hint warn'}>현재 {sublineLen}자</p>

      <label>하단 브랜드 라인(선택)<input value={brandLine} onChange={event => onBrandLineChange(event.target.value)} placeholder="예: ROMA PLAYLIST" /></label>

      <div className="suggestion-block">
        <h3><Sparkles size={16} /> 스타일별 헤드라인 후보</h3>
        <div className="tagged-suggestions">
          {suggestions.map(item => (
            <label key={item.tag} className="tagged-option">
              <input type="radio" name="headline-suggestion" checked={headline === item.text} onChange={() => onHeadlineChange(item.text)} />
              <span className="tag-pill">{HEADLINE_STYLE_LABELS[language][item.tag]}</span>
              <span>{item.text}</span>
            </label>
          ))}
        </div>
        <button className="secondary" onClick={() => setSeed(current => current + 1)}><RefreshCw size={15} /> 다시 추천</button>
      </div>

      <div className="suggestion-block">
        <h3>10자 안팎 짧은 문구</h3>
        <div className="chips">{shortSuggestions.map(text => <button key={text} className="chip" onClick={() => onHeadlineChange(text)}>{text}</button>)}</div>
      </div>

      <div className="suggestion-block">
        <h3>릴리스 정보 — DistroKid 등록 메타데이터와 이어집니다</h3>
        <p className="supporting">여기서 입력한 릴리스 제목·아티스트명이 커버(3000×3000) 인쇄 문구의 기본값이 됩니다. 커버에 인쇄된 문구와 등록 정보가 어긋나면 DistroKid 반려 사유가 됩니다.</p>
        <label>릴리스 제목<input value={releaseTitle} maxLength={64} onChange={event => onReleaseTitleChange(event.target.value)} /></label>
        <label>아티스트명<input value={artistName} onChange={event => onArtistNameChange(event.target.value)} placeholder="예: SUM Studio" /></label>

        <label className="checkbox-row">
          <input type="checkbox" checked={coverHeadlineOverride} onChange={event => onCoverHeadlineOverrideChange(event.target.checked)} />
          커버 문구를 릴리스 제목과 다르게 쓰기
        </label>
        {coverHeadlineOverride ? (
          <>
            <label>커버(1:1) 전용 문구<input value={coverHeadlineOverrideValue} maxLength={24} onChange={event => onCoverHeadlineOverrideValueChange(event.target.value)} /></label>
            <p className="length-hint warn"><AlertTriangle size={13} /> 커버 문구가 등록 제목과 다릅니다 — DistroKid 반려 위험</p>
          </>
        ) : (
          <p className="supporting">커버 인쇄 문구: <b>{releaseTitle || '(릴리스 제목을 입력하세요)'}</b> (릴리스 제목과 동일)</p>
        )}
      </div>
    </div>
  );
}
