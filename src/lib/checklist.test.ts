import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';

// electron/checklist.cjs는 Electron API를 import하지 않는 순수 CommonJS 모듈이므로
// 여기서는 모킹 없이 실제 모듈을 require해서 진짜 파서를 돌린다.
const require = createRequire(import.meta.url);
const checklist = require('../../electron/checklist.cjs') as {
  parseChecklistXlsx: (filePath: string, opts?: { onWarn?: (message: string) => void }) => Record<string, Array<Record<string, string>>>;
  CHECKLIST_HEADER_ROW: number;
  MAX_SHEET_ROWS: number;
};

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.resolve(here, '../../fixtures/checklist.fixture.xlsx');

function withTamperedFixture(mutate: (workbook: XLSX.WorkBook) => void): string {
  const workbook = XLSX.readFile(FIXTURE_PATH);
  mutate(workbook);
  const tmpPath = path.join(os.tmpdir(), `checklist-tamper-${Date.now()}-${Math.random().toString(16).slice(2)}.xlsx`);
  XLSX.writeFile(workbook, tmpPath);
  return tmpPath;
}

describe('checklist.cjs — 픽스처(실제 버그를 재현하는 xlsx)로 실제 파서를 돌린다', () => {
  it('픽스처 파일이 존재한다(이 테스트 스위트 전체가 이 파일에 의존한다)', () => {
    expect(fs.existsSync(FIXTURE_PATH)).toBe(true);
  });

  it('1) 시트 개수 및 이름: 한국채널·일본채널 둘 다 존재한다', () => {
    const sheets = checklist.parseChecklistXlsx(FIXTURE_PATH);
    expect(Object.keys(sheets).sort()).toEqual(['일본채널', '한국채널'].sort());
  });

  it('2) 데이터 행 수: 각 시트 18건', () => {
    const sheets = checklist.parseChecklistXlsx(FIXTURE_PATH);
    expect(sheets['한국채널']).toHaveLength(18);
    expect(sheets['일본채널']).toHaveLength(18);
  });

  it('3) 첫 세트 번호 / 마지막 세트 번호: 01 / 18', () => {
    const sheets = checklist.parseChecklistXlsx(FIXTURE_PATH);
    expect(sheets['한국채널'][0].setNumber).toBe('01');
    expect(sheets['한국채널'][17].setNumber).toBe('18');
    expect(sheets['일본채널'][0].setNumber).toBe('01');
    expect(sheets['일본채널'][17].setNumber).toBe('18');
  });

  it('4) K열(배경 방향): 18건 전부 비어있지 않다', () => {
    const sheets = checklist.parseChecklistXlsx(FIXTURE_PATH);
    for (const sheetName of ['한국채널', '일본채널'] as const) {
      for (const row of sheets[sheetName]) expect(row.backgroundDirection.length).toBeGreaterThan(0);
    }
  });

  it('5) L열(제목 예시): 18건 전부 비어있지 않다', () => {
    const sheets = checklist.parseChecklistXlsx(FIXTURE_PATH);
    for (const sheetName of ['한국채널', '일본채널'] as const) {
      for (const row of sheets[sheetName]) expect(row.titleExample.length).toBeGreaterThan(0);
    }
  });

  it('6) 일본채널 K열은 일본어 문자를 포함한다(인코딩 검증)', () => {
    const sheets = checklist.parseChecklistXlsx(FIXTURE_PATH);
    const hasJapanese = /[぀-ヿ一-龯]/;
    for (const row of sheets['일본채널']) expect(hasJapanese.test(row.backgroundDirection)).toBe(true);
  });

  it('6-1) F열(곡수목표): 18건 전부 비어있지 않은 숫자 문자열이다', () => {
    const sheets = checklist.parseChecklistXlsx(FIXTURE_PATH);
    for (const sheetName of ['한국채널', '일본채널'] as const) {
      for (const row of sheets[sheetName]) {
        expect(row.trackTarget.length).toBeGreaterThan(0);
        expect(Number.isFinite(Number(row.trackTarget))).toBe(true);
      }
    }
  });

  it('7) 헤더 변조 시(7행 D열) 에러를 던진다', () => {
    const tamperedPath = withTamperedFixture(workbook => {
      const sheet = workbook.Sheets['한국채널'];
      sheet['D7'] = { t: 's', v: '변조된헤더' };
    });
    try {
      let thrown: Error | null = null;
      try {
        checklist.parseChecklistXlsx(tamperedPath);
      } catch (error) {
        thrown = error as Error;
      }
      expect(thrown).toBeInstanceOf(Error);
      expect(thrown!.message).toContain('행이 예상된 헤더와 다릅니다');
      expect(thrown!.message).toContain('D열');
      expect(thrown!.message).toContain('곡세트/영상기획');
      expect(thrown!.message).toContain('변조된헤더');
      // eslint-disable-next-line no-console
      console.log('[checklist.test] 헤더 변조 에러 메시지:\n' + thrown!.message);
    } finally {
      fs.rmSync(tamperedPath, { force: true });
    }
  });

  it('8) 시트 누락 시 명확한 에러 메시지를 던진다', () => {
    const missingSheetPath = withTamperedFixture(workbook => {
      workbook.SheetNames = workbook.SheetNames.filter(name => name !== '일본채널');
      delete workbook.Sheets['일본채널'];
    });
    try {
      expect(() => checklist.parseChecklistXlsx(missingSheetPath)).toThrow(/시트 "일본채널"를 찾을 수 없습니다/);
    } finally {
      fs.rmSync(missingSheetPath, { force: true });
    }
  });

  it('MAX_SHEET_ROWS 상한을 넘는 행은 건너뛰고 onWarn으로 사유를 남긴다(조용한 실패 금지)', () => {
    const bigPath = withTamperedFixture(workbook => {
      const sheet = workbook.Sheets['한국채널'];
      const headerRow = checklist.CHECKLIST_HEADER_ROW;
      // 500행 상한을 넘기도록 더미 행을 채운다. 번호(A열)만 채우면 나머지는 defval로 채워진다.
      for (let i = 0; i < checklist.MAX_SHEET_ROWS + 20; i++) {
        const r = headerRow + 1 + i;
        sheet[`A${r}`] = { t: 's', v: String(i + 1) };
        sheet[`K${r}`] = { t: 's', v: '더미 배경' };
        sheet[`L${r}`] = { t: 's', v: '더미 제목' };
      }
      const range = XLSX.utils.decode_range(sheet['!ref'] as string);
      range.e.r = Math.max(range.e.r, headerRow + checklist.MAX_SHEET_ROWS + 20);
      sheet['!ref'] = XLSX.utils.encode_range(range);
    });
    try {
      const warnings: string[] = [];
      const sheets = checklist.parseChecklistXlsx(bigPath, { onWarn: message => warnings.push(message) });
      expect(sheets['한국채널'].length).toBeLessThanOrEqual(checklist.MAX_SHEET_ROWS);
      expect(warnings.some(message => message.includes(String(checklist.MAX_SHEET_ROWS)))).toBe(true);
    } finally {
      fs.rmSync(bigPath, { force: true });
    }
  });
});

