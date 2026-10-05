// 콘텐츠(배치할 항목 목록) 타입과 zod 스키마.
import { z } from 'zod';
import { RoleSchema } from './template';
import type { Role } from './template';

export type ContentItem = {
  id: string;
  kind: 'text' | 'image';
  roleHint?: Role;
  text?: string;          // kind === 'text'이면 필수
  groupId?: string;       // 같은 카드에 속해야 하는 항목
  priority: 1 | 2 | 3;    // 1 = 절대 버리면 안 됨
};
export type Content = { id: string; description: string; items: ContentItem[] }; // 배열 순서 = 들어온 순서

export const ContentItemSchema: z.ZodType<ContentItem> = z
  .strictObject({
    id: z.string().min(1),
    kind: z.enum(['text', 'image']),
    roleHint: RoleSchema.optional(),
    text: z.string().optional(),
    groupId: z.string().min(1).optional(),
    priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  })
  .refine((item) => item.kind !== 'text' || item.text !== undefined, {
    message: "kind가 'text'이면 text가 필요하다",
    path: ['text'],
  });

// 가정: 항목 id는 콘텐츠 안에서 유일하다(assignment가 contentId로 항목을 가리키므로).
export const ContentSchema: z.ZodType<Content> = z
  .strictObject({
    id: z.string().min(1),
    description: z.string(),
    items: z.array(ContentItemSchema),
  })
  .refine((c) => new Set(c.items.map((i) => i.id)).size === c.items.length, {
    message: '콘텐츠 항목 id가 중복된다',
    path: ['items'],
  });
