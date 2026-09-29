import type { LucideIcon } from "lucide-react";
import {
  Clapperboard,
  Camera,
  Aperture,
  Scissors,
  Palette,
  Sparkles,
  Drama,
  Music,
  Code2,
  BrainCircuit,
  Server,
  Languages,
} from "lucide-react";

export type Department = "cinema" | "tech";

export interface Course {
  id: string;
  title: string;
  latin: string;
  department: Department;
  description: string;
  level: string;
  duration: string;
  icon: LucideIcon;
}

export const departmentMeta: Record<
  Department,
  { label: string; latin: string }
> = {
  cinema: { label: "هنرهای نمایشی", latin: "CINEMA & PERFORMING ARTS" },
  tech: { label: "مهارت‌های تخصصی", latin: "PROFESSIONAL SKILLS" },
};

export const courses: Course[] = [
  // --- Cinema & Performing Arts ---
  {
    id: "acting",
    title: "بازیگری",
    latin: "ACTING",
    department: "cinema",
    description: "از بدن و صدا تا حضور مقابل دوربین؛ تمرین، تکنیک و تجربه صحنه.",
    level: "مقدماتی تا پیشرفته",
    duration: "۴۸ جلسه",
    icon: Drama,
  },
  {
    id: "cinematography",
    title: "فیلم‌برداری",
    latin: "CINEMATOGRAPHY",
    department: "cinema",
    description: "زبان دوربین، کادربندی و نور؛ ساختن تصویری که قصه را روایت کند.",
    level: "مقدماتی تا پیشرفته",
    duration: "۳۶ جلسه",
    icon: Camera,
  },
  {
    id: "directing",
    title: "کارگردانی",
    latin: "DIRECTING",
    department: "cinema",
    description: "از فیلمنامه تا صحنه؛ تصمیم‌گیری، رهبری تیم و ساختن جهان فیلم.",
    level: "متوسط تا پیشرفته",
    duration: "۴۰ جلسه",
    icon: Clapperboard,
  },
  {
    id: "makeup",
    title: "گریم",
    latin: "MAKEUP DESIGN",
    department: "cinema",
    description: "طراحی چهره و شخصیت؛ از گریم سینمایی تا جلوه‌های ویژه چهره.",
    level: "مقدماتی تا پیشرفته",
    duration: "۳۲ جلسه",
    icon: Palette,
  },
  {
    id: "editing",
    title: "تدوین",
    latin: "EDITING",
    department: "cinema",
    description: "ریتم، روایت و ساختار؛ جایی که فیلم واقعاً ساخته می‌شود.",
    level: "مقدماتی تا پیشرفته",
    duration: "۳۰ جلسه",
    icon: Scissors,
  },
  {
    id: "filmmaking",
    title: "فیلم‌سازی",
    latin: "FILMMAKING",
    department: "cinema",
    description: "مسیر کامل ساخت یک فیلم کوتاه؛ از ایده تا نمایش، پروژه‌محور.",
    level: "همه سطوح",
    duration: "۴۴ جلسه",
    icon: Aperture,
  },
  {
    id: "vfx",
    title: "جلوه‌های بصری",
    latin: "VISUAL EFFECTS",
    department: "cinema",
    description: "Compositing، Motion و ساخت جهان‌هایی که دوربین نمی‌بیند.",
    level: "متوسط تا پیشرفته",
    duration: "۳۸ جلسه",
    icon: Sparkles,
  },
  // --- Professional Skills ---
  {
    id: "music",
    title: "موسیقی",
    latin: "MUSIC",
    department: "tech",
    description: "ساز، تئوری و ساختن قطعه؛ از شنیدن تا اجرا و ضبط.",
    level: "مقدماتی تا پیشرفته",
    duration: "۴۸ جلسه",
    icon: Music,
  },
  {
    id: "programming",
    title: "برنامه‌نویسی",
    latin: "PROGRAMMING",
    department: "tech",
    description: "از منطق تا پروژه واقعی؛ وب، اپلیکیشن و تفکر مهندسی.",
    level: "مقدماتی تا پیشرفته",
    duration: "۵۲ جلسه",
    icon: Code2,
  },
  {
    id: "ai",
    title: "هوش مصنوعی",
    latin: "ARTIFICIAL INTELLIGENCE",
    department: "tech",
    description: "Machine Learning و ابزارهای مولد؛ ساختن با داده و مدل.",
    level: "متوسط تا پیشرفته",
    duration: "۴۰ جلسه",
    icon: BrainCircuit,
  },
  {
    id: "it",
    title: "IT و شبکه",
    latin: "IT & NETWORK",
    department: "tech",
    description: "زیرساخت، شبکه و امنیت؛ ستون فقرات دنیای دیجیتال.",
    level: "مقدماتی تا پیشرفته",
    duration: "۳۶ جلسه",
    icon: Server,
  },
  {
    id: "language",
    title: "زبان انگلیسی",
    latin: "ENGLISH LANGUAGE",
    department: "tech",
    description: "مهارت چهارگانه با تمرکز بر مکالمه واقعی و مسیر آزمون.",
    level: "همه سطوح",
    duration: "۶۰ جلسه",
    icon: Languages,
  },
];

export const cinemaCourses = courses.filter((c) => c.department === "cinema");
export const techCourses = courses.filter((c) => c.department === "tech");
