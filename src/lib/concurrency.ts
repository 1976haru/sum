// 동시 실행 수를 제한해 비동기 작업을 처리한다. Promise.all처럼 전부 한 번에 쏘지 않는다 —
// ffprobe처럼 무거운 외부 프로세스를 트랙 수만큼(예: 12개) 한꺼번에 띄우면 체감이 크다.
// 순서를 보존한 결과 배열을 반환한다. 반복은 items.length로 자연히 상한이 걸린다.
export async function runWithConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const effectiveLimit = Math.max(1, Math.min(limit, items.length) || 1);

  async function runNext(): Promise<void> {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: effectiveLimit }, () => runNext()));
  return results;
}
