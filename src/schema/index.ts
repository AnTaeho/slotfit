// schema 모듈의 타입과 스키마를 한곳에서 내보낸다.
export type {
  Box, Role, FrameNode, GroupNode, TextSlot, ImageSlot, TemplateNode, Slot, Template,
} from './template';
export {
  BoxSchema, RoleSchema, TemplateNodeSchema, FrameNodeSchema, GroupNodeSchema,
  TextSlotSchema, ImageSlotSchema, TemplateSchema,
} from './template';
export type { ContentItem, Content } from './content';
export { ContentItemSchema, ContentSchema } from './content';
export type {
  Assignment, MatchResult, Severity, Violation, Adjustments, Status, PipelineResult, Golden,
} from './result';
export { AssignmentSchema, GoldenSchema } from './result';
