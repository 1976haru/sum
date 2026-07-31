// 곡세트 체크리스트(xlsx) 읽기 전용 파서. Electron API를 일절 import하지 않는다(vitest에서 직접 돌리기 위함).
// 파일 다이얼로그·IPC·로그 전송은 main.cjs에 남기고, 이 모듈은 순수 파싱 로직만 담당한다.
const XLSX = require('xlsx');

const CHECKLIST_SHEET_NAMES = ['한국채널', '일본채널'];
const CHECKLIST_HEADER_ROW = 7; // 1-based
const CHECKLIST_DATA_START_ROW = 8; // 1-based
const MAX_SHEET_ROWS = 500; // 파트G: 어떤 대용량 반복도 이 상한을 넘기지 않는다.

const CHECKLIST_EXPECTED_HEADERS = {
  A: '번호', B: '공개목표', C: '시즌', D: '곡세트/영상기획', E: '핵심청자·상황',
  K: '썸네일/배경 방향', L: '유튜브 제목 예시', M: '핵심 키워드', R: '썸네일'
};

function cellsToText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function validateChecklistHeaders(headerRow, sheetName) {
  const mismatches = [];
  for (const [col, expected] of Object.entries(CHECKLIST_EXPECTED_HEADERS)) {
    const actual = cellsToText(headerRow[col]);
    if (actual !== expected) mismatches.push(`${col}열: 기대 "${expected}" / 실제 "${actual || '(비어있음)'}"`);
  }
  if (mismatches.length) {
    throw new Error(`[체크리스트] "${sheetName}" 시트의 ${CHECKLIST_HEADER_ROW}행이 예상된 헤더와 다릅니다. 추측해서 진행하지 않고 중단합니다.\n${mismatches.join('\n')}`);
  }
}

function parseChecklistSheet(worksheet, sheetName, onWarn) {
  // header:'A' → 컬럼 문자를 키로 사용. range:CHECKLIST_HEADER_ROW-1 → 0-based 오프셋이므로 7행부터 읽기 시작한다.
  // 수식 셀(T열 등)은 캐시값이 없으면 빈 문자열로 들어온다 — 읽지 않으므로 무시된다.
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 'A',
    range: CHECKLIST_HEADER_ROW - 1,
    defval: '',
    blankrows: false,
    raw: false
  });

  if (!rows.length) throw new Error(`[체크리스트] "${sheetName}" 시트의 ${CHECKLIST_HEADER_ROW}행(헤더)을 찾지 못했습니다.`);
  validateChecklistHeaders(rows[0], sheetName);

  const dataRows = rows.slice(1);
  const hardLimit = MAX_SHEET_ROWS;
  const truncated = dataRows.length > hardLimit;
  const limited = dataRows.slice(0, hardLimit);

  const result = [];
  for (const row of limited) {
    const rawNumber = cellsToText(row.A);
    if (!rawNumber) continue; // 번호가 없는 행은 세트 목록 끝으로 간주하고 건너뛴다.
    const numeric = parseInt(rawNumber, 10);
    const setNumber = String(Number.isFinite(numeric) ? numeric : rawNumber).padStart(2, '0');
    result.push({
      setNumber,
      releaseTarget: cellsToText(row.B),
      season: cellsToText(row.C),
      projectName: cellsToText(row.D),
      moodHint: cellsToText(row.E),
      backgroundDirection: cellsToText(row.K),
      titleExample: cellsToText(row.L),
      keywords: cellsToText(row.M),
      thumbnailStatus: cellsToText(row.R)
    });
  }

  if (truncated && typeof onWarn === 'function') {
    onWarn(`[체크리스트] "${sheetName}": ${MAX_SHEET_ROWS}행 상한을 넘어 이후 행은 건너뛰었습니다.`);
  }
  return result;
}

function parseChecklistXlsx(filePath, { onWarn } = {}) {
  const workbook = XLSX.readFile(filePath, { cellFormula: false, cellHTML: false });
  const sheets = {};
  for (const sheetName of CHECKLIST_SHEET_NAMES) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) throw new Error(`[체크리스트] 시트 "${sheetName}"를 찾을 수 없습니다. 파일 구조를 확인하세요.`);
    sheets[sheetName] = parseChecklistSheet(worksheet, sheetName, onWarn);
  }
  return sheets;
}

module.exports = {
  CHECKLIST_SHEET_NAMES,
  CHECKLIST_HEADER_ROW,
  CHECKLIST_DATA_START_ROW,
  MAX_SHEET_ROWS,
  CHECKLIST_EXPECTED_HEADERS,
  parseChecklistXlsx
};
