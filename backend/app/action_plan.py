"""After the result (2nd consultation: "That's all?"): a step-by-step Action Plan and urgent
help contacts.

For every program the household can or may apply for: get the documents ready (with where and
how to get each missing one), where to go, what happens there, and upcoming schedules. When the
citizen reported a crisis, urgent contacts come first.

Fees and places below are general guidance for Cebu City; each says to confirm at the office.
VERIFY with the CSWDO before the defense.
"""

import re

L = ("en", "fil", "ceb")


def _t(d: dict, lang: str) -> str:
    return d.get(lang) or d["en"]


# --- How to get each document (matched by words in the document's name) -------------------
# "{hall}" is replaced with the citizen's own barangay hall when we know it.
DOC_GUIDE = [
    (r"barangay cert|indigency|certification of the incident|barangay certification", {
        "en": "At {hall}. Bring a valid ID. Usually free or a small fee; if you can't pay, ask for a Certificate of Indigency.",
        "fil": "Sa {hall}. Magdala ng valid ID. Kadalasang libre o maliit na bayad; kung hindi kaya, humingi ng Certificate of Indigency.",
        "ceb": "Sa {hall}. Pagdala og valid ID. Kasagaran libre o gamay nga bayad; kung dili kaya, pangayo og Certificate of Indigency.",
    }),
    (r"birth certificate", {
        "en": "From the PSA: a PSA Serbilis outlet in Cebu City, or order online at psaserbilis.com.ph. Bring a valid ID. There is a fee (about ₱155 at the counter).",
        "fil": "Mula sa PSA: sa PSA Serbilis outlet sa Cebu City, o mag-order online sa psaserbilis.com.ph. Magdala ng valid ID. May bayad (mga ₱155 sa counter).",
        "ceb": "Gikan sa PSA: sa PSA Serbilis outlet sa Cebu City, o pag-order online sa psaserbilis.com.ph. Pagdala og valid ID. Naay bayad (mga ₱155 sa counter).",
    }),
    (r"valid|government-issued id", {
        "en": "Any government ID works: National ID (PhilID), UMID, driver's license, postal ID or voter's ID. No ID yet? The National ID is free; ask {hall} for registration days.",
        "fil": "Anumang government ID: National ID (PhilID), UMID, lisensya, postal ID o voter's ID. Wala pang ID? Libre ang National ID; itanong sa {hall} kung kailan ang rehistrasyon.",
        "ceb": "Bisan unsang government ID: National ID (PhilID), UMID, lisensya, postal ID o voter's ID. Wala pay ID? Libre ang National ID; pangutana sa {hall} kanus-a ang rehistrasyon.",
    }),
    (r"photo", {
        "en": "Any photo studio (usually ₱50–100), or a clear recent photo on a plain background.",
        "fil": "Sa kahit anong photo studio (mga ₱50–100), o malinaw na bagong litrato na plain ang background.",
        "ceb": "Sa bisan unsang photo studio (mga ₱50–100), o klaro nga bag-ong litrato nga plain ang background.",
    }),
    (r"medical|clinical|hospital bill|prescription|laboratory|disability", {
        "en": "From the hospital or clinic treating the patient: ask the records or billing section, or the attending doctor.",
        "fil": "Mula sa ospital o klinika na gumagamot sa pasyente: magtanong sa records o billing section, o sa doktor.",
        "ceb": "Gikan sa ospital o klinika nga nagtambal sa pasyente: pangutana sa records o billing section, o sa doktor.",
    }),
    (r"death certificate", {
        "en": "Registered at the Cebu City Civil Registrar (Cebu City Hall). The funeral parlor usually helps with this.",
        "fil": "Ipinaparehistro sa Cebu City Civil Registrar (Cebu City Hall). Kadalasang tumutulong dito ang punerarya.",
        "ceb": "Iparehistro sa Cebu City Civil Registrar (Cebu City Hall). Kasagaran motabang niini ang punerarya.",
    }),
    (r"funeral|transfer permit", {
        "en": "From the funeral parlor handling the burial; they usually process the permits too.",
        "fil": "Mula sa puneraryang humahawak sa libing; kadalasang sila rin ang nag-aasikaso ng permit.",
        "ceb": "Gikan sa punerarya nga nag-atiman sa lubong; kasagaran sila ang moproseso sa permit.",
    }),
    (r"police|fire protection|bfp", {
        "en": "From the police station or Bureau of Fire Protection station that responded to the incident.",
        "fil": "Mula sa istasyon ng pulis o Bureau of Fire Protection na rumesponde sa insidente.",
        "ceb": "Gikan sa istasyon sa pulis o Bureau of Fire Protection nga mitubag sa insidente.",
    }),
    (r"case study|case summary", {
        "en": "You don't prepare this: a social worker writes it when you apply at the social welfare office.",
        "fil": "Hindi ninyo ito ihahanda: isang social worker ang gagawa nito pag-apply ninyo sa social welfare office.",
        "ceb": "Dili nimo kini andamon: usa ka social worker ang mohimo niini inig aplay nimo sa social welfare office.",
    }),
    (r"application form", {
        "en": "Given to you at the office when you apply.",
        "fil": "Ibibigay sa inyo sa opisina pag-apply ninyo.",
        "ceb": "Ihatag kanimo sa opisina inig aplay nimo.",
    }),
    (r"solo parent id", {
        "en": "From the Cebu City Department of Social Welfare and Services (City Hall). Bring proof that you raise your child alone and a barangay certificate.",
        "fil": "Mula sa Cebu City Department of Social Welfare and Services (City Hall). Magdala ng patunay na mag-isa kayong nagpapalaki ng anak at barangay certificate.",
        "ceb": "Gikan sa Cebu City Department of Social Welfare and Services (City Hall). Pagdala og pamatuod nga nag-inusara ka sa pagpadako sa anak ug barangay certificate.",
    }),
    (r"osca", {
        "en": "From the Office of Senior Citizens Affairs (OSCA). Bring proof of age and a barangay certificate.",
        "fil": "Mula sa Office of Senior Citizens Affairs (OSCA). Magdala ng patunay ng edad at barangay certificate.",
        "ceb": "Gikan sa Office of Senior Citizens Affairs (OSCA). Pagdala og pamatuod sa edad ug barangay certificate.",
    }),
    (r"bank|e-wallet", {
        "en": "Your own bank, GCash or Maya account details (account name and number).",
        "fil": "Detalye ng sarili ninyong bank, GCash o Maya account (pangalan at numero).",
        "ceb": "Detalye sa imong kaugalingong bank, GCash o Maya account (ngalan ug numero).",
    }),
    (r"job loss|no regular work", {
        "en": "A termination notice or certificate from your employer; if your work was informal, a barangay certification from {hall}.",
        "fil": "Termination notice o certificate mula sa employer; kung arawan ang trabaho, barangay certification mula sa {hall}.",
        "ceb": "Termination notice o certificate gikan sa employer; kung adlaw-adlaw ang trabaho, barangay certification gikan sa {hall}.",
    }),
]
DOC_DEFAULT = {
    "en": "Ask the office where you apply what they accept.",
    "fil": "Itanong sa opisinang pag-a-apply-an kung ano ang tinatanggap nila.",
    "ceb": "Pangutana sa opisina nga imong aplayan kung unsa ang ilang dawaton.",
}
YOUR_HALL = {"en": "your barangay hall", "fil": "inyong barangay hall", "ceb": "inyong barangay hall"}

