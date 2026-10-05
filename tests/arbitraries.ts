// fast-check 랜덤 입력 생성기: Template(frame 아래 슬롯과 1단계 그룹)과 Content.
import fc from 'fast-check';
import type { Content, ContentItem, GroupNode, Role, Slot, Template, TemplateNode } from '../src/schema';

type TextRole = Exclude<Role, 'image'>;
type SlotSeed =
  | { type: 'text'; role: TextRole; w: number; h: number; fontSize: number; maxLines: number }
  | { type: 'image'; w: number; h: number };

const textRole = fc.constantFrom<TextRole>('title', 'subtitle', 'body', 'caption');
const role = fc.constantFrom<Role>('title', 'subtitle', 'body', 'caption', 'image');

const slotSeed: fc.Arbitrary<SlotSeed> = fc.oneof(
  fc.record({
    type: fc.constant('text' as const),
    role: textRole,
    w: fc.integer({ min: 40, max: 600 }),
    h: fc.integer({ min: 20, max: 300 }),
    fontSize: fc.integer({ min: 10, max: 48 }),
    maxLines: fc.integer({ min: 1, max: 6 }),
  }),
  fc.record({
    type: fc.constant('image' as const),
    w: fc.integer({ min: 40, max: 600 }),
    h: fc.integer({ min: 20, max: 300 }),
  }),
);

// frame의 자식 하나: 슬롯 하나이거나, 슬롯 1~3개를 가진 그룹(중첩 1단계).
const childSeed: fc.Arbitrary<SlotSeed | SlotSeed[]> = fc.oneof(
  slotSeed,
  fc.array(slotSeed, { minLength: 1, maxLength: 3 }),
);

// id는 순번으로 붙여 유일하게 만든다. 좌표는 매칭과 무관해 고정한다.
export const templateArb: fc.Arbitrary<Template> = fc
  .array(childSeed, { minLength: 0, maxLength: 5 })
  .map((seeds) => {
    let slotCount = 0;
    let groupCount = 0;
    const toSlot = (seed: SlotSeed): Slot => {
      const id = `s${slotCount++}`;
      const box = { x: 0, y: 0, w: seed.w, h: seed.h };
      if (seed.type === 'image') return { id, type: 'image', role: 'image', box };
      return {
        id, type: 'text', role: seed.role, box,
        fontSize: seed.fontSize, minFontSize: Math.min(seed.fontSize, 10), maxLines: seed.maxLines,
      };
    };
    const children: TemplateNode[] = seeds.map((seed) => {
      if (!Array.isArray(seed)) return toSlot(seed);
      const group: GroupNode = {
        id: `g${groupCount++}`, type: 'group', box: { x: 0, y: 0, w: 600, h: 300 }, children: [],
      };
      group.children = seed.map(toSlot);
      return group;
    });
    return {
      id: 't-random',
      description: 'fast-check 랜덤 템플릿',
      root: { id: 'root', type: 'frame', box: { x: 0, y: 0, w: 600, h: 400 }, children },
    };
  });

type ItemSeed = {
  kind: 'text' | 'image';
  roleHint: Role | undefined;
  text: string;
  groupId: string | undefined;
  priority: 1 | 2 | 3;
};

const itemSeed: fc.Arbitrary<ItemSeed> = fc.record({
  kind: fc.constantFrom<'text' | 'image'>('text', 'text', 'text', 'image'),
  roleHint: fc.option(role, { nil: undefined }),
  text: fc.stringMatching(/^[가-힣A-Za-z0-9 ]{0,40}$/),
  groupId: fc.option(fc.constantFrom('cg0', 'cg1', 'cg2'), { nil: undefined }),
  priority: fc.constantFrom<1 | 2 | 3>(1, 2, 3),
});

// id는 순번으로 유일. text 항목은 항상 text를 갖고, image 항목은 갖지 않는다.
export const contentArb: fc.Arbitrary<Content> = fc
  .array(itemSeed, { minLength: 0, maxLength: 8 })
  .map((seeds) => ({
    id: 'c-random',
    description: 'fast-check 랜덤 콘텐츠',
    items: seeds.map((seed, index): ContentItem => {
      const item: ContentItem = { id: `i${index}`, kind: seed.kind, priority: seed.priority };
      if (seed.kind === 'text') item.text = seed.text;
      if (seed.roleHint !== undefined) item.roleHint = seed.roleHint;
      if (seed.groupId !== undefined) item.groupId = seed.groupId;
      return item;
    }),
  }));
