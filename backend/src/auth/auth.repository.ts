import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Database } from '../infrastructure/infrastructure.module';
import { hash, safeEqual } from '../common/validation';
import { Prisma } from '@prisma/client';

@Injectable()
export class AuthRepository {
  constructor(private readonly db: Database) {}
  findUser(email: string) { return this.db.user.findUnique({ where: { email } }); }
  async failure(id?: string) {
    await this.db.serial(async (tx) => {
      const user = id ? await tx.user.findUnique({ where: { id } }) : null;
      const now = new Date();
      if (user && user.active && !user.deletedAt && (!user.lockedUntil || user.lockedUntil <= now)) {
        const failedLogins = user.lockedUntil ? 1 : user.failedLogins + 1;
        await tx.user.update({ where: { id: user.id }, data: { failedLogins, lockedUntil: failedLogins >= 5 ? new Date(now.getTime() + 15 * 60_000) : null } });
      }
      await tx.auditLog.create({ data: { actorId: user?.id, action: 'LOGIN_FAILED', entityType: 'User', entityId: user?.id ?? 'unknown' } });
    });
  }
  async login(userId: string, passwordHash: string, data: Prisma.RefreshSessionUncheckedCreateInput) {
    return this.db.serial(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user || !user.active || user.deletedAt || user.passwordHash !== passwordHash || (user.lockedUntil && user.lockedUntil > new Date())) throw new UnauthorizedException('Invalid credentials');
      await tx.user.update({ where: { id: userId }, data: { failedLogins: 0, lockedUntil: null } });
      const session = await tx.refreshSession.create({ data });
      await tx.auditLog.create({ data: { actorId: userId, action: 'LOGIN', entityType: 'User', entityId: userId } });
      return { user, session };
    });
  }
  async rotate(token: string, csrf: string, replacement: { tokenHash: string; csrfHash: string }) {
    return this.db.serial(async (tx) => {
      const current = await tx.refreshSession.findUnique({ where: { tokenHash: hash(token) }, include: { user: true } });
      if (!current || !safeEqual(current.csrfHash, hash(csrf))) return null;
      if (current.consumedAt || current.revokedAt) {
        await tx.refreshSession.updateMany({ where: { familyId: current.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
        await tx.auditLog.create({ data: { actorId: current.userId, action: 'REFRESH_REPLAY', entityType: 'User', entityId: current.userId } });
        return null;
      }
      if (current.expiresAt <= new Date() || !current.user.active || current.user.deletedAt) return null;
      const cas = await tx.refreshSession.updateMany({ where: { id: current.id, consumedAt: null, revokedAt: null }, data: { consumedAt: new Date() } });
      if (cas.count !== 1) {
        await tx.refreshSession.updateMany({ where: { familyId: current.familyId }, data: { revokedAt: new Date() } });
        return null;
      }
      const session = await tx.refreshSession.create({ data: { ...replacement, userId: current.userId, familyId: current.familyId, expiresAt: current.expiresAt } });
      return { session, user: current.user };
    });
  }
  async liveSession(id: string, userId: string) {
    return this.db.refreshSession.findFirst({ where: { id, userId, revokedAt: null, consumedAt: null, expiresAt: { gt: new Date() }, user: { active: true, deletedAt: null } }, include: { user: true } });
  }
  async logout(token: string, csrf: string) {
    await this.db.serial(async (tx) => {
      const session = await tx.refreshSession.findUnique({ where: { tokenHash: hash(token) } });
      if (!session || !safeEqual(session.csrfHash, hash(csrf))) throw new UnauthorizedException();
      await tx.refreshSession.updateMany({ where: { familyId: session.familyId }, data: { revokedAt: new Date() } });
    });
  }
  async changeUser(actorId: string, id: string, role: 'SUPER_ADMIN' | 'CONTENT_MANAGER' | 'BLOG_EDITOR', active: boolean) {
    return this.db.serial(async (tx) => {
      const actor = await tx.user.findUnique({ where: { id: actorId } });
      if (!actor || !actor.active || actor.deletedAt || actor.role !== 'SUPER_ADMIN') throw new UnauthorizedException();
      if (id === actorId && (!active || role !== 'SUPER_ADMIN')) throw new UnauthorizedException('Cannot demote own account');
      const user = await tx.user.update({ where: { id, deletedAt: null }, data: { role, active } });
      await tx.refreshSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId, action: 'ACCESS_CHANGED', entityType: 'User', entityId: id, metadata: { role, active } } });
      return { id: user.id, role: user.role, active: user.active };
    });
  }
}
