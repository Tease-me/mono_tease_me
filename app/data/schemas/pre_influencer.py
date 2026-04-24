from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, Dict, Any, List
from typing import Literal

class PreInfluencerRegisterRequest(BaseModel):
    full_name: str
    location: Optional[str] = None
    username: str
    email: EmailStr
    password: str
    terms_agreement: bool = False
    fp_tid: str | None = None
    parent_ref_id: str | None = None
    fpr: str | None = None
    invite_code: str | None = None
    invitee_email: str | None = None
    inviter_email: str | None = None
    account_manager_email: str | None = None

class PreInfluencerRegisterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    ok: bool
    user_id: int
    email: EmailStr
    message: str
    
class PreInfluencerAcceptTermsRequest(BaseModel):
    terms_agreement: Literal[True]
    
class SurveyState(BaseModel):
    pre_influencer_id: int
    username: str
    survey_answers: Dict[str, Any] | None = None
    survey_step: int

class SurveySaveRequest(BaseModel):
    survey_answers: Dict[str, Any]
    survey_step: int

class InfluencerAudioDeleteRequest(BaseModel):
    key: str

class SurveyQuestionsResponse(BaseModel):
    sections: List[Dict[str, Any]]

class SurveyPromptRequest(BaseModel):
    additional_prompt: Optional[str] = None

class SurveyStages(BaseModel):
    hate: str
    dislike: str
    strangers: str
    friends: str
    flirting: str
    dating: str
    girlfriend: str

class SurveyPromptResponse(BaseModel):
    likes: List[str]
    dislikes: List[str]
    mbti_architype: str
    mbti_rules: str
    personality_rules: str
    tone: str
    stages: SurveyStages


class PreInfluencerAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    location: Optional[str] = None
    username: str
    email: EmailStr
    survey_token: Optional[str] = None
    survey_answers: Dict[str, Any] | None = None
    survey_step: int
    ig_user_id: Optional[str] = None
    ig_access_token: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime
    terms_agreement: bool
    fp_promoter_id: Optional[str] = None
    fp_ref_id: Optional[str] = None


class MJPreInfluencerStepProgressRequest(BaseModel):
    invite_code: str
    invitee_email: EmailStr


class MJPreInfluencerStepProgressOut(BaseModel):
    ok: bool = True
    exists: bool = True
    pre_influencer_id: int
    username: str
    survey_step: int
    status: str


class MJPreInfluencerAssetLinkOut(BaseModel):
    ok: bool = True
    exists: bool = True
    pre_influencer_id: int
    username: str
    asset_link: str | None = None
