export interface GalleryItem {
  id: number;
  /** Placeholder — replace with /images/gallery/<id>.jpg when real assets arrive */
  image: string;
  category: string;
  title: string;
  /** Tailwind aspect class controlling masonry rhythm */
  aspect: string;
}

export const galleryItems: GalleryItem[] = [
  {
    id: 1,
    image: "https://picsum.photos/seed/filmnama-studio-1/900/1200",
    category: "پشت صحنه",
    title: "تمرین صحنه‌ای از فیلم کوتاه",
    aspect: "aspect-[3/4]",
  },
  {
    id: 2,
    image: "https://picsum.photos/seed/filmnama-studio-2/1000/700",
    category: "کارگاه",
    title: "کارگاه نورپردازی",
    aspect: "aspect-[10/7]",
  },
  {
    id: 3,
    image: "https://picsum.photos/seed/filmnama-studio-3/900/900",
    category: "کلاس",
    title: "جلسه تمرین بازیگری",
    aspect: "aspect-square",
  },
  {
    id: 4,
    image: "https://picsum.photos/seed/filmnama-studio-4/900/1300",
    category: "پشت صحنه",
    title: "آماده‌سازی گریم",
    aspect: "aspect-[3/4.3]",
  },
  {
    id: 5,
    image: "https://picsum.photos/seed/filmnama-studio-5/1000/750",
    category: "کارگاه",
    title: "کارگاه برنامه‌نویسی",
    aspect: "aspect-[4/3]",
  },
  {
    id: 6,
    image: "https://picsum.photos/seed/filmnama-studio-6/900/1150",
    category: "کلاس",
    title: "کلاس تدوین",
    aspect: "aspect-[3/3.8]",
  },
  {
    id: 7,
    image: "https://picsum.photos/seed/filmnama-studio-7/1000/680",
    category: "رویداد",
    title: "نمایش پروژه پایانی",
    aspect: "aspect-[10/7]",
  },
  {
    id: 8,
    image: "https://picsum.photos/seed/filmnama-studio-8/900/900",
    category: "کلاس",
    title: "جلسه موسیقی",
    aspect: "aspect-square",
  },
  {
    id: 9,
    image: "https://picsum.photos/seed/filmnama-studio-9/1000/760",
    category: "پشت صحنه",
    title: "فیلم‌برداری در لوکیشن",
    aspect: "aspect-[4/3]",
  },
];
