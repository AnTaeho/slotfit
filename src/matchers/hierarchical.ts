// hierarchical matcher: 그룹끼리 먼저 짝짓고 그룹 안을 채우는 2단계 매칭. 카드 섞임(F-3)을 구조로 막는다.
//
// 비유(반 배정): 학생(콘텐츠)은 이미 친구 무리(groupId)로 나뉘어 있고, 학교(템플릿)에는 반(카드 그룹)이 있다.
// 먼저 「어느 무리를 어느 반에 넣을지」를 정하고, 그다음 반 안에서 자리를 정한다.
// 무리와 반 사이의 궁합 = 그 무리를 그 반에 넣었을 때 반 안 자리 배치의 최소 불편이다.
// 궁합표가 생기면 무리↔반 짝짓기도 자리 배치와 똑같은 문제라 Hungarian으로 푼다.
// 한 무리는 한 반에만 들어가므로 친구가 다른 반으로 흩어지지(카드 섞임) 않는다.
//
// 알고리즘
//   0) 콘텐츠 그룹 = groupId가 같은 항목 묶음(첫 등장 순서). 템플릿 그룹 = GroupNode와 그 그룹에 「직접」 속한 슬롯.
//   1) 그룹↔그룹 cost[c][t] = 「콘텐츠 그룹 c의 항목 × 템플릿 그룹 t의 슬롯」 하위 문제를 Hungarian으로 푼 최적 cost.
//   2) 그룹끼리 Hungarian. 짝이 없는 콘텐츠 그룹은 항목을 전부 버린다고, 짝이 없는 템플릿 그룹은
//      슬롯을 전부 비운다고 비관적으로 값을 매긴다(실제로는 4)에서 낱개로 자리를 찾을 수 있다).
//   3) 짝지어진 그룹 쌍은 1)의 하위 문제 결과를 그대로 쓴다. 그 안에서 버린 항목·비운 슬롯은 확정한다.
//   4) 남은 항목(groupId 없음 + 짝 없는 그룹)과 남은 슬롯(그룹 밖 + 짝 없는 그룹)을 flat하게 한 번 더 푼다.
//
// 전역 최적이 아닐 수 있다: 2)의 dummy 값이 비관적이고, 3)에서 그룹 쌍 결과를 확정한 뒤 4)를 푼다.
// 예: 카드 한 장뿐인 템플릿에 「제목 + 카드 한 장」 콘텐츠(t09×c09). 카드가 카드 자리를 다 차지해 제목은
// 갈 곳이 없어 버려진다(1000). flat hungarian은 제목을 카드 소제목 칸에 넣고 소제목(30)을 버려 더 싸다.
//
// 가정: 그룹이 중첩되면 ctx.slotGroup은 가장 안쪽 그룹을 가리킨다. 그래서 그룹마다 「직접」 속한 슬롯만 보고,
// 바깥 그룹과 안쪽 그룹은 서로 다른 템플릿 그룹으로 따로 짝짓는다. 직접 슬롯이 없는 그룹은 짝짓기에서 뺀다.
import type { MatchContext } from '../context';
import type { ContentItem, MatchResult, Slot } from '../schema';
import { DUMMY_ITEM_COST, DUMMY_SLOT_COST } from '../scoring/cost';
import type { Weights } from '../scoring/weights';
import { collectGroups } from '../tree/traverse';
import { toMatchResult } from './costMatrix';
import type { SubproblemResult } from './costMatrix';
import { solveAssignment, solveSubproblem } from './hungarian';
import type { Matcher } from './types';

type ContentGroup = { id: string; items: ContentItem[] };
type TemplateGroup = { id: string; slots: Slot[] };

// 0) groupId가 같은 항목 묶음. 묶음 순서 = groupId가 처음 나온 순서, 묶음 안 = 입력 순서.
function collectContentGroups(ctx: MatchContext): ContentGroup[] {
  const groups: ContentGroup[] = [];
  for (const item of ctx.content.items) {
    if (item.groupId === undefined) continue;
    const found = groups.find((group) => group.id === item.groupId);
    if (found === undefined) groups.push({ id: item.groupId, items: [item] });
    else found.items.push(item);
  }
  return groups;
}

// 0) GroupNode(DFS 순서)마다 그 그룹에 직접 속한 슬롯(DFS 순서). 직접 슬롯이 없는 그룹은 뺀다:
// 짝지어도 항목을 하나도 못 받으니 콘텐츠 그룹만 붙잡아 두게 된다.
function collectTemplateGroups(ctx: MatchContext): TemplateGroup[] {
  return collectGroups(ctx.template.root)
    .map((group) => ({ id: group.id, slots: ctx.slots.filter((slot) => ctx.slotGroup[slot.id] === group.id) }))
    .filter((group) => group.slots.length > 0);
}

