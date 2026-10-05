// overflow 규칙: 텍스트가 슬롯의 허용 줄 수나 높이를 넘으면 error.
import type { MatchContext } from '../../context';
import type { Adjustments, MatchResult, Violation } from '../../schema';
import { currentFontSize, fits, lineHeight, measureLines } from '../../text/measure';
import type { Rule } from '../types';

const id = 'overflow';
const severity = 'error'; // D-20

// 텍스트가 든 텍스트 슬롯마다 지금 글자 크기로 fits를 본다. 이미지 짝과 빈 슬롯은 보지 않는다.
function check(ctx: MatchContext, result: MatchResult, adj: Adjustments): Violation[] {
  const violations: Violation[] = [];
  for (const { slotId, contentId } of result.assignment) {
    if (contentId === null) continue;
    const slot = ctx.slotsById[slotId];
    const item = ctx.itemsById[contentId];
    if (slot === undefined || item === undefined) continue;
    if (slot.type !== 'text' || item.kind !== 'text' || item.text === undefined) continue;

    const fontSize = currentFontSize(slot, adj); // fallback이 줄였으면 줄인 크기로 잰다
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
