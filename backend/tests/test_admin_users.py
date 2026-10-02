import pytest
from app.models.user import User
from app.core.security import hash_password, create_access_token


@pytest.fixture
def admin_fixture(db_session):
    """Seed an admin and two regular users for testing."""
    admin = User(
        name="Trần Quản Trị",
        email="admin@fintrack.internal",
        password_hash=hash_password("AdminPassword@123"),
        role="admin",
        status="active"
    )
    user_1 = User(
        name="Nguyễn Văn A",
        email="vana.nguyen@example.com",
        password_hash=hash_password("PasswordA@123"),
        role="user",
        status="active"
    )
    user_2 = User(
        name="Lê Thị B",
        email="thib.le@example.com",
        password_hash=hash_password("PasswordB@123"),
        role="user",
        status="locked"
    )
    db_session.add_all([admin, user_1, user_2])
    db_session.commit()
    return {"admin": admin, "user_1": user_1, "user_2": user_2}


# ==============================================================================
# ADMIN QUẢN LÝ NGƯỜI DÙNG - TEST SUITE
# ==============================================================================

def test_admin_get_users_list_success(client, admin_fixture):
    """Admin xem danh sách người dùng thành công."""
    admin = admin_fixture["admin"]
    token = create_access_token(data={"sub": str(admin.id)})

    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/admin/users", headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 3

    # Kiểm tra các trường được phép trả về
    for item in data:
        assert "id" in item
        assert "name" in item
        assert "email" in item
        assert "role" in item
        assert "status" in item
        assert "created_at" in item
        # Tuyệt đối không trả về thông tin nhạy cảm
        assert "password" not in item
        assert "password_hash" not in item
        assert "google_id" not in item
        assert "active_session_id" not in item
        assert "token" not in item
        assert "secret" not in item


