import datetime
import pytest
from unittest.mock import patch
from app.models.user import User
from app.models.password_reset_token import PasswordResetToken
from app.core.security import hash_password, verify_password, hash_token
from app.services.email_service import email_service


@pytest.fixture
def setup_reset_users(db_session):
    """Seed test users for forgot & reset password tests."""
    email_service.sent_emails.clear()

    # 1. Normal user with password
    user = User(
        name="Reset Test User",
        email="reset_user@example.com",
        password_hash=hash_password("OldPassword@123"),
        role="user",
        status="active"
    )

    # 2. Blocked user
    blocked_user = User(
        name="Blocked Reset User",
        email="blocked_reset@example.com",
        password_hash=hash_password("OldPassword@123"),
        role="user",
        status="blocked"
    )

    # 3. Google-only user without password
    google_user = User(
        name="Google Only User",
        email="google_only@gmail.com",
        google_id="google-id-reset-check",
        password_hash=None,
        role="user",
        status="active"
    )

    db_session.add_all([user, blocked_user, google_user])
    db_session.commit()
    return {"user": user, "blocked_user": blocked_user, "google_user": google_user}


# ==========================================================
# 1. Forgot Password Tests (Cases 1 - 6)
# ==========================================================

def test_forgot_password_valid_email_generates_token(client, setup_reset_users, db_session):
    """1, 4, 5, 6. Email hợp lệ & tồn tại -> tạo token có expiration và gửi email."""
    payload = {"email": "reset_user@example.com"}
    response = client.post("/api/auth/forgot-password", json=payload)
    assert response.status_code == 200
    assert "hướng dẫn đặt lại mật khẩu" in response.json()["message"]

    # 4. Kiểm tra token được tạo trong DB
    user = setup_reset_users["user"]
    token_record = db_session.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id
    ).first()
    assert token_record is not None
    assert token_record.used_at is None
    # 5. Token có expiration trong tương lai
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    expires_at = token_record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=datetime.timezone.utc)
    assert expires_at > now_utc

    # 6. Email reset được gửi đi
    assert len(email_service.sent_emails) == 1
    sent = email_service.sent_emails[0]
    assert sent["to"] == "reset_user@example.com"
    assert "reset-password?token=" in sent["reset_link"]


def test_forgot_password_nonexistent_email_returns_same_response(client, setup_reset_users):
    """2, 3. Email không tồn tại vẫn trả cùng response chung (chống account enumeration)."""
    payload = {"email": "not_in_system@example.com"}
    response = client.post("/api/auth/forgot-password", json=payload)
    assert response.status_code == 200

    # Message giống hệt email tồn tại
    assert "hướng dẫn đặt lại mật khẩu" in response.json()["message"]

    # Không có email nào được gửi
    assert len(email_service.sent_emails) == 0


def test_forgot_password_blocked_user_anti_enumeration(client, setup_reset_users):
    """3. Tài khoản bị khóa cũng trả cùng response chung, không tạo token gửi đi."""
    payload = {"email": "blocked_reset@example.com"}
    response = client.post("/api/auth/forgot-password", json=payload)
    assert response.status_code == 200
    assert "hướng dẫn đặt lại mật khẩu" in response.json()["message"]
    assert len(email_service.sent_emails) == 0


# ==========================================================
# 2. Reset Password Tests (Cases 7 - 16)
# ==========================================================

def test_reset_password_success(client, setup_reset_users, db_session):
    """7, 13, 14, 15, 16. Token hợp lệ -> đặt mật khẩu mới thành công, hash bcrypt, vô hiệu token."""
    # Bước 1: Yêu cầu reset password
    client.post("/api/auth/forgot-password", json={"email": "reset_user@example.com"})
    assert len(email_service.sent_emails) == 1
    raw_link = email_service.sent_emails[0]["reset_link"]
    raw_token = raw_link.split("token=")[1]

    # Bước 2: Gọi reset password với mật khẩu mới đạt chuẩn
    new_pwd = "BrandNewPassword@2026"
    reset_payload = {
        "token": raw_token,
        "new_password": new_pwd,
        "confirm_password": new_pwd
    }
    res = client.post("/api/auth/reset-password", json=reset_payload)
    assert res.status_code == 200
    assert "thành công" in res.json()["message"]

    # 14, 15. Kiểm tra password được hash trong DB, không lưu plaintext
    user = db_session.query(User).filter(User.email == "reset_user@example.com").first()
    assert user.password_hash != new_pwd
    assert verify_password(new_pwd, user.password_hash) is True

    # 16. Token bị đánh dấu used_at
    token_record = db_session.query(PasswordResetToken).filter(
        PasswordResetToken.token_hash == hash_token(raw_token)
    ).first()
    assert token_record.used_at is not None

    # 13. Người dùng đăng nhập thành công với mật khẩu mới
    login_res = client.post("/api/auth/login", json={
        "email": "reset_user@example.com",
        "password": new_pwd
    })
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()


