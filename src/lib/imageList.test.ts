import { describe, expect, it } from 'vitest';
import { dedupeImages } from './imageList';
import type { BackgroundImage } from '../types';

describe('dedupeImages', () => {
  it('드롭 경로(drop://)와 실제 파일 경로가 섞여 있어도 그대로 유지한다', () => {
    const images: BackgroundImage[] = [
      { path: 'drop://1000-0-a.png', name: 'a.png', dataUrl: 'data:image/png;base64,AAA' },
      { path: 'C:\\Users\\user\\Pictures\\b.jpg', name: 'b.jpg', dataUrl: 'data:image/jpeg;base64,BBB' },
      { path: 'drop://1000-1-c.webp', name: 'c.webp', dataUrl: 'data:image/webp;base64,CCC' }
    ];
    const result = dedupeImages(images);
    expect(result).toHaveLength(3);
    expect(result.map(image => image.path)).toEqual(images.map(image => image.path));
    // renderThumbnail 등 렌더 경로는 imageDataUrl만 사용하므로, path 스킴과 무관하게 dataUrl이 보존되어야 한다.
    for (const image of result) expect(image.dataUrl.startsWith('data:')).toBe(true);
  });

  it('같은 path를 가진 항목은 먼저 온 것만 남긴다', () => {
    const images: BackgroundImage[] = [
      { path: 'C:\\Users\\user\\Pictures\\same.jpg', name: 'same.jpg', dataUrl: 'data:image/jpeg;base64,FIRST' },
      { path: 'drop://999-0-other.png', name: 'other.png', dataUrl: 'data:image/png;base64,DROP' },
      { path: 'C:\\Users\\user\\Pictures\\same.jpg', name: 'same.jpg', dataUrl: 'data:image/jpeg;base64,SECOND' }
    ];
    const result = dedupeImages(images);
    expect(result).toHaveLength(2);
    expect(result[0].dataUrl).toBe('data:image/jpeg;base64,FIRST');
  });

  it('빈 배열은 빈 배열을 반환한다', () => {
    expect(dedupeImages([])).toEqual([]);
  });
});
