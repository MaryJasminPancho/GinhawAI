"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonClasses } from "@/components/Button";
import { AppStatus, getMyReminders, getMyTracker, Lang, Reminders, setMyApplication, setMyReminders, TrackedProgram, Tracker } from "@/lib/api";

// Signed-in extras on the dashboard (answer to the professor's "That's all?"):
//   * RecheckCard:   "Did something change?" (+ why to check again: an old result, turning 60)
//   * TrackerCard:   where the citizen is with each program, with a "valid until" date for renewals
//   * RemindersCard: opt-in email reminders (visit dates, renewals, check again)

type Text = Record<Lang, string>;
const TX = {
  recheckTitle: { en: "Did something change?", fil: "May nagbago ba?", ceb: "Naay nausab?" },
  recheckIntro: {
    en: "If your situation changed, check again: you may qualify for more. For example:",
    fil: "Kung nagbago ang inyong sitwasyon, magsuri muli: baka may iba pa kayong makuha. Halimbawa:",
    ceb: "Kung nausab ang imong kahimtang, susiha pag-usab: basin naa pay laing makuha nimo. Pananglitan:",
  },
  recheckExamples: {
    en: "lost a job or income · a new baby or pregnancy · someone got a disability · someone turned 60 · an emergency · moved to another barangay",
    fil: "nawalan ng trabaho o kita · bagong sanggol o nagbubuntis · may nagkaroon ng kapansanan · may nag-60 · may emergency · lumipat ng barangay",
    ceb: "nawad-an og trabaho o kita · bag-ong bata o nagmabdos · naay nakabaton og kakulangan · naay nag-60 · naay emerhensya · nibalhin og barangay",
  },
  recheckOld: {
    en: "Your last check was {n} days ago.",
    fil: "{n} araw na mula sa huli ninyong pagsusuri.",
    ceb: "{n} ka adlaw na sukad sa imong kataposang pagsusi.",
  },
  recheckAge60: {
    en: "You may have turned 60 since your last check, so senior citizen programs may now fit.",
    fil: "Maaaring nag-60 na kayo mula sa huli ninyong pagsusuri, kaya baka pasok na kayo sa mga programa para sa senior citizen.",
    ceb: "Basin nag-60 na ka sukad sa imong kataposang pagsusi, busa basin pasok na ka sa mga programa para sa senior citizen.",
  },
  recheckButton: { en: "Check again", fil: "Magsuri muli", ceb: "Susiha pag-usab" },
  recheckHow: {
    en: "Your saved answers are filled in. Change the ones that are different on the review page.",
    fil: "Nakalagay na ang inyong mga naka-save na sagot. Baguhin ang mga iba na sa review page.",
    ceb: "Nakabutang na ang imong na-save nga mga tubag. Usba ang lahi na sa review page.",
  },
  trackerTitle: { en: "My applications", fil: "Aking mga aplikasyon", ceb: "Akong mga aplikasyon" },
  trackerHint: {
    en: "Mark where you are with each program. Your progress is saved to your account.",
    fil: "Markahan kung nasaan na kayo sa bawat programa. Naka-save ito sa inyong account.",
    ceb: "Markahi kung asa na ka sa matag programa. Ma-save kini sa imong account.",
  },
  trackerNone: {
    en: "No programs yet. Start a check to see which ones may fit.",
    fil: "Wala pang programa. Magsimula ng pagsusuri para makita kung alin ang maaaring para sa inyo.",
    ceb: "Wala pay programa. Sugdi ang pagsusi aron makita kung unsa ang mahimong para nimo.",
  },
  not_started: { en: "Not started", fil: "Hindi pa nasisimulan", ceb: "Wala pa nasugdan" },
  papers_ready: { en: "Papers ready", fil: "Handa na ang papeles", ceb: "Andam na ang papeles" },
  applied: { en: "Applied", fil: "Nakapag-apply na", ceb: "Nakaaplay na" },
  approved: { en: "Approved", fil: "Naaprubahan", ceb: "Naaprobahan" },
  statusLabel: { en: "Status", fil: "Kalagayan", ceb: "Kahimtang" },
  papers: { en: "Papers: {r} of {t} ready", fil: "Papeles: {r} sa {t} handa", ceb: "Papeles: {r} sa {t} andam" },
  allReady: {
    en: "All papers are ticked. You can mark this as “Papers ready”.",
    fil: "Natsek na ang lahat ng papeles. Maaari na itong markahan na “Handa na ang papeles”.",
    ceb: "Natsek na ang tanang papeles. Mahimo na kining markahan nga “Andam na ang papeles”.",
  },
  nextVisit: { en: "Next schedule", fil: "Susunod na iskedyul", ceb: "Sunod nga iskedyul" },
  validUntil: { en: "Valid until (optional)", fil: "May bisa hanggang (opsyonal)", ceb: "Balido hangtod (opsyonal)" },
  validHint: {
    en: "If this is an ID or benefit you renew, add the date on it. With reminders on, we'll email you 30 and 7 days before.",
    fil: "Kung ID o benepisyo ito na nire-renew, ilagay ang petsa nito. Kung naka-on ang paalala, mag-e-email kami 30 at 7 araw bago nito.",
    ceb: "Kung ID o benepisyo kini nga i-renew, ibutang ang petsa niini. Kung naka-on ang pahinumdom, mag-email mi 30 ug 7 ka adlaw sa dili pa.",
  },
  soloHint: {
    en: "Solo Parent IDs are valid for 1 year.",
    fil: "Isang taon ang bisa ng Solo Parent ID.",
    ceb: "Usa ka tuig ang balido sa Solo Parent ID.",
  },
  pwdHint: {
    en: "PWD IDs are valid for 5 years.",
    fil: "Limang taon ang bisa ng PWD ID.",
    ceb: "Lima ka tuig ang balido sa PWD ID.",
  },
  seniorNoExpiry: {
    en: "Senior Citizen IDs don't expire, so there's nothing to renew.",
    fil: "Hindi napapaso ang Senior Citizen ID, kaya walang kailangang i-renew.",
    ceb: "Dili ma-expire ang Senior Citizen ID, busa walay kinahanglan i-renew.",
  },
  saveFailed: { en: "Couldn't save. Please try again.", fil: "Hindi na-save. Subukan muli.", ceb: "Wala ma-save. Sulayi pag-usab." },
  remindersTitle: { en: "Email reminders", fil: "Mga paalala sa email", ceb: "Mga pahinumdom sa email" },
  remindersIntro: {
    en: "We'll email you when a schedule for one of your programs is 3 days away, when an ID or benefit is about to expire, and when it's time to check again.",
    fil: "Mag-e-email kami kapag 3 araw na lang bago ang iskedyul ng isa sa inyong mga programa, kapag malapit nang mapaso ang ID o benepisyo, at kapag panahon nang magsuri muli.",
    ceb: "Mag-email mi kung 3 ka adlaw na lang sa dili pa ang iskedyul sa usa sa imong mga programa, kung hapit na ma-expire ang ID o benepisyo, ug kung panahon na sa pagsusi pag-usab.",
  },
  emailLabel: { en: "Your email", fil: "Inyong email", ceb: "Imong email" },
  consent: {
    en: "I agree to receive reminder emails. GinhawAI keeps this address only while reminders are on.",
    fil: "Pumapayag akong makatanggap ng mga paalala sa email. Itatago lang ng GinhawAI ang address na ito habang naka-on ang paalala.",
    ceb: "Mouyon ko nga makadawat og mga pahinumdom sa email. Tipigan ra sa GinhawAI kini nga address samtang naka-on ang pahinumdom.",
  },
  turnOn: { en: "Turn on reminders", fil: "I-on ang mga paalala", ceb: "I-on ang mga pahinumdom" },
  turnOff: { en: "Turn off", fil: "I-off", ceb: "I-off" },
  onAt: { en: "On. Reminders go to {e}.", fil: "Naka-on. Ipapadala ang mga paalala sa {e}.", ceb: "Naka-on. Ipadala ang mga pahinumdom sa {e}." },
  notReady: {
    en: "The office hasn't set up email yet. Your reminders will start once it does.",
    fil: "Hindi pa naka-set up ng opisina ang email. Magsisimula ang inyong mga paalala kapag naayos na ito.",
    ceb: "Wala pa ma-set up sa opisina ang email. Magsugod ang imong mga pahinumdom kung maayo na kini.",
  },
} satisfies Record<string, Text>;