# --- Which office handles each program (matched by words in the program's name) ------------
PROGRAM_OFFICE = [
    (r"crisis situations|aics", "DSWD Crisis Intervention Section (AICS)"),
    (r"pantawid|4ps", "DSWD Field Office VII"),
    (r"tupad|displaced workers", "DOLE Cebu Provincial Field Office"),
    (r"social pension|solo parent", "Cebu City Dept. of Social Welfare and Services"),
]
# Programs run by city offices not in the directory yet: say who, and to ask the barangay hall.
PROGRAM_OFFICE_TEXT = [
    (r"pwd|disability", {"en": "Cebu City Persons with Disability Affairs Office (PDAO)", "fil": "Cebu City Persons with Disability Affairs Office (PDAO)", "ceb": "Cebu City Persons with Disability Affairs Office (PDAO)"}),
    (r"senior citizen id|osca", {"en": "Office of Senior Citizens Affairs (OSCA)", "fil": "Office of Senior Citizens Affairs (OSCA)", "ceb": "Office of Senior Citizens Affairs (OSCA)"}),
]

STEP = {
    "docs": {"en": "Get your documents ready", "fil": "Ihanda ang mga dokumento", "ceb": "Andama ang mga dokumento"},
    "docs_all": {"en": "You already have everything on the list. Bring the originals and a photocopy of each.", "fil": "Kumpleto na kayo. Dalhin ang orihinal at isang photocopy ng bawat isa.", "ceb": "Kompleto na ka. Dad-a ang orihinal ug usa ka photocopy sa matag usa."},
    "go": {"en": "Go to the office", "fil": "Pumunta sa opisina", "ceb": "Adto sa opisina"},
    "go_ask": {"en": "Ask {hall} where {office} is right now, or call the City Social Welfare office.", "fil": "Itanong sa {hall} kung nasaan ngayon ang {office}, o tawagan ang City Social Welfare office.", "ceb": "Pangutana sa {hall} kung asa karon ang {office}, o tawagi ang City Social Welfare office."},
    "there": {"en": "What happens there", "fil": "Ano ang mangyayari doon", "ceb": "Unsa ang mahitabo didto"},
    "there_text": {
        "en": "Say you want to apply for {program}. Staff will check your documents and may ask a few questions, like the ones in this chat. They make the final decision and tell you the next step.",
        "fil": "Sabihing gusto ninyong mag-apply sa {program}. Susuriin ng staff ang mga dokumento at maaaring magtanong, katulad ng nasa chat. Sila ang magpapasya at magsasabi ng susunod na hakbang.",
        "ceb": "Ingna nga gusto ka moaplay sa {program}. Susihon sa staff ang mga dokumento ug basin mangutana, sama sa naa sa chat. Sila ang modesisyon ug mosulti sa sunod nga lakang.",
    },
    "dates": {"en": "Upcoming dates", "fil": "Mga paparating na petsa", "ceb": "Mga umaabot nga petsa"},
}

