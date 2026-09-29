import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';
import courseContent from './course-content.json';
import { cleanHtml } from '../src/common/validation';

const departments = [
  { id: 'cinema', slug: 'cinema', label: 'هنرهای نمایشی', latin: 'CINEMA & PERFORMING ARTS' },
  { id: 'tech', slug: 'tech', label: 'مهارت‌های تخصصی', latin: 'PROFESSIONAL SKILLS' },
];

const courses = [
  {
    id: 'acting', departmentId: 'cinema', title: 'بازیگری', latin: 'ACTING',
    description: 'از بدن و صدا تا حضور مقابل دوربین؛ تمرین، تکنیک و تجربه صحنه.',
    level: 'مقدماتی تا پیشرفته', duration: '۴۸ جلسه', iconKey: 'Drama',
  },
  {
    id: 'cinematography', departmentId: 'cinema', title: 'فیلم‌برداری', latin: 'CINEMATOGRAPHY',
    description: 'زبان دوربین، کادربندی و نور؛ ساختن تصویری که قصه را روایت کند.',
    level: 'مقدماتی تا پیشرفته', duration: '۳۶ جلسه', iconKey: 'Camera',
  },
  {
    id: 'directing', departmentId: 'cinema', title: 'کارگردانی', latin: 'DIRECTING',
    description: 'از فیلمنامه تا صحنه؛ تصمیم‌گیری، رهبری تیم و ساختن جهان فیلم.',
    level: 'متوسط تا پیشرفته', duration: '۴۰ جلسه', iconKey: 'Clapperboard',
  },
  {
    id: 'makeup', departmentId: 'cinema', title: 'گریم', latin: 'MAKEUP DESIGN',
    description: 'طراحی چهره و شخصیت؛ از گریم سینمایی تا جلوه‌های ویژه چهره.',
    level: 'مقدماتی تا پیشرفته', duration: '۳۲ جلسه', iconKey: 'Palette',
  },
  {
    id: 'editing', departmentId: 'cinema', title: 'تدوین', latin: 'EDITING',
    description: 'ریتم، روایت و ساختار؛ جایی که فیلم واقعاً ساخته می‌شود.',
    level: 'مقدماتی تا پیشرفته', duration: '۳۰ جلسه', iconKey: 'Scissors',
  },
  {
    id: 'filmmaking', departmentId: 'cinema', title: 'فیلم‌سازی', latin: 'FILMMAKING',
    description: 'مسیر کامل ساخت یک فیلم کوتاه؛ از ایده تا نمایش، پروژه‌محور.',
    level: 'همه سطوح', duration: '۴۴ جلسه', iconKey: 'Aperture',
  },
  {
    id: 'vfx', departmentId: 'cinema', title: 'جلوه‌های بصری', latin: 'VISUAL EFFECTS',
    description: 'Compositing، Motion و ساخت جهان‌هایی که دوربین نمی‌بیند.',
    level: 'متوسط تا پیشرفته', duration: '۳۸ جلسه', iconKey: 'Sparkles',
  },
  {
    id: 'music', departmentId: 'tech', title: 'موسیقی', latin: 'MUSIC',
    description: 'ساز، تئوری و ساختن قطعه؛ از شنیدن تا اجرا و ضبط.',
    level: 'مقدماتی تا پیشرفته', duration: '۴۸ جلسه', iconKey: 'Music',
  },
  {
    id: 'programming', departmentId: 'tech', title: 'برنامه‌نویسی', latin: 'PROGRAMMING',
    description: 'از منطق تا پروژه واقعی؛ وب، اپلیکیشن و تفکر مهندسی.',
    level: 'مقدماتی تا پیشرفته', duration: '۵۲ جلسه', iconKey: 'Code2',
  },
  {
    id: 'ai', departmentId: 'tech', title: 'هوش مصنوعی', latin: 'ARTIFICIAL INTELLIGENCE',
    description: 'Machine Learning و ابزارهای مولد؛ ساختن با داده و مدل.',
    level: 'متوسط تا پیشرفته', duration: '۴۰ جلسه', iconKey: 'BrainCircuit',
  },
  {
    id: 'it', departmentId: 'tech', title: 'IT و شبکه', latin: 'IT & NETWORK',
    description: 'زیرساخت، شبکه و امنیت؛ ستون فقرات دنیای دیجیتال.',
    level: 'مقدماتی تا پیشرفته', duration: '۳۶ جلسه', iconKey: 'Server',
  },
  {
    id: 'language', departmentId: 'tech', title: 'زبان انگلیسی', latin: 'ENGLISH LANGUAGE',
    description: 'مهارت چهارگانه با تمرکز بر مکالمه واقعی و مسیر آزمون.',
    level: 'همه سطوح', duration: '۶۰ جلسه', iconKey: 'Languages',
  },
];

