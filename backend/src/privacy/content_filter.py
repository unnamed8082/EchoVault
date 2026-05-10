import re


class ContentFilter:

    def __init__(self):
        self._patterns = [
            re.compile(
                r"(自杀|自残|自伤|自尽|轻生|结束生命|不想活|活不下去|"
                r"suicide|self[\-\s]?harm|kill\s+myself|end\s+my\s+life|"
                r"不想活了|想死|去死|死了算了|割腕|跳楼)",
                re.IGNORECASE,
            ),
            re.compile(
                r"(杀[人他她它你我]|砍人|捅人|伤害他人|制造炸弹|持刀|枪击|"
                r"murder|kill\s+someone|stab|shoot|bomb|weapon|"
                r"报复社会|恐怖袭击|施暴|家暴)",
                re.IGNORECASE,
            ),
            re.compile(
                r"(色情|裸体|性行为|性交|做爱|黄片|AV|"
                r"porn|nude|explicit\s+sexual|xxx|"
                r"嫖|卖淫|淫秽)",
                re.IGNORECASE,
            ),
        ]

    def check_content(self, text: str) -> dict:
        if not text:
            return {"safe": True, "reason": "", "filtered_text": text}

        filtered = text
        triggered = False
        reasons = []

        self_harm_kw = [
            "自杀", "自残", "自伤", "自尽", "轻生", "结束生命",
            "不想活", "活不下去", "suicide", "self-harm", "self harm",
            "kill myself", "end my life", "不想活了", "想死", "去死",
            "死了算了", "割腕", "跳楼",
        ]
        violence_kw = [
            "杀人", "砍人", "捅人", "伤害他人", "制造炸弹", "持刀", "枪击",
            "murder", "kill someone", "stab", "shoot", "bomb",
            "报复社会", "恐怖袭击", "施暴", "家暴",
        ]
        explicit_kw = [
            "色情", "裸体", "性行为", "性交", "做爱", "黄片",
            "porn", "nude", "explicit sexual", "xxx",
            "嫖", "卖淫", "淫秽",
        ]

        all_keywords = self_harm_kw + violence_kw + explicit_kw

        for kw in all_keywords:
            pattern = re.compile(re.escape(kw), re.IGNORECASE)
            if pattern.search(text):
                triggered = True
                filtered = pattern.sub("***", filtered)

        if not triggered:
            for pat in self._patterns:
                if pat.search(text):
                    triggered = True
                    filtered = pat.sub("***", filtered)

        if triggered:
            reasons.append("harmful content detected")

        return {
            "safe": not triggered,
            "reason": "; ".join(reasons),
            "filtered_text": filtered,
        }