def test_admin_get_user_detail_success(client, admin_fixture):
    """Admin xem thông tin chi tiết một người dùng cụ thể."""
    admin = admin_fixture["admin"]
    user_1 = admin_fixture["user_1"]
    token = create_access_token(data={"sub": str(admin.id)})

    headers = {"Authorization": f"Bearer {token}"}
    response = client.get(f"/api/admin/users/{user_1.id}", headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == user_1.id
    assert data["name"] == user_1.name
    assert data["email"] == user_1.email
    assert data["role"] == "user"
    assert data["status"] == "active"
    assert "created_at" in data
    assert "password_hash" not in data
    assert "password" not in data


def test_admin_get_user_detail_not_found(client, admin_fixture):
    """Admin xem thông tin chi tiết người dùng không tồn tại -> HTTP 404."""
    admin = admin_fixture["admin"]
    token = create_access_token(data={"sub": str(admin.id)})

    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/admin/users/99999", headers=headers)

    assert response.status_code == 404
    assert "Không tìm thấy người dùng." in response.json()["detail"]


def test_admin_lock_user_success(client, admin_fixture, db_session):
    """Admin khóa tài khoản người dùng thành công (status -> 'locked')."""
    admin = admin_fixture["admin"]
    user_1 = admin_fixture["user_1"]
    assert user_1.status == "active"

    token = create_access_token(data={"sub": str(admin.id)})
    headers = {"Authorization": f"Bearer {token}"}

    response = client.patch(f"/api/admin/users/{user_1.id}/lock", headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == user_1.id
    assert data["status"] == "locked"
    assert "password_hash" not in data

    # Kiểm tra cập nhật trong database
    db_session.refresh(user_1)
    assert user_1.status == "locked"


def test_admin_cannot_lock_self(client, admin_fixture):
    """Admin không thể tự khóa tài khoản của chính mình -> HTTP 400."""
    admin = admin_fixture["admin"]
    token = create_access_token(data={"sub": str(admin.id)})
    headers = {"Authorization": f"Bearer {token}"}

    response = client.patch(f"/api/admin/users/{admin.id}/lock", headers=headers)

    assert response.status_code == 400
    assert "Không thể tự khóa tài khoản của chính mình." in response.json()["detail"]


def test_admin_lock_user_not_found(client, admin_fixture):
    """Khóa người dùng không tồn tại -> HTTP 404."""
    admin = admin_fixture["admin"]
    token = create_access_token(data={"sub": str(admin.id)})
    headers = {"Authorization": f"Bearer {token}"}

    response = client.patch("/api/admin/users/99999/lock", headers=headers)
    assert response.status_code == 404
    assert "Không tìm thấy người dùng." in response.json()["detail"]


def test_admin_unlock_user_success(client, admin_fixture, db_session):
    """Admin mở khóa tài khoản người dùng thành công (status -> 'active')."""
    admin = admin_fixture["admin"]
    user_2 = admin_fixture["user_2"]
    assert user_2.status == "locked"

    token = create_access_token(data={"sub": str(admin.id)})
    headers = {"Authorization": f"Bearer {token}"}

    response = client.patch(f"/api/admin/users/{user_2.id}/unlock", headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == user_2.id
    assert data["status"] == "active"
    assert "password_hash" not in data

    # Kiểm tra cập nhật trong database
    db_session.refresh(user_2)
    assert user_2.status == "active"


def test_admin_unlock_user_not_found(client, admin_fixture):
    """Mở khóa người dùng không tồn tại -> HTTP 404."""
    admin = admin_fixture["admin"]
    token = create_access_token(data={"sub": str(admin.id)})
    headers = {"Authorization": f"Bearer {token}"}

    response = client.patch("/api/admin/users/99999/unlock", headers=headers)
    assert response.status_code == 404
    assert "Không tìm thấy người dùng." in response.json()["detail"]


def test_regular_user_forbidden_all_admin_endpoints(client, admin_fixture):
    """User thường (role='user') gọi bất kỳ API Admin nào -> HTTP 403 Forbidden."""
    user_1 = admin_fixture["user_1"]
    token = create_access_token(data={"sub": str(user_1.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. GET /api/admin/users
    res_list = client.get("/api/admin/users", headers=headers)
    assert res_list.status_code == 403

    # 2. GET /api/admin/users/{id}
    res_detail = client.get(f"/api/admin/users/{user_1.id}", headers=headers)
    assert res_detail.status_code == 403

    # 3. PATCH /api/admin/users/{id}/lock
    res_lock = client.patch(f"/api/admin/users/{user_1.id}/lock", headers=headers)
    assert res_lock.status_code == 403

    # 4. PATCH /api/admin/users/{id}/unlock
    res_unlock = client.patch(f"/api/admin/users/{user_1.id}/unlock", headers=headers)
    assert res_unlock.status_code == 403


def test_unauthenticated_all_admin_endpoints(client, admin_fixture):
    """Chưa đăng nhập (không có Bearer token) -> HTTP 401 Unauthorized."""
    user_1 = admin_fixture["user_1"]

    assert client.get("/api/admin/users").status_code == 401
    assert client.get(f"/api/admin/users/{user_1.id}").status_code == 401
    assert client.patch(f"/api/admin/users/{user_1.id}/lock").status_code == 401
    assert client.patch(f"/api/admin/users/{user_1.id}/unlock").status_code == 401


def test_cannot_forge_role_from_request_payload(client, admin_fixture):
    """User thường không thể giả mạo quyền Admin bằng cách đính kèm 'role': 'admin'."""
    user_1 = admin_fixture["user_1"]
    token = create_access_token(data={"sub": str(user_1.id)})
    headers = {
        "Authorization": f"Bearer {token}",
        "X-User-Role": "admin"
    }

    response = client.get("/api/admin/users", headers=headers)
    assert response.status_code == 403


def test_locked_user_cannot_login(client, admin_fixture):
    """User bị khóa (status='locked') không thể đăng nhập hệ thống -> HTTP 403."""
    user_2 = admin_fixture["user_2"]
    assert user_2.status == "locked"

    payload = {
        "email": user_2.email,
        "password": "PasswordB@123"
    }
    response = client.post("/api/auth/login", json=payload)

    assert response.status_code == 403
    assert "Tài khoản đã bị khóa hoặc chưa được kích hoạt." in response.json()["detail"]


def test_locked_user_cannot_use_system(client, admin_fixture):
    """User có token nhưng trạng thái trong DB đã bị khóa -> không thể gọi API bảo vệ -> HTTP 403."""
    user_2 = admin_fixture["user_2"]
    token = create_access_token(data={"sub": str(user_2.id)})
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get("/api/users/me", headers=headers)
    assert response.status_code == 403
    assert "Tài khoản đã bị khóa hoặc chưa được kích hoạt." in response.json()["detail"]


def test_unlocked_user_can_login_again(client, admin_fixture, db_session):
    """User sau khi được Admin mở khóa (status='active') có thể đăng nhập bình thường."""
    admin = admin_fixture["admin"]
    user_2 = admin_fixture["user_2"]
    admin_token = create_access_token(data={"sub": str(admin.id)})

    # 1. Admin mở khóa user
    unlock_res = client.patch(
        f"/api/admin/users/{user_2.id}/unlock",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert unlock_res.status_code == 200

    # 2. User đăng nhập lại thành công
    login_res = client.post(
        "/api/auth/login",
        json={"email": user_2.email, "password": "PasswordB@123"}
    )
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert "access_token" in login_data
    assert login_data["user"]["status"] == "active"


def test_role_cannot_be_changed_via_admin_user_api(client, admin_fixture, db_session):
    """Không cho phép thay đổi role qua API này."""
    admin = admin_fixture["admin"]
    user_1 = admin_fixture["user_1"]
    token = create_access_token(data={"sub": str(admin.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # Thử gửi role='admin' khi khóa
    client.patch(f"/api/admin/users/{user_1.id}/lock", headers=headers, json={"role": "admin"})

    db_session.refresh(user_1)
    assert user_1.role == "user"


def test_backward_compatible_status_endpoint(client, admin_fixture, db_session):
    """Kiểm tra endpoint tương thích ngược PATCH /api/admin/users/{id}/status."""
    admin = admin_fixture["admin"]
    user_1 = admin_fixture["user_1"]
    token = create_access_token(data={"sub": str(admin.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Khóa bằng /status
    res_lock = client.patch(
        f"/api/admin/users/{user_1.id}/status",
        headers=headers,
        json={"status": "locked"}
    )
    assert res_lock.status_code == 200
    assert res_lock.json()["status"] == "locked"

    # 2. Mở khóa bằng /status
    res_unlock = client.patch(
        f"/api/admin/users/{user_1.id}/status",
        headers=headers,
        json={"status": "active"}
    )
    assert res_unlock.status_code == 200
    assert res_unlock.json()["status"] == "active"

    # 3. Trạng thái không hợp lệ
    res_invalid = client.patch(
        f"/api/admin/users/{user_1.id}/status",
        headers=headers,
        json={"status": "unknown"}
    )
    assert res_invalid.status_code == 400
