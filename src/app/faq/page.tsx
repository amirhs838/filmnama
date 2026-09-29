import Link from "next/link";
import { Breadcrumbs } from "@/components/courses/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { contentMetadata } from "@/lib/content-seo";
import { faqJsonLd, serializeJsonLd } from "@/lib/structured-data";

export const revalidate = 3600;

export function generateMetadata() {
  const meta = contentMetadata("سوالات متداول", "سوالات متداول ما در این جا به برخی سوالات شما پاسخ داده ایم", "/faq/");
  return { ...meta, title: { absolute: "سوالات متداول - فیلم نما" } };
}

const faqs = [
  {
    question: "آموزشگاه فیلم نما چه دوره هایی داره؟",
    answer: "فیلم نما شامل دوره های بازیگری مقابل دوربین، بازیگری تئاتر، فیلمنامه نویسی، کارگردانی، گویندگی، گریم سینمایی، عکاسی،تدوین سینمایی و فن بیانه. شماره تماسمون 09120290980 واسه آشنایی بیشتر شما با دوره ها",
  },
  {
    question: "هزینه کلاس ها چه قیمته؟",
    answer: "هزینه کلاس در هر ترم پرداخته میشه و بسیار مناسبه. برای راهنمایی بیستر با مشاوره حضوری می تونیم بیشتر راهنماییتون کنیم.",
  },
  {
    question: "اساتید و مدرک پایانی؟",
    answer: "فیلم نما از اساتید بسیار برجسته و حرفه ای با شیوه و تدریش جدید دعوت کرده که اکثرشون از استادان بنام حرفه ی خودشون هستن. فضای کلاس ها صمیمی اما حرفه ای و سرشار از انگیزه برای هنرجویان عزیز هست. پایان هر دوره علاوه بر مدرکی که از موسسه سینمایی فیلم نما دریافت می کنیم، یک مدرک بین المللی حرف ای بهتون اعطا میشه که در 168 کشور جهان قابل ترجمه هست.",
  },
  {
    question: "آدرس آموزشگاه آزاد سینمایی فیلم نما کجاس؟",
    answer: "آدرس ما اندیشه، فاز3، خیابان بوستان، خیابان شبنم، آموزشگاه آزاد سینمایی فیلم نما",
  },
];

export default function FaqPage() {
  const faq = faqJsonLd(faqs);
  return (
    <article className="pt-32 lg:pt-40" dir="rtl">
      <div className="container-site">
        <Breadcrumbs items={[{ name: "خانه", path: "/" }, { name: "سوالات متداول", path: "/faq/" }]} />
        <p className="text-label-latin mt-6 text-smoke" dir="ltr">FAQ</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-extrabold leading-snug md:text-5xl">سوالات متداول</h1>
        <p className="mt-5 max-w-2xl text-base font-light leading-9 text-smoke">ما در این جا به برخی سوالات شما پاسخ داده ایم !</p>
      </div>
      <div className="container-site section-y">
        <SectionHeading index="01" label="QUESTIONS" title="سوالات متداول" />
        <div className="mt-10 max-w-3xl divide-y divide-line border-y border-line">
          {faqs.map((item) => (
            <details key={item.question} className="group py-2 open:bg-ivory-2">
              <summary className="cursor-pointer break-words px-3 py-5 text-base font-bold leading-8 marker:text-red hover:text-red">{item.question}</summary>
              <p className="whitespace-pre-line break-words px-6 pb-6 text-sm leading-8 text-ink-3">{item.answer}</p>
            </details>
          ))}
        </div>
        {faq && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(faq) }} />}
        <p className="mt-10 text-sm text-smoke">
          سؤال دیگری دارید؟ <Link href="/contact-us/" className="font-bold text-ink underline decoration-red underline-offset-8 hover:text-red">تماس با ما</Link>
        </p>
      </div>
    </article>
  );
}
