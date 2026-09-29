import sanitizeHtml from "sanitize-html";

export function sanitizeCourseHtml(contentHtml: string): string {
  return sanitizeHtml(contentHtml, {
    allowedTags: ["h2", "h3", "h4", "h5", "h6", "p", "ul", "ol", "li", "strong", "em", "b", "i", "blockquote", "br", "hr", "a"],
    allowedAttributes: { a: ["href", "title"] },
    allowedSchemes: ["https", "http", "mailto", "tel"],
    allowProtocolRelative: false,
  });
}
