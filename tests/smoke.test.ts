// smoke: greedy가 end-to-end로 돌아가는지, 그리고 알려진 실패가 그대로인지 확인한다.
import { describe, expect, it } from 'vitest';
import { loadContent, loadTemplate } from '../src/io/loader';
import { greedy } from '../src/matchers/greedy';
import { run } from '../src/pipeline';

describe('smoke: t01-sale-cards × c01-summer-sale × greedy', () => {
  const result = run(loadTemplate('t01-sale-cards'), loadContent('c01-summer-sale'), greedy);

  it('PipelineResult를 반환한다', () => {
    expect(result.matcher).toBe('greedy');
    expect(['accepted', 'degraded', 'rejected']).toContain(result.status);
    expect(result.assignment).toHaveLength(5);
    expect(Array.isArray(result.dropped)).toBe(true);
    expect(result.adjustments).toEqual({ fontSize: {} });
    expect(Array.isArray(result.violations)).toBe(true);
    expect(result.trace.length).toBeGreaterThan(0);
  });

  // 의도된 실패를 고정해 두는 테스트: greedy는 role을 보지 않고 입력 순서대로 넣기 때문에
  // title 슬롯에 소제목 「무료배송」(c1-sub)이 들어간다. 더 나은 matcher가 생겨도 greedy는 이대로여야 한다.
  it('title 슬롯에 「무료배송」(c1-sub)이 들어간다', () => {
    const title = result.assignment.find((a) => a.slotId === 'title');
    expect(title?.contentId).toBe('c1-sub');
  });
});
