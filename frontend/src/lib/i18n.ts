// UI text for the citizen screens in Filipino, Bisaya and English.
// The chat questions themselves come from the backend (app/chatflow.py).

import type { Entities, Lang } from "./api";

export const LANG_LABELS: Record<Lang, string> = { fil: "Filipino", ceb: "Bisaya", en: "English" };

const T = {
  startOver: { fil: "Magsimula muli", ceb: "Sugod pag-usab", en: "Start over" },
  loading: { fil: "Naglo-load…", ceb: "Nagkarga…", en: "Loading…" },
  sessionEnded: { fil: "Natapos na ang session. Magsimula muli.", ceb: "Nahuman na ang session. Sugod pag-usab.", en: "Your session has ended. Please start again." },
  typeMessage: { fil: "I-type ang sagot…", ceb: "I-type ang tubag…", en: "Type your answer…" },
  reviewAnswers: { fil: "Tingnan ang mga sagot", ceb: "Tan-awa ang mga tubag", en: "Review your answers" },
  assessment: { fil: "Pagtatasa", ceb: "Pagsusi", en: "Assessment" },

  confirmTitle: { fil: "Kumpirmahin ang mga sagot", ceb: "Kumpirmaha ang mga tubag", en: "Confirm your answers" },
  confirmHint: { fil: "Tama ba ang lahat? Pindutin ang I-edit para baguhin.", ceb: "Sakto ba tanan? Pindota ang I-edit aron usbon.", en: "Is everything correct? Tap Edit to change an answer." },
  edit: { fil: "I-edit", ceb: "I-edit", en: "Edit" },
  save: { fil: "I-save", ceb: "I-save", en: "Save" },
  cancel: { fil: "Kanselahin", ceb: "Kanselahon", en: "Cancel" },
  confirmSubmit: { fil: "Kumpirmahin at Isumite", ceb: "Kumpirmaha ug Isumite", en: "Confirm and Submit" },
  checking: { fil: "Sinusuri…", ceb: "Gisusi…", en: "Checking…" },
  yes: { fil: "Oo", ceb: "Oo", en: "Yes" },
  no: { fil: "Hindi", ceb: "Dili", en: "No" },
  notAnswered: { fil: "Wala pang sagot", ceb: "Wala pay tubag", en: "Not answered yet" },

  resultTitle: { fil: "Ang inyong resulta", ceb: "Ang imong resulta", en: "Your result" },
  whyThisScore: { fil: "Bakit ganito ang resulta", ceb: "Nganong mao kini ang resulta", en: "Why you got this result" },
  scoreNote: {
    fil: "Isa itong tantya para makapagmungkahi ng mga programa. Hindi ito opisyal na desisyon — ang opisina ng LGU ang magkukumpirma.",
    ceb: "Usa kini ka banabana aron makasugyot og mga programa. Dili kini opisyal nga desisyon — ang opisina sa LGU ang mokumpirma.",
    en: "This score is an estimate used to suggest programs. It is not an official decision — your LGU office confirms eligibility.",
  },
  seePrograms: { fil: "Tingnan ang mga programa", ceb: "Tan-awa ang mga programa", en: "See recommended programs" },
  outOf100: { fil: "sa 100", ceb: "sa 100", en: "out of 100" },

  programsTitle: { fil: "Mga programa para sa inyo", ceb: "Mga programa para nimo", en: "Programs for you" },
  qualified: { fil: "Kwalipikado", ceb: "Kwalipikado", en: "Qualified" },
  partial: { fil: "Posibleng kwalipikado", ceb: "Posibleng kwalipikado", en: "Likely qualified" },
  notQualified: { fil: "Hindi kwalipikado", ceb: "Dili kwalipikado", en: "Not qualified" },
  likelihood: { fil: "tsansa", ceb: "tsansa", en: "match" },
  whyTitle: { fil: "Bakit?", ceb: "Ngano?", en: "Why?" },
  toVerify: { fil: "Susuriin sa opisina", ceb: "Susihon sa opisina", en: "Checked at the office" },
  documentsTitle: { fil: "Mga dokumentong dadalhin", ceb: "Mga dokumento nga dad-on", en: "Documents to bring" },
  iHaveThis: { fil: "Mayroon na ako", ceb: "Naa na ko", en: "I have this" },
  required: { fil: "Kailangan", ceb: "Kinahanglan", en: "Required" },
  optional: { fil: "Opsyonal", ceb: "Opsyonal", en: "Optional" },
  schedulesTitle: { fil: "Mga iskedyul", ceb: "Mga iskedyul", en: "Schedules" },
  officesTitle: { fil: "Saan pupunta", ceb: "Asa moadto", en: "Where to go" },
  noPrograms: {
    fil: "Walang programang tugma ngayon. Maaari pa ring magtanong sa opisina ng inyong barangay.",
    ceb: "Walay programa nga mohaum karon. Mahimo gihapon mangutana sa opisina sa inyong barangay.",
    en: "No programs match right now. You can still ask your barangay office for other help.",
  },
  otherPrograms: { fil: "Iba pang programa na nasuri", ceb: "Ubang programa nga gisusi", en: "Other programs we checked" },
  smsTitle: { fil: "Ipadala via SMS", ceb: "Ipadala pinaagi sa SMS", en: "Send via SMS" },
  smsHint: {
    fil: "Ipadadala namin ang listahan ng dokumento at address ng opisina sa inyong cellphone. Hindi namin itatago ang inyong numero.",
    ceb: "Ipadala namo ang lista sa dokumento ug address sa opisina sa imong cellphone. Dili namo tipigan ang imong numero.",
    en: "We'll text the document checklist and office address to your phone. We don't keep your number.",
  },
  send: { fil: "Ipadala", ceb: "Ipadala", en: "Send" },
  sending: { fil: "Ipinapadala…", ceb: "Gipadala…", en: "Sending…" },
  sent: { fil: "Naipadala na!", ceb: "Napadala na!", en: "Sent successfully!" },
  saveChecklist: { fil: "I-save / I-print ang listahan", ceb: "I-save / I-print ang lista", en: "Save / print checklist" },
  finish: { fil: "Tapusin", ceb: "Human na", en: "Finish" },
  disclaimer: {
    fil: "Ang huling desisyon sa pagiging kwalipikado ay mula sa opisina ng LGU.",
    ceb: "Ang katapusang desisyon kung kwalipikado ba gikan sa opisina sa LGU.",
    en: "Final eligibility is decided by your LGU office.",
  },

  doneTitle: { fil: "Salamat!", ceb: "Salamat!", en: "Thank you!" },
  donePurged: {
    fil: "Natapos na ang inyong session at binura na namin ang lahat ng inyong sagot, alinsunod sa Data Privacy Act (RA 10173).",
    ceb: "Nahuman na ang imong session ug gipapas na namo ang tanan nimong tubag, subay sa Data Privacy Act (RA 10173).",
    en: "Your session has ended and all your answers have been deleted, as required by the Data Privacy Act (RA 10173).",
  },
  feedbackTitle: { fil: "Tulungan kaming mapabuti ang GinhawAI", ceb: "Tabangi mi nga mapaayo ang GinhawAI", en: "Help us improve GinhawAI" },
  feedbackHint: { fil: "Opsyonal at hindi nagpapakilala. 1 = lubos na hindi sang-ayon, 5 = lubos na sang-ayon.", ceb: "Opsyonal ug dili mailhan. 1 = hugot nga dili uyon, 5 = hugot nga uyon.", en: "Optional and anonymous. 1 = strongly disagree, 5 = strongly agree." },
  comment: { fil: "May iba pa ba kayong gustong sabihin?", ceb: "Aduna pa bay gusto nimong isulti?", en: "Anything else you'd like to tell us?" },
  submitFeedback: { fil: "Ipadala ang feedback", ceb: "Ipadala ang feedback", en: "Send feedback" },
  feedbackThanks: { fil: "Salamat sa inyong feedback!", ceb: "Salamat sa imong feedback!", en: "Thanks for your feedback!" },
  newAssessment: { fil: "Bagong pagtatasa", ceb: "Bag-ong pagsusi", en: "New assessment" },
} as const;

