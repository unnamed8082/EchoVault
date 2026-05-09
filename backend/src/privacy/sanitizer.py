import re
from typing import Optional

_ID_CARD = re.compile(r'[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]')
_BANK_CARD = re.compile(r'(?:62|60|56|4\d)\d{14,17}')
_PHONE = re.compile(r'(?<!\d)1[3-9]\d{9}(?!\d)')
_EMAIL = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')
_URL = re.compile(r'https?://[^\s<>"\']+')
_IP = re.compile(r'(?<!\d)(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)(?!\d)')
_NAME_PREFIX = re.compile(r'(我叫|我是|姓名[：:]?\s*|名字[：:]?\s*)([\u4e00-\u9fff]{2,4})')
_NAME_SUFFIX = re.compile(r'([\u4e00-\u9fff]{2,4})(的手机|的电话|的邮箱|的身份证|的银行卡)')


def _replace_name_prefix(m):
    return m.group(1) + '[姓名]'


def _replace_name_suffix(m):
    return '[姓名]' + m.group(2)


def sanitize_text(text: Optional[str]) -> Optional[str]:
    if text is None:
        return None
    if not text:
        return ''
    result = text
    result = _ID_CARD.sub('[身份证]', result)
    result = _BANK_CARD.sub('[银行卡]', result)
    result = _PHONE.sub('[手机号]', result)
    result = _EMAIL.sub('[邮箱]', result)
    result = _URL.sub('[URL]', result)
    result = _IP.sub('[IP]', result)
    result = _NAME_PREFIX.sub(_replace_name_prefix, result)
    result = _NAME_SUFFIX.sub(_replace_name_suffix, result)
    return result
