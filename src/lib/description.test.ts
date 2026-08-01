import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const description = require('../../electron/description.cjs') as {
  MAX_DESCRIPTION_CHARS: number;
  keywordsToHashtags: (keywords: string) => string[];
  buildDescriptionText: (input: { greeting?: string; chaptersText?: string; keywords?: string; footer?: string }) => {
    text: string;
    length: number;
    overLimit: boolean;
    hashtags: string[];
  };
};

const chaptersText = '0:00 트랙1\n0:11 트랙2\n0:23 트랙3\n';

describe('description.cjs — keywordsToHashtags', () => {
  it('5) "아침음악, 커피음악" → ["#아침음악", "#커피음악"]', () => {
    expect(description.keywordsToHashtags('아침음악, 커피음악')).toEqual(['#아침음악', '#커피음악']);
    expect(description.keywordsToHashtags('아침음악, 커피음악').join(' ')).toBe('#아침음악 #커피음악');
  });

  it('빈 값/공백만 있는 항목은 걸러진다', () => {
    expect(description.keywordsToHashtags(' , ,키워드,')).toEqual(['#키워드']);
    expect(description.keywordsToHashtags('')).toEqual([]);
    expect(description.keywordsToHashtags(undefined as unknown as string)).toEqual([]);
  });
});

describe('description.cjs — buildDescriptionText', () => {
  it('3) 조립 결과의 챕터 구간이 chaptersText(=chapters.txt)와 완전 일치한다', () => {
    const result = description.buildDescriptionText({ greeting: '안녕하세요!', chaptersText, keywords: '아침음악, 커피음악', footer: '저작권 안내' });
    expect(result.text).toContain(chaptersText.replace(/\n+$/, ''));
    // chapters.txt 파일 내용(끝 개행 포함)과 description.txt 안의 챕터 블록이 줄 단위로 완전히 같아야 한다.
    const chapterLinesInDescription = result.text.split('\n\n')[1].split('\n');
    const chapterLinesInFile = chaptersText.trim().split('\n');
    expect(chapterLinesInDescription).toEqual(chapterLinesInFile);
  });

  it('순서: 인사말 → 빈 줄 → 챕터 → 빈 줄 → 해시태그 → 푸터', () => {
    const result = description.buildDescriptionText({ greeting: '인사', chaptersText: '0:00 A\n', keywords: '키워드', footer: '푸터' });
    expect(result.text.split('\n')).toEqual(['인사', '', '0:00 A', '', '#키워드', '푸터']);
  });

  it('4) 5000자 초과 시 overLimit=true이되 문자열은 잘리지 않는다', () => {
    const longFooter = '가'.repeat(6000);
    const result = description.buildDescriptionText({ greeting: '인사', chaptersText, keywords: '', footer: longFooter });
    expect(result.overLimit).toBe(true);
    expect(result.text).toContain(longFooter); // 안 잘렸는지 — 부분 문자열로 포함되어야 함
    expect(result.length).toBeGreaterThan(description.MAX_DESCRIPTION_CHARS);
  });

  it('5000자 이하면 overLimit=false', () => {
    const result = description.buildDescriptionText({ greeting: '짧은 인사', chaptersText, keywords: '키워드', footer: '짧은 푸터' });
    expect(result.overLimit).toBe(false);
  });

  it('키워드가 없으면 해시태그 줄을 아예 넣지 않는다', () => {
    const result = description.buildDescriptionText({ greeting: '인사', chaptersText: '0:00 A\n', keywords: '', footer: '푸터' });
    expect(result.text).not.toContain('#');
  });
});
