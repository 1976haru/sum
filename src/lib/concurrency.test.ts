import { describe, expect, it } from 'vitest';
import { runWithConcurrencyLimit } from './concurrency';

describe('runWithConcurrencyLimit', () => {
  it('결과 순서를 입력 순서대로 보존한다', async () => {
    const items = [30, 10, 20, 5];
    const results = await runWithConcurrencyLimit(items, 4, async ms => {
      await new Promise(resolve => setTimeout(resolve, ms));
      return ms;
    });
    expect(results).toEqual(items);
  });

  it('동시 실행 수가 limit을 넘지 않는다', async () => {
    let active = 0;
    let maxActive = 0;
    const items = Array.from({ length: 12 }, (_, i) => i);
    await runWithConcurrencyLimit(items, 4, async i => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise(resolve => setTimeout(resolve, 5));
      active--;
      return i;
    });
    expect(maxActive).toBeLessThanOrEqual(4);
    expect(maxActive).toBeGreaterThan(1); // 실제로 병렬화되고 있는지도 확인
  });

  it('개별 작업 실패는 다른 작업을 막지 않는다(worker 자체가 throw하면 그대로 전파)', async () => {
    await expect(
      runWithConcurrencyLimit([1, 2, 3], 2, async n => {
        if (n === 2) throw new Error('boom');
        return n;
      })
    ).rejects.toThrow('boom');
  });

  it('빈 배열에서도 즉시 반환한다', async () => {
    const results = await runWithConcurrencyLimit([], 4, async n => n);
    expect(results).toEqual([]);
  });

  it('limit이 items.length보다 크면 items.length만큼만 동시 실행한다', async () => {
    let active = 0;
    let maxActive = 0;
    await runWithConcurrencyLimit([1, 2], 10, async n => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise(resolve => setTimeout(resolve, 5));
      active--;
      return n;
    });
    expect(maxActive).toBeLessThanOrEqual(2);
  });
});