def test_reset_password_invalid_token(client):
    """8. Token không hợp lệ -> 400 Bad Request."""
    payload = {
        "token": "completely_fake_and_invalid_token_string",
        "new_password": "NewValidPassword@123",
        "confirm_password": "NewValidPassword@123"
    }
    response = client.post("/api/auth/reset-password", json=payload)
    assert response.status_code == 400
    assert "không hợp lệ" in response.json()["detail"]


def test_reset_password_expired_token(client, setup_reset_users, db_session):
    """9. Token hết hạn -> 400 Bad Request."""
    user = setup_reset_users["user"]
    raw_token = "expired_raw_token_xyz"
    expired_time = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=30)

    token_record = PasswordResetToken(
        user_id=user.id,
        token_hash=hash_token(raw_token),
        expires_at=expired_time,
        used_at=None
    )
    db_session.add(token_record)
    db_session.commit()

    payload = {
        "token": raw_token,
        "new_password": "NewValidPassword@123",
        "confirm_password": "NewValidPassword@123"
    }
    response = client.post("/api/auth/reset-password", json=payload)
    assert response.status_code == 400
    assert "hết hạn" in response.json()["detail"]


def test_reset_password_already_used_token(client, setup_reset_users, db_session):
    """10, 16. Token đã sử dụng -> không được tái sử dụng (400 Bad Request)."""
    user = setup_reset_users["user"]
    raw_token = "already_used_token_xyz"
    future_time = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=15)
    used_time = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=1)

    token_record = PasswordResetToken(
        user_id=user.id,
        token_hash=hash_token(raw_token),
        expires_at=future_time,
        used_at=used_time
    )
    db_session.add(token_record)
    db_session.commit()

    payload = {
        "token": raw_token,
        "new_password": "NewValidPassword@123",
        "confirm_password": "NewValidPassword@123"
    }
    response = client.post("/api/auth/reset-password", json=payload)
    assert response.status_code == 400
    assert "đã được sử dụng" in response.json()["detail"]


def test_reset_password_weak_password_rejected(client, setup_reset_users):
    """11. Password mới yếu -> 400 hoặc 422 Bad Request."""
    client.post("/api/auth/forgot-password", json={"email": "reset_user@example.com"})
    raw_token = email_service.sent_emails[0]["reset_link"].split("token=")[1]

    payload = {
        "token": raw_token,
        "new_password": "weak",  # Quá ngắn
        "confirm_password": "weak"
    }
    response = client.post("/api/auth/reset-password", json=payload)
    assert response.status_code in (400, 422)


def test_reset_password_confirm_mismatch(client, setup_reset_users):
    """12. Confirm password không khớp -> 400 hoặc 422."""
    client.post("/api/auth/forgot-password", json={"email": "reset_user@example.com"})
    raw_token = email_service.sent_emails[0]["reset_link"].split("token=")[1]

    payload = {
        "token": raw_token,
        "new_password": "NewValidPassword@123",
        "confirm_password": "MismatchingPassword@123"
    }
    response = client.post("/api/auth/reset-password", json=payload)
    assert response.status_code in (400, 422)


# ==========================================================
# 3. Security & Edge Cases (Cases 17 - 20)
# ==========================================================

def test_security_no_plaintext_passwords_or_tokens_leaked_in_responses(client, setup_reset_users):
    """17, 18, 19. Response không trả token hay password/password_hash."""
    # Forgot response
    res1 = client.post("/api/auth/forgot-password", json={"email": "reset_user@example.com"})
    assert "token" not in res1.json()
    assert "password" not in res1.json()

    raw_token = email_service.sent_emails[0]["reset_link"].split("token=")[1]
    res2 = client.post("/api/auth/reset-password", json={
        "token": raw_token,
        "new_password": "BrandNewPassword@2026",
        "confirm_password": "BrandNewPassword@2026"
    })
    assert "token" not in res2.json()
    assert "password" not in res2.json()
    assert "password_hash" not in res2.json()


def test_google_only_user_cannot_silently_create_password(client, setup_reset_users, db_session):
    """20. Tài khoản chỉ đăng ký bằng Google (không có local password) không bị tạo password âm thầm."""
    client.post("/api/auth/forgot-password", json={"email": "google_only@gmail.com"})

    # Không sinh token cho tài khoản thuần Google
    tokens = db_session.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == setup_reset_users["google_user"].id
    ).all()
    assert len(tokens) == 0


def test_rate_limiting_forgot_password(client, setup_reset_users):
    """20. Giới hạn tần suất yêu cầu (Rate Limit: tối đa 5 lần trong 10 phút)."""
    # Gửi 5 lần liên tiếp
    for _ in range(5):
        res = client.post("/api/auth/forgot-password", json={"email": "reset_user@example.com"})
        assert res.status_code == 200

    # Lần thứ 6 phải bị chặn với 429 Too Many Requests
    res6 = client.post("/api/auth/forgot-password", json={"email": "reset_user@example.com"})
    assert res6.status_code == 429
    assert "quá nhiều lần" in res6.json()["detail"]
