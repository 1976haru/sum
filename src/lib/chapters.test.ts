import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

// electron/chapters.cjs는 Electron API를 import하지 않는 순수 CommonJS 모듈이므로
// checklist.test.ts와 같은 방식으로 실제 모듈을 require해서 돌린다.
const require = createRequire(import.meta.url);
const chapters = require('../../electron/chapters.cjs') as {
  MIN_CHAPTER_COUNT: number;
  MIN_CHAPTER_SECONDS: number;
  MAX_CHAPTER_TITLE_CHARS: number;
  formatChapter: (seconds: number) => string;
  buildChapters: (tracks: Array<{ title?: string; duration: number }>) => {
    lines: string[];
    text: string;
    issues: Array<{ level: 'error' | 'warning'; code: string; message: string }>;
    cues: Array<{ index: number; title: string; duration: number; start: number; end: number }>;
  };
  buildTimelineCsv: (tracks: Array<{ title?: string; duration: number }>) => string;
  buildSrt: (tracks: Array<{ title?: string; duration: number }>) => string;
};

function track(title: string, duration: number) {
  return { title, duration };
}

describe('chapters.cjs — buildChapters', () => {
  it('1) 첫 챕터는 항상 0:00이다', () => {
    const result = chapters.buildChapters([track('가', 120), track('나', 90), track('다', 60)]);
    expect(result.lines[0].startsWith('0:00 ')).toBe(true);
    expect(result.cues[0].start).toBe(0);
  });

  it('2) 트랙 2개 → TOO_FEW 오류', () => {
    const result = chapters.buildChapters([track('가', 60), track('나', 60)]);
    expect(result.issues.some(issue => issue.code === 'TOO_FEW' && issue.level === 'error')).toBe(true);
  });

  it('3) 트랙 3개, 그중 하나가 7초 → TOO_SHORT 오류', () => {
    const result = chapters.buildChapters([track('가', 60), track('나', 7), track('다', 60)]);
    const issue = result.issues.find(i => i.code === 'TOO_SHORT');
    expect(issue?.level).toBe('error');
    expect(issue?.message).toContain('2번');
    expect(issue?.message).toContain('7');
  });

  it('4) 0.5초짜리 트랙 두 개 연속 → DUPLICATE_TIME 오류', () => {
    const result = chapters.buildChapters([track('가', 0.5), track('나', 0.5), track('다', 60), track('라', 60)]);
    const issue = result.issues.find(i => i.code === 'DUPLICATE_TIME');
    expect(issue?.level).toBe('error');
    expect(issue?.message).toContain('1번');
    expect(issue?.message).toContain('2번');
  });

  it('5) 45자 제목 → TITLE_TOO_LONG 경고(오류 아님)', () => {
    const longTitle = '가'.repeat(45);
    const result = chapters.buildChapters([track(longTitle, 60), track('나', 60), track('다', 60)]);
    const issue = result.issues.find(i => i.code === 'TITLE_TOO_LONG');
    expect(issue?.level).toBe('warning');
  });

  it('6) 정상 12트랙 → issues가 비어있다', () => {
    const tracks = Array.from({ length: 12 }, (_, i) => track(`트랙 ${i + 1}`, 180));
    const result = chapters.buildChapters(tracks);
    expect(result.issues).toEqual([]);
    expect(result.lines).toHaveLength(12);
  });

  it('빈 트랙 목록에서도 예외 없이 빈 결과를 반환한다', () => {
    const result = chapters.buildChapters([]);
    expect(result.lines).toEqual([]);
    expect(result.text).toBe('');
    expect(result.issues.some(i => i.code === 'TOO_FEW')).toBe(true);
  });

  it('cues의 start/end가 duration 누적과 일치한다(타임라인 UI가 재사용하는 값)', () => {
    const result = chapters.buildChapters([track('가', 100), track('나', 50)]);
    expect(result.cues[0]).toMatchObject({ start: 0, end: 100 });
    expect(result.cues[1]).toMatchObject({ start: 100, end: 150 });
  });

  it('error가 있어도 lines/text는 그대로 반환한다(내보내기를 막지 않는다)', () => {
    const result = chapters.buildChapters([track('가', 60), track('나', 60)]); // TOO_FEW
    expect(result.lines.length).toBe(2);
    expect(result.text.length).toBeGreaterThan(0);
  });
});

describe('chapters.cjs — formatChapter', () => {
  it('0/65/3665초를 각각 0:00 / 1:05 / 1:01:05로 포맷한다', () => {
    expect(chapters.formatChapter(0)).toBe('0:00');
    expect(chapters.formatChapter(65)).toBe('1:05');
    expect(chapters.formatChapter(3665)).toBe('1:01:05');
  });
});

describe('chapters.cjs — buildTimelineCsv / buildSrt (main.cjs와 같은 computeCues 소스)', () => {
  it('buildTimelineCsv는 헤더 + 트랙당 1행을 만든다', () => {
    const csv = chapters.buildTimelineCsv([track('가', 60), track('나', 60), track('다', 60)]);
    const rows = csv.trim().split('\n');
    expect(rows[0]).toBe('index,start,end,duration,title,file');
    expect(rows).toHaveLength(4);
  });

  it('buildSrt는 트랙당 4줄(번호/타임코드/제목/빈줄)을 만든다', () => {
    const srt = chapters.buildSrt([track('가', 60), track('나', 60)]);
    const blocks = srt.split('\n');
    // 2트랙 * 4줄 - 마지막 빈 줄로 인한 join 특성 감안
    expect(blocks.filter(Boolean).length).toBeGreaterThanOrEqual(6);
    expect(srt).toContain('00:00:00,000 -->');
  });
});
