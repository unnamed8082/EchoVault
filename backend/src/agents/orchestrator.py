import re
from typing import Dict, List, Any


class DistillationOrchestrator:
    def __init__(self):
        self._line_pattern = re.compile(r'^([^:：]+)[：:]\s*(.+)$')

    def parse_chat_log(self, chat_log: str) -> Dict[str, Any]:
        if not chat_log or not chat_log.strip():
            return {"messages": []}
        messages: List[Dict[str, str]] = []
        for line in chat_log.strip().splitlines():
            line = line.strip()
            if not line:
                continue
            m = self._line_pattern.match(line)
            if m:
                messages.append({
                    "speaker": m.group(1).strip(),
                    "content": m.group(2).strip(),
                })
        return {"messages": messages}
