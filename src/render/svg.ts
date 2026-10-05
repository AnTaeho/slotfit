// 배치 결과를 박스와 텍스트만 있는 SVG 문자열로 그린다(외부 라이브러리 없음).
import type { MatchContext } from '../context';
import type { Box, ContentItem, GroupNode, PipelineResult, Severity, Slot, TextSlot } from '../schema';
import { countFallbacks, countViolations } from '../pipeline';
import {
  RENDER_FOOTER_FONT_SIZE, RENDER_FOOTER_HEIGHT, RENDER_FOOTER_PADDING,
  RENDER_IMAGE_LABEL_FONT_SIZE, RENDER_SLOT_FILL_OPACITY,
} from '../scoring/weights';
import { currentFontSize, lineHeight, wrapLines } from '../text/measure';
import { collectGroups } from '../tree/traverse';

const COLOR_ERROR = '#d92d20'; // 빨강
const COLOR_WARN = '#f79009'; // 주황
const COLOR_OK = '#12b76a'; // 초록
const COLOR_EMPTY = '#98a2b3'; // 회색
const COLOR_GROUP = '#667085';
const COLOR_TEXT = '#101828';
const COLOR_BACKGROUND = '#ffffff';
const DASH = '6 4';
const FONT_FAMILY = 'sans-serif';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// <rect>의 위치·크기 속성. 모든 사각형이 이 순서로 시작한다.
function boxAttrs({ x, y, w, h }: Box): string {
  return `x="${x}" y="${y}" width="${w}" height="${h}"`;
}

// 슬롯에 걸린 위반 중 가장 무거운 것. 없으면 null.
function worstSeverity(result: PipelineResult, slotId: string): Severity | null {
  const mine = result.violations.filter((v) => v.slotId === slotId);
  if (mine.some((v) => v.severity === 'error')) return 'error';
  if (mine.some((v) => v.severity === 'warn')) return 'warn';
  return null;
}

function severityColor(severity: Severity | null): string {
  if (severity === 'error') return COLOR_ERROR;
  if (severity === 'warn') return COLOR_WARN;
  return COLOR_OK;
}

function renderGroupOutline(group: GroupNode): string {
  return `<rect ${boxAttrs(group.box)} fill="none" stroke="${COLOR_GROUP}" stroke-dasharray="${DASH}"><title>${escapeXml(group.id)}</title></rect>`;
}

// 텍스트를 근사 줄바꿈해 한 줄씩 <text>로 놓는다.
// 가정: 첫 줄 기준선은 박스 위에서 fontSize만큼 내려온 곳. 넘친 줄은 자르지 않고 그대로 보여 준다.
function renderTextLines(text: string, slot: TextSlot, result: PipelineResult): string[] {
  const { x, y, w } = slot.box;
  const fontSize = currentFontSize(slot, result.adjustments);
  return wrapLines(text, fontSize, w).map((line, lineIndex) => {
    const baseline = y + fontSize + lineIndex * lineHeight(fontSize);
    return `<text x="${x}" y="${baseline}" font-size="${fontSize}" font-family="${FONT_FAMILY}" fill="${COLOR_TEXT}" xml:space="preserve">${escapeXml(line)}</text>`;
  });
}

// 이미지는 그리지 않고 박스 가운데에 항목 id만 적는다.
function renderImageLabel(item: ContentItem, slot: Slot): string {
  const { x, y, w, h } = slot.box;
  return `<text x="${x + w / 2}" y="${y + h / 2}" font-size="${RENDER_IMAGE_LABEL_FONT_SIZE}" font-family="${FONT_FAMILY}" fill="${COLOR_TEXT}" text-anchor="middle">${escapeXml(`[image] ${item.id}`)}</text>`;
}

// 빈 슬롯은 회색 점선, 찬 슬롯은 가장 무거운 위반 색(없으면 초록)으로 칠하고 내용을 얹는다.
function renderSlot(ctx: MatchContext, result: PipelineResult, slot: Slot): string {
  const contentId = result.assignment.find((a) => a.slotId === slot.id)?.contentId ?? null;
  const item = contentId === null ? undefined : ctx.itemsById[contentId];
  const tooltip = `<title>${escapeXml(`${slot.id} (${slot.role}) ← ${contentId ?? '비어 있음'}`)}</title>`;

  if (item === undefined) {
    return `<rect ${boxAttrs(slot.box)} fill="none" stroke="${COLOR_EMPTY}" stroke-dasharray="${DASH}">${tooltip}</rect>`;
  }

  const color = severityColor(worstSeverity(result, slot.id));
  const background = `<rect ${boxAttrs(slot.box)} fill="${color}" fill-opacity="${RENDER_SLOT_FILL_OPACITY}" stroke="${color}">${tooltip}</rect>`;
  const body = slot.type === 'text' && item.text !== undefined
    ? renderTextLines(item.text, slot, result)
    : [renderImageLabel(item, slot)];
  return [background, ...body].join('\n');
}

// 프레임 아래 띠에 status·matcher·위반 수·버림 수·fallback 횟수를 한 줄로 적는다.
function renderFooter(result: PipelineResult, frameBottom: number): string {
  const { errors, warns } = countViolations(result.violations);
  const summary = `status: ${result.status} · matcher: ${result.matcher} · error ${errors} · warn ${warns} · dropped ${result.dropped.length} · fallback ${countFallbacks(result)}`;
  return `<text x="${RENDER_FOOTER_PADDING}" y="${frameBottom + RENDER_FOOTER_HEIGHT / 2}" font-size="${RENDER_FOOTER_FONT_SIZE}" font-family="${FONT_FAMILY}" fill="${COLOR_TEXT}" dominant-baseline="middle">${escapeXml(summary)}</text>`;
}

export function renderSvg(ctx: MatchContext, result: PipelineResult): string {
  const frame = ctx.template.root.box;
  const width = frame.x + frame.w;
  const frameBottom = frame.y + frame.h;
  const height = frameBottom + RENDER_FOOTER_HEIGHT;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect x="0" y="0" width="${width}" height="${height}" fill="${COLOR_BACKGROUND}"/>`,
    `<rect ${boxAttrs(frame)} fill="none" stroke="${COLOR_GROUP}"/>`,
    ...collectGroups(ctx.template.root).map(renderGroupOutline),
    ...ctx.slots.map((slot) => renderSlot(ctx, result, slot)),
    renderFooter(result, frameBottom),
    '</svg>',
    '',
  ].join('\n');
}
