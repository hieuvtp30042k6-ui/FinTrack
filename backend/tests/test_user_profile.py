import pytest
from datetime import timedelta
from app.models.user import User
from app.core.security import hash_password, create_access_token


@pytest.fixture
def test_users(db_session):
    """Seed test users for profile retrieval and update tests."""
    user_a = User(
        name="Nguyễn Văn A",
        email="vana.nguyen@example.com",
        password_hash=hash_password("PasswordA@123"),
        role="user",
        status="active"
    )
    user_b = User(
        name="Trần Thị B",
        email="thib.tran@example.com",
        password_hash=hash_password("PasswordB@123"),
        role="user",
        status="active"
    )
    blocked_user = User(
        name="Lê Văn Khóa",
        email="blocked@example.com",
        password_hash=hash_password("Blocked@123"),
        role="user",
        status="blocked"
    )
    db_session.add_all([user_a, user_b, blocked_user])
    db_session.commit()
    return {"user_a": user_a, "user_b": user_b, "blocked_user": blocked_user}


# ==============================================================================
# F01.04 TEST SUITE – XEM THÔNG TIN CÁ NHÂN
# ==============================================================================

def test_get_my_profile_success(client, test_users):
    """Test 1: Lấy thông tin cá nhân thành công với Bearer token hợp lệ."""
    user_a = test_users["user_a"]
    token = create_access_token(data={"sub": str(user_a.id)})

    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/users/me", headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == user_a.id
    assert data["name"] == "Nguyễn Văn A"
    assert data["email"] == "vana.nguyen@example.com"
    assert data["role"] == "user"
    assert data["status"] == "active"
    assert "created_at" in data


def test_get_my_profile_unauthenticated(client):
    """Test 2: Chưa đăng nhập (không gửi Authorization header) -> HTTP 401."""
    response = client.get("/api/users/me")

    assert response.status_code == 401
    assert "Bearer" in response.headers.get("WWW-Authenticate", "")


def test_get_my_profile_invalid_token(client):
    """Test 3: Token không hợp lệ -> HTTP 401."""
    headers = {"Authorization": "Bearer token_khong_hop_le_xyz"}
    response = client.get("/api/users/me", headers=headers)

    assert response.status_code == 401
    assert "WWW-Authenticate" in response.headers


def test_get_my_profile_expired_token(client, test_users):
    """Test 4: Token hết hạn -> HTTP 401."""
    user_a = test_users["user_a"]
    expired_token = create_access_token(
        data={"sub": str(user_a.id)},
        expires_delta=timedelta(minutes=-10)
    )

    headers = {"Authorization": f"Bearer {expired_token}"}
    response = client.get("/api/users/me", headers=headers)

    assert response.status_code == 401


def test_get_my_profile_no_sensitive_data(client, test_users):
    """Test 5: Response tuyệt đối không trả password, password_hash, token hay secret."""
    user_a = test_users["user_a"]
    token = create_access_token(data={"sub": str(user_a.id)})

    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/users/me", headers=headers)

    assert response.status_code == 200
    data = response.json()

    assert "password" not in data
    assert "password_hash" not in data
    assert "token" not in data
    assert "access_token" not in data
    assert "secret" not in data
    assert "google_id" not in data


def test_get_my_profile_only_returns_current_user(client, test_users):
    """Test 6: /me chỉ trả thông tin của user hiện tại tương ứng với token."""
    user_a = test_users["user_a"]
    user_b = test_users["user_b"]

    token_a = create_access_token(data={"sub": str(user_a.id)})
    token_b = create_access_token(data={"sub": str(user_b.id)})

    res_a = client.get("/api/users/me", headers={"Authorization": f"Bearer {token_a}"})
    assert res_a.status_code == 200
    data_a = res_a.json()
    assert data_a["id"] == user_a.id
    assert data_a["email"] == user_a.email
    assert data_a["name"] == user_a.name

    res_b = client.get("/api/users/me", headers={"Authorization": f"Bearer {token_b}"})
    assert res_b.status_code == 200
    data_b = res_b.json()
    assert data_b["id"] == user_b.id
    assert data_b["email"] == user_b.email
    assert data_b["name"] == user_b.name

    assert data_a["id"] != data_b["id"]
    assert data_a["email"] != data_b["email"]


def test_get_my_profile_blocked_user(client, test_users):
    """Test 7: Tài khoản bị khóa (status='blocked') gọi /me -> HTTP 403 Forbidden."""
    blocked_user = test_users["blocked_user"]
    token = create_access_token(data={"sub": str(blocked_user.id)})

    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/users/me", headers=headers)

    assert response.status_code == 403
    assert "khóa" in response.json()["detail"].lower()


# ==============================================================================
# F01.05 TEST SUITE – CẬP NHẬT THÔNG TIN CÁ NHÂN
# ==============================================================================

