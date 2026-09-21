"""Placeholder NLP layer using the Gemini API, standing in for the fine-tuned
XLM-RoBERTa model until Phase 1 (synthetic dataset + fine-tuning) is complete.
Extracts the same entity fields the dev guide's XLM-RoBERTa pipeline expects,
so swapping this out later doesn't require changing anything downstream. """

import json
from google import genai
from app.config import GEMINI_API_KEY

client = genai.Client(api_key=GEMINI_API_KEY)

EXTRACTION_PROMPT = """You are a social welfare intake assistant for GinhawAI, serving Filipino citizens who may write in Tagalog, Bisaya, Taglish, or English.

From the citizen's message below, extract these fields as JSON (use null for anything not mentioned):
- monthly_income (number, in PHP)
- number_of_dependents (integer)
- is_unemployed (boolean)
- has_pwd (boolean, true if a household member has a disability)

Respond with ONLY the JSON object, no other text.

Citizen message: {message}
"""

async def extract_entities(message: str) -> dict:
    prompt = EXTRACTION_PROMPT.format(message=message)

    try:
        response = await client.aio.models.generate_content(model="gemini-3.6-flash", contents=prompt)
    except Exception as e:
        # Gemini's servers can be temporarily overloaded, rate-limited, or unreachable —
        # don't let that crash the whole request, just report nothing extracted this turn
        print(f"Gemini extraction failed: {e}")
        return {}

    text = response.text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # The model occasionally doesn't follow the "JSON only" instruction perfectly
        print(f"Gemini returned non-JSON response: {text}")
        return {}