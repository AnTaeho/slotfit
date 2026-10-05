// 배치 결과를 박스와 텍스트만 있는 SVG 문자열로 그린다(외부 라이브러리 없음).
import type { MatchContext } from '../context';
import type { PipelineResult, Severity, Slot } from '../schema';
import {
  RENDER_FOOTER_FONT_SIZE, RENDER_FOOTER_HEIGHT, RENDER_FOOTER_PADDING,
  RENDER_IMAGE_LABEL_FONT_SIZE, RENDER_SLOT_FILL_OPACITY,
} from '../scoring/weights';
import { lineHeight, wrapLines } from '../text/measure';
import { collectGroups } from '../tree/traverse';

const COLOR_ERROR = '#d92d20'; // 빨강
const COLOR_WARN = '#f79009'; // 주황
const COLOR_OK = '#12b76a'; // 초록
const COLOR_EMPTY = '#98a2b3'; // 회색
const COLOR_GROUP = '#667085';
const COLOR_TEXT = '#101828';
const DASH = '6 4';
const FONT_FAMILY = 'sans-serif';

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// 슬롯에 걸린 위반 중 가장 무거운 것. 없으면 null.
function worstSeverity(result: PipelineResult, slotId: string): Severity | null {
  const mine = result.violations.filter((v) => v.slotId === slotId);
  if (mine.some((v) => v.severity === 'error')) return 'error';
  if (mine.some((v) => v.severity === 'warn')) return 'warn';
  return null;
}

function renderSlot(ctx: MatchContext, result: PipelineResult, slot: Slot): string {
  const { x, y, w, h } = slot.box;
  const contentId = result.assignment.find((a) => a.slotId === slot.id)?.contentId ?? null;
  const item = contentId === null ? undefined : ctx.itemsById[contentId];
  const tip = `<title>${escapeXml(`${slot.id} (${slot.role}) ← ${contentId ?? '비어 있음'}`)}</title>`;

  if (item === undefined) {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${COLOR_EMPTY}" stroke-dasharray="${DASH}">${tip}</rect>`;
  }

  const severity = worstSeverity(result, slot.id);
  const color = severity === 'error' ? COLOR_ERROR : severity === 'warn' ? COLOR_WARN : COLOR_OK;
  const parts = [
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}" fill-opacity="${RENDER_SLOT_FILL_OPACITY}" stroke="${color}">${tip}</rect>`,
  ];

  if (slot.type === 'text' && item.text !== undefined) {
    // 가정: 첫 줄 기준선은 박스 위에서 fontSize만큼 내려온 곳. 넘친 줄은 자르지 않고 그대로 보여 준다.
    const fontSize = result.adjustments.fontSize[slot.id] ?? slot.fontSize;
    wrapLines(item.text, fontSize, w).forEach((line, i) => {
      const baseline = y + fontSize + i * lineHeight(fontSize);
      parts.push(
        `<text x="${x}" y="${baseline}" font-size="${fontSize}" font-family="${FONT_FAMILY}" fill="${COLOR_TEXT}" xml:space="preserve">${escapeXml(line)}</text>`,
      );
    });
  } else {
    // 이미지는 그리지 않고 항목 id만 적는다.
    parts.push(
      `<text x="${x + w / 2}" y="${y + h / 2}" font-size="${RENDER_IMAGE_LABEL_FONT_SIZE}" font-family="${FONT_FAMILY}" fill="${COLOR_TEXT}" text-anchor="middle">${escapeXml(`[image] ${item.id}`)}</text>`,
    );
  }
  return parts.join('\n');
}

export function renderSvg(ctx: MatchContext, result: PipelineResult): string {
  const root = ctx.template.root.box;
  const width = root.x + root.w;
  const frameBottom = root.y + root.h;
  const height = frameBottom + RENDER_FOOTER_HEIGHT;
  const errors = result.violations.filter((v) => v.severity === 'error').length;
  const warns = result.violations.length - errors;
  // fallback 적용 횟수 = trace의 'fallback#' 줄 수(pipeline이 단계를 적용할 때마다 한 줄 남긴다).
  const fallbacks = result.trace.filter((line) => line.startsWith('fallback#')).length;
  const footer = `status: ${result.status} · matcher: ${result.matcher} · error ${errors} · warn ${warns} · dropped ${result.dropped.length} · fallback ${fallbacks}`;

  const groups = collectGroups(ctx.template.root).map(
    (g) =>
      `<rect x="${g.box.x}" y="${g.box.y}" width="${g.box.w}" height="${g.box.h}" fill="none" stroke="${COLOR_GROUP}" stroke-dasharray="${DASH}"><title>${escapeXml(g.id)}</title></rect>`,
  );
  const slots = ctx.slots.map((slot) => renderSlot(ctx, result, slot));

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`,
    `<rect x="${root.x}" y="${root.y}" width="${root.w}" height="${root.h}" fill="none" stroke="${COLOR_GROUP}"/>`,
    ...groups,
    ...slots,
    `<text x="${RENDER_FOOTER_PADDING}" y="${frameBottom + RENDER_FOOTER_HEIGHT / 2}" font-size="${RENDER_FOOTER_FONT_SIZE}" font-family="${FONT_FAMILY}" fill="${COLOR_TEXT}" dominant-baseline="middle">${escapeXml(footer)}</text>`,
    '</svg>',
    '',
  ].join('\n');
}
