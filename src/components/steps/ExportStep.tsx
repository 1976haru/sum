import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, FolderOpen, PlayCircle, StopCircle } from 'lucide-react';
import type { BackgroundImage, BatchProgressState, BatchResultItem, ChecklistSetRow, ChecklistSheetName, ChecklistSheets, CoverConfig, ProjectConfig } from '../../types';
import { renderThumbnail } from '../../lib/thumbnail';
import { COVER_SIZE, renderCover } from '../../lib/cover';
import { buildReleaseMetadataText } from '../../lib/releaseMeta';

interface ExportStepProps {
  config: ProjectConfig;
  coverBase: CoverConfig;
  coverHeadline: string;
  releaseTitle: string;
  artistName: string;
  images: BackgroundImage[];
  outputDir: string;
  onOutputDirChange: (value: string) => void;
  channelLabel: string;
  onExported: () => void;
  // 렌더 산출물 폴더에 커버를 함께 담을 수 있도록(있으면), 실제로 저장한 커버의 절대 경로를 끌어올린다.
  onCoverSaved: (path: string) => void;
  onApplyChecklistSet: (patch: { projectName: string; season: string; backgroundExtra: string; trackTarget: string; keywords: string }) => void;
}

// 어떤 대용량 반복도 이 상한을 넘기지 않는다: 못 맞춰도 경고 후 남은 항목은 건너뛰고 반환한다(파트G).
const MAX_BATCH_ITEMS = 200;

const CHECKLIST_CHANNEL_LABEL: Record<ChecklistSheetName, string> = { '한국채널': '굿모닝추억라디오', '일본채널': '아침의쇼와카페' };

function slug(value: string): string {
  return value.trim().replace(/\s+/g, '') || 'Channel';
}