export type Key = keyof typeof T;
export const t = (lang: Lang, key: Key) => T[key][lang] ?? T[key].en;

// ---------------------------------------------------------------------------
// Answer labels (Fig. 17 data confirmation)
// ---------------------------------------------------------------------------
export const FIELD_LABELS: Record<keyof Omit<Entities, "barangay_code">, Record<Lang, string>> = {
  barangay: { fil: "Barangay", ceb: "Barangay", en: "Barangay" },
  household_size: { fil: "Bilang ng nakatira", ceb: "Gidaghanon sa nagpuyo", en: "People in household" },
  monthly_income: { fil: "Kita kada buwan", ceb: "Kita kada bulan", en: "Monthly income" },
  employment_status: { fil: "Trabaho", ceb: "Trabaho", en: "Work situation" },
  age: { fil: "Edad", ceb: "Edad", en: "Age" },
  housing_type: { fil: "Tirahan", ceb: "Puy-anan", en: "Housing" },
  has_children_0_18: { fil: "May anak 0–18 / buntis", ceb: "Naay anak 0–18 / mabdos", en: "Children 0–18 / pregnant" },
  has_pwd: { fil: "May PWD sa pamilya", ceb: "Naay PWD sa pamilya", en: "PWD in household" },
  is_solo_parent: { fil: "Solo parent", ceb: "Solo parent", en: "Solo parent" },
  crisis_type: { fil: "Krisis ngayon", ceb: "Krisis karon", en: "Current crisis" },
};

export const FIELD_ORDER = Object.keys(FIELD_LABELS) as (keyof typeof FIELD_LABELS)[];

