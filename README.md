# فیلم‌نما

وب‌سایت فارسی با Next.js 16 و بک‌اند NestJS، Prisma، PostgreSQL و Redis. این مخزن در فاز اول توسعه است؛ فایل‌های Docker فقط محیط **توسعه محلی** را فراهم می‌کنند، نه استقرار production.

## محدوده و وضعیت

- فاز اول: احراز هویت، API عمومی و مدیریتی دپارتمان‌ها و دوره‌ها، و صفحات فرانت‌اند `/courses`، `/courses/[department-slug]` و `/courses/[department-slug]/[course-slug]`.
- کاتالوگ عمومی، `AdminCatalogModule` و worker مربوط به `RevalidationModule` به `AppModule` متصل‌اند. کش Redis با نسخهٔ دیتابیس و outbox تراکنشی پیاده‌سازی شده؛ تحویل واقعی webhook با PostgreSQL/Redis هنوز آزموده نشده است.
- پنل مدیریت واقعی وجود ندارد؛ پورت 3001 فقط برای origin پنل آینده رزرو شده است.
- وبلاگ، مدیریت رسانه و آپلود، گالری، نمونه‌کار، لیدها و سایر بخش‌های CMS پیاده‌سازی کامل ندارند. وجود مدل در Prisma یا داده نمایشی در فرانت‌اند به معنی آماده بودن API آن بخش نیست. schema اولیه پوشش نهایی همه دامنه‌ها نیست.
- seed، CLI ساخت مدیر و migration اولیه موجودند؛ migration از schema فعلی تولید شده، اما اجرای آن روی دیتابیس واقعی هنوز تأیید نشده است. این schema پایهٔ فاز اول است، نه تحویل نهایی تمام مدل‌های سند.

## اجرای Docker در توسعه

پیش‌نیاز: Docker Engine/Desktop با Compose v2؛ برای دستور تولید secret به Node.js 22 نیاز دارید. دستورهای کپی زیر برای PowerShell هستند؛ در Linux/macOS از `cp` استفاده کنید.

```powershell
Copy-Item .env.example .env
Copy-Item backend/.env.example backend/.env
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

دستور Node را چهار بار اجرا کنید و چهار خروجی مستقل را در `POSTGRES_PASSWORD`، `JWT_SECRET`، `CSRF_SECRET` و `NEXT_REVALIDATE_SECRET` فایل ریشه `.env` قرار دهید. سه secret برنامه باید حداقل 32 کاراکتر و متفاوت باشند؛ secret بازاعتبارسنجی عمداً بین فرانت‌اند و بک‌اند مشترک است. نمونه‌ها هیچ رمز آماده‌ای ندارند. رمز hex برای اتصال دیتابیس Compose مناسب است؛ رمز دارای نویسه‌های ویژه به URL-encoding نیاز دارد.

Compose از `.env` ریشه برای جایگذاری متغیرها استفاده می‌کند و `backend/.env` را نمی‌خواند؛ فایل دوم برای اجرای خارج Docker است. اطلاعات محرمانه را commit نکنید و خروجی کامل `docker compose config` یا inspect را منتشر نکنید.

پس از تنظیم متغیرهای محیطی:

```sh
docker compose up --build
```

- فرانت‌اند: `http://localhost:3000`؛ API: `http://localhost:4000/api/v1`؛ liveness: `http://localhost:4000/api/v1/health/live`.
- PostgreSQL روی `127.0.0.1:55432` و Redis روی `127.0.0.1:56379` در دسترس‌اند؛ با سرویس محلی روی 5432 یا 6379 تداخل ندارند. همه پورت‌های منتشرشده فقط به loopback متصل‌اند.
- healthcheckهای PostgreSQL و Redis پیش از شروع بک‌اند بررسی می‌شوند. بک‌اند ابتدا `npm run migrate:deploy` و سپس `node dist/src/main.js` را اجرا می‌کند؛ شکست migration مانع شروع API است. healthcheck بک‌اند فقط liveness است، نه آزمون کامل وابستگی‌ها.
- فرانت‌اند با `next dev --hostname 0.0.0.0` اجرا می‌شود. کد داخل image کپی می‌شود و source bind mount نداریم؛ پس از تغییر کد دوباره `docker compose up --build` بزنید. این اجرا معیار رفتار cache در production نیست.
- imageهای Node 22 با کاربر غیر root یعنی `node` اجرا می‌شوند. image بک‌اند OpenSSL و devDependencies، از جمله Prisma CLI، را برای migration و ابزارهای توسعه نگه می‌دارد.
- `docker compose down` داده volumeها را نگه می‌دارد؛ `docker compose down -v` داده دیتابیس و Redis را پاک می‌کند. تغییر `POSTGRES_PASSWORD` در `.env` رمز دیتابیس از قبل ساخته‌شده را عوض نمی‌کند.

