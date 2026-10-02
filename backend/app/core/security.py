import re
import datetime
from typing import Tuple, Dict, Any, Optional
import bcrypt
import jwt
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from app.core.config import settings

# Common weak passwords list to avoid
COMMON_PASSWORDS = {
    "12345678", "password", "password123", "admin123", "123456789", 
    "qwerty123", "iloveyou", "welcome123", "admin@123", "Password@1234"
}


def hash_password(password: str) -> str:
    """Hash password using bcrypt."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against hashed password."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def check_password_strength(password: str) -> Tuple[str, bool, Optional[str]]:
    """
    Evaluates password strength and returns:
    (level: 'Weak' | 'Medium' | 'Strong', is_valid: bool, reason: Optional[str])
    
    Policy requirements:
    - Min length: 8 chars
    - Lowercase letter
    - Uppercase letter
    - Number
    - Special character
    - Not in common passwords list
    """
    if len(password) < 8:
        return ("Weak", False, "Mật khẩu phải có tối thiểu 8 ký tự.")
    
    if len(password) > 128:
        return ("Weak", False, "Mật khẩu không được dài quá 128 ký tự.")

    if password.lower() in COMMON_PASSWORDS:
        return ("Weak", False, "Mật khẩu quá phổ biến và dễ đoán. Vui lòng chọn mật khẩu khác.")

    has_lower = bool(re.search(r"[a-z]", password))
    has_upper = bool(re.search(r"[A-Z]", password))
    has_digit = bool(re.search(r"\d", password))
    has_special = bool(re.search(r"[@$!%*?&_\-#^~+=><.,:;(){}[\]|\\]", password))

    score = 0
    if len(password) >= 8:
        score += 1
    if has_lower and has_upper:
        score += 1
    if has_digit:
        score += 1
    if has_special:
        score += 1
    if len(password) >= 12:
        score += 1

    # Check minimum required characters
    missing_criteria = []
    if not has_lower:
        missing_criteria.append("chữ thường")
    if not has_upper:
        missing_criteria.append("chữ hoa")
    if not has_digit:
        missing_criteria.append("chữ số")
    if not has_special:
        missing_criteria.append("ký tự đặc biệt")

    if missing_criteria:
        return ("Weak", False, f"Mật khẩu cần chứa: {', '.join(missing_criteria)}.")

    # Classification
    if score >= 4:
        strength = "Strong"
    elif score >= 3:
        strength = "Medium"
    else:
        strength = "Weak"

    return (strength, True, None)


def create_access_token(data: dict, expires_delta: Optional[datetime.timedelta] = None) -> str:
    """Generate system JWT access token with session ID (sid) and issuance time (iat)."""
    to_encode = data.copy()
    now = datetime.datetime.now(datetime.timezone.utc)
    if "iat" not in to_encode:
        to_encode["iat"] = int(now.timestamp())
    if "sid" not in to_encode:
        import uuid
        to_encode["sid"] = str(uuid.uuid4())
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + datetime.timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decode and validate system JWT access token."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise ValueError("Token đã hết hạn.")
    except jwt.PyJWTError:
        raise ValueError("Token không hợp lệ.")


def verify_google_id_token(token: str) -> Dict[str, Any]:
    """
    Verify Google OAuth 2.0 / OpenID Connect ID token.
    Returns decoded token payload if valid.
    Raises ValueError on invalid token.
    """
    request = google_requests.Request()
    audience = settings.GOOGLE_CLIENT_ID if settings.GOOGLE_CLIENT_ID else None
    
    # verify_oauth2_token handles signature and expiration checks
    id_info = id_token.verify_oauth2_token(token, request, audience=audience)
    
    if id_info.get("iss") not in ["accounts.google.com", "https://accounts.google.com"]:
        raise ValueError("Invalid issuer for Google token.")
        
    return id_info


def generate_secure_token(nbytes: int = 32) -> str:
    """Generate cryptographically secure random urlsafe token."""
    import secrets
    return secrets.token_urlsafe(nbytes)


def hash_token(token: str) -> str:
    """Compute SHA-256 hash of token for safe database persistence."""
    import hashlib
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