# --- Urgent help, by the crisis the citizen reported -----------------------------------------
# Phone numbers here are national hotlines; office numbers come from the Office Directory.
URGENT = {
    "emergency": {"name": {"en": "Emergency hotline", "fil": "Emergency hotline", "ceb": "Emergency hotline"}, "phone": "911",
                  "what": {"en": "Police, fire or ambulance, any time.", "fil": "Pulis, bumbero o ambulansya, anumang oras.", "ceb": "Pulis, bombero o ambulansya, bisan kanus-a."}},
    "redcross": {"name": {"en": "Philippine Red Cross", "fil": "Philippine Red Cross", "ceb": "Philippine Red Cross"}, "phone": "143",
                 "what": {"en": "Rescue, relief goods and blood.", "fil": "Rescue, relief goods at dugo.", "ceb": "Rescue, relief goods ug dugo."}},
    "malasakit": {"name": {"en": "Malasakit Center, Vicente Sotto Memorial Medical Center", "fil": "Malasakit Center, Vicente Sotto Memorial Medical Center", "ceb": "Malasakit Center, Vicente Sotto Memorial Medical Center"},
                  "address": "B. Rodriguez St., Cebu City",
                  "what": {"en": "Help with hospital bills from several agencies in one place.", "fil": "Tulong sa bayarin sa ospital mula sa iba't ibang ahensya sa iisang lugar.", "ceb": "Tabang sa bayronon sa ospital gikan sa nagkalain-laing ahensya sa usa ka lugar."}},
    "mental": {"name": {"en": "NCMH crisis hotline", "fil": "NCMH crisis hotline", "ceb": "NCMH crisis hotline"}, "phone": "1553",
               "what": {"en": "Free, 24/7, if you or someone in the family feels overwhelmed.", "fil": "Libre, 24/7, kung kayo o kapamilya ay nabibigatan.", "ceb": "Libre, 24/7, kung ikaw o pamilya nabug-atan."}},
    "aics": {"office": "DSWD Crisis Intervention Section (AICS)",
             "what": {"en": "Emergency cash help for medical, burial, fire and other crises.", "fil": "Pang-emergency na tulong pinansyal sa pagpapagamot, libing, sunog at iba pa.", "ceb": "Pang-emerhensya nga tabang pinansyal sa pagpatambal, lubong, sunog ug uban pa."}},
    "cswdo": {"office": "Cebu City Dept. of Social Welfare and Services",
              "what": {"en": "City social workers: relief, referrals and help with your papers.", "fil": "Mga social worker ng lungsod: relief, referral at tulong sa mga papeles.", "ceb": "Mga social worker sa siyudad: relief, referral ug tabang sa mga papeles."}},
    "dole": {"office": "DOLE Cebu Provincial Field Office",
             "what": {"en": "Emergency work (TUPAD) and help after losing a job.", "fil": "Pansamantalang trabaho (TUPAD) at tulong pagkatapos mawalan ng trabaho.", "ceb": "Temporaryong trabaho (TUPAD) ug tabang human mawad-an og trabaho."}},
}
URGENT_BY_CRISIS = {
    "medical": ["emergency", "malasakit", "aics", "mental"],
    "death": ["aics", "cswdo", "mental"],
    "fire": ["emergency", "redcross", "cswdo", "aics"],
    "calamity": ["emergency", "redcross", "cswdo", "aics"],
    "job_loss": ["dole", "aics", "mental"],
}
URGENT_TITLE = {"en": "Need help right now?", "fil": "Kailangan ng tulong ngayon?", "ceb": "Kinahanglan og tabang karon?"}


