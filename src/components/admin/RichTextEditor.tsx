"use client";

import { useEffect, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  CodeXml,
  Eraser,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Pilcrow,
  Redo2,
  TextQuote,
  Undo2,
  Unlink,
} from "lucide-react";

/**
 * Rich HTML editor for CMS content (courses, posts).
 *
 * The toolbar is intentionally limited to the markup the backend keeps in
 * `cleanHtml` (p, strong, em, h2, h3, lists, blockquote, a) so what the
 * editor writes is exactly what gets stored — nothing is silently stripped.
 */

export function isRichTextEmpty(html: string): boolean {
  return (
    html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim().length === 0
  );
}

type RichTextEditorProps = {
  id: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  describedBy?: string;
};

function ToolButton({
  title,
  active,
  disabled,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active === true}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`grid size-8 place-items-center border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active === true
          ? "border-ink bg-ink text-ivory"
          : "border-transparent text-ink hover:border-line-strong hover:bg-ivory-2"
      }`}
    >
      {children}
    </button>
  );
}

function normalizeLink(raw: string): string | null {
  const value = raw.trim();
  if (value.length === 0) return null;
  if (/^(https?:\/\/|mailto:)/i.test(value)) return value;
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(value)) return `https://${value}`;
  return null;
}

function LinkControl({ editor, disabled }: { editor: Editor; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const linked = editor.isActive("link");

  function start() {
    setDraft(editor.getAttributes("link").href ?? "");
    setError(null);
    setOpen(true);
  }

  function apply() {
    const href = normalizeLink(draft);
    if (!href) {
      setError("نشانی معتبر نیست (https، http یا mailto)");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setOpen(false);
  }

  return (
    <span className="flex items-center gap-0.5">
      <ToolButton title="افزودن پیوند" active={linked} disabled={disabled} onClick={start}>
        <Link2 className="size-4" />
      </ToolButton>
      <ToolButton
        title="حذف پیوند"
        disabled={disabled || !linked}
        onClick={() => editor.chain().focus().unsetLink().run()}
      >
        <Unlink className="size-4" />
      </ToolButton>
      {open && (
        <span className="flex items-center gap-1 border border-line-strong bg-ivory px-1.5 py-0.5">
          <input
            dir="ltr"
            autoFocus
            disabled={disabled}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                apply();
              }
              if (event.key === "Escape") setOpen(false);
            }}
            placeholder="https://…"
            aria-label="نشانی پیوند"
            className="h-7 w-44 bg-transparent text-xs text-ink outline-none placeholder:text-smoke"
          />
          <button
            type="button"
            disabled={disabled}
            onClick={apply}
            className="bg-ink px-2 py-1 text-xs font-medium text-ivory disabled:opacity-40"
          >
            ثبت
          </button>
          {error && (
            <span role="alert" className="whitespace-nowrap text-[11px] text-red">
              {error}
            </span>
          )}
        </span>
      )}
    </span>
  );
}