const tx = (lang: Lang, key: keyof typeof TX, vars: Record<string, string | number> = {}) =>
  Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), TX[key][lang] ?? TX[key].en);

const STATUSES: AppStatus[] = ["not_started", "papers_ready", "applied", "approved"];
const card = "rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 dark:bg-white/4 dark:ring-white/10";
const cardTitle = "text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400";
const input =
  "min-h-11 w-full rounded-xl border-0 bg-white px-3 text-sm text-gray-900 ring-1 ring-gray-200 focus:ring-2 focus:ring-brand-500 dark:bg-white/5 dark:text-gray-100 dark:ring-white/10";
const fmtDate = (iso: string, lang: Lang) => new Date(`${iso}T00:00:00`).toLocaleDateString(lang === "en" ? "en-PH" : "fil-PH", { dateStyle: "medium" });

/** Loads the tracker once for both the "check again" card and the applications card. */
export function useTracker() {
  const [tracker, setTracker] = useState<Tracker | null>(null);
  useEffect(() => {
    getMyTracker()
      .then(setTracker)
      .catch(() => setTracker({ programs: [], recheck: { checked_on: null, days_since: null, reasons: [] } }));
  }, []);
  return [tracker, setTracker] as const;
}

export function RecheckCard({ tracker, lang }: { tracker: Tracker | null; lang: Lang }) {
  const reasons = tracker?.recheck.reasons ?? [];
  const days = tracker?.recheck.days_since ?? 0;
  return (
    <section className={card}>
      <h2 className={cardTitle}>{tx(lang, "recheckTitle")}</h2>
      {reasons.length > 0 && (
        <div className="mt-3 space-y-1 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/20">
          {reasons.includes("age60") && <p>{tx(lang, "recheckAge60")}</p>}
          {reasons.includes("old") && <p>{tx(lang, "recheckOld", { n: days })}</p>}
        </div>
      )}
      <p className="mt-3 text-sm text-gray-700 dark:text-gray-200">{tx(lang, "recheckIntro")}</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{tx(lang, "recheckExamples")}</p>
      <Link href="/language" className={buttonClasses("secondary", "mt-4 w-full text-center")}>
        {tx(lang, "recheckButton")}
      </Link>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{tx(lang, "recheckHow")}</p>
    </section>
  );
}

