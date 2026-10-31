// "Need help right now?": contacts for the crisis the citizen reported, with tap-to-call.
// Folded by default so a call button can't be tapped by accident; one tap opens it.
export type UrgentContact = { name: string; phone: string | null; address: string | null; what: string };

export default function UrgentHelp({ title, contacts }: { title: string; contacts: UrgentContact[] }) {
  if (contacts.length === 0) return null;
  return (
    <details className="group relative z-10 rounded-3xl bg-red-50 ring-1 ring-red-200 dark:bg-red-500/10 dark:ring-red-500/25">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-3xl p-5 text-[1rem] font-bold text-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 dark:text-red-200 [&::-webkit-details-marker]:hidden">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.7a2 2 0 01-.5 2.1L8 9.8a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.7.7a2 2 0 011.7 2z" />
        </svg>
        <span className="flex-1">{title}</span>
        <span className="text-[0.8125rem] font-semibold text-red-700/80 group-open:hidden dark:text-red-300/80">{contacts.length}</span>
        <svg className="shrink-0 transition group-open:rotate-180" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <ul className="space-y-2.5 px-5 pb-5">
        {contacts.map((c) => {
          // First number only, for the call button ("(032) 233-8785 loc. 132 / 145" -> 0322338785)
          const dial = c.phone?.split("/")[0].replace(/loc\..*$/i, "").replace(/[^\d+]/g, "");
          return (
            <li key={c.name} className="flex items-start justify-between gap-3 rounded-2xl bg-white p-3.5 dark:bg-white/5">
              <div className="min-w-0">
                <p className="text-[0.9375rem] font-semibold text-gray-900 dark:text-white">{c.name}</p>
                <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-gray-600 dark:text-gray-300">{c.what}</p>
                {c.address && <p className="mt-0.5 text-[0.75rem] text-gray-500 dark:text-gray-400">{c.address}</p>}
                {c.phone && <p className="mt-0.5 text-[0.75rem] tabular-nums text-gray-500 dark:text-gray-400">{c.phone}</p>}
              </div>
              {dial && (
                <a
                  href={`tel:${dial}`}
                  className="shrink-0 rounded-full bg-red-600 px-4 py-2 text-[0.875rem] font-bold text-white shadow-sm hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 print:hidden"
                >
                  {c.phone && c.phone.length <= 4 ? c.phone : "Call"}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
