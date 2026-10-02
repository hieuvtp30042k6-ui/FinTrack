import pytest
from unittest.mock import patch
from app.models.user import User
from app.core.security import hash_password


# Helper fixture to create users with different roles and statuses
@pytest.fixture
def setup_users(db_session):
    """Seed test users: standard active user, admin user, blocked user, google user."""
    # 1. Normal active user
    user = User(
        name="Standard User",
        email="user@example.com",
        password_hash=hash_password("UserPassword@123"),
        role="user",
        status="active"
    )
    # 2. Admin active user
    admin = User(
        name="System Admin",
        email="admin@example.com",
        password_hash=hash_password("AdminPassword@123"),
        role="admin",
        status="active"
    )
    # 3. Inactive/Blocked user
    blocked = User(
        name="Blocked User",
        email="blocked@example.com",
        password_hash=hash_password("BlockedPassword@123"),
        role="user",
        status="blocked"
    )
    # 4. User registered via Google with google_id
    google_user = User(
        name="Linked Google User",
        email="google_linked@gmail.com",
        google_id="existing-google-id-001",
        password_hash=None,
        role="user",
        status="active"
    )

    db_session.add_all([user, admin, blocked, google_user])
    db_session.commit()
    return {"user": user, "admin": admin, "blocked": blocked, "google_user": google_user}


# ==========================================================
# 1. Email + Password Login Tests (Cases 1 - 7)
# ==========================================================