def _hall_text(offices: list[dict], lang: str) -> tuple[str, dict | None]:
    hall = next((o for o in offices if re.match(r"(barangay|brgy\.?)\s", o["office_name"], re.I)), None)
    return (hall["office_name"] if hall else _t(YOUR_HALL, lang)), hall


def urgent_contacts(crisis: str | None, directory: dict[str, dict], lang: str) -> list[dict]:
    out = []
    for key in URGENT_BY_CRISIS.get(crisis or "", []):
        c = URGENT[key]
        if "office" in c:
            o = directory.get(c["office"])
            if not o:
                continue
            out.append({"name": o["office_name"], "phone": o["contact_number"], "address": o["address"], "what": _t(c["what"], lang)})
        else:
            out.append({"name": _t(c["name"], lang), "phone": c.get("phone"), "address": c.get("address"), "what": _t(c["what"], lang)})
    return out


def build_plan(assessment: dict, crisis: str | None, have: set[str], directory: dict[str, dict], lang: str) -> dict:
    lang = lang if lang in L else "en"
    offices = assessment.get("offices", [])
    hall_name, hall = _hall_text(offices, lang)
    programs = []
    for p in assessment["programs"]:
        if p["status"] == "not_qualified":
            continue
        name = p["program_name"]
        # 1. documents
        docs = []
        for d in p.get("documents", []):
            if d["doc_id"] in have:
                docs.append({"document_name": d["document_name"], "have": True, "how": None, "is_mandatory": d["is_mandatory"]})
                continue
            guide = next((g for pat, g in DOC_GUIDE if re.search(pat, d["document_name"], re.I)), DOC_DEFAULT)
            docs.append({"document_name": d["document_name"], "have": False, "how": _t(guide, lang).format(hall=hall_name), "is_mandatory": d["is_mandatory"]})
        # 2. where to go
        office = None
        office_note = None
        target = next((o for pat, o in PROGRAM_OFFICE if re.search(pat, name, re.I)), None)
        if target and target in directory:
            o = directory[target]
            office = {"name": o["office_name"], "address": o["address"], "hours": o["operating_hours"], "phone": o["contact_number"]}
        else:
            who = next((_t(t, lang) for pat, t in PROGRAM_OFFICE_TEXT if re.search(pat, name, re.I)), p["agency"])
            office_note = _t(STEP["go_ask"], lang).format(hall=hall_name, office=who)
            if hall:
                office = {"name": hall["office_name"], "address": hall["address"], "hours": hall["operating_hours"], "phone": hall["contact_number"]}
        programs.append({
            "program_id": p["program_id"],
            "program_name": name,
            "status": p["status"],
            "documents": docs,
            "all_documents_ready": bool(docs) and all(d["have"] for d in docs),
            "office": office,
            "office_note": office_note,
            "what_happens": _t(STEP["there_text"], lang).format(program=name),
            "schedules": p.get("schedules", []),
        })
    return {
        "urgent": urgent_contacts(crisis, directory, lang),
        "urgent_title": _t(URGENT_TITLE, lang),
        "programs": programs,
        "labels": {k: _t(STEP[k], lang) for k in ("docs", "docs_all", "go", "there", "dates")},
    }
