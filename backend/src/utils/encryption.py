from cryptography.fernet import Fernet, InvalidToken
from typing import Optional


def generate_key() -> str:
    return Fernet.generate_key().decode('utf-8')


class EncryptionManager:
    def __init__(self, key: str):
        self._fernet = Fernet(key.encode('utf-8'))

    @staticmethod
    def generate_key() -> str:
        return generate_key()

    def encrypt(self, plaintext: Optional[str]) -> Optional[str]:
        if not plaintext:
            return None
        return self._fernet.encrypt(plaintext.encode('utf-8')).decode('utf-8')

    def decrypt(self, ciphertext: Optional[str]) -> Optional[str]:
        if not ciphertext:
            return None
        try:
            return self._fernet.decrypt(ciphertext.encode('utf-8')).decode('utf-8')
        except (InvalidToken, Exception):
            return None
