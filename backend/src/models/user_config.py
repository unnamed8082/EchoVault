from dataclasses import dataclass, field
from typing import Optional
import bcrypt


@dataclass
class UserConfig:
    username: str
    email: str
    password_hash: Optional[str] = field(default=None, repr=False)

    def set_password(self, password: str) -> None:
        pwd = password[:72].encode('utf-8')
        self.password_hash = bcrypt.hashpw(pwd, bcrypt.gensalt(rounds=4)).decode('utf-8')

    def verify_password(self, password: str) -> bool:
        if not self.password_hash:
            return False
        pwd = password[:72].encode('utf-8')
        return bcrypt.checkpw(pwd, self.password_hash.encode('utf-8'))

    def to_safe_dict(self) -> dict:
        return {
            "username": self.username,
            "email": self.email,
        }
