// pipeline: status 판정 경계(D-22), fallback(D-21, D-29)이 고치는 경우·거절하는 경우, 입력 불변.
import { describe, expect, it } from 'vitest';
import { buildContext } from '../src/context';
import { dropLowPriority, shrinkFont } from '../src/fallback/steps';
import { loadContent, loadTemplate } from '../src/io/loader';
import { greedy } from '../src/matchers/greedy';
import { hierarchical } from '../src/matchers/hierarchical';
import { hungarian } from '../src/matchers/hungarian';
import { decideStatus, run } from '../src/pipeline';
import type { Adjustments, Content, MatchResult, PipelineResult, Template, Violation } from '../src/schema';
import { DROP_COST_BY_PRIORITY, EMPTY_COST_BY_ROLE, OVERFLOW_PER_LINE_COST, SHRINK_NEEDED_COST } from '../src/scoring/weights';
import { validate } from '../src/validation/validate';

const error: Violation = { ruleId: 'overflow', severity: 'error', detail: 'e' };
const warn: Violation = { ruleId: 'roleMismatch', severity: 'warn', detail: 'w' };

describe('decideStatus (D-22)', () => {
  it('위반 0, fallback 0 → accepted', () => expect(decideStatus([], 0)).toBe('accepted'));
  it('위반 0, fallback 1 → degraded', () => expect(decideStatus([], 1)).toBe('degraded'));
  it('warn 1, fallback 0 → degraded', () => expect(decideStatus([warn], 0)).toBe('degraded'));
  it('error 1이면 fallback·warn과 무관하게 rejected', () => expect(decideStatus([error, warn], 2)).toBe('rejected'));
});

// fixture 쌍을 hierarchical로 끝까지 실행한다.
const runHierarchical = (templateId: string, contentId: string): PipelineResult =>
  run(loadTemplate(templateId), loadContent(contentId), hierarchical);

describe('fallback: shrinkFont가 고치는 경우', () => {
  it('t02 × c03(긴 제목): 제목을 줄여 overflow가 없어지고 degraded', () => {
    const result = runHierarchical('t02-notice-two-body', 'c03-long-title');
    expect(result.trace.some((line) => line.startsWith('fallback#') && line.includes('shrinkFont'))).toBe(true);
    expect(result.violations.filter((v) => v.ruleId === 'overflow')).toEqual([]);
    expect(result.adjustments.fontSize.title).toBeLessThan(32);
    expect(result.status).toBe('degraded');
  });
});

describe('거절이 올바른 fixture', () => {
  it('t04 × c10(본문 12개, 전부 p1) → rejected', () => {
    expect(runHierarchical('t04-product-cards-3', 'c10-twelve-bodies').status).toBe('rejected');
  });
  it('t05 × c11(줄여도 안 들어가는 p1 고지문) → rejected, overflow가 남는다', () => {
    const result = runHierarchical('t05-narrow-banner', 'c11-long-legal-notice');
    expect(result.status).toBe('rejected');
    expect(result.violations.some((v) => v.ruleId === 'overflow' && v.contentId === 'notice')).toBe(true);
  });
});

// 본문 칸 하나(폭 60)에 긴 p3 글 하나: shrinkFont도, dropLowPriority도 할 일이 있는 작은 입력.
const tinyTemplate: Template = {
  id: 't-tiny', description: '좁은 본문 칸 하나',
  root: {
    id: 'root', type: 'frame', box: { x: 0, y: 0, w: 100, h: 100 },
    children: [{
      id: 'b', type: 'text', role: 'body', box: { x: 0, y: 0, w: 60, h: 40 },
      fontSize: 16, minFontSize: 12, maxLines: 2,
    }],
  },
};
const tinyContent: Content = {
  id: 'c-tiny', description: '긴 p3 본문',
  items: [{ id: 'x', kind: 'text', roleHint: 'body', text: '아주 길어서 줄여도 들어가지 않는 문장입니다', priority: 3 }],
};

