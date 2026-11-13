import jwt
from pwdlib import PasswordHash

from app.core.config import settings

_password_hash = PasswordHash.recommended()
_JWT_ALGORITHM = "HS256"
_MINIMUM_JWT_SECRET_BYTES = 32


def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _password_hash.verify(password, password_hash)


def _jwt_secret() -> str:
    secret = settings.JWT_SECRET_KEY
    if len(secret.encode("utf-8")) < _MINIMUM_JWT_SECRET_BYTES:
        raise RuntimeError("JWT_SECRET_KEY must contain at least 32 bytes.")
    return secret


def create_access_token(subject: str, expires_at: int) -> str:
    return jwt.encode(
        {"sub": subject, "exp": expires_at},
        _jwt_secret(),
        algorithm=_JWT_ALGORITHM,
    )


def decode_access_token(token: str) -> dict:
    return jwt.decode(
        token,
        _jwt_secret(),
        algorithms=[_JWT_ALGORITHM],
        options={"require": ["sub", "exp"]},
    )
