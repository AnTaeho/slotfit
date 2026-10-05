// shrinkFont 단계: 넘치는 텍스트 슬롯의 글자 크기를 minFontSize까지 줄인다(D-21).
import type { MatchContext } from '../../context';
import type { Adjustments, MatchResult, TextSlot, Violation } from '../../schema';
import { FONT_SHRINK_STEP } from '../../scoring/weights';
import { fits } from '../../text/measure';
import { validate } from '../../validation/validate';
import { overflow } from '../../validation/rules/overflow';
import type { FallbackStep } from '../types';

const id = 'shrinkFont';

function currentFontSize(slot: TextSlot, adj: Adjustments): number {
  return adj.fontSize[slot.id] ?? slot.fontSize;
}

// overflow 위반이 걸린 텍스트 슬롯 중 아직 minFontSize보다 큰 것(= 더 줄일 여지가 있는 것). 위반 순서대로.
function shrinkable(v: Violation[], ctx: MatchContext, adj: Adjustments): TextSlot[] {
  const out: TextSlot[] = [];
  for (const violation of v) {
    if (violation.ruleId !== overflow.id || violation.slotId === undefined) continue;
    const slot = ctx.slots.find((s) => s.id === violation.slotId);
    if (slot === undefined || slot.type !== 'text') continue;
    if (currentFontSize(slot, adj) > slot.minFontSize && !out.includes(slot)) out.push(slot);
  }
  return out;
}

function applies(v: Violation[], ctx: MatchContext, _r: MatchResult, adj: Adjustments): boolean {
  return shrinkable(v, ctx, adj).length > 0;
}

// 현재 크기에서 FONT_SHRINK_STEP씩 내려가며 fits가 되는 가장 큰 크기. 끝까지 안 되면 minFontSize.
// 예: fontSize 32, minFontSize 22 → 31, 30, … 중 처음 들어가는 크기. 22에서도 안 들어가면 22.
function largestFitting(text: string, slot: TextSlot, from: number): number {
  for (let size = from - FONT_SHRINK_STEP; size > slot.minFontSize; size -= FONT_SHRINK_STEP) {
    if (fits(text, slot, size)) return size;
  }
  return slot.minFontSize;
}

function apply(ctx: MatchContext, r: MatchResult, adj: Adjustments): { r: MatchResult; adj: Adjustments; note: string } {
  // 넘침 위반은 지금 상태로 다시 계산한다(apply는 위반 목록을 받지 않는다).
  const slots = shrinkable(validate(ctx, r, adj, [overflow]), ctx, adj);
  const fontSize: Record<string, number> = { ...adj.fontSize }; // 입력 adj는 바꾸지 않는다
  const notes: string[] = [];
  for (const slot of slots) {
    const contentId = r.assignment.find((a) => a.slotId === slot.id)?.contentId ?? null;
    const text = contentId === null ? undefined : ctx.itemsById[contentId]?.text;
    if (text === undefined) continue;
    const from = currentFontSize(slot, adj);
    const to = largestFitting(text, slot, from);
    fontSize[slot.id] = to;
    notes.push(`${slot.id} ${from}→${to}`);
  }
  return { r, adj: { ...adj, fontSize }, note: notes.join(', ') };
}

export const shrinkFont: FallbackStep = { id, applies, apply };
