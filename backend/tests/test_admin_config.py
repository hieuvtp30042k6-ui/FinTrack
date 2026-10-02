import pytest
from app.models.user import User
from app.core.security import hash_password, create_access_token


@pytest.fixture
def superadmin_and_admin_fixture(db_session):
    super_admin = User(
        name="Super Admin Test",
        email="superadmin.test@fintrack.internal",
        password_hash=hash_password("Password@123"),
        role="super_admin",
        status="active"
    )
    admin = User(
        name="Admin Test",
        email="admin.test@fintrack.internal",
        password_hash=hash_password("Password@123"),
        role="admin",
        status="active"
    )
    regular_user = User(
        name="User Test",
        email="user.test@example.com",
        password_hash=hash_password("Password@123"),
        role="user",
        status="active"
    )
    db_session.add_all([super_admin, admin, regular_user])
    db_session.commit()
    return {"super_admin": super_admin, "admin": admin, "regular_user": regular_user}


def test_get_system_config_admin(client, superadmin_and_admin_fixture):
    """Admin có thể lấy cấu hình hệ thống thành công."""
    admin = superadmin_and_admin_fixture["admin"]
    token = create_access_token(data={"sub": str(admin.id)})
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/admin/config", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "general" in data
    assert "smtp" in data
    assert "flags" in data
    assert "apis" in data
    assert data["general"]["app_name"] == "FinTrack"
    assert int(data["general"]["max_wallets"]) >= 1


def test_regular_user_cannot_access_config(client, superadmin_and_admin_fixture):
    """User thường không thể truy cập /api/admin/config -> 403 Forbidden."""
    user = superadmin_and_admin_fixture["regular_user"]
    token = create_access_token(data={"sub": str(user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/admin/config", headers=headers)
    assert res.status_code == 403


def test_update_system_config_persists(client, superadmin_and_admin_fixture, db_session):
    """Cập nhật cấu hình hệ thống được lưu vào DB và bảo toàn khi gọi lại."""
    super_admin = superadmin_and_admin_fixture["super_admin"]
    token = create_access_token(data={"sub": str(super_admin.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Lấy cấu hình ban đầu
    get_res = client.get("/api/admin/config", headers=headers)
    assert get_res.status_code == 200
    config_data = get_res.json()

    # 2. Thay đổi giá trị
    config_data["general"]["app_name"] = "FinTrack Enterprise"
    config_data["general"]["max_wallets"] = "25"
    config_data["smtp"]["from_name"] = "FinTrack Admin Team"
    # Thay đổi flag
    for f in config_data["flags"]:
        if f["id"] == "maintenance_mode":
            f["enabled"] = True

    # 3. Gửi cập nhật PUT
    put_res = client.put("/api/admin/config", json=config_data, headers=headers)
    assert put_res.status_code == 200
    updated = put_res.json()
    assert updated["general"]["app_name"] == "FinTrack Enterprise"
    assert updated["general"]["max_wallets"] == "25"
    assert updated["smtp"]["from_name"] == "FinTrack Admin Team"

    # 4. Gọi GET lại để kiểm chứng dữ liệu đã lưu vào database
    get_again = client.get("/api/admin/config", headers=headers)
    assert get_again.status_code == 200
    persisted = get_again.json()
    assert persisted["general"]["app_name"] == "FinTrack Enterprise"
    assert persisted["general"]["max_wallets"] == "25"
    assert persisted["smtp"]["from_name"] == "FinTrack Admin Team"
    maintenance_flag = next(f for f in persisted["flags"] if f["id"] == "maintenance_mode")
    assert maintenance_flag["enabled"] is True


def test_update_system_config_invalid_limits(client, superadmin_and_admin_fixture):
    """Cập nhật với hạn mức âm hoặc bằng 0 bị từ chối với HTTP 422."""
    admin = superadmin_and_admin_fixture["admin"]
    token = create_access_token(data={"sub": str(admin.id)})
    headers = {"Authorization": f"Bearer {token}"}

    get_res = client.get("/api/admin/config", headers=headers)
    config_data = get_res.json()
    config_data["general"]["max_wallets"] = "-5"

    put_res = client.put("/api/admin/config", json=config_data, headers=headers)
    assert put_res.status_code == 422


def test_test_email_config_endpoint(client, superadmin_and_admin_fixture):
    """Kiểm tra endpoint gửi email test."""
    admin = superadmin_and_admin_fixture["admin"]
    token = create_access_token(data={"sub": str(admin.id)})
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "smtp": {
            "host": "smtp.gmail.com",
            "port": "587",
            "username": "admin@fintrack.internal",
            "password": "secret_password",
            "from_email": "admin@fintrack.internal",
            "from_name": "FinTrack Admin",
            "use_tls": True
        }
    }
    res = client.post("/api/admin/config/test-email", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