### داده نمونه و مدیر

هیچ seed یا مدیر اولیه‌ای به‌صورت خودکار ساخته نمی‌شود. پس از اجرای migration، فقط برای دیتابیس توسعه:

```sh
docker compose exec -e NODE_ENV=development -e SEED_DEVELOPMENT=true backend npm run seed:dev
```

برای ساخت مدیر با CLI موجود، `ADMIN_EMAIL` و `ADMIN_PASSWORD` را با ویرایشگر در فایل محلی `backend/.env.admin.local` قرار دهید. رمز باید بین 16 و 128 کاراکتر باشد و ایمیل نباید قبلاً ثبت شده باشد. دسترسی فایل را فقط به حساب خود محدود کنید، آن را وارد Git نکنید و پس از ساخت مدیر حذف کنید. رمز را به آرگومان shell یا history وارد نکنید.

```sh
docker compose run --rm --no-deps --volume ./backend/.env.admin.local:/run/admin.env:ro backend node --env-file=/run/admin.env dist/src/cli/create-admin.js
```

این دستور پس از build و migration، همان CLI مربوط به `npm run create-admin` را با فایل فقط‌خواندنی اجرا می‌کند. فایل باید برای کاربر `node` داخل کانتینر قابل خواندن و فقط شامل دو ورودی مدیر باشد. برای اجرای محلی، از مسیر کاری `backend`، پس از build دستور `node --env-file=.env.admin.local dist/src/cli/create-admin.js` را اجرا کنید؛ اتصال دیتابیس از `backend/.env` خوانده می‌شود.

## متغیرهای محیطی

| متغیر | کاربرد |
| --- | --- |
| `NODE_ENV` | توسعه محلی: `development`؛ Compose آن را ثابت نگه می‌دارد. |
| `FILMNAMA_CONTENT_SOURCE` | `api` برای بک‌اند؛ `mock` فقط برای توسعه مستقل فرانت‌اند. Compose همیشه `api` است؛ production به `api` نیاز دارد. |
| `SITE_URL` | origin عمومی سایت برای SEO؛ محلی `http://localhost:3000`. |
| `BACKEND_API_URL` | متغیر واقعی خوانده‌شده در فرانت‌اند، فقط سمت سرور؛ خارج Docker برابر `http://localhost:4000/api/v1`. |
| `API_URL` | ورودی Compose که به `BACKEND_API_URL` سرویس فرانت‌اند نگاشت می‌شود؛ پیش‌فرض `http://backend:4000/api/v1`. |
| `POSTGRES_USER`, `POSTGRES_DB` | کاربر و دیتابیس توسعه؛ پیش‌فرض هر دو `filmnama`. |
| `POSTGRES_PASSWORD` | رمز تصادفی الزامی برای PostgreSQL در Compose؛ بدون مقدار پیش‌فرض. |
| `DATABASE_URL` | اتصال Prisma برای اجرای محلی؛ Compose آن را با hostname داخلی `postgres` و پورت 5432 می‌سازد. |
| `REDIS_URL` | محلی `redis://localhost:56379`؛ داخل Compose برابر `redis://redis:6379`. |
| `PORT` | پورت بک‌اند محلی؛ Compose از 4000 استفاده می‌کند. |
| `JWT_SECRET`, `CSRF_SECRET` | دو secret مستقل با حداقل 32 کاراکتر. |
| `JWT_ISSUER`, `JWT_AUDIENCE` | پیش‌فرض `filmnama-api` و `filmnama-admin`. |
| `ALLOWED_ORIGINS` | فهرست originهای مجاز با جداکننده ویرگول: `http://localhost:3000,http://localhost:3001`؛ wildcard نگذارید. |
| `NEXT_REVALIDATE_URL` | callback بک‌اند؛ Compose: `http://frontend:3000/api/revalidate`، محلی: `http://localhost:3000/api/revalidate`. |
| `NEXT_REVALIDATE_SECRET` | کلید مشترک امضای HMAC webhook بین دو سرویس، متفاوت از JWT و CSRF. |
| `TRUST_PROXY` | IP/CIDR پروکسی‌های مورد اعتماد؛ برای توسعه مستقیم خالی. |
| `ADMIN_IP_ALLOWLIST` | محدودسازی IP/CIDR مسیرهای auth/admin؛ خالی یعنی محدودیت IP اضافی ندارد. |
| `SWAGGER_ENABLED` | نمونه توسعه `true`؛ در production باید `false` باشد. |
| `SEED_DEVELOPMENT` | بک‌اند محلی پیش‌فرض `false`؛ فقط برای seed صریح توسعه `true` شود. |