const dropAllCost = (items: readonly ContentItem[], weights: Weights): number =>
  items.reduce((sum, item) => sum + DUMMY_SLOT_COST(item, weights), 0);
const emptyAllCost = (slots: readonly Slot[], weights: Weights): number =>
  slots.reduce((sum, slot) => sum + DUMMY_ITEM_COST(slot, weights), 0);

// 2) 그룹끼리 Hungarian. 반환값[콘텐츠 그룹 번호] = 템플릿 그룹 번호(templateGroups.length 이상이면 짝 없음).
// costMatrix와 같은 모양: 행 = [콘텐츠 그룹들, dummy(템플릿 그룹 수)], 열 = [템플릿 그룹들, dummy(콘텐츠 그룹 수)].
//   콘텐츠 그룹 × 템플릿 그룹 = 1)의 하위 문제 cost
//   콘텐츠 그룹 × dummy 열   = 그 그룹 항목을 전부 버리는 비용(비관적 가정. 실제로는 4)에서 자리를 찾을 수 있음)
//   dummy 행 × 템플릿 그룹   = 그 그룹 슬롯을 전부 비우는 비용(같은 가정)
function pairGroups(
  contentGroups: ContentGroup[],
  templateGroups: TemplateGroup[],
  pairResults: SubproblemResult[][],
  weights: Weights,
): number[] {
  const groupRows = contentGroups.map((contentGroup, c) => [
    ...(pairResults[c] ?? []).map((result) => result.cost),
    ...contentGroups.map(() => dropAllCost(contentGroup.items, weights)),
  ]);
  const dummyRows = templateGroups.map(() => [
    ...templateGroups.map((templateGroup) => emptyAllCost(templateGroup.slots, weights)),
    ...contentGroups.map(() => 0),
  ]);
  return solveAssignment([...groupRows, ...dummyRows]).slice(0, contentGroups.length);
}

function match(ctx: MatchContext): MatchResult {
  const contentGroups = collectContentGroups(ctx);
  const templateGroups = collectTemplateGroups(ctx);

  // 1) 그룹 쌍마다 하위 문제를 푼다. pairResults[c][t] = 콘텐츠 그룹 c × 템플릿 그룹 t.
  const pairResults = contentGroups.map((contentGroup) =>
    templateGroups.map((templateGroup) => solveSubproblem(ctx, contentGroup.items, templateGroup.slots)),
  );
  const partnerOf = pairGroups(contentGroups, templateGroups, pairResults, ctx.weights);

  // 3) 짝지어진 그룹 쌍은 하위 문제 결과를 그대로 확정한다.
  //   그 안에서 버린 항목은 버림으로 확정(다른 카드로 새면 찢어진다), 비운 슬롯도 빈 채로 둔다(다른 그룹 항목이 섞인다).
  //   단, 항목을 하나도 넣지 못한 쌍(예: 글만 있는 그룹 × 사진만 있는 카드)은 짝이 아니라고 보고 4)로 넘긴다.
  //   이 경우 쌍의 cost = 전부 버림 + 전부 비움이라 4)에서 풀면 그보다 나빠지지 않는다.
  const settled: SubproblemResult[] = [];
  const settledItems = new Set<string>();
  const settledSlots = new Set<string>();
  contentGroups.forEach((contentGroup, c) => {
    const t = partnerOf[c];
    if (t === undefined || t >= templateGroups.length) return; // dummy 열: 짝 없음
    const result = pairResults[c]?.[t];
    const templateGroup = templateGroups[t];
    if (result === undefined || templateGroup === undefined || result.pairs.length === 0) return;
    settled.push(result);
    for (const item of contentGroup.items) settledItems.add(item.id);
    for (const slot of templateGroup.slots) settledSlots.add(slot.id);
  });

  // 4) 남은 것끼리 flat 하위 문제: groupId 없는 항목 + 짝 없는 그룹 항목 × 그룹 밖 슬롯 + 짝 없는 그룹 슬롯.
  const restItems = ctx.content.items.filter((item) => !settledItems.has(item.id));
  const restSlots = ctx.slots.filter((slot) => !settledSlots.has(slot.id));
  const rest = solveSubproblem(ctx, restItems, restSlots);

  return toMatchResult(ctx, [...settled, rest]);
}

export const hierarchical: Matcher = { name: 'hierarchical', match };
