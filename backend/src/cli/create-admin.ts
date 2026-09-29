import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import { z } from 'zod';

const credentialsSchema = z.object({
  ADMIN_EMAIL: z.string().trim().toLowerCase().email(),
  ADMIN_PASSWORD: z.string().min(16).max(128),
});

export async function main() {
  const { ADMIN_EMAIL: email, ADMIN_PASSWORD: password } = credentialsSchema.parse(process.env);
  const prisma = new PrismaClient();
  try {
    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) throw new Error('Administrator creation failed');
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });
    await prisma.user.create({ data: { email, passwordHash, role: 'SUPER_ADMIN' } });
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main().catch(() => {
    process.stderr.write('Administrator creation failed\n');
    process.exitCode = 1;
  });
}