export const CHOICES: Record<string, { value: string; label: Record<Lang, string> }[]> = {
  employment_status: [
    { value: "employed", label: { fil: "May regular na trabaho", ceb: "Naay regular nga trabaho", en: "Regular job" } },
    { value: "self_employed", label: { fil: "May sariling negosyo", ceb: "Naay kaugalingong negosyo", en: "Own small business" } },
    { value: "informal", label: { fil: "Arawan / 'extra'", ceb: "Adlaw-adlaw / 'extra'", en: "Daily wage / odd jobs" } },
    { value: "seasonal", label: { fil: "Pana-panahon", ceb: "Seasonal", en: "Seasonal work" } },
    { value: "underemployed", label: { fil: "Kulang ang trabaho", ceb: "Kulang ang trabaho", en: "Not enough work" } },
    { value: "unemployed", label: { fil: "Walang trabaho", ceb: "Walay trabaho", en: "No work" } },
    { value: "displaced", label: { fil: "Kakatanggal lang sa trabaho", ceb: "Bag-o lang natangtang", en: "Recently lost job" } },
  ],
  housing_type: [
    { value: "owned", label: { fil: "Sariling bahay", ceb: "Kaugalingong balay", en: "Own house" } },
    { value: "rented", label: { fil: "Umuupa", ceb: "Nag-abang", en: "Renting" } },
    { value: "with_relatives", label: { fil: "Nakikitira sa kamag-anak", ceb: "Nakipuyo sa paryente", en: "Living with relatives" } },
    { value: "informal_settler", label: { fil: "Informal settler", ceb: "Informal settler", en: "Informal settler" } },
  ],
  crisis_type: [
    { value: "none", label: { fil: "Wala", ceb: "Wala", en: "None" } },
    { value: "medical", label: { fil: "Pagpapagamot / ospital", ceb: "Pagpatambal / ospital", en: "Medical / hospital" } },
    { value: "death", label: { fil: "May namatay sa pamilya", ceb: "Naay namatay sa pamilya", en: "Death in the family" } },
    { value: "fire", label: { fil: "Nasunugan", ceb: "Nasunogan", en: "Fire" } },
    { value: "calamity", label: { fil: "Baha / bagyo", ceb: "Baha / bagyo", en: "Flood / typhoon" } },
    { value: "job_loss", label: { fil: "Biglang nawalan ng kita", ceb: "Kalit nawad-an og kita", en: "Sudden loss of income" } },
  ],
};

export const BOOL_FIELDS = new Set(["has_children_0_18", "has_pwd", "is_solo_parent"]);
export const NUMBER_FIELDS = new Set(["household_size", "monthly_income", "age"]);

export function displayValue(field: string, value: unknown, lang: Lang): string {
  if (value === undefined || value === null || value === "") return t(lang, "notAnswered");
  if (BOOL_FIELDS.has(field)) return value ? t(lang, "yes") : t(lang, "no");
  if (field === "monthly_income") return `₱${Number(value).toLocaleString("en-PH")}`;
  const choice = CHOICES[field]?.find((c) => c.value === value);
  return choice ? choice.label[lang] : String(value);
}

// ---------------------------------------------------------------------------
// System Usability Scale (Table 18 — sus_score). Standard 10 items.
// ---------------------------------------------------------------------------
export const SUS_ITEMS: Record<Lang, string>[] = [
  { en: "I would like to use GinhawAI again.", fil: "Gusto kong gamitin muli ang GinhawAI.", ceb: "Gusto nakong gamiton pag-usab ang GinhawAI." },
  { en: "It was more complicated than it needed to be.", fil: "Mas komplikado ito kaysa kinakailangan.", ceb: "Mas komplikado kini kaysa kinahanglan." },
  { en: "It was easy to use.", fil: "Madali itong gamitin.", ceb: "Sayon kini gamiton." },
  { en: "I would need someone's help to use it.", fil: "Kakailanganin ko ng tulong ng iba para magamit ito.", ceb: "Kinahanglan nako ang tabang sa uban aron magamit kini." },
  { en: "The different parts worked well together.", fil: "Maayos na nagtutugma ang iba't ibang bahagi.", ceb: "Maayo ang pagkahiusa sa lainlaing bahin." },
  { en: "Some parts didn't make sense together.", fil: "May mga bahaging hindi magkatugma.", ceb: "Naay mga bahin nga dili magkahiusa." },
  { en: "Most people would learn to use it quickly.", fil: "Mabilis itong matututunan ng karamihan.", ceb: "Dali ra kini makat-onan sa kadaghanan." },
  { en: "It was awkward or confusing to use.", fil: "Nakakalito itong gamitin.", ceb: "Makalibog kini gamiton." },
  { en: "I felt confident using it.", fil: "Kampante ako habang ginagamit ito.", ceb: "Kumpiyansa ko samtang gigamit kini." },
  { en: "I had to learn a lot before I could use it.", fil: "Marami akong kailangang matutunan bago ito magamit.", ceb: "Daghan kong kinahanglan makat-onan una kini magamit." },
];
