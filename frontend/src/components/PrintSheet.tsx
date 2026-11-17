import Image from "next/image";
import { ActionPlan, Lang } from "@/lib/api";
import { t } from "@/lib/i18n";

// The printed checklist: shown only on paper (hidden on screen). A letterhead, then for each
// program the documents to bring (with a box to tick) and the office to go to, then a footer.
export default function PrintSheet({ plan, lang, barangay }: { plan: ActionPlan; lang: Lang; barangay?: string | null }) {
  const printedOn = new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  return (
    <div className="hidden bg-white p-6 text-gray-900 print:block">
      <div className="border-b-2 border-gray-800 pb-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="GinhawAI" width={243} height={313} className="h-12 w-auto" />
            <div>
              <p className="text-xl font-bold">GinhawAI</p>
              <p className="text-sm text-gray-600">{t(lang, "printSubtitle")}</p>
            </div>
          </div>
          <p className="text-right text-sm text-gray-600">
            {t(lang, "printedOn")}
            <br />
            {printedOn}
            {barangay && (
              <>
                <br />
                Brgy. {barangay}
              </>
            )}
          </p>
        </div>
        <h1 className="mt-3 text-2xl font-bold">{t(lang, "programsTitle")}</h1>
      </div>

      <div className="mt-4 space-y-4">
        {plan.programs.map((p) => (
          <section key={p.program_id} className="break-inside-avoid rounded-xl p-4 ring-1 ring-gray-300">
            <h2 className="text-lg font-bold">{p.program_name}</h2>

            <h3 className="mt-3 text-xs font-bold uppercase tracking-wide text-gray-500">{t(lang, "documentsTitle")}</h3>
            {p.documents.length === 0 ? (
              <p className="mt-1 text-sm text-gray-600">{t(lang, "noDocsListed")}</p>
            ) : (
              <ul className="mt-1.5 space-y-1.5">
                {p.documents.map((d) => (
                  <li key={d.document_name} className="flex gap-2 text-sm">
                    {/* an empty box to tick by hand; a check when the citizen already has it */}
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 border-gray-400 text-[0.625rem] font-bold">{d.have ? "✓" : ""}</span>
                    <span>
                      {d.document_name}
                      {!d.is_mandatory && <span className="ml-1 text-gray-500">({t(lang, "optional")})</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <h3 className="mt-3 text-xs font-bold uppercase tracking-wide text-gray-500">{plan.labels.go}</h3>
            {p.office && (
              <div className="mt-1 text-sm">
                <p className="font-semibold">{p.office.name}</p>
                {p.office.address && <p>{p.office.address}</p>}
                <p className="text-gray-600">{[p.office.hours, p.office.phone].filter(Boolean).join(" · ")}</p>
              </div>
            )}
            {p.office_note && <p className="mt-1 text-sm text-gray-700">{p.office_note}</p>}

            {p.schedules.length > 0 && (
              <>
                <h3 className="mt-3 text-xs font-bold uppercase tracking-wide text-gray-500">{plan.labels.dates}</h3>
                <ul className="mt-1 space-y-0.5 text-sm">
                  {p.schedules.map((s, i) => (
                    <li key={i}>
                      {s.start_date === s.end_date ? s.start_date : `${s.start_date} – ${s.end_date}`} · {s.office_name}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        ))}
      </div>

      <p className="mt-4 border-t border-gray-300 pt-3 text-xs text-gray-600">
        {t(lang, "planNote")} {t(lang, "disclaimer")}
      </p>
    </div>
  );
}