describe('fallback은 입력을 바꾸지 않는다', () => {
  const ctx = buildContext(tinyTemplate, tinyContent);
  const result: MatchResult = { assignment: [{ slotId: 'b', contentId: 'x' }], dropped: [], totalCost: 0 };

  it('shrinkFont: 입력 result·adj는 그대로, 새 adj에 minFontSize(12)를 담는다', () => {
    const adj: Adjustments = { fontSize: {} };
    const before = structuredClone({ result, adj });
    expect(shrinkFont.applies(validate(ctx, result, adj), ctx, result, adj)).toBe(true);
    const next = shrinkFont.apply(ctx, result, adj);
    expect({ result, adj }).toEqual(before);
    expect(next.adj.fontSize.b).toBe(12);
  });

  it('dropLowPriority: 입력 result·adj는 그대로, 새 결과에서 x를 버린다', () => {
    const adj: Adjustments = { fontSize: { b: 12 } };
    const before = structuredClone({ result, adj });
    expect(dropLowPriority.applies(validate(ctx, result, adj), ctx, result, adj)).toBe(true);
    const next = dropLowPriority.apply(ctx, result, adj);
    expect({ result, adj }).toEqual(before);
    expect(next.r.dropped).toEqual(['x']);
    expect(next.r.assignment).toEqual([{ slotId: 'b', contentId: null }]);
  });
});

// hungarian은 cost가 넘침에 벌점을 주므로 넘칠 글을 대개 처음부터 버린다. 그래도 「넘친 채 넣기」가
// 「버리고 칸을 비우기」보다 싸면 넣고, 그때는 fallback이 끝까지 돈다.
describe('fallback: hungarian에서도 dropLowPriority가 도는 경우', () => {
  // tinyTemplate의 칸(폭 60, 16px → 최소 12px, 2줄)에 공백 없는 한글 12자, priority 2.
  //   12px: 12자 × 12 = 144px → ceil(144 / 60) = 3줄. 담을 수 있는 줄 수 2 → 1줄 초과.
  //   넣는 cost = SHRINK_NEEDED_COST + 1 × OVERFLOW_PER_LINE_COST (role 일치, 2줄을 다 채움, 항목·슬롯이 하나씩이라 순서 0)
  //   안 넣는 cost = 버림(p2) + 비움(body)
  const overflowing: Content = {
    id: 'c-one-line-over', description: '줄여도 한 줄 넘치는 p2 본문',
    items: [{ id: 'x', kind: 'text', roleHint: 'body', text: '가나다라마바사아자차카타', priority: 2 }],
  };

  it('전제: 넘친 채 넣는 쪽이 버리고 비우는 쪽보다 싸다', () => {
    expect(SHRINK_NEEDED_COST + 1 * OVERFLOW_PER_LINE_COST).toBeLessThan(DROP_COST_BY_PRIORITY[2] + EMPTY_COST_BY_ROLE.body);
  });

  it('넘친 채 배치 → shrinkFont(12px에서도 넘침) → dropLowPriority가 x를 버린다', () => {
    const result = run(tinyTemplate, overflowing, hungarian);
    expect(result.trace[0]).toContain('dropped 0'); // matcher는 버리지 않고 넣었다
    const fallbackLines = result.trace.filter((line) => line.startsWith('fallback#'));
    expect(fallbackLines).toHaveLength(2);
    expect(fallbackLines[0]).toContain('shrinkFont');
    expect(fallbackLines[1]).toContain('dropLowPriority');
    expect(result.dropped).toEqual(['x']);
    expect(result.assignment).toEqual([{ slotId: 'b', contentId: null }]);
    expect(result.status).toBe('degraded'); // 넘침은 사라졌고 fallback이 적용됐다(D-22)
  });
});

// F-8: greedy는 t01 × c01에서 카드 g1의 소제목을 그룹 밖 제목 칸에, 본문을 cardA 소제목 칸에 넣어 카드를 찢고, 그 본문은 줄여도 넘친다.
// 그 본문을 버리면 groupSplit error까지 사라져 degraded가 되므로, 찢어진 카드의 항목은 버리지 않는다(D-29).
describe('fallback: 찢어진 카드의 항목은 버리지 않는다 (D-29, F-8)', () => {
  const result = run(loadTemplate('t01-sale-cards'), loadContent('c01-summer-sale'), greedy);

  it('greedy t01 × c01: groupSplit 위반이 남고 rejected', () => {
    expect(result.violations.some((v) => v.ruleId === 'groupSplit')).toBe(true);
    expect(result.status).toBe('rejected');
  });

  it('dropLowPriority가 돌지 않아 버린 항목이 늘지 않고, 넘침도 error로 남는다', () => {
    expect(result.trace.some((line) => line.startsWith('fallback#') && line.includes('dropLowPriority'))).toBe(false);
    expect(result.dropped).not.toContain('c1-body');
    expect(result.violations.some((v) => v.ruleId === 'overflow' && v.contentId === 'c1-body')).toBe(true);
  });
});
