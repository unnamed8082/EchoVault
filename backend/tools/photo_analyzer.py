"""
Photo Analyzer - 照片元信息分析器
提取照片 EXIF 数据，分析时间线和可能的约会记录
"""

from dataclasses import dataclass
from typing import List, Dict, Optional, Any, Tuple
from pathlib import Path
from datetime import datetime


@dataclass
class PhotoInfo:
    """照片信息"""
    file_path: str
    timestamp: Optional[str] = None
    location: Optional[Tuple[float, float]] = None  # (lat, lng)
    location_name: Optional[str] = None
    camera: Optional[str] = None
    people_count: int = 0


class PhotoAnalyzer:
    """照片分析器"""
    
    def __init__(self):
        self.photos: List[PhotoInfo] = []
    
    def extract_exif(self, file_path: Path) -> Dict[str, Any]:
        """提取 EXIF 数据"""
        try:
            from PIL import Image
            from PIL.ExifTags import TAGS, GPSTAGS
            
            exif_data = {}
            
            with Image.open(file_path) as img:
                exif = img._getexif()
                
                if exif:
                    for tag_id, value in exif.items():
                        tag = TAGS.get(tag_id, tag_id)
                        
                        if tag == 'GPSInfo':
                            gps_data = {}
                            for gps_tag_id, gps_value in value.items():
                                gps_tag = GPSTAGS.get(gps_tag_id, gps_tag_id)
                                gps_data[gps_tag] = gps_value
                            exif_data[tag] = gps_data
                        else:
                            exif_data[tag] = value
            
            return exif_data
        except ImportError:
            return {}
        except Exception:
            return {}
    
    def _convert_to_degrees(self, value) -> float:
        """将 GPS 坐标转换为十进制度数"""
        d, m, s = value
        return d + (m / 60.0) + (s / 3600.0)
    
    def get_location(self, exif_data: Dict) -> Optional[Tuple[float, float]]:
        """从 EXIF 中获取经纬度"""
        if 'GPSInfo' not in exif_data:
            return None
        
        gps_info = exif_data['GPSInfo']
        
        try:
            gps_latitude = gps_info.get('GPSLatitude')
            gps_latitude_ref = gps_info.get('GPSLatitudeRef')
            gps_longitude = gps_info.get('GPSLongitude')
            gps_longitude_ref = gps_info.get('GPSLongitudeRef')
            
            if gps_latitude and gps_latitude_ref and gps_longitude and gps_longitude_ref:
                lat = self._convert_to_degrees(gps_latitude)
                if gps_latitude_ref != 'N':
                    lat = -lat
                
                lng = self._convert_to_degrees(gps_longitude)
                if gps_longitude_ref != 'E':
                    lng = -lng
                
                return (lat, lng)
        except:
            pass
        
        return None
    
    def get_timestamp(self, exif_data: Dict) -> Optional[str]:
        """从 EXIF 中获取时间戳"""
        timestamp_fields = ['DateTime', 'DateTimeOriginal', 'DateTimeDigitized']
        
        for field in timestamp_fields:
            if field in exif_data:
                return str(exif_data[field])
        
        return None
    
    def analyze_photo(self, file_path: Path) -> PhotoInfo:
        """分析单张照片"""
        exif_data = self.extract_exif(file_path)
        
        photo = PhotoInfo(
            file_path=str(file_path),
            timestamp=self.get_timestamp(exif_data),
            location=self.get_location(exif_data),
            camera=exif_data.get('Model', exif_data.get('Make', '')),
        )
        
        # 如果没有 EXIF 时间，尝试从文件名提取
        if not photo.timestamp:
            # 常见格式: IMG_20240101_120000.jpg
            filename = file_path.name
            time_match = None
            
            patterns = [
                r'(\d{4})(\d{2})(\d{2})',
                r'(\d{4})-(\d{2})-(\d{2})',
                r'(\d{4})_(\d{2})_(\d{2})',
            ]
            
            for pattern in patterns:
                time_match = re.search(pattern, filename)
                if time_match:
                    photo.timestamp = f"{time_match.group(1)}-{time_match.group(2)}-{time_match.group(3)}"
                    break
        
        self.photos.append(photo)
        return photo
    
    def analyze_directory(self, dir_path: Path) -> Dict[str, Any]:
        """分析整个目录的照片"""
        self.photos = []
        
        # 支持的图片格式
        extensions = ['.jpg', '.jpeg', '.png', '.heic', '.heif']
        
        for ext in extensions:
            for file_path in dir_path.glob(f"*{ext}"):
                self.analyze_photo(file_path)
        
        # 构建时间线
        timeline = []
        locations = []
        
        for photo in self.photos:
            if photo.timestamp:
                timeline.append({
                    "timestamp": photo.timestamp,
                    "file": photo.file_path,
                    "location": photo.location,
                })
            if photo.location:
                locations.append(photo.location)
        
        # 按时间排序
        timeline.sort(key=lambda x: x["timestamp"])
        
        # 检测可能的约会（同一天不同时间的多个地点）
        date_groups = {}
        for item in timeline:
            date = item["timestamp"].split()[0] if " " in item["timestamp"] else item["timestamp"]
            if date not in date_groups:
                date_groups[date] = []
            date_groups[date].append(item)
        
        potential_dates = []
        for date, items in date_groups.items():
            if len(items) >= 2:
                potential_dates.append({
                    "date": date,
                    "photo_count": len(items),
                    "photos": items
                })
        
        return {
            "total_photos": len(self.photos),
            "timeline": timeline,
            "locations": locations,
            "potential_dates": potential_dates,
        }