export default function ExportStep({ config, coverBase, coverHeadline, releaseTitle, artistName, images, outputDir, onOutputDirChange, channelLabel, onExported, onCoverSaved, onApplyChecklistSet }: ExportStepProps) {
  const [busySingle, setBusySingle] = useState(false);
  const [singleMessage, setSingleMessage] = useState('');

  const [captionsText, setCaptionsText] = useState('');
  const [channelCode, setChannelCode] = useState(() => slug(channelLabel));
  const [setNumber, setSetNumber] = useState('01');
  const [checklistSheets, setChecklistSheets] = useState<ChecklistSheets | null>(null);
  const [checklistSheetName, setChecklistSheetName] = useState<ChecklistSheetName>('한국채널');
  const [checklistBusy, setChecklistBusy] = useState(false);
  const [checklistMessage, setChecklistMessage] = useState('');
  const [appliedSetNumber, setAppliedSetNumber] = useState<string | null>(null);
  const [includeWide, setIncludeWide] = useState(true);
  const [includeSquare, setIncludeSquare] = useState(false);
  const [busyBatch, setBusyBatch] = useState(false);
  const [progress, setProgress] = useState<BatchProgressState | null>(null);
  const [results, setResults] = useState<BatchResultItem[]>([]);
  const cancelRef = useRef(false);

  const image = images[0];
  const captions = useMemo(() => captionsText.split('\n').map(line => line.trim()).filter(Boolean), [captionsText]);
  // 배경이 하나도 없어도(Phase 1-3 폴백 배경) 문구만으로 조합을 만들 수 있어야 하므로 최소 1로 취급한다.
  const effectiveBgCount = Math.max(1, images.length);
  const combinationCount = effectiveBgCount * captions.length;
  const aspectCount = (includeWide ? 1 : 0) + (includeSquare ? 1 : 0);
  const plannedCount = captions.length ? Math.min(combinationCount, MAX_BATCH_ITEMS) * aspectCount : 0;

  async function ensureOutputDir() {
    if (outputDir) return outputDir;
    const picked = await window.sumAPI.pickOutputDir();
    if (picked) onOutputDirChange(picked);
    return picked || '';
  }

  async function loadChecklist() {
    setChecklistBusy(true);
    setChecklistMessage('');
    try {
      const filePath = await window.sumAPI.pickChecklistXlsx();
      if (!filePath) return;
      const sheets = await window.sumAPI.loadChecklistXlsx(filePath);
      setChecklistSheets(sheets);
      setAppliedSetNumber(null);
      setChecklistMessage(`불러왔습니다: 한국채널 ${sheets['한국채널'].length}세트 · 일본채널 ${sheets['일본채널'].length}세트.`);
    } catch (error) {
      setChecklistSheets(null);
      setChecklistMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setChecklistBusy(false);
    }
  }

  function applyChecklistSet(row: ChecklistSetRow) {
    const candidateLines = [
      row.titleExample,
      ...row.keywords.split(/[,·/]+/).map(part => part.trim()).filter(Boolean)
    ].filter(Boolean);
    setCaptionsText(candidateLines.join('\n'));
    setChannelCode(slug(CHECKLIST_CHANNEL_LABEL[checklistSheetName]));
    setSetNumber(row.setNumber);
    setAppliedSetNumber(row.setNumber);
    onApplyChecklistSet({ projectName: row.projectName, season: row.season, backgroundExtra: row.backgroundDirection, trackTarget: row.trackTarget, keywords: row.keywords });
    setChecklistMessage(`${checklistSheetName} Set${row.setNumber}(${row.projectName})을(를) 적용했습니다. 문구는 편집 가능합니다.`);
  }

  async function saveSingle(kind: 'thumbnail' | 'cover' | 'both') {
    const dir = await ensureOutputDir();
    if (!dir) return;
    setBusySingle(true);
    setSingleMessage('');
    try {
      // Phase 1-3: 배경 이미지가 없으면(image === undefined) accent 색 그라디언트 폴백으로 렌더한다.
      const warnings: string[] = [];
      if (kind === 'thumbnail' || kind === 'both') {
        const { dataUrl, diagnostics } = await renderThumbnail({ ...config, imageDataUrl: image?.dataUrl, width: 1920, height: 1080 });
        await window.sumAPI.saveThumbnail({ dataUrl, outputDir: dir, fileName: `${config.projectName}_thumbnail`, format: 'jpg' });
        warnings.push(...diagnostics.warnings);
      }
      if (kind === 'cover' || kind === 'both') {
        const dataUrl = await renderCover({ ...coverBase, headline: coverHeadline, imageDataUrl: image?.dataUrl }, COVER_SIZE);
        const savedCoverPath = await window.sumAPI.saveThumbnail({ dataUrl, outputDir: dir, fileName: `${config.projectName}_cover`, format: coverBase.format });
        onCoverSaved(savedCoverPath);
        // 파트E: 커버와 같은 폴더에 등록 메타데이터를 동봉해, 인쇄 문구와 DistroKid 등록 정보가 어긋나지 않게 한다.
        const metadataText = buildReleaseMetadataText({ releaseTitle, artistName, coverHeadline });
        await window.sumAPI.saveTextFile({ outputDir: dir, fileName: `${releaseTitle || config.projectName}_metadata`, content: metadataText });
      }
      const suffix = warnings.length ? ` — 주의: ${warnings.join(' / ')}` : '';
      setSingleMessage(`저장을 완료했습니다.${suffix}`);
      onExported();
    } catch (error) {
      setSingleMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusySingle(false);
    }
  }

  async function runBatch() {
    if (!captions.length) return alert('문구 목록을 한 줄에 하나씩 입력하세요.');
    if (!includeWide && !includeSquare) return alert('16:9 또는 1:1 중 하나 이상 선택하세요.');
    const dir = await ensureOutputDir();
    if (!dir) return;

    const code = slug(channelCode);
    const set = String(setNumber || '01').trim();

    // 배경 × 문구 전체 조합(카르테시안 곱)을 만들되, 최대 반복 상한을 넘지 않는다(파트G).
    // 배경이 하나도 없으면(Phase 1-3 폴백 배경) bgIndex=0 한 번만 돌려 폴백 그라디언트를 쓴다.
    const combos: Array<{ bgIndex: number; capIndex: number }> = [];
    for (let bi = 0; bi < effectiveBgCount && combos.length < MAX_BATCH_ITEMS; bi++) {
      for (let ci = 0; ci < captions.length && combos.length < MAX_BATCH_ITEMS; ci++) {
        combos.push({ bgIndex: bi, capIndex: ci });
      }
    }
    const overflow = combinationCount > combos.length;

    const jobs: Array<{ aspect: '16x9' | '1x1'; bgIndex: number; capIndex: number; seq: number }> = [];
    combos.forEach((combo, i) => {
      const seq = i + 1;
      if (includeWide) jobs.push({ aspect: '16x9', seq, ...combo });
      if (includeSquare) jobs.push({ aspect: '1x1', seq, ...combo });
    });

    cancelRef.current = false;
    setBusyBatch(true);
    setResults([]);
    const collected: BatchResultItem[] = [];
    try {
      for (let j = 0; j < jobs.length; j++) {
        if (cancelRef.current) {
          collected.push({ fileName: '(취소됨)', status: 'failed', reason: `사용자 취소로 남은 ${jobs.length - j}건을 중단했습니다.` });
          setResults([...collected]);
          break;
        }
        const { aspect, bgIndex, capIndex, seq } = jobs[j];
        const bg = images[bgIndex];
        const caption = captions[capIndex];
        const base = `${code}_${set}_${String(seq).padStart(2, '0')}_${aspect}`;
        const fileName = `${code}/Set${set}/${base}`;
        setProgress({ current: j + 1, total: jobs.length, label: `${base} 렌더링` });

        try {
          if (aspect === '16x9') {
            const { dataUrl, diagnostics } = await renderThumbnail({ ...config, headline: caption, imageDataUrl: bg?.dataUrl, width: 1920, height: 1080 });
            const savedPath = await window.sumAPI.saveThumbnail({ dataUrl, outputDir: dir, fileName, format: 'jpg' });
            collected.push({ fileName: `${base}.jpg`, path: savedPath, status: 'ok', warnings: diagnostics.warnings.length ? diagnostics.warnings : undefined });
          } else {
            const dataUrl = await renderCover({ ...coverBase, headline: caption, imageDataUrl: bg?.dataUrl });
            const savedPath = await window.sumAPI.saveThumbnail({ dataUrl, outputDir: dir, fileName, format: 'jpg' });
            collected.push({ fileName: `${base}.jpg`, path: savedPath, status: 'ok' });
          }
        } catch (error) {
          // 실패해도 조용히 넘어가지 않는다: 사유를 남기고 다음 항목을 계속 처리한다.
          collected.push({ fileName: `${base}.jpg`, status: 'failed', reason: error instanceof Error ? error.message : String(error) });
        }
        setResults([...collected]);
        // UI 블로킹 방지: 렌더 사이마다 이벤트 루프에 양보한다.
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      if (overflow) {
        collected.push({ fileName: '(생략됨)', status: 'failed', reason: `배경×문구 조합이 ${MAX_BATCH_ITEMS}개를 넘어 초과분은 건너뛰었습니다.` });
        setResults([...collected]);
      }
      if (collected.some(item => item.status === 'ok')) onExported();
    } finally {
      setBusyBatch(false);
      setProgress(null);
    }
  }

  const failedCount = results.filter(item => item.status === 'failed').length;

  return (
    <div className="export-step">
      <h3>단일 저장</h3>
      {!image && <p className="supporting">배경 이미지 없음 — 단색 배경으로 생성 중</p>}
      <div className="action-row">
        <button className="secondary" disabled={busySingle} onClick={() => void saveSingle('thumbnail')}><Download size={16} /> 썸네일 1920×1080</button>
        <button className="secondary" disabled={busySingle} onClick={() => void saveSingle('cover')}><Download size={16} /> 커버 3000×3000</button>
        <button className="primary" disabled={busySingle} onClick={() => void saveSingle('both')}><Download size={16} /> 둘 다 저장</button>
      </div>
      {singleMessage && <p className="supporting">{singleMessage}</p>}
      {outputDir && <button className="path-button" onClick={() => void window.sumAPI.openPath(outputDir)}><FolderOpen size={14} /> 저장 폴더: {outputDir}</button>}

      <h3 className="section-gap">곡세트 체크리스트에서 불러오기</h3>
      <p className="supporting">시니어 플레이리스트 채널 곡세트 체크리스트(xlsx)에서 세트 하나를 선택하면 프로젝트명·시즌·배경 방향·문구 후보가 자동으로 채워집니다(읽기 전용, 원본 파일은 수정하지 않습니다).</p>
      <div className="action-row">
        <button className="secondary" disabled={checklistBusy} onClick={() => void loadChecklist()}><FileSpreadsheet size={16} /> {checklistBusy ? '불러오는 중...' : '체크리스트 불러오기(xlsx)'}</button>
      </div>
      {checklistSheets && (
        <>
          <div className="tab-strip small">
            {(Object.keys(CHECKLIST_CHANNEL_LABEL) as ChecklistSheetName[]).map(name => (
              <button key={name} className={checklistSheetName === name ? 'active' : ''} onClick={() => setChecklistSheetName(name)}>{name}({checklistSheets[name].length})</button>
            ))}
          </div>
          <div className="checklist-set-list">
            {checklistSheets[checklistSheetName].map(row => (
              <button
                key={row.setNumber}
                className={appliedSetNumber === row.setNumber ? 'checklist-set-row active' : 'checklist-set-row'}
                onClick={() => applyChecklistSet(row)}
              >
                <span className="checklist-set-num">Set{row.setNumber}</span>
                <span className="checklist-set-name">{row.projectName || '(제목 없음)'}</span>
                <span className="checklist-set-meta">{row.releaseTarget}{row.thumbnailStatus ? ` · ${row.thumbnailStatus}` : ''}</span>
              </button>
            ))}
            {!checklistSheets[checklistSheetName].length && <p className="empty-note">이 시트에는 세트가 없습니다.</p>}
          </div>
        </>
      )}
      {checklistMessage && <p className="supporting step-message">{checklistMessage}</p>}

      <h3 className="section-gap">세트 일괄 생성</h3>
      <p className="supporting">
        현재 배경 목록({images.length}장) × 아래 문구 목록({captions.length}개)의 모든 조합({combinationCount}개)을 렌더링합니다.
        {!images.length && ' 배경 이미지가 없어 단색 배경(폴백)으로 생성됩니다.'}
      </p>
      <label>문구 목록(줄바꿈으로 구분)<textarea rows={5} value={captionsText} onChange={event => setCaptionsText(event.target.value)} placeholder={'문득, 그날이 떠올랐다\n비가 지나간 자리에\n오늘은 조금 천천히'} /></label>
      <div className="field-grid">
        <label>채널 코드(파일명)<input value={channelCode} onChange={event => setChannelCode(event.target.value)} /></label>
        <label>세트 번호<input value={setNumber} onChange={event => setSetNumber(event.target.value)} placeholder="01" /></label>
      </div>
      <div className="field-grid">
        <label className="checkbox-row"><input type="checkbox" checked={includeWide} onChange={event => setIncludeWide(event.target.checked)} /> 16:9 썸네일</label>
        <label className="checkbox-row"><input type="checkbox" checked={includeSquare} onChange={event => setIncludeSquare(event.target.checked)} /> 1:1 커버</label>
      </div>
      <p className="supporting">파일명 규칙: {channelCode || '채널'}_{setNumber || '01'}_순번_16x9|1x1.jpg — {channelCode || '채널'}/Set{setNumber || '01'} 폴더에 자동 저장됩니다. 예상 {plannedCount}개 파일.</p>

      {progress && <div className="progress-card"><div><b>{progress.label}</b><span>{progress.current}/{progress.total}</span></div><div className="progress-track"><span style={{ width: `${(progress.current / Math.max(1, progress.total)) * 100}%` }} /></div></div>}

      <div className="action-row">
        <button className="primary" disabled={busyBatch || !captions.length} onClick={() => void runBatch()}><PlayCircle size={17} /> {busyBatch ? '생성 중...' : '일괄 생성 시작'}</button>
        {busyBatch && <button className="secondary" onClick={() => { cancelRef.current = true; }}><StopCircle size={17} /> 취소</button>}
      </div>

      <div className="batch-results">
        {results.length === 0 && <p className="empty-note">아직 결과가 없습니다.</p>}
        {results.map((item, index) => (
          <div key={`${item.fileName}-${index}`} className={item.status === 'ok' ? 'batch-row ok' : 'batch-row fail'}>
            {item.status === 'ok' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            <span className="batch-name">{item.fileName}</span>
            {item.reason && <span className="batch-reason">{item.reason}</span>}
            {item.warnings?.map(warning => <span key={warning} className="batch-reason batch-warning">{warning}</span>)}
          </div>
        ))}
      </div>
      {results.length > 0 && <p className="supporting">성공 {results.length - failedCount}건 · 실패/취소 {failedCount}건</p>}
    </div>
  );
}
