import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

const statuses = ['NEW', 'CONTACTED', 'CLOSED'] as const;
export const leadIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || null);
export const leadSchema = z.object({
  submissionId: z.string().uuid().transform((value) => value.toLowerCase()),
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(30).transform((value) => value
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/^(?:\+98|0098)/, '0')).pipe(z.string().regex(/^09[0-9]{9}$/)),
  email: optionalText(254).refine((value) => value === null || z.string().email().safeParse(value).success).transform((value) => value?.toLowerCase() ?? null),
  message: optionalText(2000),
  courseId: optionalText(100),
  consent: z.literal(true),
}).strict();
export type LeadInput = z.infer<typeof leadSchema>;
export const leadStatusSchema = z.object({ status: z.enum(statuses) }).strict();
export type LeadStatusInput = z.infer<typeof leadStatusSchema>;
export const leadListSchema = z.object({
  status: z.enum(statuses).optional(),
  courseId: z.string().trim().min(1).max(100).optional(),
  limit: z.string().regex(/^[1-9][0-9]{0,2}$/).transform(Number).pipe(z.number().max(100)).default('20'),
  cursor: z.string().min(1).max(1000).regex(/^[A-Za-z0-9_-]+$/).optional(),
}).strict();
export type LeadListInput = z.infer<typeof leadListSchema>;
export const leadCursorSchema = z.object({
  id: leadIdSchema,
  createdAt: z.string().datetime().refine((value) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value),
  status: z.enum(statuses).nullable(),
  courseId: z.string().min(1).max(100).nullable(),
}).strict();

export class SubmitLeadDto {
  @ApiProperty({ format: 'uuid' })
  submissionId!: string;
  @ApiProperty({ minLength: 2, maxLength: 100, description: 'Trimmed name' })
  name!: string;
  @ApiProperty({ description: 'Iranian mobile; Persian/Arabic digits and +98/0098 prefixes normalized to 09xxxxxxxxx' })
  phone!: string;
  @ApiPropertyOptional({ format: 'email', maxLength: 254, description: 'Blank is stored as null' })
  email?: string;
  @ApiPropertyOptional({ maxLength: 2000, description: 'Blank is stored as null' })
  message?: string;
  @ApiPropertyOptional({ maxLength: 100, description: 'Published course ID; blank is stored as null' })
  courseId?: string;
  @ApiProperty({ enum: [true] })
  consent!: true;
}
export class AcceptedLeadDto {
  @ApiProperty({ enum: [true] })
  accepted!: true;
}
export class LeadStatusDto {
  @ApiProperty({ enum: statuses })
  status!: LeadStatusInput['status'];
}
export class UpdatedLeadDto extends LeadStatusDto {
  @ApiProperty()
  id!: string;
}
export class AdminLeadDto extends UpdatedLeadDto {
  @ApiProperty()
  name!: string;
  @ApiProperty()
  phone!: string;
  @ApiProperty({ type: String, nullable: true })
  email!: string | null;
  @ApiProperty({ type: String, nullable: true })
  message!: string | null;
  @ApiProperty({ type: String, nullable: true })
  courseId!: string | null;
  @ApiProperty({ format: 'date-time' })
  consentAt!: string;
  @ApiProperty()
  locale!: string;
  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
export class LeadPageDto {
  @ApiProperty({ type: [AdminLeadDto] })
  items!: AdminLeadDto[];
  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;
}
