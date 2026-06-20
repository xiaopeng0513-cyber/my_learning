"""Configuration management for PyTodo."""

import os
import secrets


def _default_secret():
    return os.environ.get("PYTODO_SECRET_KEY") or secrets.token_hex(32)


class Config:
    SECRET_KEY = _default_secret()
    DATABASE = os.environ.get("PYTODO_DATABASE", None)
    JWT_EXPIRY_DAYS = int(os.environ.get("PYTODO_JWT_EXPIRY_DAYS", "30"))
    HOST = os.environ.get("PYTODO_HOST", "127.0.0.1")
    PORT = int(os.environ.get("PYTODO_PORT", "5000"))
    SHARE_TOKEN_BYTES = 6  # 8 URL-safe characters


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False
