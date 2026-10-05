// invariants: 구현된 모든 matcher가 어떤 입력에서도 지켜야 하는 네 가지 성질.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildContext } from '../src/context';
import type { MatchContext } from '../src/context';
import { loadAllContents, loadAllTemplates } from '../src/io/loader';
import { REGISTRY } from '../src/matchers';
import type { Matcher } from '../src/matchers';
import type { MatchResult } from '../src/schema';
import { contentArb, templateArb } from './arbitraries';

type Check = (ctx: MatchContext, r: MatchResult) => void;

const placedIds = (r: MatchResult): string[] =>
  r.assignment.flatMap((a) => (a.contentId === null ? [] : [a.contentId]));

const checks: { title: string; check: Check }[] = [
  {
    title: '모든 슬롯이 assignment에 정확히 1번 등장한다',
    check: (ctx, r) => {
      expect(r.assignment.map((a) => a.slotId).sort()).toEqual(ctx.slots.map((s) => s.id).sort());
    },
  },
  {
    title: '한 contentId는 최대 1번 배치된다',
    check: (_ctx, r) => {
      const placed = placedIds(r);
      expect(new Set(placed).size).toBe(placed.length);
    },
  },
  {
    title: '배치된 쌍은 kind가 일치한다 (text↔text, image↔image)',
    check: (ctx, r) => {
      for (const { slotId, contentId } of r.assignment) {
        if (contentId === null) continue;
        const slot = ctx.slots.find((s) => s.id === slotId);
        expect(slot).toBeDefined();
        expect(ctx.itemsById[contentId]?.kind).toBe(slot?.type);
      }
    },
  },
  {
    title: '배치된 콘텐츠 + dropped = 전체 콘텐츠 (중복 없이)',
    check: (ctx, r) => {
      const all = [...placedIds(r), ...r.dropped];
      expect(new Set(all).size).toBe(all.length);
      expect([...all].sort()).toEqual(ctx.content.items.map((i) => i.id).sort());
    },
  },
];

// fixture 전 조합.
const fixtureContexts: MatchContext[] = loadAllTemplates().flatMap((t) =>
  loadAllContents().map((c) => buildContext(t, c)),
);

function runCheck(matcher: Matcher, check: Check): void {
  for (const ctx of fixtureContexts) check(ctx, matcher.match(ctx));
  fc.assert(
    fc.property(templateArb, contentArb, (t, c) => {
      const ctx = buildContext(t, c);
      check(ctx, matcher.match(ctx));
    }),
  );
}

for (const { matcher, implemented } of REGISTRY) {
  describe(`invariants: ${matcher.name}`, () => {
    for (const { title, check } of checks) {
      // 미구현 matcher는 예외를 잡지 않고 레지스트리 플래그로 건너뛴다.
      it.skipIf(!implemented)(title, () => runCheck(matcher, check));
    }
  });
}
