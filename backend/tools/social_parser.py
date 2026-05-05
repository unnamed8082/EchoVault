"""
Social Parser - 社交媒体内容解析器
支持朋友圈、微博、小红书截图的 OCR 文本分析
"""

import re
from dataclasses import dataclass
from typing import List, Dict, Optional, Any
from pathlib import Path
from datetime import datetime


@dataclass
class SocialPost:
    """社交媒体帖子"""
    timestamp: str
    content: str
    images: List[str] = field(default_factory=list)
    platform: str = "unknown"
    likes: int = 0
    comments: List[str] = field(default_factory=list)


class SocialParser:
    """社交媒体内容解析器"""
    
    def __init__(self):
        self.posts: List[SocialPost] = []
    
    def extract_personality_traits(self, text: str) -> List[str]:
        """从文本中提取性格特征"""
        traits = []
        
        # 常用表达模式
        pattern_mapping = {
            r"我觉得|我认为|在我看来": ["有主见", "善于表达"],
            r"哈哈|哈哈哈|笑死": ["乐观", "幽默"],
            r"好累|不想动|宅": ["内向", "喜欢独处"],
            r"今天去了|打卡|旅行": ["喜欢探索", "热爱生活"],
            r"工作|加班|项目": ["工作狂", "有责任心"],
            r"学习|读书|看书": ["好学", "求知欲强"],
            r"想你|喜欢你|爱": ["重感情", "感性"],
        }
        
        for pattern, matches in pattern_mapping.items():
            if re.search(pattern, text):
                traits.extend(matches)
        
        return list(set(traits))
    
    def extract_topics(self, text: str) -> List[str]:
        """提取话题标签"""
        topics = re.findall(r'#([^#]+)#', text)
        return topics
    
    def extract_emotions(self, text: str) -> Dict[str, int]:
        """提取情感词"""
        emotion_keywords = {
            "开心": ["开心", "高兴", "快乐", "幸福"],
            "难过": ["难过", "伤心", "不开心", "郁闷"],
            "愤怒": ["生气", "愤怒", "无语", "醉了"],
            "期待": ["期待", "希望", "想要", "盼着"],
        }
        
        emotions = {}
        for emotion, keywords in emotion_keywords.items():
            count = 0
            for keyword in keywords:
                count += text.count(keyword)
            if count > 0:
                emotions[emotion] = count
        
        return emotions
    
    def parse_text_file(self, file_path: Path) -> List[SocialPost]:
        """解析文本文件（OCR 结果）"""
        content = file_path.read_text(encoding="utf-8")
        posts = []
        
        # 按空行分割可能的帖子
        raw_posts = re.split(r'\n\s*\n', content)
        
        for raw_post in raw_posts:
            raw_post = raw_post.strip()
            if not raw_post:
                continue
            
            # 尝试提取时间
            time_match = re.search(r'(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2})', raw_post)
            timestamp = time_match.group(1) if time_match else ""
            
            post = SocialPost(
                timestamp=timestamp,
                content=raw_post,
                platform="unknown"
            )
            posts.append(post)
        
        self.posts.extend(posts)
        return posts
    
    def parse_directory(self, dir_path: Path) -> Dict[str, Any]:
        """解析整个目录"""
        all_text = ""
        all_traits = []
        all_topics = []
        all_emotions = {}
        
        # 读取所有文本文件
        for file_path in dir_path.glob("*.txt"):
            self.parse_text_file(file_path)
        
        # 聚合分析
        for post in self.posts:
            all_text += post.content + "\n"
            traits = self.extract_personality_traits(post.content)
            all_traits.extend(traits)
            topics = self.extract_topics(post.content)
            all_topics.extend(topics)
            emotions = self.extract_emotions(post.content)
            for emo, count in emotions.items():
                all_emotions[emo] = all_emotions.get(emo, 0) + count
        
        # 统计特征频率
        trait_counts = {}
        for trait in all_traits:
            trait_counts[trait] = trait_counts.get(trait, 0) + 1
        
        sorted_traits = sorted(trait_counts.items(), key=lambda x: x[1], reverse=True)
        
        return {
            "total_posts": len(self.posts),
            "personality_traits": sorted_traits,
            "topics": list(set(all_topics)),
            "emotions": all_emotions,
            "all_text": all_text,
        }
