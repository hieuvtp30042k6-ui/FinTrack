import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Dict, Any, Optional

from app.core.config import settings


class EmailService:
    def __init__(self):
        # In-memory inbox for testing and verification
        self.sent_emails: List[Dict[str, Any]] = []

    def send_password_reset_email(
        self,
        to_email: str,
        reset_link: str,
        expires_in_minutes: int = 15
    ) -> bool:
        """
        Send password reset email containing secure link.
        Does not reveal old or new password.
        """
        subject = "[FinTrack] Yêu cầu đặt lại mật khẩu của bạn"
        
        text_content = f"""Xin chào,

Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản FinTrack liên kết với địa chỉ email này.

Vui lòng nhấp vào liên kết dưới đây để tạo mật khẩu mới:
{reset_link}

LƯU Ý BẢO MẬT:
- Liên kết này chỉ có hiệu lực trong {expires_in_minutes} phút và chỉ sử dụng được 1 lần.
- Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này. Mật khẩu tài khoản của bạn sẽ không bị thay đổi.

Trân trọng,
Đội ngũ bảo mật FinTrack
"""

        # Record in testable in-memory storage
        email_record = {
            "to": to_email,
            "subject": subject,
            "reset_link": reset_link,
            "expires_in_minutes": expires_in_minutes,
            "body": text_content
        }
        self.sent_emails.append(email_record)

        # If live SMTP is configured, attempt real dispatch
        if settings.SMTP_HOST:
            try:
                msg = MIMEMultipart()
                msg["From"] = settings.EMAIL_FROM
                msg["To"] = to_email
                msg["Subject"] = subject
                msg.attach(MIMEText(text_content, "plain", "utf-8"))

                with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                    if settings.SMTP_USER and settings.SMTP_PASSWORD:
                        server.starttls()
                        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                    server.send_message(msg)
            except Exception:
                # Log or handle error without crashing
                pass

        return True


email_service = EmailService()
