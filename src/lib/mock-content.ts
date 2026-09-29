import "server-only";
import { courses, departmentMeta } from "@/data/courses";
import type { CourseDto, DepartmentDto, IconKey } from "./content-contract";
import courseContent from "../../backend/prisma/course-content.json";

type AuthoredContent = Pick<CourseDto, "contentHtml" | "syllabus" | "faq"> & { seoTitle: string; seoDescription: string };
const authoredCourses: Record<string, AuthoredContent> = courseContent;

const fixtureIcons: Record<string, IconKey> = {
  acting: "Drama", cinematography: "Camera", directing: "Clapperboard", makeup: "Palette", editing: "Scissors", filmmaking: "Aperture", vfx: "Sparkles", music: "Music", programming: "Code2", ai: "BrainCircuit", it: "Server", language: "Languages",
};
const updatedAt = "2026-01-01T00:00:00.000Z";
export const mockDepartments: DepartmentDto[] = [
  { id: "cinema", slug: "cinema", ...departmentMeta.cinema, description: "بازیگری، فیلم‌برداری، کارگردانی و هر چیزی که پشت و جلوی دوربین اتفاق می‌افتد؛ با تمرین واقعی در فضای کارگاهی.", updatedAt },
  { id: "tech", slug: "tech", ...departmentMeta.tech, description: "موسیقی، برنامه‌نویسی، هوش مصنوعی، IT و زبان؛ مهارت‌هایی که مسیر حرفه‌ای شما را در دنیای امروز می‌سازند.", updatedAt },
];
export const mockCourses: CourseDto[] = courses.map(({ id, title, latin, department, description, level, duration }) => {
  const content = authoredCourses[id];
  if (!content) throw new Error(`Missing authored course content: ${id}`);
  return {
    id, slug: id, title, latin, department, description, level, duration, iconKey: fixtureIcons[id],
    contentHtml: content.contentHtml, syllabus: content.syllabus, faq: content.faq, instructors: [],
    coverMedia: null, customPath: null,
    seo: { title: content.seoTitle, description: content.seoDescription, canonicalUrl: null, noindex: true }, updatedAt, publishedAt: null,
  };
});
