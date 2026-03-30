"""
Pydantic schemas for Twilio Verify OTP.
"""

from pydantic import BaseModel, Field


class TwilioSendCodeRequest(BaseModel):
    """Request to send an OTP verification code."""
    phone: str = Field(
        ...,
        description="Phone number in E.164 format (e.g. +61412345678)",
        min_length=8,
        max_length=16,
    )
    channel: str = Field(
        default="sms",
        description="Delivery channel: sms, call, whatsapp, or email",
    )


class TwilioSendCodeResponse(BaseModel):
    """Response after sending a verification code."""
    status: str = Field(description="Verification status (typically 'pending')")
    sid: str = Field(description="Twilio verification SID")
    channel: str = Field(description="Channel used for delivery")
    to: str = Field(description="Destination phone number")


class TwilioCheckCodeRequest(BaseModel):
    """Request to check an OTP verification code."""
    phone: str = Field(
        ...,
        description="Phone number in E.164 format (must match the send-code request)",
        min_length=8,
        max_length=16,
    )
    code: str = Field(
        ...,
        description="The OTP code entered by the user",
        min_length=4,
        max_length=10,
    )


class TwilioCheckCodeResponse(BaseModel):
    """Response after checking a verification code."""
    status: str = Field(description="Verification status ('approved' or 'pending')")
    valid: bool = Field(description="Whether the code was correct")
    sid: str = Field(description="Twilio verification SID")
