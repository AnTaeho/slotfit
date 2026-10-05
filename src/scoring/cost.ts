// 콘텐츠를 슬롯에 넣었을 때의 나쁨 점수(cost)와 버림/비움 비용. D-13~D-16.
// cost = role 항 + 넘침 항 + 너무 짧음 항 + 입력 순서 항. kind가 다르면 FORBIDDEN_COST 하나로 끝.
import type { MatchContext } from '../context';
import type { ContentItem, Slot, TextSlot } from '../schema';
import { fits, lineHeight, measureLines, textWidthEm } from '../text/measure';
import {
  DROP_COST_BY_PRIORITY, EMPTY_COST_BY_ROLE, FORBIDDEN_COST, ORDER_COST, OVERFLOW_PER_LINE_COST,
  ROLE_MISMATCH_COST, ROLE_UNKNOWN_COST, SHRINK_NEEDED_COST, UNDERFILL_COST,
} from './weights';

// 항목별 내역. 나중에 「왜 이 자리인가」를 보여 줄 때 쓴다. forbidden이면 total만 FORBIDDEN_COST.
export type CostBreakdown = { role: number; overflow: number; underfill: number; order: number; total: number };

// role 항: roleHint가 있는데 슬롯 role과 다르면 벌점. roleHint가 없으면(D-8) 0.
export function roleCost(item: ContentItem, slot: Slot): number {
  if (item.roleHint === undefined) return ROLE_UNKNOWN_COST;
  return item.roleHint === slot.role ? 0 : ROLE_MISMATCH_COST;
}

// minFontSize에서 슬롯이 담을 수 있는 줄 수 = min(maxLines, 높이에 들어가는 줄 수).
function capacityAtMin(slot: TextSlot): number {
  return Math.min(slot.maxLines, Math.floor(slot.box.h / lineHeight(slot.minFontSize)));
}

// 넘침 항: 기본 크기로 들어가면 0. 아니면 「줄여야 함」 벌점 + minFontSize로도 넘치는 줄 수 × 줄당 벌점.
export function overflowCost(text: string, slot: TextSlot): number {
  if (fits(text, slot, slot.fontSize)) return 0;
  // minFontSize에서 fits면 초과 0. fits와 capacity 계산이 부동소수 경계에서 어긋나지 않게 먼저 본다.
  if (fits(text, slot, slot.minFontSize)) return SHRINK_NEEDED_COST;
  const lines = measureLines(text, slot.minFontSize, slot.box.w);
  const excess = Math.max(0, lines - capacityAtMin(slot));
  return SHRINK_NEEDED_COST + excess * OVERFLOW_PER_LINE_COST;
}

// 너무 짧음 항: 기본 크기에서 텍스트가 차지하는 줄 수(소수, 문단 너비 합 기준)가 maxLines보다 적을수록 크다.
// 예: maxLines 4, 텍스트가 1줄 분량 → used 1, underfill 0.75 → 4 × 0.75 = 3.
export function underfillCost(text: string, slot: TextSlot): number {
  const widthEm = text.split('\n').reduce((sum, paragraph) => sum + textWidthEm(paragraph), 0);
  const used = Math.min(slot.maxLines, (widthEm * slot.fontSize) / slot.box.w);
  const underfill = 1 - used / slot.maxLines;
  return UNDERFILL_COST * underfill;
}

// 0~1 상대 위치. 원소가 하나면 0.
function relativePos(index: number, count: number): number {
  return count <= 1 ? 0 : index / (count - 1);
}

// 입력 순서 항(D-16): 항목의 상대 위치(입력 순서)와 슬롯의 상대 위치(DFS 순서)의 차이의 제곱에 비례.
// 진짜 「역전 쌍 수」는 두 짝을 함께 봐야 정해져 짝 하나의 cost로 쪼갤 수 없다.
// assignment problem은 짝별 cost의 합만 다루므로, 짝 하나로 정해지는 상대 위치 차이로 근사한다.
export function orderCost(item: ContentItem, slot: Slot, ctx: MatchContext): number {
  const itemIndex = ctx.itemIndex[item.id];
  const slotIndex = ctx.slotIndex[slot.id];
  if (itemIndex === undefined || slotIndex === undefined) {
    throw new Error(`orderCost: ctx에 없는 항목/슬롯 (${item.id}, ${slot.id})`);
  }
  const itemPos = relativePos(itemIndex, ctx.content.items.length);
  const slotPos = relativePos(slotIndex, ctx.slots.length);
  // 제곱(볼록)이라 두 짝을 엇갈리게 놓으면 항상 더 비싸다. 절댓값이면 엇갈린 배치와 바른 배치가
  // 동점이 되는 경우가 있다(예: t02×c02 본문 0.25·0.5 → 슬롯 0.5·1: 0.25+0.5 = 0.75+0).
  const diff = itemPos - slotPos;
  return ORDER_COST * diff * diff;
}

export function costBreakdown(item: ContentItem, slot: Slot, ctx: MatchContext): CostBreakdown {
  // D-15: kind 불일치는 큰 유한값. 다른 항은 보지 않는다.
  if (item.kind !== slot.type) return { role: 0, overflow: 0, underfill: 0, order: 0, total: FORBIDDEN_COST };

  const role = roleCost(item, slot);
  const order = orderCost(item, slot, ctx);
  let overflow = 0;
  let underfill = 0;
  // 넘침·너무 짧음은 텍스트 짝만. 이미지 짝은 role·순서만 본다.
  if (slot.type === 'text') {
    const text = item.text ?? '';
    overflow = overflowCost(text, slot);
    underfill = underfillCost(text, slot);
  }
  return { role, overflow, underfill, order, total: role + overflow + underfill + order };
}

export function cost(item: ContentItem, slot: Slot, ctx: MatchContext): number {
  return costBreakdown(item, slot, ctx).total;
}

// 항목을 버리는 비용(dummy 슬롯과 짝). priority가 1에 가까울수록 크다.
export function DUMMY_SLOT_COST(item: ContentItem): number {
  return DROP_COST_BY_PRIORITY[item.priority];
}

// 슬롯을 비워 두는 비용(dummy 항목과 짝). title이 비는 것이 가장 비싸다.
export function DUMMY_ITEM_COST(slot: Slot): number {
  return EMPTY_COST_BY_ROLE[slot.role];
}
