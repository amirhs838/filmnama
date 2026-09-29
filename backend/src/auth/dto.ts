import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const loginSchema = z.object({ email: z.string().email().max(254).transform((x) => x.toLowerCase()), password: z.string().min(1).max(256) }).strict();
export const accessSchema = z.object({ role: z.enum(['SUPER_ADMIN', 'CONTENT_MANAGER', 'BLOG_EDITOR']), active: z.boolean() }).strict();
export const emptySchema = z.object({}).strict();
export const userIdSchema = z.string().cuid();

export class LoginDto {
  @ApiProperty({ format: 'email', maxLength: 254 })
  email!: string;
  @ApiProperty({ minLength: 1, maxLength: 256, format: 'password' })
  password!: string;
}
export class AccessDto {
  @ApiProperty({ enum: ['SUPER_ADMIN', 'CONTENT_MANAGER', 'BLOG_EDITOR'] })
  role!: 'SUPER_ADMIN' | 'CONTENT_MANAGER' | 'BLOG_EDITOR';
  @ApiProperty()
  active!: boolean;
}
export class CsrfDto {
  @ApiProperty()
  csrfToken!: string;
}
export class TokensDto extends CsrfDto {
  @ApiProperty()
  accessToken!: string;
  @ApiProperty({ example: 900 })
  expiresIn!: number;
  @ApiProperty({ enum: ['SUPER_ADMIN', 'CONTENT_MANAGER', 'BLOG_EDITOR'] })
  role!: string;
}
