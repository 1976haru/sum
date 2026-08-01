import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const uniqueName = require('../../electron/uniqueName.cjs') as {
  MAX_NAME_ATTEMPTS: number;
  resolveUniqueName: (dir: string, baseName: string, ext: string, existsFn?: (name: string) => boolean) => string;
};

function existsAmong(names: string[]) {
  const set = new Set(names);
  return (name: string) => set.has(name);
}

describe('uniqueName.cjs — resolveUniqueName', () => {
  it('충돌이 없으면 원래 이름 그대로 반환한다', () => {
    expect(uniqueName.resolveUniqueName('/dir', 'a', '.mp4', existsAmong([]))).toBe('a.mp4');
  });

  it('1) a.mp4가 있으면 a (2).mp4, 둘 다 있으면 a (3).mp4', () => {
    expect(uniqueName.resolveUniqueName('/dir', 'a', '.mp4', existsAmong(['a.mp4']))).toBe('a (2).mp4');
    expect(uniqueName.resolveUniqueName('/dir', 'a', '.mp4', existsAmong(['a.mp4', 'a (2).mp4']))).toBe('a (3).mp4');
  });

  it('2) 100회 초과 충돌 → 타임스탬프 파일명, 무한루프 없음', () => {
    const taken = ['a.mp4', ...Array.from({ length: 200 }, (_, i) => `a (${i + 2}).mp4`)];
    const start = Date.now();
    const result = uniqueName.resolveUniqueName('/dir', 'a', '.mp4', existsAmong(taken));
    expect(Date.now() - start).toBeLessThan(200);
    expect(result).toMatch(/^a_\d+\.mp4$/);
  });

  it('폴더명(확장자 없음)에도 동일하게 동작한다', () => {
    expect(uniqueName.resolveUniqueName('/dir', 'Set01', '', existsAmong(['Set01']))).toBe('Set01 (2)');
  });
});
