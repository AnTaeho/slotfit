// overflow 규칙: 텍스트가 슬롯의 허용 줄 수나 높이를 넘으면 error.
import type { MatchContext } from '../../context';
import type { Adjustments, MatchResult, Slot, Violation } from '../../schema';
import { fits, lineHeight, measureLines } from '../../text/measure';
import type { Rule } from '../types';

const id = 'overflow';
const severity = 'error';

function check(ctx: MatchContext, r: MatchResult, adj: Adjustments): Violation[] {
  const slotsById = new Map<string, Slot>(ctx.slots.map((s) => [s.id, s]));
  const violations: Violation[] = [];

  for (const { slotId, contentId } of r.assignment) {
    if (contentId === null) continue;
    const slot = slotsById.get(slotId);
    const item = ctx.itemsById[contentId];
    if (slot === undefined || item === undefined) continue;
    if (slot.type !== 'text' || item.kind !== 'text' || item.text === undefined) continue;

    // fallback이 줄인 폰트 크기가 있으면 그것으로 잰다.
    const fontSize = adj.fontSize[slot.id] ?? slot.fontSize;
    if (fits(item.text, slot, fontSize)) continue;

    const lines = measureLines(item.text, fontSize, slot.box.w);
    violations.push({
      ruleId: id,
      severity,
      slotId,
      contentId,
      detail: `줄 수 ${lines}/${slot.maxLines}, 높이 ${lines * lineHeight(fontSize)}/${slot.box.h} (fontSize ${fontSize})`,
    });
  }
  return violations;
}

export const overflow: Rule = { id, severity, check };