export default function RichTextEditor({
  id,
  name,
  value,
  onChange,
  disabled,
  placeholder,
  describedBy,
}: RichTextEditorProps) {
  const [sourceMode, setSourceMode] = useState(false);
  const isDisabled = disabled === true;

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable: !isDisabled,
      extensions: [
        StarterKit.configure({
          heading: { levels: [2, 3] },
          code: false,
          codeBlock: false,
          strike: false,
          horizontalRule: false,
          underline: false,
        }),
        Link.configure({
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          protocols: ["http", "https", "mailto"],
        }),
        Placeholder.configure({
          placeholder: placeholder ?? "متن محتوا را اینجا بنویسید…",
        }),
      ],
      content: value,
      editorProps: {
        attributes: {
          id,
          dir: "rtl",
          "aria-label": "ویرایشگر محتوا",
          ...(describedBy ? { "aria-describedby": describedBy } : {}),
        },
      },
      onUpdate: ({ editor: next }) => {
        onChange(next.getHTML());
      },
    },
    [],
  );

  // External value changes (initial load, reset) replace the document.
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  useEffect(() => {
    if (editor) editor.setEditable(!isDisabled);
  }, [editor, isDisabled]);

  useEffect(() => () => editor?.destroy(), [editor]);

  if (!editor) {
    return (
      <div
        aria-busy="true"
        className="min-h-40 border border-line-strong bg-ivory px-3 py-2.5 text-sm text-smoke"
      >
        در حال بارگذاری ویرایشگر…
      </div>
    );
  }

  const iconClass = "size-4";
  return (
    <div dir="rtl" className="border border-line-strong bg-ivory text-ink">
      <div
        role="toolbar"
        aria-label="ابزارهای ویرایش متن"
        className="flex flex-wrap items-center gap-0.5 border-b border-line bg-ivory-2 px-1.5 py-1.5"
      >
        <ToolButton
          title="بازگردانی"
          disabled={isDisabled || !editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 className={iconClass} />
        </ToolButton>
        <ToolButton
          title="انجام دوباره"
          disabled={isDisabled || !editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 className={iconClass} />
        </ToolButton>
        <span aria-hidden className="mx-1 h-5 w-px bg-line-strong" />
        <ToolButton
          title="درشت"
          active={editor.isActive("bold")}
          disabled={isDisabled}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className={iconClass} />
        </ToolButton>
        <ToolButton
          title="کج (ایتالیک)"
          active={editor.isActive("italic")}
          disabled={isDisabled}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className={iconClass} />
        </ToolButton>
        <span aria-hidden className="mx-1 h-5 w-px bg-line-strong" />
        <ToolButton
          title="تیتر ۲"
          active={editor.isActive("heading", { level: 2 })}
          disabled={isDisabled}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className={iconClass} />
        </ToolButton>
        <ToolButton
          title="تیتر ۳"
          active={editor.isActive("heading", { level: 3 })}
          disabled={isDisabled}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className={iconClass} />
        </ToolButton>
        <ToolButton
          title="متن ساده"
          active={editor.isActive("paragraph")}
          disabled={isDisabled}
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          <Pilcrow className={iconClass} />
        </ToolButton>
        <span aria-hidden className="mx-1 h-5 w-px bg-line-strong" />
        <ToolButton
          title="فهرست نقطه‌ای"
          active={editor.isActive("bulletList")}
          disabled={isDisabled}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className={iconClass} />
        </ToolButton>
        <ToolButton
          title="فهرست شماره‌دار"
          active={editor.isActive("orderedList")}
          disabled={isDisabled}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className={iconClass} />
        </ToolButton>
        <ToolButton
          title="نقل‌قول"
          active={editor.isActive("blockquote")}
          disabled={isDisabled}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <TextQuote className={iconClass} />
        </ToolButton>
        <span aria-hidden className="mx-1 h-5 w-px bg-line-strong" />
        <LinkControl editor={editor} disabled={isDisabled} />
        <ToolButton
          title="پاک کردن قالب‌بندی"
          disabled={isDisabled}
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
        >
          <Eraser className={iconClass} />
        </ToolButton>
        <span className="ms-auto" />
        <ToolButton
          title={sourceMode ? "بازگشت به نمای دیداری" : "نمایش سورس HTML"}
          active={sourceMode}
          disabled={isDisabled}
          onClick={() => setSourceMode((prev) => !prev)}
        >
          <CodeXml className={iconClass} />
        </ToolButton>
      </div>
      {sourceMode ? (
        <textarea
          dir="ltr"
          value={value}
          disabled={isDisabled}
          onChange={(event) => onChange(event.target.value)}
          aria-label="سورس HTML محتوا"
          rows={10}
          spellCheck={false}
          className="block min-h-40 w-full bg-ivory px-3 py-2.5 font-mono text-xs leading-6 text-ink outline-none disabled:opacity-60"
        />
      ) : (
        <EditorContent
          editor={editor}
          className="[&_.ProseMirror]:min-h-40 [&_.ProseMirror]:px-3 [&_.ProseMirror]:py-2.5 [&_.ProseMirror]:text-sm [&_.ProseMirror]:leading-8 [&_.ProseMirror]:outline-none [&_.ProseMirror_blockquote]:border-s-2 [&_.ProseMirror_blockquote]:border-line-strong [&_.ProseMirror_blockquote]:ps-3 [&_.ProseMirror_blockquote]:text-smoke [&_.ProseMirror_h2]:text-lg [&_.ProseMirror_h2]:font-extrabold [&_.ProseMirror_h3]:font-bold [&_.ProseMirror_a]:text-red [&_.ProseMirror_a]:underline [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-start [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-smoke [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:ps-5 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:ps-5"
        />
      )}
      {name ? <input type="hidden" name={name} value={value} /> : null}
    </div>
  );
}
