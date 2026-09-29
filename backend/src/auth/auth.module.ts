import { Body, Controller, Get, Header, HttpCode, Module, Param, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCookieAuth, ApiHeader, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Config } from '../infrastructure/config';
import { randomToken, SchemaPipe, signature } from '../common/validation';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { AccessGuard, AdminIpGuard, AuthRequest, cookie, cookieNames, LoginCsrfGuard, OriginGuard, Roles, SessionCsrfGuard } from './guards';
import { AccessDto, accessSchema, CsrfDto, emptySchema, LoginDto, loginSchema, TokensDto, userIdSchema } from './dto';

@ApiTags('auth')
@ApiHeader({ name: 'Origin', required: true })
@UseGuards(AdminIpGuard)
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly config: Config) {}
  private cookies(res: Response, refresh: string, csrf: string, expiresAt: Date) {
    const names = cookieNames(this.config.production);
    const options = { httpOnly: true, secure: this.config.production, sameSite: 'strict' as const, path: '/', expires: expiresAt };
    res.cookie(names.refresh, refresh, options);
    res.cookie(names.csrf, csrf, options);
  }
  @Get('csrf')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: CsrfDto })
  @UseGuards(OriginGuard)
  csrf(@Res({ passthrough: true }) res: Response) {
    const value = `${randomToken()}.${Date.now()}`;
    const csrfToken = `${value}.${signature(this.config.value.CSRF_SECRET, value)}`;
    res.cookie(cookieNames(this.config.production).csrf, csrfToken, { httpOnly: true, secure: this.config.production, sameSite: 'strict', path: '/', maxAge: 600000 });
    return { csrfToken };
  }
  @Post('login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiBody({ type: LoginDto })
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiOkResponse({ type: TokensDto })
  @UseGuards(OriginGuard, LoginCsrfGuard)
  async login(@Body(new SchemaPipe(loginSchema)) body: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(body.email, body.password);
    this.cookies(res, result.refresh, result.csrf, result.expiresAt);
    return { accessToken: result.accessToken, csrfToken: result.csrf, expiresIn: result.expiresIn, role: result.role };
  }
  @Post('refresh')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiCookieAuth()
  @ApiBody({ schema: { type: 'object', additionalProperties: false } })
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiOkResponse({ type: TokensDto })
  @UseGuards(OriginGuard, SessionCsrfGuard)
  async refresh(@Req() req: Request, @Body(new SchemaPipe(emptySchema)) _body: Record<string, never>, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.rotate(cookie(req, cookieNames(this.config.production).refresh), req.get('x-csrf-token')!);
    this.cookies(res, result.refresh, result.csrf, result.expiresAt);
    return { accessToken: result.accessToken, csrfToken: result.csrf, expiresIn: result.expiresIn, role: result.role };
  }
  @Post('logout')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiCookieAuth()
  @ApiBody({ schema: { type: 'object', additionalProperties: false } })
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @UseGuards(OriginGuard, SessionCsrfGuard)
  async logout(@Req() req: Request, @Body(new SchemaPipe(emptySchema)) _body: Record<string, never>, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(cookie(req, cookieNames(this.config.production).refresh), req.get('x-csrf-token')!);
    for (const name of Object.values(cookieNames(this.config.production))) res.clearCookie(name, { httpOnly: true, secure: this.config.production, sameSite: 'strict', path: '/' });
    return { ok: true };
  }
  @Get('me')
  @Header('Cache-Control', 'no-store')
  @ApiBearerAuth()
  @UseGuards(AccessGuard)
  @Roles('SUPER_ADMIN', 'CONTENT_MANAGER', 'BLOG_EDITOR')
  me(@Req() req: AuthRequest) { return { id: req.user.id, role: req.user.role }; }
}

@ApiTags('admin')
@ApiBearerAuth()
@ApiHeader({ name: 'Origin', required: true })
@ApiHeader({ name: 'X-CSRF-Token', required: true })
@Controller('admin/users')
@UseGuards(AccessGuard)
@Roles('SUPER_ADMIN')
export class AdminUsersController {
  constructor(private readonly auth: AuthService) {}
  @Patch(':id/access')
  @Header('Cache-Control', 'no-store')
  @ApiBody({ type: AccessDto })
  change(@Req() req: AuthRequest, @Param('id', new SchemaPipe(userIdSchema)) id: string, @Body(new SchemaPipe(accessSchema)) body: AccessDto) {
    return this.auth.changeUser(req.user.id, id, body.role, body.active);
  }
}

@Module({ controllers: [AuthController, AdminUsersController], providers: [AuthService, AuthRepository, AccessGuard, AdminIpGuard, OriginGuard, LoginCsrfGuard, SessionCsrfGuard], exports: [AuthService, AccessGuard] })
export class AuthModule {}
