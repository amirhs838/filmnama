import Link from "next/link";
import { Breadcrumbs } from "@/components/courses/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { contentMetadata } from "@/lib/content-seo";

export const revalidate = 3600;

export function generateMetadata() {
  const meta = contentMetadata(
    "تماس با ما",
    "تماس با ما خانه تماس با ما راه های ارتباطی با ما ساعات کاری: 9 صبح الی9 شب شماره تماس 09120290980 02165560132 ایمیل info@example.com",
    "/contact-us/",
  );
  return { ...meta, title: { absolute: "تماس با ما - فیلم نما" } };
}

export default function ContactUsPage() {
  return (
    <article className="pt-32 lg:pt-40" dir="rtl">
      <div className="container-site">
        <Breadcrumbs items={[{ name: "خانه", path: "/" }, { name: "تماس با ما", path: "/contact-us/" }]} />
        <p className="text-label-latin mt-6 text-smoke" dir="ltr">CONTACT US</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-extrabold leading-snug md:text-5xl">تماس با ما</h1>
      </div>
      <section aria-label="راه های ارتباطی با ما" className="container-site section-y">
        <SectionHeading index="01" label="CONTACT" title="راه های ارتباطی با ما" />
        <dl className="mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
          <div className="border border-line bg-ivory-2 p-6"><dt className="text-sm font-bold">ساعات کاری</dt><dd className="mt-2 text-sm font-light leading-8 text-smoke">9 صبح الی9 شب</dd></div>
          <div className="border border-line bg-ivory-2 p-6"><dt className="text-sm font-bold">شماره تماس</dt><dd className="mt-2 flex flex-col gap-1 text-sm" dir="ltr"><a href="tel:09120290980" className="hover:text-red">09120290980</a><a href="tel:02165560132" className="hover:text-red">02165560132</a></dd></div>
          <div className="border border-line bg-ivory-2 p-6"><dt className="text-sm font-bold">ایمیل</dt><dd className="mt-2 text-sm font-light" dir="ltr">info@example.com</dd></div>
          <div className="border border-line bg-ivory-2 p-6"><dt className="text-sm font-bold">آدرس</dt><dd className="mt-2 text-sm font-light leading-8 text-smoke">اندیشه،فاز4، چهارراه ارغوان، خیابان توحید جنوبی، خیابان علامه جعفری، جنب مدرسه غدیر، آموزشگاه فیلم نما</dd></div>
        </dl>
        <h2 className="mt-12 text-xl font-bold">شبکه های اجتماعی</h2>
        <ul className="mt-4 flex flex-wrap gap-3 text-sm">
          <li className="border border-line px-4 py-2">Whatsapp</li>
          <li className="border border-line px-4 py-2">Instagram</li>
          <li className="border border-line px-4 py-2">Telegram</li>
        </ul>
      </section>
      <section aria-label="ثبت درخواست" className="bg-ink text-ivory"><div className="container-site section-y">
        <SectionHeading dark index="02" label="REQUEST" title="منتظر پیغام شما هستیم" description="با ما از طریق فرم زیر در ارتباط باشید" />
        <p className="mt-8 max-w-2xl text-base font-light leading-9 text-fog">منتظر دیدار شما علاقه مندان دنیای سینما هستیم</p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link href="/contact/" className="inline-flex min-h-12 items-center bg-red px-6 py-3 text-sm font-medium text-ivory transition-colors hover:bg-red-deep">ثبت درخواست مشاوره</Link>
          <a href="tel:09120290980" className="inline-flex min-h-12 items-center border border-line-light px-6 py-3 text-sm font-medium text-ivory transition-colors hover:border-red hover:text-red">با ما تماس بگیرید</a>
        </div>
      </div></section>
    </article>
  );
}
