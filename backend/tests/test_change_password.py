import pytest
from app.models.user import User
from app.core.security import hash_password, create_access_token


@pytest.fixture
def user_with_password(db_session):
    """Seed test user with initial password 'OldPassword@123'."""
    user = User(
        name="Lê Văn Test",
        email="test.password@example.com",
        password_hash=hash_password("OldPassword@123"),
        role="user",
        status="active"
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


# ==============================================================================
# F01.06 TEST SUITE – ĐỔI MẬT KHẨU & THU HỒI PHIÊN
# ==============================================================================

def test_change_password_success(client, user_with_password):
    """Test 1: Đổi mật khẩu thành công với thông tin hợp lệ."""
    token = create_access_token(data={"sub": str(user_with_password.id)})
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "current_password": "OldPassword@123",
        "new_password": "NewStrongPassword@2026",
        "confirm_password": "NewStrongPassword@2026"
    }
    response = client.patch("/api/users/me/password", json=payload, headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert "thành công" in data["message"].lower()
    assert "password" not in data
    assert "password_hash" not in data


def test_change_password_unauthenticated(client):
    """Test 2: Không đăng nhập -> HTTP 401 Unauthorized."""
    payload = {
        "current_password": "OldPassword@123",
        "new_password": "NewStrongPassword@2026",
        "confirm_password": "NewStrongPassword@2026"
    }
    response = client.patch("/api/users/me/password", json=payload)

    assert response.status_code == 401


def test_change_password_wrong_current_password(client, user_with_password):
    """Test 3: Mật khẩu hiện tại không đúng -> HTTP 400 Bad Request."""
    token = create_access_token(data={"sub": str(user_with_password.id)})
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "current_password": "WrongPassword@999",
        "new_password": "NewStrongPassword@2026",
        "confirm_password": "NewStrongPassword@2026"
    }
    response = client.patch("/api/users/me/password", json=payload, headers=headers)

    assert response.status_code == 400
    assert "mật khẩu hiện tại không chính xác" in response.json()["detail"].lower()


def test_change_password_weak_new_password(client, user_with_password):
    """Test 4: Mật khẩu mới không hợp lệ (quá ngắn, thiếu ký tự đặc biệt...) -> HTTP 400."""
    token = create_access_token(data={"sub": str(user_with_password.id)})
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "current_password": "OldPassword@123",
        "new_password": "simplepassword",
        "confirm_password": "simplepassword"
    }
    response = client.patch("/api/users/me/password", json=payload, headers=headers)

    assert response.status_code == 400
    assert "mật khẩu không đạt yêu cầu" in response.json()["detail"].lower()


def test_change_password_confirm_mismatch(client, user_with_password):
    """Test 5: Mật khẩu xác nhận không khớp -> HTTP 422 Unprocessable Entity."""
    token = create_access_token(data={"sub": str(user_with_password.id)})
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "current_password": "OldPassword@123",
        "new_password": "NewStrongPassword@2026",
        "confirm_password": "DifferentPassword@2026"
    }
    response = client.patch("/api/users/me/password", json=payload, headers=headers)

    assert response.status_code == 422


def test_change_password_same_as_old(client, user_with_password):
    """Test 6: Mật khẩu mới trùng với mật khẩu cũ -> HTTP 400 Bad Request."""
    token = create_access_token(data={"sub": str(user_with_password.id)})
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "current_password": "OldPassword@123",
        "new_password": "OldPassword@123",
        "confirm_password": "OldPassword@123"
    }
    response = client.patch("/api/users/me/password", json=payload, headers=headers)

    assert response.status_code == 400
    assert "không được trùng" in response.json()["detail"].lower()


def test_change_password_not_stored_plaintext(client, user_with_password, db_session):
    """Test 7: Mật khẩu mới không được lưu plaintext trong database."""
    token = create_access_token(data={"sub": str(user_with_password.id)})
    headers = {"Authorization": f"Bearer {token}"}

    new_pwd = "NewStrongPassword@2026"
    payload = {
        "current_password": "OldPassword@123",
        "new_password": new_pwd,
        "confirm_password": new_pwd
    }
    client.patch("/api/users/me/password", json=payload, headers=headers)

    db_session.refresh(user_with_password)
    assert user_with_password.password_hash != new_pwd
    assert user_with_password.password_hash.startswith("$2b$")


def test_login_with_new_password_after_change(client, user_with_password):
    """Test 8: Đăng nhập bằng mật khẩu mới thành công, mật khẩu cũ bị từ chối."""
    token = create_access_token(data={"sub": str(user_with_password.id)})
    headers = {"Authorization": f"Bearer {token}"}

    new_pwd = "NewStrongPassword@2026"
    payload = {
        "current_password": "OldPassword@123",
        "new_password": new_pwd,
        "confirm_password": new_pwd
    }
    client.patch("/api/users/me/password", json=payload, headers=headers)

    # 1. Thử đăng nhập lại bằng mật khẩu cũ -> HTTP 401
    old_login = client.post("/api/auth/login", json={
        "email": user_with_password.email,
        "password": "OldPassword@123"
    })
    assert old_login.status_code == 401

    # 2. Đăng nhập bằng mật khẩu mới -> HTTP 200
    new_login = client.post("/api/auth/login", json={
        "email": user_with_password.email,
        "password": new_pwd
    })
    assert new_login.status_code == 200
    assert "access_token" in new_login.json()


def test_other_sessions_revoked_and_current_session_preserved(client, user_with_password):
    """
    Test 9: Thu hồi phiên:
    - Các phiên đăng nhập khác của tài khoản bị thu hồi sau khi đổi mật khẩu (HTTP 401).
    - Phiên hiện tại thực hiện lệnh đổi mật khẩu vẫn tiếp tục hoạt động bình thường (HTTP 200).
    """
    # 1. Tạo 2 phiên đăng nhập: Phiên A (laptop) và Phiên B (mobile)
    token_current_session = create_access_token(data={"sub": str(user_with_password.id), "sid": "session-laptop"})
    token_other_session = create_access_token(data={"sub": str(user_with_password.id), "sid": "session-mobile"})

    # Cả hai phiên ban đầu đều truy cập được bình thường
    res_a_before = client.get("/api/users/me", headers={"Authorization": f"Bearer {token_current_session}"})
    assert res_a_before.status_code == 200
    res_b_before = client.get("/api/users/me", headers={"Authorization": f"Bearer {token_other_session}"})
    assert res_b_before.status_code == 200

    # 2. Phiên A (laptop) thực hiện đổi mật khẩu
    payload = {
        "current_password": "OldPassword@123",
        "new_password": "NewStrongPassword@2026",
        "confirm_password": "NewStrongPassword@2026"
    }
    change_res = client.patch(
        "/api/users/me/password",
        json=payload,
        headers={"Authorization": f"Bearer {token_current_session}"}
    )
    assert change_res.status_code == 200

    # 3. Phiên A (phiên hiện tại) VẪN HOẠT ĐỘNG
    res_a_after = client.get("/api/users/me", headers={"Authorization": f"Bearer {token_current_session}"})
    assert res_a_after.status_code == 200
    assert res_a_after.json()["email"] == user_with_password.email

    # 4. Phiên B (phiên khác) BỊ THU HỒI NGAY LẬP TỨC -> HTTP 401
    res_b_after = client.get("/api/users/me", headers={"Authorization": f"Bearer {token_other_session}"})
    assert res_b_after.status_code == 401
    assert "thu hồi" in res_b_after.json()["detail"].lower()
