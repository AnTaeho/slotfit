// 템플릿(중첩 트리) 타입과 zod 스키마.
import { z } from 'zod';

export type Box = { x: number; y: number; w: number; h: number };
export type Role = 'title' | 'subtitle' | 'body' | 'caption' | 'image';

export type FrameNode = { id: string; type: 'frame'; box: Box; children: TemplateNode[] };
export type GroupNode = { id: string; type: 'group'; box: Box; children: TemplateNode[] };
export type TextSlot = {
  id: string; type: 'text'; role: Exclude<Role, 'image'>; box: Box;
  fontSize: number; minFontSize: number; maxLines: number;
};
export type ImageSlot = { id: string; type: 'image'; role: 'image'; box: Box };
export type TemplateNode = FrameNode | GroupNode | TextSlot | ImageSlot;
export type Slot = TextSlot | ImageSlot;

export type Template = { id: string; description: string; root: FrameNode };

// 가정: 박스의 폭/높이와 폰트 크기는 양수여야 줄 수 계산이 성립하므로 스키마에서 막는다.
export const BoxSchema: z.ZodType<Box> = z.strictObject({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
});

export const RoleSchema: z.ZodType<Role> = z.enum(['title', 'subtitle', 'body', 'caption', 'image']);

// 재귀 타입이라 z.lazy로 감싼다. 아래 스키마들을 호출 시점에 참조한다.
export const TemplateNodeSchema: z.ZodType<TemplateNode> = z.lazy(() =>
  z.union([FrameNodeSchema, GroupNodeSchema, TextSlotSchema, ImageSlotSchema]),
);

export const FrameNodeSchema: z.ZodType<FrameNode> = z.strictObject({
  id: z.string().min(1),
  type: z.literal('frame'),
  box: BoxSchema,
  children: z.array(TemplateNodeSchema),
});

export const GroupNodeSchema: z.ZodType<GroupNode> = z.strictObject({
  id: z.string().min(1),
  type: z.literal('group'),
  box: BoxSchema,
  children: z.array(TemplateNodeSchema),
});

export const TextSlotSchema: z.ZodType<TextSlot> = z.strictObject({
  id: z.string().min(1),
  type: z.literal('text'),
  role: z.enum(['title', 'subtitle', 'body', 'caption']),
  box: BoxSchema,
  fontSize: z.number().positive(),
  minFontSize: z.number().positive(),
  maxLines: z.number().int().positive(),
});

export const ImageSlotSchema: z.ZodType<ImageSlot> = z.strictObject({
  id: z.string().min(1),
  type: z.literal('image'),
  role: z.literal('image'),
  box: BoxSchema,
});

function nodeIds(node: TemplateNode): string[] {
  if (node.type === 'frame' || node.type === 'group') {
    return [node.id, ...node.children.flatMap(nodeIds)];
  }
  return [node.id];
}

// 가정: 노드 id는 템플릿 안에서 유일하다(assignment가 slotId로 슬롯을 가리키므로).
export const TemplateSchema: z.ZodType<Template> = z
  .strictObject({
    id: z.string().min(1),
    description: z.string(),
    root: FrameNodeSchema,
  })
  .refine(
    (t) => {
      const ids = nodeIds(t.root);
      return new Set(ids).size === ids.length;
    },
    { message: '템플릿 노드 id가 중복된다', path: ['root'] },
  );