describe('checklist.cjs — 픽스처가 사라지면 이 스위트는 실패해야 한다(더미 데이터로 대체 불가)', () => {
  it('픽스처 경로가 실제 fixtures/checklist.fixture.xlsx를 가리킨다', () => {
    expect(FIXTURE_PATH.endsWith(path.join('fixtures', 'checklist.fixture.xlsx'))).toBe(true);
  });
});

const LOCAL_FIXTURE_PATH = path.resolve(here, '../../fixtures/checklist.local.xlsx');
const hasLocalFixture = fs.existsSync(LOCAL_FIXTURE_PATH);

describe('checklist.cjs — 실파일(선택 실행)', () => {
  if (!hasLocalFixture) {
    // eslint-disable-next-line no-console
    console.log('[checklist.test] 실파일 테스트 건너뜀 — fixtures/checklist.local.xlsx 없음');
  }

  it.skipIf(!hasLocalFixture)('한국채널 마지막 세트는 Goodnight Old Year, 일본채널 마지막 세트는 年の終わりの朝다', () => {
    const sheets = checklist.parseChecklistXlsx(LOCAL_FIXTURE_PATH);
    const lastKo = sheets['한국채널'][sheets['한국채널'].length - 1];
    const lastJa = sheets['일본채널'][sheets['일본채널'].length - 1];
    expect(lastKo.projectName).toBe('Goodnight Old Year');
    expect(lastJa.projectName).toBe('年の終わりの朝');
  });
});
