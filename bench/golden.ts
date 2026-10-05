// golden 정답과 실제 배치를 비교해 맞은 슬롯 수를 센다. D-7: 모양이 같은 카드끼리 통째로 바꾼 배치도 정답.
import type { Assignment, Template } from '../src/schema';
import { collectGroups, collectSlots, slotGroupMap } from '../src/tree/traverse';

export type GoldenScore = { hits: number; total: number };

// 그룹 하나를 「안쪽 슬롯들(DFS 순서)」로 본 모양.
type GroupShape = { groupId: string; slotIds: string[]; key: string };

// 가정(D-7): 「모양이 같다」 = 그 그룹에 직접 속한 슬롯의 수와 role 순서(DFS)가 같다.
// 예: [image, subtitle, body] 카드 3장은 서로 같은 모양, [subtitle, body] 카드와는 다른 모양.
function groupShapes(t: Template): GroupShape[] {
  const owner = slotGroupMap(t.root);
  const slots = collectSlots(t.root);
  return collectGroups(t.root).map((g) => {
    const mine = slots.filter((s) => owner[s.id] === g.id);
    return { groupId: g.id, slotIds: mine.map((s) => s.id), key: mine.map((s) => s.role).join('|') };
  });
}

// 0..n-1의 모든 순열. 카드 수가 작다는 가정(fixture는 최대 3장)이라 n!을 그대로 돈다.
function permutations(n: number): number[][] {
  if (n === 0) return [[]];
  return permutations(n - 1).flatMap((p) =>
    Array.from({ length: n }, (_, i) => [...p.slice(0, i), n - 1, ...p.slice(i)]),
  );
}

export function scoreGolden(t: Template, golden: Assignment, actual: Assignment): GoldenScore {
  const expected = new Map(golden.map((a) => [a.slotId, a.contentId]));
  const got = new Map(actual.map((a) => [a.slotId, a.contentId ?? null]));
  const shapes = groupShapes(t);
  const grouped = new Set(shapes.flatMap((s) => s.slotIds));

  let hits = 0;
  let total = 0;

  // 1) 그룹 밖 슬롯은 정확 일치로 센다. golden에 없는 슬롯은 세지 않는다.
  for (const [slotId, contentId] of expected) {
    if (grouped.has(slotId)) continue;
    total += 1;
    if (got.has(slotId) && got.get(slotId) === contentId) hits += 1;
  }

  // 2) 같은 모양 그룹끼리 묶고, 묶음마다 「golden 카드 i → 실제 카드 σ(i)」 순열 중 맞은 슬롯이 가장 많은 것을 쓴다.
  const byKey = new Map<string, GroupShape[]>();
  for (const s of shapes) byKey.set(s.key, [...(byKey.get(s.key) ?? []), s]);

  for (const cards of byKey.values()) {
    // match[i][j]: golden 카드 i의 내용을 실제 카드 j와 같은 자리끼리 비교했을 때 맞은 수
    const match = cards.map((gi) =>
      cards.map((gj) =>
        gi.slotIds.reduce((sum, slotId, p) => {
          const target = gj.slotIds[p];
          if (!expected.has(slotId) || target === undefined) return sum;
          return sum + (got.get(target) === expected.get(slotId) ? 1 : 0);
        }, 0),
      ),
    );
    total += cards.reduce((sum, g) => sum + g.slotIds.filter((id) => expected.has(id)).length, 0);
    let best = 0;
    for (const perm of permutations(cards.length)) {
      const sum = perm.reduce((acc, j, i) => acc + (match[i]?.[j] ?? 0), 0);
      best = Math.max(best, sum);
    }
    hits += best;
  }

  return { hits, total };
}
