/** Rules for a password a staff member chooses. Same rules the backend enforces
 * (backend/app/routers/auth.py → password_problems). */
export const MIN_PASSWORD_LENGTH = 8;

export function passwordRules(pw: string, confirm: string) {
  return [
    { label: `At least ${MIN_PASSWORD_LENGTH} characters`, ok: pw.length >= MIN_PASSWORD_LENGTH },
    { label: "Starts with a capital letter", ok: /^\p{Lu}/u.test(pw) },
    { label: "Has a special character (e.g. ! @ # $ %)", ok: /[^\p{L}\p{N}\s]/u.test(pw) },
    { label: "Both new passwords match", ok: pw.length > 0 && pw === confirm },
  ];
}

export const passwordOk = (pw: string, confirm: string) => passwordRules(pw, confirm).every((r) => r.ok);

/** Live checklist shown under the new-password fields. */
export default function PasswordChecklist({ password, confirm, id }: { password: string; confirm: string; id?: string }) {
  return (
    <ul id={id} className="space-y-1 text-[13px]" aria-live="polite">
      {passwordRules(password, confirm).map((r) => (
        <li key={r.label} className={`flex items-center gap-2 ${r.ok ? "text-brand-700 dark:text-brand-300" : "text-gray-500 dark:text-gray-400"}`}>
          <span aria-hidden="true" className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${r.ok ? "bg-brand-600 text-white" : "bg-gray-200 text-gray-500 dark:bg-white/10"}`}>
            {r.ok ? "✓" : ""}
          </span>
          <span>{r.label}</span>
          <span className="sr-only">{r.ok ? "(done)" : "(not yet)"}</span>
        </li>
      ))}
    </ul>
  );
}