def test_login_email_success(client, setup_users):
    """1. Đăng nhập thành công với email và password chính xác."""
    payload = {
        "email": "user@example.com",
        "password": "UserPassword@123"
    }
    response = client.post("/api/auth/login", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "user@example.com"
    assert data["user"]["name"] == "Standard User"
    assert data["user"]["role"] == "user"


def test_login_email_not_found(client, setup_users):
    """2. Email không tồn tại -> 401 Unauthorized (thông báo chung chống account enumeration)."""
    payload = {
        "email": "nonexistent@example.com",
        "password": "AnyPassword@123"
    }
    response = client.post("/api/auth/login", json=payload)
    assert response.status_code == 401
    assert "Email hoặc mật khẩu không chính xác" in response.json()["detail"]


def test_login_wrong_password(client, setup_users):
    """3. Password sai -> 401 Unauthorized (thông báo chung)."""
    payload = {
        "email": "user@example.com",
        "password": "WrongPassword@999"
    }
    response = client.post("/api/auth/login", json=payload)
    assert response.status_code == 401
    assert "Email hoặc mật khẩu không chính xác" in response.json()["detail"]


def test_login_blocked_or_inactive_account(client, setup_users):
    """4. Tài khoản bị khóa/inactive -> 403 Forbidden."""
    payload = {
        "email": "blocked@example.com",
        "password": "BlockedPassword@123"
    }
    response = client.post("/api/auth/login", json=payload)
    assert response.status_code == 403
    assert "khóa hoặc chưa được kích hoạt" in response.json()["detail"]


def test_login_creates_valid_authentication(client, setup_users):
    """5. Authentication (JWT token) được tạo hợp lệ."""
    payload = {
        "email": "user@example.com",
        "password": "UserPassword@123"
    }
    response = client.post("/api/auth/login", json=payload)
    assert response.status_code == 200
    token = response.json().get("access_token")
    assert token is not None
    assert len(token.split(".")) == 3  # Valid JWT format header.payload.signature


def test_login_response_contains_user_and_role(client, setup_users):
    """6. Response trả về đúng User và role tương ứng từ database."""
    payload = {
        "email": "admin@example.com",
        "password": "AdminPassword@123"
    }
    response = client.post("/api/auth/login", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["user"]["email"] == "admin@example.com"
    assert data["user"]["role"] == "admin"
    assert data["user"]["name"] == "System Admin"


def test_login_response_does_not_contain_password_or_hash(client, setup_users):
    """7. Response không chứa password hoặc password_hash."""
    payload = {
        "email": "user@example.com",
        "password": "UserPassword@123"
    }
    response = client.post("/api/auth/login", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert "password" not in data
    assert "password_hash" not in data
    assert "password" not in data.get("user", {})
    assert "password_hash" not in data.get("user", {})


# ==========================================================
# 2. Google Login Tests (Cases 8 - 12)
# ==========================================================

@patch("app.services.auth_service.verify_google_id_token")
def test_google_login_valid_credentials(mock_verify, client, setup_users):
    """8. Google authentication hợp lệ -> 200 OK và trả authentication token."""
    mock_verify.return_value = {
        "sub": "existing-google-id-001",
        "email": "google_linked@gmail.com",
        "email_verified": True,
        "name": "Linked Google User"
    }
    payload = {"credential": "mocked_valid_google_token"}
    response = client.post("/api/auth/login/google", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "google_linked@gmail.com"
    assert data["user"]["role"] == "user"


@patch("app.services.auth_service.verify_google_id_token")
def test_google_login_invalid_credential(mock_verify, client, setup_users):
    """9. Google credential không hợp lệ -> 401 Unauthorized."""
    mock_verify.side_effect = ValueError("Invalid signature or expired token")

    payload = {"credential": "invalid_fake_token"}
    response = client.post("/api/auth/login/google", json=payload)
    assert response.status_code == 401
    assert "không thành công" in response.json()["detail"]


@patch("app.services.auth_service.verify_google_id_token")
def test_google_login_account_linking(mock_verify, client, setup_users, db_session):
    """10. Google account đã liên kết / trùng email tự động liên kết -> đăng nhập thành công."""
    # user@example.com ban đầu chưa có google_id
    user_before = db_session.query(User).filter(User.email == "user@example.com").first()
    assert user_before.google_id is None

    mock_verify.return_value = {
        "sub": "google-id-to-link-123",
        "email": "user@example.com",
        "email_verified": True,
        "name": "Standard User"
    }

    payload = {"credential": "token_for_user_linking"}
    response = client.post("/api/auth/login/google", json=payload)
    assert response.status_code == 200

    # Sau khi đăng nhập, google_id được liên kết
    user_after = db_session.query(User).filter(User.email == "user@example.com").first()
    assert user_after.google_id == "google-id-to-link-123"


@patch("app.services.auth_service.verify_google_id_token")
def test_google_login_no_duplicate_user(mock_verify, client, setup_users, db_session):
    """11. Không tạo duplicate User khi đăng nhập bằng Google."""
    count_before = db_session.query(User).count()

    mock_verify.return_value = {
        "sub": "existing-google-id-001",
        "email": "google_linked@gmail.com",
        "email_verified": True,
        "name": "Linked Google User"
    }

    payload = {"credential": "valid_token"}
    response = client.post("/api/auth/login/google", json=payload)
    assert response.status_code == 200

    count_after = db_session.query(User).count()
    assert count_after == count_before


@patch("app.services.auth_service.verify_google_id_token")
def test_google_login_role_from_database(mock_verify, client, setup_users, db_session):
    """12. Role được lấy trực tiếp từ database (admin giữ nguyên admin, user giữ nguyên user)."""
    # Gán admin cho google_linked@gmail.com
    admin_user = db_session.query(User).filter(User.email == "google_linked@gmail.com").first()
    admin_user.role = "admin"
    db_session.commit()

    mock_verify.return_value = {
        "sub": "existing-google-id-001",
        "email": "google_linked@gmail.com",
        "email_verified": True,
        "name": "Linked Google User"
    }

    payload = {"credential": "token_for_admin"}
    response = client.post("/api/auth/login/google", json=payload)
    assert response.status_code == 200
    assert response.json()["user"]["role"] == "admin"


# ==========================================================
# 3. Authorization Tests (Cases 13 - 15)
# ==========================================================

def test_user_login_yields_role_user(client, setup_users):
    """13. User đăng nhập -> nhận role='user'."""
    payload = {
        "email": "user@example.com",
        "password": "UserPassword@123"
    }
    response = client.post("/api/auth/login", json=payload)
    assert response.status_code == 200
    assert response.json()["user"]["role"] == "user"


def test_admin_login_yields_role_admin(client, setup_users):
    """14. Admin đăng nhập -> nhận role='admin'."""
    payload = {
        "email": "admin@example.com",
        "password": "AdminPassword@123"
    }
    response = client.post("/api/auth/login", json=payload)
    assert response.status_code == 200
    assert response.json()["user"]["role"] == "admin"


def test_admin_endpoint_authorization(client, setup_users):
    """
    15. Kiểm tra phân quyền:
    - User gọi API Admin -> 403 Forbidden.
    - Admin gọi API Admin -> 200 OK.
    """
    # 1. User đăng nhập lấy token
    user_res = client.post("/api/auth/login", json={
        "email": "user@example.com",
        "password": "UserPassword@123"
    })
    user_token = user_res.json()["access_token"]

    # User gọi API Admin -> 403 Forbidden
    res_forbidden = client.get(
        "/api/admin/users",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert res_forbidden.status_code == 403
    assert "yêu cầu quyền Admin" in res_forbidden.json()["detail"]

    # 2. Admin đăng nhập lấy token
    admin_res = client.post("/api/auth/login", json={
        "email": "admin@example.com",
        "password": "AdminPassword@123"
    })
    admin_token = admin_res.json()["access_token"]

    # Admin gọi API Admin -> 200 OK
    res_allowed = client.get(
        "/api/admin/users",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_allowed.status_code == 200
    assert isinstance(res_allowed.json(), list)
    assert len(res_allowed.json()) >= 2
