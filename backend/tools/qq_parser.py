"""
QQ Parser - QQ 聊天记录解析器
支持 TXT、MHT 格式
"""

import re
from dataclasses import dataclass
from typing import List, Dict, Optional, Any
from pathlib import Path
import quopri
import html


@dataclass
class QQChatMessage:
    """QQ 单条聊天消息"""
    timestamp: str
    sender: str
    sender_qq: Optional[str] = None
    content: str
    is_group: bool = False
    group_name: Optional[str] = None


class QQParser:
    """QQ 聊天记录解析器"""
    
    def __init__(self):
        self.messages: List[QQChatMessage] = []
    
    def parse_txt(self, file_path: Path) -> List[QQChatMessage]:
        """解析 TXT 格式（QQ 导出）"""
        content = file_path.read_text(encoding="utf-8")
        messages = []
        
        # QQ TXT 格式: 2024-01-01 12:00:00 用户名(123456)
        pattern = re.compile(
            r'(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+([^(]+)\((\d+)\)\s*\n(.*?)(?=\n\d{4}-\d{2}-\d{2}|\Z)',
            re.DOTALL
        )
        
        matches = pattern.findall(content)
        for match in matches:
            msg = QQChatMessage(
                timestamp=match[0],
                sender=match[1].strip(),
                sender_qq=match[2],
                content=match[3].strip()
            )
            messages.append(msg)
        
        self.messages.extend(messages)
        return messages
    
    def parse_mht(self, file_path: Path) -> List[QQChatMessage]:
        """解析 MHT 格式（QQ 导出）"""
        content = file_path.read_text(encoding="gbk", errors="ignore")
        messages = []
        
        # MHT 是多部分格式，需要解码 quoted-printable
        # 先找 HTML 部分
        html_start = content.find('<html')
        html_end = content.rfind('</html>')
        
        if html_start != -1 and html_end != -1:
            html_content = content[html_start:html_end + 7]
            
            # 解码 quoted-printable
            try:
                decoded = quopri.decodestring(html_content)
                html_content = decoded.decode('gbk', errors='ignore')
            except:
                pass
            
            # 解析 HTML
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # 找消息表格
            tables = soup.find_all('table')
            for table in tables:
                rows = table.find_all('tr')
                for i in range(0, len(rows), 2):
                    if i + 1 >= len(rows):
                        continue
                    
                    try:
                        header_row = rows[i]
                        content_row = rows[i + 1]
                        
                        # 提取时间和发送者
                        header_text = header_row.get_text(strip=True)
                        time_match = re.search(r'(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})', header_text)
                        
                        if time_match:
                            timestamp = time_match.group(1)
                            
                            # 提取发送者
                            sender_match = re.search(r'([^\s]+)\s*\(\d+\)', header_text)
                            sender = sender_match.group(1) if sender_match else ""
                            
                            # 提取内容
                            msg_content = content_row.get_text(strip=True)
                            
                            if msg_content:
                                msg = QQChatMessage(
                                    timestamp=timestamp,
                                    sender=sender,
                                    content=msg_content
                                )
                                messages.append(msg)
                    except:
                        continue
        
        self.messages.extend(messages)
        return messages
    
    def parse(self, file_path: Path) -> List[QQChatMessage]:
        """自动识别格式并解析"""
        suffix = file_path.suffix.lower()
        
        if suffix == '.txt':
            return self.parse_txt(file_path)
        elif suffix in ['.mht', '.mhtml']:
            return self.parse_mht(file_path)
        else:
            return self.parse_txt(file_path)
    
    def get_conversation_summary(self) -> Dict[str, Any]:
        """获取对话摘要"""
        if not self.messages:
            return {"total_messages": 0}
        
        senders = {}
        for msg in self.messages:
            senders[msg.sender] = senders.get(msg.sender, 0) + 1
        
        return {
            "total_messages": len(self.messages),
            "senders": senders,
        }
