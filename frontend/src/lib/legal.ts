import type { Lang } from "@/lib/api";

// Text of the Privacy Notice (/privacy) and Terms of Use (/terms), in the three languages.
// It describes what the system really does (see backend: sessions in Redis, 30-minute session,
// optional consent-based accounts, 12-month inactivity deletion, anonymous demand counts, Gemini
// fallback). If the system's behavior changes, update this text too, and the date below.
// Plain language on purpose: many readers are older adults.

/** Fill in when the LGU names a data protection contact (office, email or phone). Shown on /privacy only when not empty. */
export const PRIVACY_CONTACT = "";

export const LEGAL_UPDATED = "November 17, 2026";

export type LegalSection = { h: string; p?: string; items?: string[]; after?: string };
export type LegalDoc = { title: string; intro: string; sections: LegalSection[] };

export const LEGAL_LABELS: Record<Lang, { updated: string; contact: string; privacy: string; terms: string; home: string }> = {
  en: { updated: "Last updated", contact: "Questions about your data", privacy: "Privacy Notice", terms: "Terms of Use", home: "Back to home" },
  fil: { updated: "Huling na-update", contact: "Mga tanong tungkol sa inyong datos", privacy: "Paunawa sa Privacy", terms: "Mga Tuntunin ng Paggamit", home: "Bumalik sa simula" },
  ceb: { updated: "Katapusang gi-update", contact: "Mga pangutana bahin sa imong datos", privacy: "Pahibalo sa Privacy", terms: "Mga Termino sa Paggamit", home: "Balik sa sinugdanan" },
};

