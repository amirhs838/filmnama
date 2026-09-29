export type WorkCategory =
  | "همه"
  | "فیلم"
  | "عکاسی"
  | "تدوین"
  | "بازیگری"
  | "گریم"
  | "موسیقی"
  | "طراحی"
  | "برنامه‌نویسی"
  | "هوش مصنوعی";

export interface StudentWork {
  id: number;
  title: string;
  student: string;
  category: Exclude<WorkCategory, "همه">;
  /** Placeholder — replace with /images/works/<id>.jpg when real assets arrive */
  image: string;
  isVideo: boolean;
}

export const workCategories: WorkCategory[] = [
  "همه",
  "فیلم",
  "عکاسی",
  "تدوین",
  "بازیگری",
  "گریم",
  "موسیقی",
  "طراحی",
  "برنامه‌نویسی",
  "هوش مصنوعی",
];

export const studentWorks: StudentWork[] = [
  {
    id: 1,
    title: "فیلم کوتاه «سکوت خاکستری»",
    student: "گروه فیلم‌سازی ترم سوم",
    category: "فیلم",
    image: "https://picsum.photos/seed/filmnama-work-1/880/550",
    isVideo: true,
  },
  {
    id: 2,
    title: "مجموعه عکس «سایه‌های شهر»",
    student: "نگار توکلی",
    category: "عکاسی",
    image: "https://picsum.photos/seed/filmnama-work-2/880/550",
    isVideo: false,
  },
  {
    id: 3,
    title: "تدوین تیزر «روز اول»",
    student: "کیان محمدی",
    category: "تدوین",
    image: "https://picsum.photos/seed/filmnama-work-3/880/550",
    isVideo: true,
  },
  {
    id: 4,
    title: "مونولوگ «پنجره»",
    student: "درسا رضایی",
    category: "بازیگری",
    image: "https://picsum.photos/seed/filmnama-work-4/880/550",
    isVideo: true,
  },
  {
    id: 5,
    title: "طراحی گریم «شخصیت کهنسال»",
    student: "هستی کریمی",
    category: "گریم",
    image: "https://picsum.photos/seed/filmnama-work-5/880/550",
    isVideo: false,
  },
  {
    id: 6,
    title: "قطعه «باران پاییزی»",
    student: "آرشام نادری",
    category: "موسیقی",
    image: "https://picsum.photos/seed/filmnama-work-6/880/550",
    isVideo: true,
  },
  {
    id: 7,
    title: "هویت بصری «فستیوال دانشجویی»",
    student: "ترلان عزیزی",
    category: "طراحی",
    image: "https://picsum.photos/seed/filmnama-work-7/880/550",
    isVideo: false,
  },
  {
    id: 8,
    title: "وب‌اپ مدیریت کلاس",
    student: "پارسا نیک‌روش (هنرجوی ترم دوم)",
    category: "برنامه‌نویسی",
    image: "https://picsum.photos/seed/filmnama-work-8/880/550",
    isVideo: false,
  },
  {
    id: 9,
    title: "مدل تشخیص احساسات چهره",
    student: "تیم هوش مصنوعی",
    category: "هوش مصنوعی",
    image: "https://picsum.photos/seed/filmnama-work-9/880/550",
    isVideo: false,
  },
];
