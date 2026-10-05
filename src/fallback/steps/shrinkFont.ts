// shrinkFont 단계: 넘치는 텍스트 슬롯의 글자 크기를 minFontSize까지 줄인다(D-21).
import type { MatchContext } from '../../context';
import type { Adjustments, MatchResult, TextSlot, Violation } from '../../schema';
import { FONT_SHRINK_STEP } from '../../scoring/weights';
import { currentFontSize, fits } from '../../text/measure';
import { overflow } from '../../validation/rules/overflow';
import { validate } from '../../validation/validate';
import type { FallbackOutcome, FallbackStep } from '../types';

const id = 'shrinkFont';

// overflow 위반이 걸린 텍스트 슬롯 중 아직 minFontSize보다 큰 것(= 더 줄일 여지가 있는 것). 위반 순서대로.
function shrinkableSlots(violations: Violation[], ctx: MatchContext, adj: Adjustments): TextSlot[] {
  const slots: TextSlot[] = [];
  for (const violation of violations) {
    if (violation.ruleId !== overflow.id || violation.slotId === undefined) continue;
    const slot = ctx.slotsById[violation.slotId];
    if (slot === undefined || slot.type !== 'text') continue;
    if (currentFontSize(slot, adj) > slot.minFontSize && !slots.includes(slot)) slots.push(slot);
  }
  return slots;
}

function applies(violations: Violation[], ctx: MatchContext, _result: MatchResult, adj: Adjustments): boolean {
  return shrinkableSlots(violations, ctx, adj).length > 0;
}

// 현재 크기에서 FONT_SHRINK_STEP씩 내려가며 fits가 되는 가장 큰 크기. 끝까지 안 되면 minFontSize.
// 예: fontSize 32, minFontSize 22 → 31, 30, … 중 처음 들어가는 크기. 22에서도 안 들어가면 22.
function largestFittingSize(text: string, slot: TextSlot, from: number): number {
  for (let size = from - FONT_SHRINK_STEP; size > slot.minFontSize; size -= FONT_SHRINK_STEP) {
    if (fits(text, slot, size)) return size;
  }
  return slot.minFontSize;
}

function apply(ctx: MatchContext, result: MatchResult, adj: Adjustments): FallbackOutcome {
  // 넘침 위반은 지금 상태로 다시 계산한다(apply는 위반 목록을 받지 않는다).
  const slots = shrinkableSlots(validate(ctx, result, adj, [overflow]), ctx, adj);
  const fontSize: Record<string, number> = { ...adj.fontSize }; // 입력 adj는 바꾸지 않는다
  const notes: string[] = [];
  for (const slot of slots) {
    const contentId = result.assignment.find((a) => a.slotId === slot.id)?.contentId ?? null;
    const text = contentId === null ? undefined : ctx.itemsById[contentId]?.text;
    if (text === undefined) continue;
    const from = currentFontSize(slot, adj);
    const to = largestFittingSize(text, slot, from);
    fontSize[slot.id] = to;
    notes.push(`${slot.id} ${from}→${to}`);
  }
  return { r: result, adj: { ...adj, fontSize }, note: notes.join(', ') };
}

export const shrinkFont: FallbackStep = { id, applies, apply };
