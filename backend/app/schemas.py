from pydantic import BaseModel

class LoginRequest(BaseModel):
    username: str
    password: str

class ProgramCreate(BaseModel):
    program_name: str
    agency: str
    scope: str
    is_active: bool = True

class EligibilityCriteriaCreate(BaseModel):
    attribute: str
    operator: str
    threshold_value: str
    weight: float

class DocumentRequirementCreate(BaseModel):
    document_name: str
    is_mandatory: bool = True
    notes: str | None = None

class LguOfficeCreate(BaseModel):
    office_name: str
    address: str | None = None
    barangay_code: str
    contact_number: str | None = None
    operating_hours: str | None = None

class MessageIn(BaseModel):
    message: str

class BarangayIn(BaseModel):
    barangay_code: str

class FeedbackCreate(BaseModel):
    sus_score: int                              # required — the usability rating
    qualitative_feedback: str | None = None     # optional — citizen can leave this blank