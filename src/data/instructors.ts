import type { Department } from "./courses";

export interface Instructor {
  id: string;
  name: string;
  specialty: string;
  department: Department;
  bio: string;
  /** Placeholder — replace with /images/instructors/<id>.jpg when real assets arrive */
  image: string;
}

export const instructors: Instructor[] = [
  // --- Cinema & Performing Arts ---
  {
    id: "arman-naderi",
    name: "آرمان نادری",
    specialty: "مدرس بازیگری و بیان",
    department: "cinema",
    bio: "بیش از ۱۲ سال تجربه روی صحنه تئاتر و جلوی دوربین سینما.",
    image: "https://picsum.photos/seed/filmnama-teacher-1/600/800",
  },
  {
    id: "nima-farahmand",
    name: "نیما فرهمند",
    specialty: "مدرس فیلم‌برداری و نورپردازی",
    department: "cinema",
    bio: "مدیر فیلم‌برداری چندین فیلم کوتاه و تبلیغاتی؛ عاشق نور طبیعی.",
    image: "https://picsum.photos/seed/filmnama-teacher-2/600/800",
  },
  {
    id: "raha-kiani",
    name: "رها کیانی",
    specialty: "مدرس کارگردانی و فیلم‌سازی",
    department: "cinema",
    bio: "کارگردان مستقل با حضور در جشنواره‌های ملی و بین‌المللی.",
    image: "https://picsum.photos/seed/filmnama-teacher-3/600/800",
  },
  {
    id: "saman-rastegar",
    name: "سامان رستگار",
    specialty: "مدرس تدوین و پس‌تولید",
    department: "cinema",
    bio: "تدوین‌گر سینما و تبلیغات؛ معتقد است فیلم روی میز تدوین ساخته می‌شود.",
    image: "https://picsum.photos/seed/filmnama-teacher-4/600/800",
  },
  {
    id: "elnaz-mehrayin",
    name: "الناز مهرآیین",
    specialty: "مدرس گریم و چهره‌پردازی",
    department: "cinema",
    bio: "طراح گریم پروژه‌های سینمایی و تلویزیونی با رویکرد کارگاهی.",
    image: "https://picsum.photos/seed/filmnama-teacher-5/600/800",
  },
  {
    id: "kaveh-sadeghi",
    name: "کاوه صادقی",
    specialty: "مدرس جلوه‌های بصری و Compositing",
    department: "cinema",
    bio: "متخصص VFX با سابقه همکاری در پروژه‌های سینمایی و سریال.",
    image: "https://picsum.photos/seed/filmnama-teacher-6/600/800",
  },
  // --- Professional Skills ---
  {
    id: "parsa-nikroosh",
    name: "پارسا نیک‌روش",
    specialty: "مدرس برنامه‌نویسی",
    department: "tech",
    bio: "توسعه‌دهنده Full-stack با تمرکز بر آموزش پروژه‌محور.",
    image: "https://picsum.photos/seed/filmnama-teacher-7/600/800",
  },
  {
    id: "arian-sharifi",
    name: "آرین شریفی",
    specialty: "مدرس هوش مصنوعی و Machine Learning",
    department: "tech",
    bio: "پژوهشگر و مهندس یادگیری ماشین؛ از تئوری تا محصول.",
    image: "https://picsum.photos/seed/filmnama-teacher-8/600/800",
  },
  {
    id: "mahsa-farahmand",
    name: "مهسا فرهمند",
    specialty: "مدرس زبان انگلیسی",
    department: "tech",
    bio: "مدرس مجرب مکالمه و آیلتس با روش تعاملی و کاربردی.",
    image: "https://picsum.photos/seed/filmnama-teacher-9/600/800",
  },
  {
    id: "sina-azari",
    name: "سینا آذری",
    specialty: "مدرس IT و شبکه",
    department: "tech",
    bio: "کارشناس زیرساخت و امنیت شبکه با تجربه پروژه‌های سازمانی.",
    image: "https://picsum.photos/seed/filmnama-teacher-10/600/800",
  },
  {
    id: "taraneh-noori",
    name: "ترانه نوری",
    specialty: "مدرس موسیقی",
    department: "tech",
    bio: "آهنگساز و مدرس ساز؛ پلی بین تئوری کلاسیک و خلاقیت امروز.",
    image: "https://picsum.photos/seed/filmnama-teacher-11/600/800",
  },
];
