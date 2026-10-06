// golden 정답과 실제 배치를 비교해 맞은 슬롯 수를 센다. D-7: 모양이 같은 카드끼리 통째로 바꾼 배치도 정답.
import type { Assignment, Template } from '../src/schema';
import { collectGroups, collectSlots, slotGroupMap } from '../src/tree/traverse';

export type GoldenScore = { hits: number; total: number };

// 그룹 하나를 「안쪽 슬롯들(DFS 순서)」로 본 모양.
type GroupShape = { groupId: string; slotIds: string[]; key: string };

// 가정(D-7): 「모양이 같다」 = 그 그룹에 직접 속한 슬롯의 수와 role 순서(DFS)가 같다.
// 예: [image, subtitle, body] 카드 3장은 서로 같은 모양, [subtitle, body] 카드와는 다른 모양.
function groupShapes(t: Template): GroupShape[] {
  const groupOfSlot = slotGroupMap(t.root);
  const slots = collectSlots(t.root);
  return collectGroups(t.root).map((group) => {
    const ownSlots = slots.filter((slot) => groupOfSlot[slot.id] === group.id);
    return { groupId: group.id, slotIds: ownSlots.map((slot) => slot.id), key: ownSlots.map((slot) => slot.role).join('|') };
  });
}

// 0..n-1의 모든 순열(n!개). 작은 n에서만 쓴다: 여기서는 카드 수(fixture는 최대 3장), tests/oracle.test.ts에서는 n ≤ 7.
export function permutations(n: number): number[][] {
  if (n === 0) return [[]];
  return permutations(n - 1).flatMap((shorter) =>
    Array.from({ length: n }, (_, at) => [...shorter.slice(0, at), n - 1, ...shorter.slice(at)]),
  );
}

// 같은 모양 카드 묶음 하나에서 맞은 슬롯 수의 최댓값.
// hitsByPair[i][j] = golden 카드 i의 내용을 실제 카드 j의 같은 자리와 비교했을 때 맞은 수.
// 「golden 카드 i → 실제 카드 perm[i]」 순열 중 합이 가장 큰 것을 쓴다.
function bestCardHits(cards: GroupShape[], expected: Map<string, string | null>, got: Map<string, string | null>): number {
  const hitsByPair = cards.map((goldenCard) =>
    cards.map((actualCard) =>
      goldenCard.slotIds.reduce((sum, slotId, position) => {
        const target = actualCard.slotIds[position];
        if (!expected.has(slotId) || target === undefined) return sum;
        return sum + (got.get(target) === expected.get(slotId) ? 1 : 0);
      }, 0),
    ),
  );
  let best = 0;
  for (const perm of permutations(cards.length)) {
    const sum = perm.reduce((acc, j, i) => acc + (hitsByPair[i]?.[j] ?? 0), 0);
    best = Math.max(best, sum);
  }
  return best;
}

export function scoreGolden(t: Template, golden: Assignment, actual: Assignment): GoldenScore {
  const expected = new Map(golden.map((a) => [a.slotId, a.contentId]));
  const got = new Map(actual.map((a) => [a.slotId, a.contentId ?? null]));
  const shapes = groupShapes(t);
  const grouped = new Set(shapes.flatMap((shape) => shape.slotIds));

  let hits = 0;
  let total = 0;

  // 1) 그룹 밖 슬롯은 정확 일치로 센다. golden에 없는 슬롯은 세지 않는다.
  for (const [slotId, contentId] of expected) {
    if (grouped.has(slotId)) continue;
    total += 1;
    if (got.has(slotId) && got.get(slotId) === contentId) hits += 1;
  }

  // 2) 같은 모양 그룹끼리 묶고, 묶음마다 카드를 통째로 바꿔 맞춰 본 최댓값을 센다(D-7).
  const cardsByShape = new Map<string, GroupShape[]>();
  for (const shape of shapes) cardsByShape.set(shape.key, [...(cardsByShape.get(shape.key) ?? []), shape]);

  for (const cards of cardsByShape.values()) {
    total += cards.reduce((sum, card) => sum + card.slotIds.filter((id) => expected.has(id)).length, 0);
    hits += bestCardHits(cards, expected, got);
  }

  return { hits, total };
}
