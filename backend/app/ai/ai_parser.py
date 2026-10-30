"""Placeholder NLP layer using the Gemini API, standing in for the fine-tuned
XLM-RoBERTa model until Phase 1 (synthetic dataset + fine-tuning) is complete.
Extracts the same entity fields the dev guide's XLM-RoBERTa pipeline expects,
so swapping this out later doesn't require changing anything downstream. """

import json
import asyncio
import time
from google import genai
from app.config import GEMINI_API_KEY

# Without a key the chat still works using the built-in parser in app/chatflow.py.
client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

# Gemini often returns 503. Keep retries few so a citizen never waits long, and after a
# failed round skip Gemini for BREAKER_SECONDS (see "circuit breaker" in extract_entities).
MAX_ATTEMPTS = 2
BREAKER_SECONDS = 60
_gemini_down_until = 0.0  # time.monotonic() value until which Gemini is skipped

EXTRACTION_PROMPT = """You are a social welfare intake assistant for GinhawAI, serving Filipino citizens who may write in Tagalog, Bisaya, Taglish, or English.

From the citizen's message below, extract these fields as JSON (use null for anything not mentioned):
- barangay (string, the barangay name only)
- household_size (integer, number of people living in the household)
- monthly_income (number, total household income per month in PHP)
- employment_status (one of: "employed", "self_employed", "informal", "seasonal", "underemployed", "unemployed", "displaced")
- age (integer, the citizen's age)
- housing_type (one of: "owned", "rented", "with_relatives", "informal_settler")
- has_children_0_18 (boolean, true if there are children aged 0-18 in the household)
- has_pregnant (boolean, true if anyone in the household is pregnant)
- has_pwd (boolean, true if a household member has a disability)
- has_senior (boolean, true if anyone in the household is 60 years old or older)
- is_solo_parent (boolean)
- crisis_type (one of: "none", "medical", "death", "fire", "calamity", "job_loss")

Local words to recognise (from the LGU's own list; "word" -> field = value):
{glossary}

The assistant just asked about: {current_question}

Respond with ONLY the JSON object, no other text.

Citizen message: {message}
"""

async def extract_entities(message: str, current_question: str = "(start of conversation)") -> dict:
    if client is None:
        return {}
    from app.jargon import glossary_text  # staff-managed local words (admin console > Local Terms)
    prompt = EXTRACTION_PROMPT.format(message=message, current_question=current_question, glossary=glossary_text() or "(none)")

    global _gemini_down_until
    # Circuit breaker: Gemini just failed repeatedly, so skip it for a while.
    # The chat then answers instantly from the rules and the fine-tuned models.
    if time.monotonic() < _gemini_down_until:
        return {}

    last_error = None
    for attempt in range(MAX_ATTEMPTS):
        try:
            response = await client.aio.models.generate_content(model="gemini-3.6-flash", contents=prompt)
            break
        except Exception as e:
            last_error = e
            print(f"Gemini extraction attempt {attempt + 1} failed: {e}")
            if attempt < MAX_ATTEMPTS - 1:
                await asyncio.sleep(1)  # short pause before the one retry
    else:
        _gemini_down_until = time.monotonic() + BREAKER_SECONDS  # stop calling Gemini for a minute
        print(f"Gemini extraction failed after {MAX_ATTEMPTS} attempts, pausing it for {BREAKER_SECONDS}s: {last_error}")
        return {}
    _gemini_down_until = 0.0  # it worked, so close the breaker

    text = response.text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        print(f"Gemini returned non-JSON response: {text}")
        return {}