// schema: fixture 전체가 zod 검증을 통과하는지, 잘못된 콘텐츠를 막는지 확인한다.
import { describe, expect, it } from 'vitest';
import { loadAllContents, loadAllGoldens, loadAllTemplates } from '../src/io/loader';
import { ContentSchema } from '../src/schema';

describe('schema', () => {
  it('모든 fixture가 zod 검증을 통과한다', () => {
    // loader는 검증에 실패하면 예외를 던진다.
    expect(loadAllTemplates().length).toBeGreaterThan(0);
    expect(loadAllContents().length).toBeGreaterThan(0);
    expect(loadAllGoldens().length).toBeGreaterThan(0);
  });

  it('text 콘텐츠에 text 필드가 없으면 실패한다', () => {
    const withoutText = {
      id: 'c-bad',
      description: 'text가 빠진 text 항목',
      items: [{ id: 'a', kind: 'text', priority: 1 }],
    };
    expect(ContentSchema.safeParse(withoutText).success).toBe(false);

    const imageWithoutText = { ...withoutText, items: [{ id: 'a', kind: 'image', priority: 1 }] };
    expect(ContentSchema.safeParse(imageWithoutText).success).toBe(true);
  });
});
