import { ReactNode } from "react";

export function FormField({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="field-label">
        {label}
        {required && <span className="mr-1 text-red-700">*</span>}
      </label>
      {children}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-5">
      <h2 className="text-lg font-bold text-black">{title}</h2>
      {description && <p className="mt-1 text-sm font-medium text-black">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}