export const LEGAL: Record<"privacy" | "terms", Record<Lang, LegalDoc>> = {
  privacy: {
    en: {
      title: "Privacy Notice",
      intro: "We keep this short and simple. It explains what GinhawAI asks, what it keeps, and your rights under the Data Privacy Act of 2012 (RA 10173).",
      sections: [
        { h: "What GinhawAI is", p: "GinhawAI helps people in Cebu City find welfare programs they may qualify for, together with the City's social welfare offices. It gives guidance only. The offices decide who qualifies." },
        {
          h: "What we ask you",
          p: "When you answer our questions, we ask about:",
          items: [
            "your barangay, household size and age",
            "work, income and the type of home you live in",
            "whether the household has a child, a pregnant member, a senior, a person with disability or a solo parent",
            "a recent crisis (such as illness, fire or job loss) and the kind of help you need",
          ],
          after: "Some of these (health, disability, pregnancy) are sensitive personal information. We use them only to match you with programs. The questions do not ask for your name, ID number or street address. Please do not type them in your answers.",
        },
        { h: "If you do not sign in", p: "Your answers stay only in temporary memory for your session. They are deleted when you tap Finish, or automatically after about 30 minutes without activity. For each check we also add one anonymous count (your barangay, the result level and the programs matched) so the City can see where help is needed. These counts cannot be traced back to you." },
        { h: "If you create an account", p: "An account is optional and needs your consent. We keep your username, display name, and email if you give one; your password in scrambled (hashed) form, never as plain text; your Google email and name if you use Google sign-in; and your saved answers and results. You can delete your account at any time in My account, and everything saved is removed. An account with no sign-in for 12 months is deleted automatically." },
        { h: "Who can see your information", p: "City staff who manage GinhawAI see anonymous counts and summaries, not individual answers. System support staff see only masked account details (for example a partly hidden email) when helping with a problem. Staff actions in the system are recorded in an audit log." },
        { h: "Other services we use", p: "Sometimes our own tools cannot read an answer. Then the text of that answer may be sent to an AI service (currently Google's Gemini) so it can be understood. We do not send your account details. If you choose Google sign-in, Google handles that sign-in under its own privacy policy. When you ask for your checklist by email, it goes through an email service, and our logs keep only a partly hidden version of the address." },
        { h: "On your device", p: "GinhawAI saves your language, light or dark setting and text size on your device. Your sign-in is kept only in the open browser tab and ends after 30 minutes. We do not use advertising or tracking." },
        { h: "Your rights", p: "Under RA 10173 you may know what is kept about you, correct it, ask for it to be deleted, and object to its use. Signed-in users can see and delete their data in My account. If you believe your rights were violated, you may file a complaint with the National Privacy Commission (privacy.gov.ph)." },
        { h: "Changes", p: "We may update this notice. The date at the top shows the latest version." },
      ],
    },
    fil: {
      title: "Paunawa sa Privacy",
      intro: "Pinaikli at pinasimple namin ito. Ipinapaliwanag nito kung ano ang itinatanong ng GinhawAI, ano ang itinatago nito, at ang inyong karapatan sa ilalim ng Data Privacy Act of 2012 (RA 10173).",
      sections: [
        { h: "Ano ang GinhawAI", p: "Tinutulungan ng GinhawAI ang mga taga-Cebu City na malaman ang mga programang pang-welfare na maaari nilang mapasukan, katuwang ang mga opisina ng social welfare ng lungsod. Gabay lamang ito. Ang mga opisina ang nagpapasya kung sino ang kwalipikado." },
        {
          h: "Ano ang itinatanong namin",
          p: "Sa inyong pagsagot, itinatanong namin ang:",
          items: [
            "barangay, bilang ng kasama sa bahay at edad",
            "trabaho, kita at uri ng tirahan",
            "kung may bata, buntis, senior, taong may kapansanan o solo parent sa pamilya",
            "kamakailang krisis (tulad ng sakit, sunog o pagkawala ng trabaho) at ang tulong na kailangan",
          ],
          after: "Ang ilan dito (kalusugan, kapansanan, pagbubuntis) ay sensitibong personal na impormasyon. Ginagamit lamang namin ang mga ito para itugma kayo sa mga programa. Hindi namin itinatanong ang inyong pangalan, ID number o address ng bahay. Pakiusap, huwag ninyo itong isulat sa inyong mga sagot.",
        },
        { h: "Kung hindi kayo mag-sign in", p: "Ang inyong mga sagot ay nasa pansamantalang memorya lamang habang tumatakbo ang session. Mabubura ito kapag pinindot ninyo ang Tapusin, o kusang mabubura pagkatapos ng mga 30 minutong walang galaw. Sa bawat pagsusuri, nagdaragdag din kami ng isang di-pinangalanang bilang (barangay, antas ng resulta at mga programang tumugma) para makita ng Lungsod kung saan kailangan ang tulong. Hindi na ito maaaring ibalik sa inyo." },
        { h: "Kung gagawa kayo ng account", p: "Opsyonal ang account at kailangan ng inyong pahintulot. Itinatago namin ang username, display name, at email kung ibibigay ninyo; ang password sa nakatagong (hashed) anyo, hindi kailanman bilang malinaw na teksto; ang Google email at pangalan kung gagamit ng Google sign-in; at ang inyong nai-save na mga sagot at resulta. Maaari ninyong burahin ang account anumang oras sa My account, at mabubura ang lahat ng naka-save. Kusang binubura ang account na hindi nag-sign in sa loob ng 12 buwan." },
        { h: "Sino ang makakakita ng inyong impormasyon", p: "Ang mga staff ng Lungsod na namamahala sa GinhawAI ay nakakakita ng di-pinangalanang bilang at buod, hindi ng mga indibidwal na sagot. Ang support staff ay nakakakita lamang ng tinakpang detalye ng account (halimbawa, bahagyang nakatagong email) kapag may inaayos na problema. Itinatala sa audit log ang mga ginagawa ng staff sa sistema." },
        { h: "Iba pang serbisyong ginagamit namin", p: "Minsan hindi mabasa ng sarili naming mga tool ang isang sagot. Kapag nangyari ito, maaaring ipadala ang teksto ng sagot na iyon sa isang AI service (sa ngayon ay Gemini ng Google) para maintindihan. Hindi namin ipinapadala ang detalye ng inyong account. Kung pipiliin ninyo ang Google sign-in, ang Google ang humahawak ng sign-in na iyon ayon sa sarili nitong privacy policy. Kapag hiniling ninyong ipadala sa email ang checklist, dadaan ito sa isang email service, at bahagyang nakatagong bersyon lamang ng address ang itinatago sa aming mga log." },
        { h: "Sa inyong device", p: "Sine-save ng GinhawAI sa inyong device ang wika, light o dark na setting at laki ng teksto. Ang inyong sign-in ay nasa bukas na browser tab lamang at nagtatapos pagkalipas ng 30 minuto. Hindi kami gumagamit ng advertising o tracking." },
        { h: "Inyong mga karapatan", p: "Sa ilalim ng RA 10173, maaari ninyong malaman kung ano ang itinatago tungkol sa inyo, itama ito, hilingin na burahin ito, at tumutol sa paggamit nito. Makikita at mabubura ng mga naka-sign in ang kanilang datos sa My account. Kung sa palagay ninyo ay nalabag ang inyong mga karapatan, maaari kayong magsampa ng reklamo sa National Privacy Commission (privacy.gov.ph)." },
        { h: "Mga pagbabago", p: "Maaari naming baguhin ang paunawang ito. Ang petsa sa itaas ang nagpapakita ng pinakabagong bersyon." },
      ],
    },
    ceb: {
      title: "Pahibalo sa Privacy",
      intro: "Gipamubo ug gipasayon namo kini. Gipasabot niini kung unsa ang pangutan-on sa GinhawAI, unsa ang tipigan niini, ug ang imong katungod ubos sa Data Privacy Act of 2012 (RA 10173).",
      sections: [
        { h: "Unsa ang GinhawAI", p: "Gitabangan sa GinhawAI ang mga taga-Cebu City nga mahibalo sa mga programa sa welfare nga mahimo nilang masudlan, kauban ang mga opisina sa social welfare sa siyudad. Giya lamang kini. Ang mga opisina ang mohukom kinsa ang kwalipikado." },
        {
          h: "Unsa ang among gipangutana",
          p: "Inig tubag nimo, among pangutan-on ang:",
          items: [
            "barangay, gidaghanon sa naa sa balay ug edad",
            "trabaho, kita ug klase sa puy-anan",
            "kung naay bata, nagmabdos, senior, tawo nga adunay kapansanan o solo parent sa pamilya",
            "bag-ong krisis (sama sa sakit, sunog o nawad-an og trabaho) ug ang tabang nga gikinahanglan",
          ],
          after: "Ang uban niini (panglawas, kapansanan, pagmabdos) sensitibo nga personal nga impormasyon. Gamiton ra namo kini aron itugma ka sa mga programa. Wala namo gipangutana ang imong ngalan, ID number o address sa balay. Palihug ayaw kini isulat sa imong mga tubag.",
        },
        { h: "Kung dili ka mag-sign in", p: "Ang imong mga tubag naa lang sa temporaryo nga memorya samtang molihok ang session. Mapapas kini inig pislit nimo sa Human na, o kusog mapapas human sa mga 30 minutos nga walay lihok. Sa matag pagsusi, magdugang usab mi og usa ka walay ngalan nga ihap (barangay, lebel sa resulta ug mga programa nga mitugma) aron makita sa Siyudad kung asa gikinahanglan ang tabang. Dili na kini mabalik kanimo." },
        { h: "Kung maghimo ka og account", p: "Opsyonal ang account ug kinahanglan ang imong pagtugot. Atong tipigan ang username, display name, ug email kung ihatag nimo; ang password sa tinagoan (hashed) nga porma, dili gyud isip klaro nga teksto; ang Google email ug ngalan kung mogamit og Google sign-in; ug ang imong na-save nga mga tubag ug resulta. Mahimo nimong papason ang account bisan kanus-a sa My account, ug mapapas ang tanang na-save. Kusog gipapas ang account nga wala nag-sign in sulod sa 12 ka bulan." },
        { h: "Kinsa ang makakita sa imong impormasyon", p: "Ang mga staff sa Siyudad nga nagdumala sa GinhawAI makakita lang og walay ngalan nga ihap ug katingbanan, dili sa indibidwal nga mga tubag. Ang support staff makakita lang og gitabonan nga detalye sa account (pananglitan, bahin nga natago nga email) kung naay gi-ayo nga problema. Gitala sa audit log ang gibuhat sa staff sa sistema." },
        { h: "Ubang serbisyo nga among gigamit", p: "Usahay dili mabasa sa among kaugalingong mga himan ang usa ka tubag. Kung mao, ang teksto sa tubag mahimong ipadala sa usa ka AI service (karon Gemini sa Google) aron masabtan. Wala namo ipadala ang detalye sa imong account. Kung pilion nimo ang Google sign-in, ang Google ang mohimo sa maong sign-in subay sa kaugalingon niyang privacy policy. Kung hangyoon nimo nga i-email ang checklist, moagi kini sa usa ka email service, ug bahin nga natago nga bersyon ra sa address ang tipigan sa among mga log." },
        { h: "Sa imong device", p: "Gitipigan sa GinhawAI sa imong device ang pinulongan, light o dark nga setting ug gidak-on sa teksto. Ang imong sign-in naa ra sa abli nga browser tab ug matapos human sa 30 minutos. Wala mi migamit og advertising o tracking." },
        { h: "Imong mga katungod", p: "Ubos sa RA 10173, mahimo nimong mahibal-an kung unsa ang gitipigan bahin kanimo, tul-iron kini, hangyoon nga papason, ug mosupak sa paggamit niini. Ang mga naka-sign in makakita ug makapapas sa ilang datos sa My account. Kung sa imong hunahuna nalapas ang imong mga katungod, mahimo kang mosumbong sa National Privacy Commission (privacy.gov.ph)." },
        { h: "Mga kausaban", p: "Mahimo namong usbon kini nga pahibalo. Ang petsa sa ibabaw nagpakita sa pinakabag-o nga bersyon." },
      ],
    },
  },

  terms: {
    en: {
      title: "Terms of Use",
      intro: "By using GinhawAI you agree to these simple terms.",
      sections: [
        { h: "What GinhawAI is", p: "GinhawAI is a free guide that helps you find welfare programs you may qualify for. It is not a government decision and it does not apply for anything on your behalf." },
        { h: "Results are guidance", p: "Results are based on your answers and on the program rules we have. They do not guarantee approval. Program rules, fees, schedules and office details can change, so confirm with the office before you go. Your LGU office makes the final decision." },
        { h: "Using it fairly", p: "Answer honestly, about your own household or about someone who asked you to help. Do not enter other people's personal details, and do not try to break, overload or misuse the service." },
        { h: "Emergencies", p: "GinhawAI is not an emergency service. If you or someone is in danger, call 911 or the emergency numbers shown in the app." },
        { h: "Accounts", p: "An account is optional. Keep your password private. You may stop using GinhawAI and delete your account at any time. How we handle your data is explained in the Privacy Notice." },
        { h: "No guarantee", p: "We work to keep GinhawAI available and correct, but we provide it as it is, without guarantee. We are not responsible for decisions made by program offices, or for losses from relying only on a result." },
        { h: "Changes and law", p: "We may update these terms. The date at the top shows the latest version. Philippine law applies." },
      ],
    },
    fil: {
      title: "Mga Tuntunin ng Paggamit",
      intro: "Sa paggamit ng GinhawAI, sumasang-ayon kayo sa mga simpleng tuntuning ito.",
      sections: [
        { h: "Ano ang GinhawAI", p: "Ang GinhawAI ay libreng gabay na tumutulong sa inyong malaman ang mga programang pang-welfare na maaari ninyong mapasukan. Hindi ito desisyon ng gobyerno at hindi ito nag-a-apply para sa inyo." },
        { h: "Gabay lamang ang resulta", p: "Ang resulta ay batay sa inyong mga sagot at sa mga patakaran ng programang nasa amin. Hindi ito garantiya ng pag-apruba. Maaaring magbago ang patakaran, bayad, iskedyul at detalye ng opisina, kaya kumpirmahin sa opisina bago pumunta. Ang opisina ng inyong LGU ang gagawa ng huling desisyon." },
        { h: "Patas na paggamit", p: "Sumagot nang tapat, tungkol sa inyong sariling pamilya o sa taong humiling ng tulong ninyo. Huwag maglagay ng personal na detalye ng ibang tao, at huwag subukang sirain, pabigatan o abusuhin ang serbisyo." },
        { h: "Mga emergency", p: "Hindi emergency service ang GinhawAI. Kung may panganib sa inyo o sa iba, tumawag sa 911 o sa mga emergency number na nasa app." },
        { h: "Mga account", p: "Opsyonal ang account. Ingatan ang inyong password. Maaari kayong tumigil sa paggamit ng GinhawAI at burahin ang inyong account anumang oras. Ang paghawak namin sa inyong datos ay ipinaliwanag sa Paunawa sa Privacy." },
        { h: "Walang garantiya", p: "Pinagsisikapan naming maging available at tama ang GinhawAI, ngunit ibinibigay ito nang ganito, walang garantiya. Hindi kami responsable sa mga desisyon ng mga opisina ng programa, o sa pagkalugi dahil sa pag-asa lamang sa resulta." },
        { h: "Mga pagbabago at batas", p: "Maaari naming baguhin ang mga tuntuning ito. Ang petsa sa itaas ang nagpapakita ng pinakabagong bersyon. Batas ng Pilipinas ang umiiral." },
      ],
    },
    ceb: {
      title: "Mga Termino sa Paggamit",
      intro: "Sa paggamit sa GinhawAI, mouyon ka niini nga yanong mga termino.",
      sections: [
        { h: "Unsa ang GinhawAI", p: "Ang GinhawAI usa ka libre nga giya nga motabang nimo nga mahibalo sa mga programa sa welfare nga mahimo nimong masudlan. Dili kini desisyon sa gobyerno ug dili kini moaplay para nimo." },
        { h: "Giya lamang ang resulta", p: "Ang resulta gibase sa imong mga tubag ug sa mga lagda sa programa nga naa kanamo. Dili kini garantiya sa pag-aprobar. Mahimong mausab ang lagda, bayad, iskedyul ug detalye sa opisina, busa kumpirmaha sa opisina sa dili pa moadto. Ang opisina sa imong LGU ang maghimo sa katapusang desisyon." },
        { h: "Patas nga paggamit", p: "Tubag nga tinud-anay, bahin sa imong kaugalingong pamilya o sa tawo nga nangayo sa imong tabang. Ayaw isulod ang personal nga detalye sa ubang tawo, ug ayaw sulayi nga guba-on, pabug-atan o abusohon ang serbisyo." },
        { h: "Mga emerhensya", p: "Dili emergency service ang GinhawAI. Kung naay peligro nimo o sa uban, tawag sa 911 o sa mga emergency number nga naa sa app." },
        { h: "Mga account", p: "Opsyonal ang account. Amoha ang imong password. Mahimo kang mohunong sa paggamit sa GinhawAI ug papason ang imong account bisan kanus-a. Ang among pagdumala sa imong datos gipasabot sa Pahibalo sa Privacy." },
        { h: "Walay garantiya", p: "Gisulayan namong magpabilin nga available ug husto ang GinhawAI, apan gihatag kini sama sa kung unsa kini, walay garantiya. Dili mi responsable sa desisyon sa mga opisina sa programa, o sa kapildihan tungod sa pagsalig lang sa resulta." },
        { h: "Mga kausaban ug balaod", p: "Mahimong usbon namo kini nga mga termino. Ang petsa sa ibabaw nagpakita sa pinakabag-o nga bersyon. Balaod sa Pilipinas ang gamiton." },
      ],
    },
  },
};
