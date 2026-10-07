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
    # Only show this document when the citizen's crisis is this type (None = always).
    for_crisis: str | None = Field(default=None, pattern=r"^(medical|death|fire|calamity|job_loss)$")


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
    full_name: str | None = Field(default=None, max_length=100)


class MobileIn(BaseModel):
    mobile: str = Field(min_length=1, max_length=20)


class EmailIn(BaseModel):
    email: str = Field(min_length=3, max_length=254)


class CodeIn(BaseModel):
    code: str = Field(pattern=r"^\s*\d{6}\s*$")


class ForgotStartIn(BaseModel):
    username: str = Field(min_length=1, max_length=64)


class ForgotCompleteIn(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    code: str = Field(pattern=r"^\s*\d{6}\s*$")
    new_password: str = Field(min_length=1, max_length=200)


class ProfileUpdate(BaseModel):
    full_name: str = Field(max_length=100)


class AvatarIn(BaseModel):
    # data:image/jpeg;base64,... produced by the browser after cropping to 256x256
    data_url: str = Field(max_length=700_000)


class PasswordRequestIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=1, max_length=200)


class RevealPinIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=200)
    pin: str = Field(pattern=r"^\d{4}$")


class RevealIn(BaseModel):
    pin: str = Field(pattern=r"^\d{4}$")


class PasswordDecisionIn(BaseModel):
    note: str | None = Field(default=None, max_length=500)


class StaffUpdate(BaseModel):
    role_name: str | None = None
    office_id: str | None = None
    full_name: str | None = Field(default=None, max_length=100)


# ---- Citizen sessions ----
class SessionStart(BaseModel):
    language: str | None = None


class MessageIn(BaseModel):
    message: str


class BarangayIn(BaseModel):
    barangay_code: str


class FeedbackCreate(BaseModel):
    sus_score: int                              # required — the usability rating
    qualitative_feedback: str | None = None     # optional — citizen can leave this blank


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


class EmailChecklistRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
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
    # Empty sender name = use Semaphore's default sender.
    sender_name: str | None = Field(default=None, pattern=r"^[A-Za-z0-9 ]{0,11}$")
    enabled: bool | None = None
    api_key: str | None = Field(default=None, min_length=16, max_length=200)
    provider: str | None = Field(default=None, pattern=r"^(semaphore|android)$")
    # Phone gateway ("SMS Gateway for Android", Local Server mode), e.g. http://192.168.1.23:8080
    android_url: str | None = Field(default=None, pattern=r"^https?://[A-Za-z0-9.\-]+(:\d{1,5})?/?$", max_length=200)
    android_username: str | None = Field(default=None, min_length=1, max_length=100)
    android_password: str | None = Field(default=None, min_length=1, max_length=200)


class EmailGatewayUpdate(BaseModel):
    enabled: bool | None = None
    smtp_host: str | None = Field(default=None, pattern=r"^[A-Za-z0-9.\-]{3,100}$")
    smtp_port: int | None = Field(default=None, ge=1, le=65535)
    smtp_username: str | None = Field(default=None, min_length=3, max_length=254)
    smtp_password: str | None = Field(default=None, min_length=1, max_length=200)
    from_name: str | None = Field(default=None, min_length=1, max_length=60)


class TestEmailIn(BaseModel):
    email: str = Field(min_length=3, max_length=254)


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