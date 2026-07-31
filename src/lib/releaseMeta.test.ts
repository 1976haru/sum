import { describe, expect, it } from 'vitest';
import { buildReleaseMetadataText } from './releaseMeta';

describe('buildReleaseMetadataText', () => {
  it('릴리스 제목·아티스트명·커버 인쇄 문구를 그대로 반영한다', () => {
    const text = buildReleaseMetadataText({
      releaseTitle: '그날, 로마에서',
      artistName: 'SUM Studio',
      coverHeadline: '그날, 로마에서',
      generatedAt: '2026-07-31T00:00:00.000Z'
    });
    expect(text).toContain('Release Title: 그날, 로마에서');
    expect(text).toContain('Artist Name: SUM Studio');
    expect(text).toContain('Cover Text (as printed): 그날, 로마에서');
    expect(text).toContain('Cover Size: 3000x3000');
    expect(text).toContain('Generated: 2026-07-31T00:00:00.000Z');
    expect(text).toContain('DistroKid');
  });

  it('커버 문구를 릴리스 제목과 다르게 쓴 경우 그 불일치가 파일에 그대로 드러난다', () => {
    const text = buildReleaseMetadataText({
      releaseTitle: '겨울 재즈 플레이리스트',
      artistName: 'SUM Studio',
      coverHeadline: '조용한 겨울밤',
      generatedAt: '2026-07-31T00:00:00.000Z'
    });
    expect(text).toContain('Release Title: 겨울 재즈 플레이리스트');
    expect(text).toContain('Cover Text (as printed): 조용한 겨울밤');
  });
});
