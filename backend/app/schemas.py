from datetime import date

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    password: str


# ---- Welfare core ----
class ProgramCreate(BaseModel):
    program_name: str = Field(min_length=2, max_length=255)
    agency: str = Field(min_length=1, max_length=255)
    scope: str = Field(max_length=100)
    is_active: bool = True


class ProgramUpdate(BaseModel):
    program_name: str | None = Field(default=None, min_length=2, max_length=255)
    agency: str | None = Field(default=None, min_length=1, max_length=255)
    scope: str | None = Field(default=None, max_length=100)
    is_active: bool | None = None


class EligibilityCriteriaCreate(BaseModel):
    attribute: str = Field(min_length=1, max_length=100)
    operator: str = Field(pattern=r"^(<=|>=|<|>|=|==|!=|in)$")
    threshold_value: str = Field(min_length=1, max_length=100)
    weight: float = Field(ge=0, le=1)


class DocumentRequirementCreate(BaseModel):
    document_name: str = Field(min_length=1, max_length=255)
    is_mandatory: bool = True
    notes: str | None = None


# ---- Localization ----
class BarangayCreate(BaseModel):
    barangay_code: str = Field(min_length=1, max_length=20)
    barangay_name: str = Field(min_length=1, max_length=255)
    city_municipality: str = Field(default="Cebu City", max_length=255)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)


class LguOfficeCreate(BaseModel):
    office_name: str = Field(min_length=1, max_length=255)
    address: str | None = None
    barangay_code: str | None = None
    contact_number: str | None = Field(default=None, max_length=50)
    operating_hours: str | None = Field(default=None, max_length=255)


class ScheduleCreate(BaseModel):
    office_id: str
    program_id: str
    start_date: date
    end_date: date
    notes: str | None = Field(default=None, max_length=500)


# ---- Staff accounts ----
class StaffCreate(BaseModel):
    username: str = Field(pattern=r"^[a-z0-9._-]{3,32}$")
    password: str
    role_name: str
    office_id: str | None = None


class StaffUpdate(BaseModel):
    role_name: str | None = None
    office_id: str | None = None


# ---- Citizen sessions ----
class SessionStart(BaseModel):
    language: str | None = None


class MessageIn(BaseModel):
    message: str


class EntityPatch(BaseModel):
    values: dict


class DocumentCheck(BaseModel):
    doc_id: str
    has_document: bool


class DocumentChecksIn(BaseModel):
    checks: list[DocumentCheck] = Field(max_length=100)


class SmsRequest(BaseModel):
    phone: str
    program_ids: list[str] | None = None


class AssessmentFeedbackIn(BaseModel):
    # The 10 System Usability Scale items, each answered 1 (strongly disagree) to 5 (strongly agree).
    answers: list[int] = Field(min_length=10, max_length=10)
    comment: str | None = None

    def model_post_init(self, __context):
        if any(a < 1 or a > 5 for a in self.answers):
            raise ValueError("Each answer must be between 1 and 5")


# ---- Validation ----
class RatingIn(BaseModel):
    tier: str = Field(pattern=r"^(high|moderate|low)$")


# ---- System ----
class CacheTtlIn(BaseModel):
    minutes: int = Field(ge=5, le=240)


class SmsGatewayUpdate(BaseModel):
    sender_name: str | None = Field(default=None, pattern=r"^[A-Za-z0-9 ]{1,11}$")
    enabled: bool | None = None
    api_key: str | None = Field(default=None, min_length=16, max_length=200)


class TestSmsIn(BaseModel):
    number: str


class SecurityPolicyIn(BaseModel):
    jwt_expire_minutes: int = Field(ge=5, le=720)
    password_min_length: int = Field(ge=8, le=64)
    max_failed_logins: int = Field(ge=3, le=20)
    lockout_minutes: int = Field(ge=1, le=1440)
    rate_limit_per_minute: int = Field(ge=10, le=1000)
    allowed_origins: list[str] = Field(min_length=1, max_length=20)
    purge_on_session_end: bool