def test_update_my_profile_name_success(client, test_users, db_session):
    """Test 8: Cập nhật họ tên thành công."""
    user_a = test_users["user_a"]
    token = create_access_token(data={"sub": str(user_a.id)})

    headers = {"Authorization": f"Bearer {token}"}
    payload = {"name": "Nguyễn Văn Đã Đổi Tên"}
    response = client.patch("/api/users/me", json=payload, headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Nguyễn Văn Đã Đổi Tên"
    assert data["email"] == user_a.email
    assert data["role"] == "user"

    # Kiểm tra tính bền vững trong database
    db_session.refresh(user_a)
    assert user_a.name == "Nguyễn Văn Đã Đổi Tên"


def test_update_my_profile_email_success(client, test_users, db_session):
    """Test 9: Cập nhật email thành công khi email mới chưa tồn tại."""
    user_a = test_users["user_a"]
    token = create_access_token(data={"sub": str(user_a.id)})

    headers = {"Authorization": f"Bearer {token}"}
    new_email = "new.email@example.com"
    payload = {"email": f"  {new_email.upper()}  "}  # Kiểm tra chuẩn hóa strip + lower
    response = client.patch("/api/users/me", json=payload, headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert data["email"] == new_email

    db_session.refresh(user_a)
    assert user_a.email == new_email


def test_update_my_profile_keep_same_email(client, test_users):
    """Test 10: Gửi lại chính email hiện tại của mình không bị báo trùng."""
    user_a = test_users["user_a"]
    token = create_access_token(data={"sub": str(user_a.id)})

    headers = {"Authorization": f"Bearer {token}"}
    payload = {"name": "Tên Mới", "email": user_a.email}
    response = client.patch("/api/users/me", json=payload, headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Tên Mới"
    assert data["email"] == user_a.email


def test_update_my_profile_duplicate_email(client, test_users):
    """Test 11: Cập nhật email trùng với tài khoản khác -> HTTP 409 Conflict."""
    user_a = test_users["user_a"]
    user_b = test_users["user_b"]
    token = create_access_token(data={"sub": str(user_a.id)})

    headers = {"Authorization": f"Bearer {token}"}
    payload = {"email": user_b.email}  # Trùng email với user_b
    response = client.patch("/api/users/me", json=payload, headers=headers)

    assert response.status_code == 409
    assert "đã được sử dụng" in response.json()["detail"].lower()


def test_update_my_profile_unauthenticated(client):
    """Test 12: Cập nhật thông tin khi chưa đăng nhập -> HTTP 401 Unauthorized."""
    payload = {"name": "Ai Đó"}
    response = client.patch("/api/users/me", json=payload)

    assert response.status_code == 401


def test_update_my_profile_invalid_token(client):
    """Test 13: Cập nhật thông tin với token không hợp lệ -> HTTP 401 Unauthorized."""
    headers = {"Authorization": "Bearer bad_token_123"}
    payload = {"name": "Ai Đó"}
    response = client.patch("/api/users/me", json=payload, headers=headers)

    assert response.status_code == 401


def test_update_my_profile_invalid_name(client, test_users):
    """Test 14: Dữ liệu tên không hợp lệ (chuỗi rỗng hoặc toàn khoảng trắng) -> HTTP 422."""
    user_a = test_users["user_a"]
    token = create_access_token(data={"sub": str(user_a.id)})

    headers = {"Authorization": f"Bearer {token}"}
    payload = {"name": "   "}
    response = client.patch("/api/users/me", json=payload, headers=headers)

    assert response.status_code == 422


def test_update_my_profile_invalid_email(client, test_users):
    """Test 15: Dữ liệu email không hợp lệ -> HTTP 422."""
    user_a = test_users["user_a"]
    token = create_access_token(data={"sub": str(user_a.id)})

    headers = {"Authorization": f"Bearer {token}"}
    payload = {"email": "invalid-email-format"}
    response = client.patch("/api/users/me", json=payload, headers=headers)

    assert response.status_code == 422


def test_update_my_profile_cannot_change_restricted_fields(client, test_users, db_session):
    """Test 16: User tuyệt đối không thể tự đổi role, status, id, password_hash qua PATCH /me."""
    user_a = test_users["user_a"]
    original_id = user_a.id
    original_pwd_hash = user_a.password_hash
    token = create_access_token(data={"sub": str(user_a.id)})

    headers = {"Authorization": f"Bearer {token}"}
    # Cố tình truyền các trường cấm
    payload = {
        "name": "Người Dùng An Toàn",
        "role": "admin",
        "status": "blocked",
        "id": 99999,
        "password_hash": "malicious_hacked_hash"
    }
    response = client.patch("/api/users/me", json=payload, headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Người Dùng An Toàn"
    assert data["role"] == "user"  # Role vẫn là user
    assert data["status"] == "active"  # Status vẫn là active
    assert data["id"] == original_id  # Id giữ nguyên

    # Kiểm tra trong DB
    db_session.refresh(user_a)
    assert user_a.role == "user"
    assert user_a.status == "active"
    assert user_a.id == original_id
    assert user_a.password_hash == original_pwd_hash


# ==============================================================================
# F01.05 TEST SUITE – UPLOAD VÀ QUẢN LÝ AVATAR
# ==============================================================================

def test_upload_avatar_valid_image(client, test_users, db_session):
    """Test 17: Upload avatar hợp lệ (PNG) thành công -> 200 OK và trả avatar_url."""
    user_a = test_users["user_a"]
    token = create_access_token(data={"sub": str(user_a.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # Giả lập file PNG hợp lệ với magic bytes chuẩn
    png_content = b"\x89PNG\r\n\x1a\n" + b"\x00" * 200
    files = {"file": ("avatar.png", png_content, "image/png")}

    response = client.post("/api/users/me/avatar", files=files, headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert data["avatar_url"] is not None
    assert data["avatar_url"].startswith("/uploads/avatars/")

    db_session.refresh(user_a)
    assert user_a.avatar_url == data["avatar_url"]


def test_upload_avatar_unauthenticated(client):
    """Test 18: Upload avatar khi chưa đăng nhập -> HTTP 401 Unauthorized."""
    png_content = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
    files = {"file": ("avatar.png", png_content, "image/png")}

    response = client.post("/api/users/me/avatar", files=files)
    assert response.status_code == 401


def test_upload_avatar_invalid_extension(client, test_users):
    """Test 19: File không phải ảnh (đuôi file không được hỗ trợ) -> HTTP 400 Bad Request."""
    user_a = test_users["user_a"]
    token = create_access_token(data={"sub": str(user_a.id)})
    headers = {"Authorization": f"Bearer {token}"}

    exe_content = b"MZ\x90\x00" + b"\x00" * 100
    files = {"file": ("malicious.exe", exe_content, "application/x-msdownload")}

    response = client.post("/api/users/me/avatar", files=files, headers=headers)
    assert response.status_code == 400
    assert "chỉ chấp nhận" in response.json()["detail"].lower()


def test_upload_avatar_invalid_magic_bytes(client, test_users):
    """Test 20: Tên file là PNG nhưng nội dung là text plain -> HTTP 400 Bad Request."""
    user_a = test_users["user_a"]
    token = create_access_token(data={"sub": str(user_a.id)})
    headers = {"Authorization": f"Bearer {token}"}

    fake_png = b"This is just plain text content pretending to be a png file."
    files = {"file": ("fake.png", fake_png, "image/png")}

    response = client.post("/api/users/me/avatar", files=files, headers=headers)
    assert response.status_code == 400
    assert "không phải là hình ảnh hợp lệ" in response.json()["detail"].lower()


def test_upload_avatar_file_too_large(client, test_users):
    """Test 21: File vượt quá kích thước cho phép (> 5MB) -> HTTP 400 Bad Request."""
    user_a = test_users["user_a"]
    token = create_access_token(data={"sub": str(user_a.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # Tạo nội dung ảnh vượt quá 5MB
    large_content = b"\x89PNG\r\n\x1a\n" + b"\x00" * (5 * 1024 * 1024 + 100)
    files = {"file": ("large_image.png", large_content, "image/png")}

    response = client.post("/api/users/me/avatar", files=files, headers=headers)
    assert response.status_code == 400
    assert "vượt quá giới hạn" in response.json()["detail"].lower()


def test_replace_and_delete_avatar(client, test_users, db_session):
    """Test 22: Thay thế avatar cũ và xóa avatar quay về mặc định (DELETE)."""
    user_a = test_users["user_a"]
    token = create_access_token(data={"sub": str(user_a.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Upload avatar lần 1 (JPEG)
    jpeg_content_1 = b"\xff\xd8\xff\xe0" + b"\x00" * 150
    files_1 = {"file": ("first_avatar.jpg", jpeg_content_1, "image/jpeg")}
    res_1 = client.post("/api/users/me/avatar", files=files_1, headers=headers)
    assert res_1.status_code == 200
    first_url = res_1.json()["avatar_url"]

    # 2. Thay thế bằng avatar lần 2 (PNG)
    png_content_2 = b"\x89PNG\r\n\x1a\n" + b"\x00" * 150
    files_2 = {"file": ("second_avatar.png", png_content_2, "image/png")}
    res_2 = client.patch("/api/users/me/avatar", files=files_2, headers=headers)
    assert res_2.status_code == 200
    second_url = res_2.json()["avatar_url"]
    assert second_url != first_url

    # 3. Xóa avatar
    delete_res = client.delete("/api/users/me/avatar", headers=headers)
    assert delete_res.status_code == 200
    assert delete_res.json()["avatar_url"] is None

    db_session.refresh(user_a)
    assert user_a.avatar_url is None