function TrackedRow({ p, lang, onChange }: { p: TrackedProgram; lang: Lang; onChange: (status: AppStatus, validUntil: string | null) => void }) {
  const id = `status-${p.program_id}`;
  // How long each ID lasts: Solo Parent 1 year, PWD 5 years, Senior Citizen (OSCA) never expires.
  const idHint = /solo parent/i.test(p.program_name) ? "soloHint" : /\bpwd\b/i.test(p.program_name) ? "pwdHint" : null;
  const noExpiry = /senior citizen id|osca/i.test(p.program_name);
  return (
    <li className="rounded-2xl bg-gray-50 p-4 dark:bg-white/[0.03]">
      <h3 className="text-sm font-semibold">{p.program_name}</h3>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        {p.total > 0 && <span>{tx(lang, "papers", { r: p.ready, t: p.total })}</span>}
        {p.next_schedule && (
          <span>
            {tx(lang, "nextVisit")}: {fmtDate(p.next_schedule.start_date, lang)} · {p.next_schedule.office_name}
          </span>
        )}
      </div>
      <label htmlFor={id} className="mt-3 block text-xs font-semibold text-gray-600 dark:text-gray-300">
        {tx(lang, "statusLabel")}
      </label>
      <select id={id} className={`${input} mt-1`} value={p.status} onChange={(e) => onChange(e.target.value as AppStatus, p.valid_until)}>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {tx(lang, s)}
          </option>
        ))}
      </select>
      {p.status === "not_started" && p.total > 0 && p.ready === p.total && (
        <p className="mt-2 text-xs font-medium text-brand-800 dark:text-brand-300">{tx(lang, "allReady")}</p>
      )}
      {p.status === "approved" && noExpiry && <p className="mt-2 text-xs font-medium text-brand-800 dark:text-brand-300">{tx(lang, "seniorNoExpiry")}</p>}
      {p.status === "approved" && !noExpiry && (
        <div className="mt-3">
          <label htmlFor={`${id}-until`} className="block text-xs font-semibold text-gray-600 dark:text-gray-300">
            {tx(lang, "validUntil")}
          </label>
          <input
            id={`${id}-until`}
            type="date"
            className={`${input} mt-1`}
            value={p.valid_until ?? ""}
            onChange={(e) => onChange("approved", e.target.value || null)}
          />
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
            {idHint && `${tx(lang, idHint)} `}
            {tx(lang, "validHint")}
          </p>
        </div>
      )}
    </li>
  );
}

