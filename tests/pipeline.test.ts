// pipeline: status 판정 경계(D-22), fallback(D-21)이 고치는 경우·거절하는 경우, 입력 불변.
import { describe, expect, it } from 'vitest';
import { buildContext } from '../src/context';
import { dropLowPriority, shrinkFont } from '../src/fallback/steps';
import { loadContent, loadTemplate } from '../src/io/loader';
import { hierarchical } from '../src/matchers/hierarchical';
import { decideStatus, run } from '../src/pipeline';
import type { Adjustments, Content, MatchResult, PipelineResult, Template, Violation } from '../src/schema';
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
