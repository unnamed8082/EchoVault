"""
WeChat Parser - 微信聊天记录解析器
支持 WeChatMsg、PyWxDump、留痕等工具导出的格式
"""

import re
from dataclasses import dataclass
from typing import List, Dict, Optional, Any
from pathlib import Path
from datetime import datetime


@dataclass
class ChatMessage:
    """单条聊天消息"""
    timestamp: str
    sender: str
    content: str
    is_group: bool = False
    group_name: Optional[str] = None
    message_type: str = "text"


class WeChatParser:
    """微信聊天记录解析器"""
    
    def __init__(self):
        self.messages: List[ChatMessage] = []
    
    def parse_txt(self, file_path: Path) -> List[ChatMessage]:
        """解析 TXT 格式（WeChatMsg/留痕导出）"""
        content = file_path.read_text(encoding="utf-8")
        messages = []
        
        # 尝试匹配常见的时间戳格式
        # 格式1: 2024-01-01 12:00:00 用户名: 内容
        pattern1 = re.compile(
            r'(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+([^:]+):\s+(.*?)(?=\n\d{4}-\d{2}-\d{2}|\Z)',
            re.DOTALL
        )
        
        # 格式2: 2024/01/01 12:00:00 用户名: 内容
        pattern2 = re.compile(
            r'(\d{4}/\d{2}/\d{2}\s+\d{2}:\d{2}:\d{2})\s+([^:]+):\s+(.*?)(?=\n\d{4}/\d{2}/\d{2}|\Z)',
            re.DOTALL
        )
        
        for pattern in [pattern1, pattern2]:
            matches = pattern.findall(content)
            if matches:
                for match in matches:
                    msg = ChatMessage(
                        timestamp=match[0],
                        sender=match[1].strip(),
                        content=match[2].strip()
                    )
                    messages.append(msg)
                break
        
        self.messages.extend(messages)
        return messages
    
    def parse_csv(self, file_path: Path) -> List[ChatMessage]:
        """解析 CSV 格式（PyWxDump 导出）"""
        import csv
        
        messages = []
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # 尝试识别常见的列名
                timestamp = row.get('时间', row.get('timestamp', ''))
                sender = row.get('发送者', row.get('sender', ''))
                content = row.get('内容', row.get('content', ''))
                
                if content:
                    msg = ChatMessage(
                        timestamp=timestamp,
                        sender=sender,
                        content=content
                    )
                    messages.append(msg)
        
        self.messages.extend(messages)
        return messages
    
    def parse_html(self, file_path: Path) -> List[ChatMessage]:
        """解析 HTML 格式"""
        from bs4 import BeautifulSoup
        
        content = file_path.read_text(encoding="utf-8")
        soup = BeautifulSoup(content, 'html.parser')
        messages = []
        
        # 尝试找到消息元素
        message_elements = soup.find_all(class_=re.compile(r'message|msg'))
        if not message_elements:
            message_elements = soup.find_all('div', {'role': 'listitem'})
        
        for elem in message_elements:
            try:
                timestamp_elem = elem.find(class_=re.compile(r'time|date'))
                sender_elem = elem.find(class_=re.compile(r'sender|name'))
                content_elem = elem.find(class_=re.compile(r'content|text'))
                
                if content_elem:
                    msg = ChatMessage(
                        timestamp=timestamp_elem.get_text(strip=True) if timestamp_elem else '',
                        sender=sender_elem.get_text(strip=True) if sender_elem else '',
                        content=content_elem.get_text(strip=True)
                    )
                    messages.append(msg)
            except:
                continue
        
        self.messages.extend(messages)
        return messages
    
    def parse(self, file_path: Path) -> List[ChatMessage]:
        """自动识别格式并解析"""
        suffix = file_path.suffix.lower()
        
        if suffix == '.txt':
            return self.parse_txt(file_path)
        elif suffix == '.csv':
            return self.parse_csv(file_path)
        elif suffix in ['.html', '.htm']:
            return self.parse_html(file_path)
        else:
            # 尝试作为 TXT 解析
            return self.parse_txt(file_path)
    
    def get_conversation_summary(self, user_name: Optional[str] = None) -> Dict[str, Any]:
        """获取对话摘要"""
        if not self.messages:
            return {"total_messages": 0}
        
        senders = {}
        for msg in self.messages:
            senders[msg.sender] = senders.get(msg.sender, 0) + 1
        
        time_range = {
            "start": self.messages[0].timestamp,
            "end": self.messages[-1].timestamp
        }
        
        return {
            "total_messages": len(self.messages),
            "senders": senders,
            "time_range": time_range,
            "user_name": user_name,
        }
    
    def export_for_analysis(self, output_path: Path):
        """导出为分析用的格式"""
        import json
        
        data = {
            "messages": [
                {
                    "timestamp": m.timestamp,
                    "sender": m.sender,
                    "content": m.content
                }
                for m in self.messages
            ],
            "summary": self.get_conversation_summary()
        }
        
        output_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
