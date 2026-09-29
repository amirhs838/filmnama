"use client";

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

type FieldProps = {
  htmlFor: string;
  label: string;
  hint?: string;
  children: ReactNode;
};

export function Field({ htmlFor, label, hint, children }: FieldProps) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && hintId && (
        <p id={hintId} className="text-xs leading-6 text-smoke">
          {hint}
        </p>
      )}
    </div>
  );
}

const controlClass =
  "border border-line-strong bg-ivory px-3 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-60";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return (
    <input
      {...rest}
      className={`${controlClass} h-11 ${className ?? ""}`.trim()}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, rows, ...rest } = props;
  return (
    <textarea
      {...rest}
      rows={rows ?? 4}
      className={`${controlClass} min-h-24 py-2.5 leading-7 ${className ?? ""}`.trim()}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, ...rest } = props;
  return (
    <select
      {...rest}
      className={`${controlClass} h-11 ${className ?? ""}`.trim()}
    />
  );
}

export function FormError({ id, message }: { id: string; message: string | null }) {
  return (
    <p
      id={id}
      role="alert"
      aria-live="polite"
      className="min-h-6 text-sm text-red"
    >
      {message ?? ""}
    </p>
  );
}

type SubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  pending?: boolean;
};

export function SubmitButton({ pending, children, disabled, ...rest }: SubmitButtonProps) {
  const isDisabled = pending === true || disabled === true;
  return (
    <button
      type="submit"
      disabled={isDisabled}
      aria-busy={pending === true}
      {...rest}
      className="h-11 bg-ink px-4 text-sm font-medium text-ivory transition-colors hover:bg-ink-3 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}
