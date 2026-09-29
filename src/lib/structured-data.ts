import type { CourseDto } from "./content-contract";

export interface BreadcrumbItem { name: string; path: string }

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function breadcrumbJsonLd(items: BreadcrumbItem[], origin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: new URL(item.path, origin).href })),
  };
}

export function courseJsonLd(course: CourseDto, url: string) {
  return {
    "@context": "https://schema.org", "@type": "Course", name: course.title, description: course.description, url,
    ...(course.level ? { educationalLevel: course.level } : {}),
    ...(course.syllabus.length ? { syllabusSections: course.syllabus.map((name) => ({ "@type": "Syllabus", name })) } : {}),
  };
}

export interface OrganizationDetails {
  name: string;
  url: string;
  logo?: string;
  sameAs?: string[];
  telephone?: string;
  address?: string;
}

export function organizationJsonLd(details: OrganizationDetails) {
  return {
    "@context": "https://schema.org", "@type": "Organization", name: details.name, url: details.url,
    ...(details.logo ? { logo: details.logo } : {}),
    ...(details.sameAs?.length ? { sameAs: details.sameAs } : {}),
    ...(details.telephone ? { contactPoint: { "@type": "ContactPoint", telephone: details.telephone, contactType: "customer service", availableLanguage: "fa" } } : {}),
    ...(details.address ? { address: { "@type": "PostalAddress", streetAddress: details.address, addressCountry: "IR" } } : {}),
  };
}

export function aboutPageJsonLd(name: string, description: string, url: string) {
  return { "@context": "https://schema.org", "@type": "AboutPage", name, description, url };
}

export function faqJsonLd(faq: CourseDto["faq"]) {
  return faq.length ? {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: faq.map(({ question, answer }) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })),
  } : null;
}
