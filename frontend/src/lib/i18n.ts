// UI text for the citizen screens in Filipino, Bisaya and English.
// The chat questions themselves come from the backend (app/chatflow.py).

import type { Entities, Lang } from "./api";

export const LANG_LABELS: Record<Lang, string> = { fil: "Filipino", ceb: "Bisaya", en: "English" };

const T = {
  // Optional citizen account
  acctLoginOrSignup: { fil: "Mag-log in o mag-sign up (opsyonal)", ceb: "Mag-log in o mag-sign up (opsyonal)", en: "Log in or sign up (optional)" },
  acctMyAccount: { fil: "Aking account", ceb: "Akong account", en: "My account" },
  acctHi: { fil: "Kumusta", ceb: "Kumusta", en: "Hi" },
  acctTitle: { fil: "Account", ceb: "Account", en: "Account" },
  acctWhy: {
    fil: "Opsyonal ito. Magagamit pa rin ang GinhawAI nang walang account. Sa account, nase-save ang inyong mga sagot at resulta para mabago ninyo ang mga ito sa susunod.",
    ceb: "Opsyonal kini. Magamit gihapon ang GinhawAI bisan walay account. Sa account, ma-save ang imong mga tubag ug resulta aron mausab nimo kini sunod.",
    en: "This is optional. You can use GinhawAI without an account. With one, your answers and results are saved so you can come back and change them.",
  },
  acctLogin: { fil: "Mag-log in", ceb: "Mag-log in", en: "Log in" },
  acctSignup: { fil: "Mag-sign up", ceb: "Mag-sign up", en: "Sign up" },
  acctUsername: { fil: "Username", ceb: "Username", en: "Username" },
  acctPassword: { fil: "Password", ceb: "Password", en: "Password" },
  acctName: { fil: "Pangalan na itatawag sa inyo (opsyonal)", ceb: "Ngalan nga itawag nimo (opsyonal)", en: "Name to call you (optional)" },
  acctUserHint: { fil: "4–40 letra o numero", ceb: "4–40 ka letra o numero", en: "4–40 letters or numbers" },
  acctPassHint: { fil: "Hindi bababa sa 8 karakter", ceb: "Dili moubos sa 8 ka karakter", en: "At least 8 characters" },
  acctConsent: {
    fil: "Pumapayag akong i-save ng GinhawAI ang aking mga sagot at resulta sa aking account. Maaari kong burahin ang account anumang oras. (RA 10173)",
    ceb: "Mouyon ko nga i-save sa GinhawAI ang akong mga tubag ug resulta sa akong account. Mahimo nakong papason ang account bisan kanus-a. (RA 10173)",
    en: "I agree that GinhawAI may save my answers and results in my account. I can delete my account at any time. (RA 10173)",
  },
  acctOr: { fil: "o", ceb: "o", en: "or" },
  acctNoAccount: { fil: "Gamitin nang walang account", ceb: "Gamita nga walay account", en: "Continue without an account" },
  acctLogout: { fil: "Mag-log out", ceb: "Mag-log out", en: "Log out" },
  acctDelete: { fil: "Burahin ang aking account", ceb: "Papasa ang akong account", en: "Delete my account" },
  acctDeleteConfirm: {
    fil: "Buburahin nang tuluyan ang inyong account, mga sagot at resulta. Ituloy?",
    ceb: "Papason sa hingpit ang imong account, mga tubag ug resulta. Padayon?",
    en: "This permanently deletes your account, answers and results. Continue?",
  },
  acctSavedAnswers: { fil: "Mga naka-save na sagot", ceb: "Mga na-save nga tubag", en: "Saved answers" },
  acctNoSaved: {
    fil: "Wala pang naka-save. Tapusin ang chat nang isang beses at mase-save dito ang inyong mga sagot.",
    ceb: "Wala pay na-save. Humana ang chat makausa ug ma-save diri ang imong mga tubag.",
    en: "Nothing saved yet. Finish the chat once and your answers are saved here.",
  },
  acctCheckAgain: { fil: "Suriin muli gamit ang mga ito", ceb: "Susiha pag-usab gamit kini", en: "Check again with these answers" },
  acctNewCheck: { fil: "Magsimula ng pagtatasa", ceb: "Sugdi ang pagsusi", en: "Start an assessment" },
  acctEditHint: {
    fil: "Para baguhin ang isang sagot, pindutin ang “Suriin muli” at i-edit ito sa pahina ng mga sagot.",
    ceb: "Aron usbon ang usa ka tubag, pindota ang “Susiha pag-usab” ug i-edit kini sa panid sa mga tubag.",
    en: "To change an answer, tap “Check again” and edit it on the review page.",
  },
  acctHistory: { fil: "Mga nakaraang resulta", ceb: "Mga miaging resulta", en: "Past results" },
  acctNoHistory: { fil: "Wala pang resulta.", ceb: "Wala pay resulta.", en: "No results yet." },
  acctQualified: { fil: "maaaring makakuha", ceb: "mahimong makakuha", en: "may qualify" },
  acctSignedInWith: { fil: "Naka-sign in gamit ang", ceb: "Naka-sign in gamit ang", en: "Signed in with" },
  acctGoogleConsent: {
    fil: "Unang beses ninyo gamit ang Google account na ito. Lagyan ng tsek ang pahintulot sa ibaba, pagkatapos ay pindutin muli ang Google.",
    ceb: "Unang higayon nimo gamit kining Google account. I-tsek ang pagtugot sa ubos, unya pindota pag-usab ang Google.",
    en: "First time with this Google account: tick the consent box below, then tap Google again.",
  },
  acctSavePrompt: {
    fil: "Gusto ninyong i-save ang resultang ito para mabago ninyo sa susunod? Gumawa ng libreng account.",
    ceb: "Gusto nimo i-save kining resulta aron mausab nimo sunod? Paghimo og libreng account.",
    en: "Want to keep this result and change your answers later? Create a free account.",
  },
  startOver: { fil: "Magsimula muli", ceb: "Sugod pag-usab", en: "Start over" },
  loading: { fil: "Naglo-load…", ceb: "Nagkarga…", en: "Loading…" },
  sessionEnded: { fil: "Natapos na ang session. Magsimula muli.", ceb: "Nahuman na ang session. Sugod pag-usab.", en: "Your session has ended. Please start again." },
  typeMessage: { fil: "I-type ang sagot…", ceb: "I-type ang tubag…", en: "Type your answer…" },
  startOverConfirm: {
    fil: "Buburahin ang inyong mga sagot at magsisimula ng bagong usapan. Ituloy?",
    ceb: "Papason ang imong mga tubag ug magsugod og bag-ong istorya. Padayon?",
    en: "This erases your answers and starts a new chat. Continue?",
  },
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
    fil: "Ipinapakita ng score kung gaano kalaki ang pangangailangan ng inyong pamilya. Hindi ito ang tsansa ninyong makakuha ng programa: sa susunod na pahina, makikita sa bawat programa kung ilang kailangan ang natugunan ninyo. Ang opisina ng LGU ang magpapasya.",
    ceb: "Gipakita sa score kung unsa kadako ang panginahanglan sa inyong pamilya. Dili kini ang tsansa nimo nga makakuha og programa: sa sunod nga panid, makita sa matag programa kung pila ka kinahanglanon ang imong natuman. Ang opisina sa LGU ang modesisyon.",
    en: "The score shows how much help your household needs. It is not your chance of getting a program: on the next page, each program shows how many of its requirements you meet. Your LGU office makes the final decision.",
  },
  seePrograms: { fil: "Tingnan ang mga programa", ceb: "Tan-awa ang mga programa", en: "See recommended programs" },
  outOf100: { fil: "sa 100", ceb: "sa 100", en: "out of 100" },
  bandLow: { fil: "Mababa", ceb: "Ubos", en: "Low" },
  bandModerate: { fil: "Katamtaman", ceb: "Kasarangan", en: "Moderate" },
  bandHigh: { fil: "Mataas", ceb: "Taas", en: "High" },

  programsTitle: { fil: "Mga programa para sa inyo", ceb: "Mga programa para nimo", en: "Programs for you" },
  qualified: { fil: "Kwalipikado", ceb: "Kwalipikado", en: "Qualified" },
  partial: { fil: "Maaaring kwalipikado", ceb: "Mahimong kwalipikado", en: "May qualify" },
  notQualified: { fil: "Hindi kwalipikado", ceb: "Dili kwalipikado", en: "Not qualified" },
  reqMet: { fil: "Natugunan ang {met} sa {total} na kailangan", ceb: "Natuman ang {met} sa {total} ka kinahanglanon", en: "Meets {met} of {total} requirements" },
  reqVerify: { fil: "{n} susuriin sa opisina", ceb: "{n} susihon sa opisina", en: "{n} to check at the office" },
  whyTitle: { fil: "Bakit?", ceb: "Ngano?", en: "Why?" },
  toVerify: { fil: "Susuriin sa opisina", ceb: "Susihon sa opisina", en: "Checked at the office" },
  documentsTitle: { fil: "Mga dokumentong dadalhin", ceb: "Mga dokumento nga dad-on", en: "Documents to bring" },
  iHaveThis: { fil: "Mayroon na ako", ceb: "Naa na ko", en: "I have this" },
  required: { fil: "Kailangan", ceb: "Kinahanglan", en: "Required" },
  optional: { fil: "Opsyonal", ceb: "Opsyonal", en: "Optional" },
  schedulesTitle: { fil: "Mga iskedyul", ceb: "Mga iskedyul", en: "Schedules" },
  browseTitle: { fil: "Mga programa ng tulong", ceb: "Mga programa sa tabang", en: "Assistance programs" },
  browseHint: {
    fil: "Tingnan ang lahat ng programa, kung sino ang puwedeng mag-apply at ang mga dokumentong dadalhin. Hindi namin kailangan ang inyong impormasyon dito.",
    ceb: "Tan-awa ang tanang programa, kinsa ang mahimong mo-apply ug ang mga dokumento nga dad-on. Dili namo kinahanglan ang imong impormasyon dinhi.",
    en: "See every program, who can apply and which documents to bring. We don't ask for any of your details here.",
  },
  searchPrograms: { fil: "Hanapin ang programa…", ceb: "Pangitaa ang programa…", en: "Search programs…" },
  whoCanApply: { fil: "Sino ang puwedeng mag-apply", ceb: "Kinsa ang mahimong mo-apply", en: "Who can apply" },
  onlyIf: { fil: "Kung", ceb: "Kung", en: "Only if" },
  noMatch: { fil: "Walang programang tugma sa hinanap.", ceb: "Walay programa nga mohaum sa gipangita.", en: "No programs match your search." },
  checkIfQualify: { fil: "Alamin kung kwalipikado ako", ceb: "Susiha kung kwalipikado ko", en: "Check if I qualify" },
  communityTitle: { fil: "Tulong mula sa komunidad", ceb: "Tabang gikan sa komunidad", en: "Community help" },
  communityHint: {
    fil: "Mga NGO at grupo sa Cebu City na beripikado ng LGU, at ang tulong na iniaalok nila ngayon.",
    ceb: "Mga NGO ug grupo sa Cebu City nga gi-verify sa LGU, ug ang tabang nga ilang gitanyag karon.",
    en: "NGOs and community groups in Cebu City, verified by the LGU, and the help they offer right now.",
  },
  officesTitle: { fil: "Saan pupunta", ceb: "Asa moadto", en: "Where to go" },
  yourBarangay: { fil: "Inyong barangay", ceb: "Inyong barangay", en: "Your barangay" },
  chooseBarangay: { fil: "Piliin ang barangay", ceb: "Pilia ang barangay", en: "Choose your barangay" },
  pickBarangayHint: {
    fil: "Piliin ang inyong barangay para makita rin ang inyong barangay hall.",
    ceb: "Pilia ang inyong barangay aron makita usab ang inyong barangay hall.",
    en: "Choose your barangay to also see your barangay hall.",
  },
  hallNotListed: {
    fil: "Wala pang nakalistang barangay hall para dito. Maaari pa ring magtanong mismo sa inyong barangay hall.",
    ceb: "Wala pay nakalista nga barangay hall para niini. Mahimo gihapon mangutana direkta sa inyong barangay hall.",
    en: "Your barangay hall isn't listed yet. You can still ask at your barangay hall directly.",
  },
  noPrograms: {
    fil: "Walang programang tugma ngayon. Maaari pa ring magtanong sa opisina ng inyong barangay.",
    ceb: "Walay programa nga mohaum karon. Mahimo gihapon mangutana sa opisina sa inyong barangay.",
    en: "No programs match right now. You can still ask your barangay office for other help.",
  },
  otherPrograms: { fil: "Iba pang programa na nasuri", ceb: "Ubang programa nga gisusi", en: "Other programs we checked" },
  sendTitle: { fil: "Ipadala ang aking listahan", ceb: "Ipadala ang akong lista", en: "Send my checklist" },
  emailHint: {
    fil: "Opsyonal. Ii-email namin ang listahan ng dokumento at address ng opisina. Hindi namin itatago ang inyong email.",
    ceb: "Opsyonal. I-email namo ang lista sa dokumento ug address sa opisina. Dili namo tipigan ang imong email.",
    en: "Optional. We'll email the document checklist and office address. We don't keep your email.",
  },
  checkSpam: {
    fil: "Tingnan din ang spam folder kung hindi ninyo makita.",
    ceb: "Tan-awa usab ang spam folder kung dili nimo makita.",
    en: "Check your spam folder if you don't see it.",
  },
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
  has_senior: { fil: "May 60 pataas sa pamilya", ceb: "Naay 60 pataas sa pamilya", en: "Someone 60+ in household" },
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

export const BOOL_FIELDS = new Set(["has_children_0_18", "has_pwd", "has_senior", "is_solo_parent"]);
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