## اجرای خارج Docker

Node.js 22، PostgreSQL 17 و Redis 7 لازم‌اند. می‌توانید فقط زیرساخت را با `docker compose up -d postgres redis` اجرا کنید؛ حتی برای این دستور نیز secretهای الزامی `.env` ریشه را کامل کنید.

در `backend/.env` مقدار `DATABASE_URL` را مطابق الگوی `postgresql://filmnama:<URL_ENCODED_PASSWORD>@localhost:55432/filmnama?schema=public` با رمز واقعی پر کنید؛ متن داخل `<...>` جایگزین شود. secretهای بک‌اند را تنظیم کنید و `NEXT_REVALIDATE_SECRET` را با `.env` ریشه یکسان بگذارید. `NEXT_REVALIDATE_URL` محلی باید از hostname `localhost` استفاده کند، نه `frontend`. اگر زیرساخت خودتان روی پورت‌های دیگری است، URLها را متناسب تغییر دهید.

در ترمینالی با مسیر کاری `backend`، پس از آماده شدن migration:

```sh
npm ci
npm run prisma:generate
npm run migrate:deploy
npm run dev
```

فرمان `dev` بک‌اند ابتدا TypeScript را build می‌کند و سپس خروجی JavaScript را watch می‌کند؛ تغییر فایل TypeScript به build مجدد نیاز دارد.

در ترمینال دوم با مسیر کاری ریشه:

```sh
npm ci
npm run dev
```

برای مشاهده فرانت‌اند بدون بک‌اند، فقط در توسعه `FILMNAMA_CONTENT_SOURCE=mock` بگذارید. در حالت `api` داده نمایشی جایگزین خودکار خطای بک‌اند نمی‌شود. متغیر `API_URL` به‌تنهایی برای اجرای خارج Compose کافی نیست؛ فرانت‌اند `BACKEND_API_URL` را می‌خواند.

## مسیرهای API فاز اول

پیشوند تمام مسیرهای جدول `/api/v1` است. مسیرهای مدیریتی کاتالوگ در `AppModule` متصل و با RBAC محافظت شده‌اند.

