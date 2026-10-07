"""Placeholder NLP layer using the Gemini API, standing in for the fine-tuned
XLM-RoBERTa model until Phase 1 (synthetic dataset + fine-tuning) is complete.
Extracts the same entity fields the dev guide's XLM-RoBERTa pipeline expects,
so swapping this out later doesn't require changing anything downstream. """

import json
import asyncio
from google import genai
from app.config import GEMINI_API_KEY

# Without a key the chat still works using the built-in parser in app/chatflow.py.
client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

EXTRACTION_PROMPT = """You are a social welfare intake assistant for GinhawAI, serving Filipino citizens who may write in Tagalog, Bisaya, Taglish, or English.

From the citizen's message below, extract these fields as JSON (use null for anything not mentioned):
- barangay (string, the barangay name only)
- household_size (integer, number of people living in the household)
- monthly_income (number, total household income per month in PHP)
- employment_status (one of: "employed", "self_employed", "informal", "seasonal", "underemployed", "unemployed", "displaced")
- age (integer, the citizen's age)
- housing_type (one of: "owned", "rented", "with_relatives", "informal_settler")
- has_children_0_18 (boolean, true if there are children aged 0-18 or a pregnant member)
- has_pwd (boolean, true if a household member has a disability)
- is_solo_parent (boolean)
- crisis_type (one of: "none", "medical", "death", "fire", "calamity", "job_loss")

The assistant just asked about: {current_question}

Respond with ONLY the JSON object, no other text.

Citizen message: {message}
"""

async def extract_entities(message: str, current_question: str = "(start of conversation)") -> dict:
    if client is None:
        return {}
    prompt = EXTRACTION_PROMPT.format(message=message, current_question=current_question)

    last_error = None
    for attempt in range(5):
        try:
            response = await client.aio.models.generate_content(model="gemini-3.6-flash", contents=prompt)
            break
        except Exception as e:
            last_error = e
            print(f"Gemini extraction attempt {attempt + 1} failed: {e}")
            if attempt < 4:
                await asyncio.sleep(2 ** attempt)  # wait 1s, then 2s, before retrying
    else:
        print(f"Gemini extraction failed after 3 attempts: {last_error}")
        return {}

    text = response.text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        print(f"Gemini returned non-JSON response: {text}")
        return {}