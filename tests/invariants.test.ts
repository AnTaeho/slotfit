// invariants: 구현된 모든 matcher가 어떤 입력에서도 지켜야 하는 네 가지 성질.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildContext } from '../src/context';
import type { MatchContext } from '../src/context';
import { REGISTRY, withinLimit } from '../src/matchers';
import type { RegistryEntry } from '../src/matchers';
import type { MatchResult } from '../src/schema';
import { contentArb, templateArb } from './arbitraries';
import { allFixtureContexts } from './fixtureContexts';

type Check = (ctx: MatchContext, result: MatchResult) => void;

const placedIds = (result: MatchResult): string[] =>
  result.assignment.flatMap((a) => (a.contentId === null ? [] : [a.contentId]));

const checks: { title: string; check: Check }[] = [
  {
    title: '모든 슬롯이 assignment에 정확히 1번 등장한다',
    check: (ctx, result) => {
      expect(result.assignment.map((a) => a.slotId).sort()).toEqual(ctx.slots.map((s) => s.id).sort());
    },
  },
  {
    title: '한 contentId는 최대 1번 배치된다',
    check: (_ctx, result) => {
      const placed = placedIds(result);
      expect(new Set(placed).size).toBe(placed.length);
    },
  },
  {
    title: '배치된 쌍은 kind가 일치한다 (text↔text, image↔image)',
    check: (ctx, result) => {
      for (const { slotId, contentId } of result.assignment) {
        if (contentId === null) continue;
        const slot = ctx.slotsById[slotId];
        expect(slot).toBeDefined();
        expect(ctx.itemsById[contentId]?.kind).toBe(slot?.type);
      }
    },
  },
  {
    title: '배치된 콘텐츠 + dropped = 전체 콘텐츠 (중복 없이)',
    check: (ctx, result) => {
      const all = [...placedIds(result), ...result.dropped];
      expect(new Set(all).size).toBe(all.length);
      expect([...all].sort()).toEqual(ctx.content.items.map((i) => i.id).sort());
    },
  },
];

const fixtureContexts = allFixtureContexts();

// oracle 전용 matcher(bruteForce)는 크기 상한 이내인 입력만 본다(D-17). 랜덤 입력은 fc.pre로 건너뛴다.
function runCheck(entry: RegistryEntry, check: Check): void {
  const { matcher } = entry;
  for (const ctx of fixtureContexts) {
    if (withinLimit(entry, ctx)) check(ctx, matcher.match(ctx));
  }
  fc.assert(
    fc.property(templateArb, contentArb, (t, c) => {
      const ctx = buildContext(t, c);
      fc.pre(withinLimit(entry, ctx));
      check(ctx, matcher.match(ctx));
    }),
  );
}

for (const entry of REGISTRY) {
  const { matcher, implemented } = entry;
  describe(`invariants: ${matcher.name}`, () => {
    for (const { title, check } of checks) {
      // 미구현 matcher는 예외를 잡지 않고 레지스트리 플래그로 건너뛴다.
      it.skipIf(!implemented)(title, () => runCheck(entry, check));
    }
  });
}