export async function seedContent(tx: Prisma.TransactionClient, completeExisting = false) {
  const publishedAt = new Date();
  const departmentIds = new Map<string, string>();
  const paths = new Set<string>();
  for (const department of departments) {
    const existing = await tx.department.findUnique({ where: { slug: department.slug }, select: { id: true } });
    const saved = await tx.department.upsert({
      where: { slug: department.slug },
      create: { ...department, status: 'PUBLISHED', publishedAt },
      update: {},
      select: { id: true },
    });
    departmentIds.set(department.id, saved.id);
    if (!existing) paths.add(`/courses/${department.slug}`);
  }
  for (const course of courses) {
    const departmentId = departmentIds.get(course.departmentId);
    if (!departmentId) throw new Error('Missing seed department');
    const content = courseContent[course.id as keyof typeof courseContent];
    if (!content) throw new Error('Missing seed course content');
    const { faq, ...fields } = content;
    const complete = {
      ...fields,
      contentHtml: cleanHtml(content.contentHtml),
      faq: { create: faq.map((item, position) => ({ ...item, position })) },
    };
    const existing = await tx.course.findFirst({
      where: { OR: [{ id: course.id }, { departmentId, slug: course.id }] },
      select: { id: true, slug: true, department: { select: { slug: true } }, contentHtml: true, syllabus: true, faq: { select: { id: true } }, seoTitle: true, seoDescription: true },
    });
    const update: Prisma.CourseUpdateInput = {};
    if (existing && completeExisting) {
      if (!existing.contentHtml.trim()) update.contentHtml = complete.contentHtml;
      if (existing.syllabus.length === 0) update.syllabus = complete.syllabus;
      if (existing.faq.length === 0) update.faq = complete.faq;
      if (existing.seoTitle === null) update.seoTitle = complete.seoTitle;
      if (existing.seoDescription === null) update.seoDescription = complete.seoDescription;
    }
    if (existing && Object.keys(update).length === 0) continue;
    const saved = await tx.course.upsert({
      where: { id: existing?.id ?? course.id },
      create: { ...course, ...complete, departmentId, slug: course.id, status: 'PUBLISHED', publishedAt },
      update,
      select: { slug: true, department: { select: { slug: true } } },
    });
    paths.add(`/courses/${saved.department.slug}`);
    paths.add(`/courses/${saved.department.slug}/${saved.slug}`);
  }
  if (paths.size > 0) {
    const revision = await tx.contentRevision.upsert({
      where: { id: 1 },
      create: { id: 1, version: 1 },
      update: { version: { increment: 1 } },
      select: { version: true },
    });
    await tx.revalidationOutbox.create({ data: { version: revision.version, paths: ['/', '/courses', ...paths] } });
  }
}

export async function main() {
  if (process.env.NODE_ENV !== 'development' || process.env.SEED_DEVELOPMENT !== 'true') {
    throw new Error('Development seed is disabled');
  }
  const prisma = new PrismaClient();
  try {
    // Generous timeout: remote/cloud databases have higher per-query latency
    // than local Postgres (the default 5s interactive timeout is too tight).
    await prisma.$transaction((tx) => seedContent(tx, process.env.SEED_COMPLETE_CONTENT === 'true'), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120000, maxWait: 30000 });
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main().catch(() => {
    process.stderr.write('Development seed failed\n');
    process.exitCode = 1;
  });
}
