import pytest
from unittest.mock import patch
from app.models.user import User
from app.core.security import verify_password


# ==========================================
# 1. Email + Password Tests (Test cases 1 - 7)
# ==========================================

def test_register_email_success(client, db_session):
    """1. Đăng ký thành công với thông tin hợp lệ."""
    payload = {
        "name": "Nguyen Van A",
        "email": "nguyenvana@example.com",
        "password": "Password@123",
        "confirm_password": "Password@123"
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 201
    
    data = response.json()
    assert data["name"] == "Nguyen Van A"
    assert data["email"] == "nguyenvana@example.com"
    assert data["role"] == "user"
    assert data["status"] == "active"
    assert "id" in data
    assert "created_at" in data


def test_register_duplicate_email(client, db_session):
    """2. Email đã tồn tại -> 409 Conflict."""
    payload = {
        "name": "User One",
        "email": "duplicate@example.com",
        "password": "Password@123",
        "confirm_password": "Password@123"
    }
    res1 = client.post("/api/auth/register", json=payload)
    assert res1.status_code == 201

    # Thử đăng ký lần hai với cùng email
    payload2 = {
        "name": "User Two",
        "email": "DUPLICATE@example.com",  # Viết hoa để kiểm tra normalize
        "password": "Password@456",
        "confirm_password": "Password@456"
    }
    res2 = client.post("/api/auth/register", json=payload2)
    assert res2.status_code == 409
    assert "đã được sử dụng" in res2.json()["detail"]


def test_register_invalid_email_format(client):
    """3. Email không hợp lệ -> 422 Unprocessable Entity."""
    payload = {
        "name": "User Test",
        "email": "invalid-email-format",
        "password": "Password@123",
        "confirm_password": "Password@123"
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 422


@pytest.mark.parametrize("weak_pwd,expected_status", [
    ("123456", 422),           # Quá ngắn (< 8 ký tự, pydantic min_length=8)
    ("password", 400),         # Phổ biến, thiếu hoa/số/ký tự đặc biệt
    ("12345678", 400),         # Chỉ có số
    ("abcdefgh", 400),         # Chỉ có chữ thường
    ("ABCDEFGH", 400),         # Chỉ có chữ hoa
    ("Abcdefgh", 400),         # Thiếu số & ký tự đặc biệt
    ("Abcdef12", 400),         # Thiếu ký tự đặc biệt
])
def test_register_weak_password_rejected(client, weak_pwd, expected_status):
    """4. Password quá yếu hoặc không đạt chính sách bị từ chối."""
    payload = {
        "name": "Weak Pass User",
        "email": f"weak_{weak_pwd[:4]}@example.com",
        "password": weak_pwd,
        "confirm_password": weak_pwd
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code in (400, 422)


def test_register_confirm_password_mismatch(client):
    """5. Password confirmation không khớp -> 422 Unprocessable Entity."""
    payload = {
        "name": "Mismatch User",
        "email": "mismatch@example.com",
        "password": "Password@123",
        "confirm_password": "DifferentPassword@123"
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 422
    assert "Mật khẩu xác nhận không khớp" in str(response.json())


def test_password_is_hashed_in_database(client, db_session):
    """6. Password được hash trong database (không lưu plaintext)."""
    raw_password = "Password@123"
    payload = {
        "name": "Hash Check User",
        "email": "hashcheck@example.com",
        "password": raw_password,
        "confirm_password": raw_password
    }
    res = client.post("/api/auth/register", json=payload)
    assert res.status_code == 201

    # Kiểm tra trực tiếp trong DB
    user_in_db = db_session.query(User).filter(User.email == "hashcheck@example.com").first()
    assert user_in_db is not None
    assert user_in_db.password_hash != raw_password
    assert user_in_db.password_hash.startswith("$2b$")
    assert verify_password(raw_password, user_in_db.password_hash) is True


def test_response_does_not_contain_password_or_hash(client):
    """7. Response không chứa password hoặc password_hash."""
    payload = {
        "name": "No Password Leak",
        "email": "noleak@example.com",
        "password": "Password@123",
        "confirm_password": "Password@123"
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "password" not in data
    assert "password_hash" not in data
    assert "confirm_password" not in data


# ==========================================
# 2. Google Registration Tests (Test cases 8 - 12)
# ==========================================

@patch("app.services.auth_service.verify_google_id_token")
def test_google_register_success_new_user(mock_verify, client, db_session):
    """8. Google authentication hợp lệ -> tạo User mới."""
    mock_verify.return_value = {
        "sub": "google-user-id-12345",
        "email": "google_new@gmail.com",
        "email_verified": True,
        "name": "Google User Test"
    }

    payload = {"credential": "mocked_valid_google_id_token"}
    response = client.post("/api/auth/google", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "google_new@gmail.com"
    assert data["user"]["name"] == "Google User Test"

    # Kiểm tra trong DB
    user_in_db = db_session.query(User).filter(User.email == "google_new@gmail.com").first()
    assert user_in_db is not None
    assert user_in_db.google_id == "google-user-id-12345"
    assert user_in_db.password_hash is None


@patch("app.services.auth_service.verify_google_id_token")
def test_google_register_immediate_login(mock_verify, client):
    """9. Google authentication hợp lệ -> đăng nhập ngay, trả JWT hợp lệ."""
    mock_verify.return_value = {
        "sub": "google-sub-777",
        "email": "auto_login@gmail.com",
        "email_verified": True,
        "name": "Immediate Login"
    }

    payload = {"credential": "mocked_valid_token"}
    response = client.post("/api/auth/google", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert "access_token" in data
    assert len(data["access_token"]) > 20
    assert data["token_type"] == "bearer"


@patch("app.services.auth_service.verify_google_id_token")
def test_google_register_existing_email_links_account(mock_verify, client, db_session):
    """10. Email Google đã tồn tại -> không tạo User duplicate, liên kết google_id."""
    # Bước 1: Tạo user bằng email + password trước
    email_payload = {
        "name": "Existing Account",
        "email": "existing_both@example.com",
        "password": "Password@123",
        "confirm_password": "Password@123"
    }
    client.post("/api/auth/register", json=email_payload)
    user_count_before = db_session.query(User).count()
    assert user_count_before == 1

    # Bước 2: Người dùng đăng ký/đăng nhập bằng Google với cùng email
    mock_verify.return_value = {
        "sub": "google-linked-id-999",
        "email": "existing_both@example.com",
        "email_verified": True,
        "name": "Google Name"
    }
    payload = {"credential": "mocked_token_for_linking"}
    response = client.post("/api/auth/google", json=payload)
    assert response.status_code == 200

    # Bước 3: Đảm bảo không tạo bản ghi User mới (không duplicate)
    user_count_after = db_session.query(User).count()
    assert user_count_after == 1

    # Kiểm tra tài khoản đã được liên kết google_id
    user_in_db = db_session.query(User).filter(User.email == "existing_both@example.com").first()
    assert user_in_db.google_id == "google-linked-id-999"
    assert user_in_db.password_hash is not None  # Giữ nguyên mật khẩu cũ


@patch("app.services.auth_service.verify_google_id_token")
def test_google_register_invalid_token(mock_verify, client):
    """11. Google credential/token không hợp lệ -> 401 Unauthorized."""
    mock_verify.side_effect = ValueError("Invalid token signature or expired")

    payload = {"credential": "invalid_or_expired_token"}
    response = client.post("/api/auth/google", json=payload)
    assert response.status_code == 401
    assert "không thành công" in response.json()["detail"]


@patch("app.services.auth_service.verify_google_id_token")
def test_google_register_no_google_secrets_leaked(mock_verify, client):
    """12. Không trả secret/token của Google trong response."""
    mock_verify.return_value = {
        "sub": "google-secret-check-id",
        "email": "secret_check@gmail.com",
        "email_verified": True,
        "name": "Secret Check User"
    }

    payload = {"credential": "google_raw_credential_sample"}
    response = client.post("/api/auth/google", json=payload)
    assert response.status_code == 200

    data = response.json()
    response_text = str(data)
    assert "google_raw_credential_sample" not in response_text
    assert "client_secret" not in response_text
    assert "refresh_token" not in response_text
    assert "password" not in data.get("user", {})