export function TrackerCard({ tracker, setTracker, lang }: { tracker: Tracker | null; setTracker: (t: Tracker) => void; lang: Lang }) {
  const [failed, setFailed] = useState(false);

  /** Changes at once, then saves; put back if saving fails. */
  function change(p: TrackedProgram, status: AppStatus, validUntil: string | null) {
    if (!tracker) return;
    const before = tracker;
    const next = { ...p, status, valid_until: status === "approved" ? validUntil : null };
    setFailed(false);
    setTracker({ ...tracker, programs: tracker.programs.map((x) => (x.program_id === p.program_id ? next : x)) });
    setMyApplication(p.program_id, status, next.valid_until).catch(() => {
      setTracker(before);
      setFailed(true);
    });
  }

  return (
    <section className={card}>
      <h2 className={cardTitle}>{tx(lang, "trackerTitle")}</h2>
      {tracker === null ? null : tracker.programs.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{tx(lang, "trackerNone")}</p>
      ) : (
        <>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{tx(lang, "trackerHint")}</p>
          {failed && (
            <p role="alert" className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
              {tx(lang, "saveFailed")}
            </p>
          )}
          <ul className="mt-3 space-y-3">
            {tracker.programs.map((p) => (
              <TrackedRow key={p.program_id} p={p} lang={lang} onChange={(s, v) => change(p, s, v)} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function RemindersCard({ lang }: { lang: Lang }) {
  const [r, setR] = useState<Reminders | null>(null);
  const [email, setEmail] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyReminders()
      .then((x) => {
        setR(x);
        setEmail(x.email ?? x.account_email ?? "");
      })
      .catch(() => setR(null));
  }, []);

  async function save(on: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await setMyReminders(on, on ? email : null);
      setR((x) => (x ? { ...x, on: res.on, email: res.email } : x));
      if (!on) setAgree(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!r) return null;
  return (
    <section className={card}>
      <h2 className={cardTitle}>{tx(lang, "remindersTitle")}</h2>
      <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">{tx(lang, "remindersIntro")}</p>
      {!r.email_ready && <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">{tx(lang, "notReady")}</p>}
      {error && (
        <p role="alert" className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      )}
      {r.on ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-brand-800 dark:text-brand-300">{tx(lang, "onAt", { e: r.email ?? "" })}</p>
          <button type="button" disabled={busy} onClick={() => save(false)} className={buttonClasses("secondary", "px-5")}>
            {tx(lang, "turnOff")}
          </button>
        </div>
      ) : (
        <form
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save(true);
          }}
        >
          <div>
            <label htmlFor="reminder-email" className="block text-xs font-semibold text-gray-600 dark:text-gray-300">
              {tx(lang, "emailLabel")}
            </label>
            <input id="reminder-email" type="email" required autoComplete="email" className={`${input} mt-1`} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <label className="flex cursor-pointer items-start gap-3 text-sm text-gray-700 dark:text-gray-200">
            <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-brand-600" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>{tx(lang, "consent")}</span>
          </label>
          <button type="submit" disabled={busy || !agree || !email} className={buttonClasses("primary", "w-full")}>
            {tx(lang, "turnOn")}
          </button>
        </form>
      )}
    </section>
  );
}
