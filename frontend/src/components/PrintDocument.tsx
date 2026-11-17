/* eslint-disable @next/next/no-img-element -- a plain <img> prints reliably; next/image may lazy-load and miss the print */
import { ActionPlan, Assessment, Lang } from "@/lib/api";
import { t } from "@/lib/i18n";
import LinkText from "@/components/LinkText";

// The printed / "Save as PDF" version of the results and the Action Plan. It only shows when
// printing (the screen version is hidden then), so the paper looks like a proper document:
// the GinhawAI logo and title at the top, the date, clean sections with tick boxes, and the
// disclaimer at the bottom. Plain black-on-white classes only (no dark: styles), so it prints
// the same even when the screen is in dark mode.

const fmtDate = (iso: string | null | undefined, lang: Lang) =>
  iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString(lang === "en" ? "en-PH" : "fil-PH", { dateStyle: "long" }) : null;

const STATUS_KEY = { qualified: "qualified", partial: "partial", not_qualified: "notQualified" } as const;
const STATUS_STYLE = {
  qualified: "border-green-700 text-green-800",
  partial: "border-amber-600 text-amber-800",
  not_qualified: "border-red-700 text-red-800",
};

function Frame({ lang, title, date, barangay, children }: { lang: Lang; title: string; date: string | null; barangay?: string | null; children: React.ReactNode }) {
  return (
    <div className="print-doc hidden bg-white text-[10.5pt] leading-snug text-gray-900 print:block">
      <header className="flex items-center gap-4 border-b-2 border-brand-700 pb-3">
        <img src="/emblem.png" alt="GinhawAI logo" className="h-14 w-14" />
        <div className="min-w-0 flex-1">
          <p className="text-[9pt] font-semibold uppercase tracking-wider text-brand-700">GinhawAI</p>
          <h1 className="text-[17pt] font-bold leading-tight">{title}</h1>
        </div>
        <div className="text-right text-[9pt] text-gray-600">
          {date && (
            <p>
              {t(lang, "printDate")}: <span className="font-semibold text-gray-900">{date}</span>
            </p>
          )}
          {barangay && (
            <p>
              Barangay: <span className="font-semibold text-gray-900">{barangay}</span>
            </p>
          )}
        </div>
      </header>
      <main className="mt-4 space-y-5">{children}</main>
      <footer className="mt-6 border-t border-gray-300 pt-2 text-[8.5pt] text-gray-500">{t(lang, "disclaimer")}</footer>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-1.5 text-[9pt] font-bold uppercase tracking-wide text-brand-800">{children}</h3>;
}

function Box({ checked }: { checked: boolean }) {
  return (
    <span aria-hidden="true" className="mt-[1px] inline-flex h-[11pt] w-[11pt] shrink-0 items-center justify-center border border-gray-700 text-[8pt] leading-none">
      {checked ? "✓" : ""}
    </span>
  );
}

function Urgent({ title, contacts }: { title: string; contacts: { name: string; phone: string | null; address: string | null; what: string }[] }) {
  if (!contacts.length) return null;
  return (
    <section className="break-inside-avoid rounded border border-red-700 p-3">
      <SectionTitle>{title}</SectionTitle>
      <ul className="space-y-1">
        {contacts.map((c) => (
          <li key={c.name}>
            <span className="font-semibold">{c.name}</span>
            {c.phone && <span> · {c.phone}</span>}
            <span className="text-gray-600"> — {c.what}</span>
            {c.address && <span className="block text-[9pt] text-gray-500">{c.address}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Printed Action Plan: per program, the papers to get (with tick boxes), where to go, what happens, dates. */
export function PlanPrint({ plan, lang, date, barangay }: { plan: ActionPlan; lang: Lang; date?: string | null; barangay?: string | null }) {
  return (
    <Frame lang={lang} title={t(lang, "planTitle")} date={fmtDate(date, lang)} barangay={barangay}>
      <Urgent title={plan.urgent_title} contacts={plan.urgent} />
      {plan.programs.map((p, i) => (
        <section key={p.program_id} className={`break-inside-avoid ${i > 0 ? "border-t border-gray-300 pt-4" : ""}`}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[13pt] font-bold">{p.program_name}</h2>
            <span className={`shrink-0 rounded border px-2 py-0.5 text-[8.5pt] font-semibold ${STATUS_STYLE[p.status]}`}>{t(lang, STATUS_KEY[p.status])}</span>
          </div>
          <ol className="mt-2 space-y-3">
            <li>
              <SectionTitle>1. {plan.labels.docs}</SectionTitle>
              {p.all_documents_ready ? (
                <p>{plan.labels.docs_all}</p>
              ) : (
                <ul className="space-y-1.5">
                  {p.documents.map((d) => (
                    <li key={d.document_name} className="flex gap-2">
                      <Box checked={d.have} />
                      <div>
                        <p className="font-semibold">
                          {d.document_name}
                          <span className="ml-1.5 text-[8.5pt] font-normal text-gray-500">({t(lang, d.is_mandatory ? "required" : "optional")})</span>
                        </p>
                        {d.how && <p className="whitespace-pre-line text-[9.5pt] text-gray-700"><LinkText text={d.how} className="text-blue-700 underline" /></p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </li>
            <li>
              <SectionTitle>2. {p.go_title ?? plan.labels.go}</SectionTitle>
              {p.office && (
                <div>
                  <p className="font-semibold">{p.office.name}</p>
                  {p.office.address && <p>{p.office.address}</p>}
                  {(p.office.hours || p.office.phone) && <p className="text-[9.5pt] text-gray-600">{[p.office.hours, p.office.phone].filter(Boolean).join(" · ")}</p>}
                </div>
              )}
              {p.office_note && <p className="mt-1 text-[9.5pt] text-gray-700">{p.office_note}</p>}
            </li>
            <li>
              <SectionTitle>3. {plan.labels.there}</SectionTitle>
              <p>{p.what_happens}</p>
            </li>
            {p.schedules.length > 0 && (
              <li>
                <SectionTitle>4. {plan.labels.dates}</SectionTitle>
                <ul className="space-y-0.5">
                  {p.schedules.map((s) => (
                    <li key={`${s.start_date}-${s.office_name}`}>
                      <span className="font-semibold">
                        {fmtDate(s.start_date, lang)} – {fmtDate(s.end_date, lang)}
                      </span>
                      : {s.office_name}
                      {s.notes && <span className="text-gray-600"> ({s.notes})</span>}
                    </li>
                  ))}
                </ul>
              </li>
            )}
          </ol>
        </section>
      ))}
    </Frame>
  );
}

/** Printed results: the programs that may fit, why, the paper checklist, dates, and where to go. */
export function ResultsPrint({ result, lang, have }: { result: Assessment; lang: Lang; have: Set<string> }) {
  const matched = result.programs.filter((p) => p.status !== "not_qualified");
  const others = result.programs.filter((p) => p.status === "not_qualified");
  return (
    <Frame lang={lang} title={t(lang, "printResultsTitle")} date={fmtDate(result.assessed_on, lang)} barangay={result.barangay}>
      <Urgent title={t(lang, "urgentTitle")} contacts={result.urgent ?? []} />
      {matched.length === 0 && <p>{t(lang, "noPrograms")}</p>}
      {matched.map((p, i) => (
        <section key={p.program_id} className={`break-inside-avoid ${i > 0 ? "border-t border-gray-300 pt-4" : ""}`}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[13pt] font-bold">{p.program_name}</h2>
            <span className={`shrink-0 rounded border px-2 py-0.5 text-[8.5pt] font-semibold ${STATUS_STYLE[p.status]}`}>{t(lang, STATUS_KEY[p.status])}</span>
          </div>
          <p className="text-[9pt] text-gray-500">{p.agency}</p>
          {p.summary && <p className="mt-1.5">{p.summary}</p>}
          {p.criteria.length > 0 && (
            <div className="mt-2.5">
              <SectionTitle>{t(lang, p.status === "qualified" ? "whyQualified" : "whyPartial")}</SectionTitle>
              <ul className="space-y-1">
                {p.criteria.map((c) => (
                  <li key={c.attribute} className="flex gap-2">
                    <span className="w-4 shrink-0 font-bold">{c.status === "pass" ? "✓" : c.status === "fail" ? "✗" : "?"}</span>
                    <span>
                      <span className="font-semibold">{c.label}</span>
                      <span className="block whitespace-pre-line">{c.status === "unknown" ? t(lang, "toVerify") : c.explanation}</span>
                      {c.note && <span className="block text-[9pt] text-gray-600">{c.note}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {p.documents.length > 0 && (
            <div className="mt-2.5">
              <SectionTitle>{t(lang, "documentsTitle")}</SectionTitle>
              <ul className="space-y-1">
                {p.documents.map((d) => (
                  <li key={d.doc_id} className="flex gap-2">
                    <Box checked={have.has(d.doc_id)} />
                    <div>
                      <p className="font-semibold">
                        {d.document_name}
                        <span className="ml-1.5 text-[8.5pt] font-normal text-gray-500">({t(lang, d.is_mandatory ? "required" : "optional")})</span>
                      </p>
                      {d.notes && <p className="whitespace-pre-line text-[9.5pt] text-gray-700"><LinkText text={d.notes} className="text-blue-700 underline" /></p>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {p.schedules.length > 0 && (
            <div className="mt-2.5">
              <SectionTitle>{t(lang, "schedulesTitle")}</SectionTitle>
              <ul className="space-y-0.5">
                {p.schedules.map((s) => (
                  <li key={s.schedule_id}>
                    <span className="font-semibold">
                      {fmtDate(s.start_date, lang)} – {fmtDate(s.end_date, lang)}
                    </span>
                    : {s.office_name}
                    {s.address && <span className="text-gray-600">, {s.address}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ))}
      {result.offices.length > 0 && (
        <section className="break-inside-avoid border-t border-gray-300 pt-4">
          <SectionTitle>{t(lang, "officesTitle")}</SectionTitle>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2">
            {result.offices.slice(0, 6).map((o) => (
              <li key={o.office_id}>
                <p className="font-semibold">{o.office_name}</p>
                {o.address && <p className="text-[9.5pt]">{o.address}</p>}
                {(o.operating_hours || o.contact_number) && (
                  <p className="text-[9pt] text-gray-600">{[o.operating_hours, o.contact_number].filter(Boolean).join(" · ")}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {others.length > 0 && (
        <p className="text-[9pt] text-gray-500">
          {t(lang, "otherPrograms")}: {others.map((p) => p.program_name).join(", ")}
        </p>
      )}
    </Frame>
  );
}
