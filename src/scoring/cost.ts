// 콘텐츠를 슬롯에 넣었을 때의 나쁨 점수(placeholder).
import type { MatchContext } from '../context';
import type { ContentItem, Slot } from '../schema';
import { KIND_MISMATCH_COST, PLACEHOLDER_COST } from './weights';

// TODO(Step 2): role 불일치, 넘침 정도, 너무 짧은 텍스트, 입력 순서 역전 항을 더한다.
// 지금은 kind 불일치 = Infinity, 나머지 = 0.
export function cost(item: ContentItem, slot: Slot, _ctx: MatchContext): number {
  if (item.kind !== slot.type) return KIND_MISMATCH_COST;
  return PLACEHOLDER_COST;
}

// TODO(Step 2): 콘텐츠를 버리는 비용. priority가 높을수록(1에 가까울수록) 크게 한다.
export function DUMMY_SLOT_COST(_item: ContentItem): number {
  return PLACEHOLDER_COST;
}

// TODO(Step 2): 슬롯을 비워 두는 비용. title처럼 중요한 role일수록 크게 한다.
export function DUMMY_ITEM_COST(_slot: Slot): number {
  return PLACEHOLDER_COST;
}