| روش | مسیر | کاربرد |
| --- | --- | --- |
| `GET` | `/health/live` | وضعیت زنده بودن پردازش |
| `GET` | `/auth/csrf` | دریافت CSRF اولیه |
| `POST` | `/auth/login`, `/auth/refresh`, `/auth/logout` | ورود، چرخش session و خروج |
| `GET` | `/auth/me` | کاربر جاری با Bearer token |
| `PATCH` | `/admin/users/:id/access` | تغییر دسترسی توسط `SUPER_ADMIN` |
| `GET` | `/public/departments`, `/public/departments/:slug` | دپارتمان‌های منتشرشده |
| `GET` | `/public/courses` | دوره‌ها؛ پارامترهای `department`, `limit`, `cursor` |
| `GET` | `/public/courses/:department/:slug` | جزئیات دوره منتشرشده |
| `GET` | `/public/redirects?path=...` | مقصد مسیر قدیمی کاتالوگ |
| `GET`, `POST` | `/admin/departments`, `/admin/courses` | فهرست و ایجاد |
| `GET`, `PUT`, `DELETE` | `/admin/departments/:id`, `/admin/courses/:id` | جزئیات، جایگزینی داده و حذف نرم |

ویرایش کاتالوگ **PUT است، نه PATCH**. نقش‌های `SUPER_ADMIN` و `CONTENT_MANAGER` به مدیریت کاتالوگ دسترسی دارند. برای ورود ابتدا CSRF را با `Origin` مجاز بگیرید و cookieها را نگه دارید؛ سپس token را در `X-CSRF-Token` بفرستید. درخواست‌های تغییردهنده باید `Content-Type: application/json` داشته باشند؛ refresh/logout بدنه `{}` دارند. برای مسیرهای حفاظت‌شده از Bearer token و در عملیات تغییردهنده از session cookie، Origin و CSRF معتبر استفاده کنید.

Swagger توسعه در `http://localhost:4000/api/docs` با `SWAGGER_ENABLED=true` فعال می‌شود. مستندسازی DTOهای auth موجود است؛ مستندات کامل Swagger کاتالوگ هنوز تکمیل نشده و Swagger قرارداد کامل همه APIها نیست.

فرانت‌اند مسیر مستقل `POST /api/revalidate` دارد که امضای HMAC و timestamp را بررسی می‌کند؛ secret را مستقیم به‌عنوان Bearer ارسال نکنید. آزمون واقعی تحویل worker، retry و بازسازی cache همچنان لازم است.

## بررسی و محدودیت‌ها

در ریشه `npm run lint` و در `backend` دستورهای زیر را اجرا کنید:

```sh
npm run lint
npm run typecheck
npm test
npm run prisma:validate
```

در ریشه نیز `npm test` و `npm run typecheck` موجودند. تست اتصال `AppModule` مسیرهای واقعی Nest را با زیرساخت mock بررسی می‌کند؛ تست‌های repository نیز عمدتاً mock هستند و عبور آن‌ها معادل E2E واقعی PostgreSQL/Redis نیست. script `test:integration` تا زمان وجود تست‌های واقعی مربوطه، مدرک پوشش integration نیست.

آخرین بررسی محلی: تست‌های فرانت و بک‌اند، lint و typecheck موفق شدند. build بک‌اند موفق است؛ build فرانت مرحلهٔ کامپایل را گذراند، اما پیش‌رندر به‌دلیل نبود تنظیم `FILMNAMA_CONTENT_SOURCE=api` متوقف شد. برای build فرانت، `BACKEND_API_URL` باید به API آماده با migration اجراشده متصل باشد و `SITE_URL` یک origin HTTPS معتبر باشد؛ mock در production مجاز نیست.

در محیط تهیه این فایل‌ها Docker در دسترس نبود؛ build imageها، اجرای Compose و migration روی دیتابیس واقعی تأیید نشده‌اند. آماده شدن فایل migration و موفقیت `migrate deploy` روی دیتابیس خالی باید جداگانه بررسی شود.

برای production به طراحی و آزمون جداگانه نیاز است: TLS و reverse proxy، تنظیم دقیق `TRUST_PROXY` و originهای HTTPS، cookie امن، غیرفعال کردن Swagger، مدیریت secret، محدودسازی شبکه دیتابیس/Redis، backup و آزمون restore، و آزمون cache و worker. تغییر صرف `NODE_ENV` یا استفاده از این Compose، استقرار production پشتیبانی‌شده ایجاد نمی‌کند.
