from openai import OpenAI, RateLimitError
from dotenv import load_dotenv
import os
import json
from datetime import datetime

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def classify_receipt(text: str):

    current_year = datetime.now().year

    prompt = f"""
    아래 영수증 텍스트를 분석해서 정보를 추출해라.

    카테고리:
    - 식비
    - 교통
    - 쇼핑
    - 의료
    - 공과금
    - 기타

    반드시 아래 JSON 형식으로만 응답해라:

    {{
        "category": "",
        "confidence": 0.0,
        "amount": 0,
        "merchant_name": "",
        "date": ""
    }}

    규칙:
    - merchant_name은 상호명만 작성하라.
    - amount는 최종 결제 금액이다.
    - date는 반드시 YYYY-MM-DD 형식으로 반환하라.
    - 영수증에 연도가 없으면 반드시 {current_year}년으로 반환하라.
    - 날짜가 전혀 없으면 빈 문자열 "" 로 반환하라.
    - confidence는 0~1 사이 숫자다.
    - JSON 외 다른 텍스트는 절대 출력하지 마라.

    영수증 텍스트:
    {text}
    """

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=180
        )

        content = response.choices[0].message.content.strip()

        # 코드블럭 제거
        if content.startswith("```"):
            content = content.replace("```json", "").replace("```", "").strip()

        data = json.loads(content)

        # 타입 정리
        data["amount"] = float(data.get("amount", 0))
        data["confidence"] = float(data.get("confidence", 0))
        data["merchant_name"] = data.get("merchant_name", "").strip()
        data["date"] = data.get("date", "").strip()

    except RateLimitError:
        print("⚠ OpenAI quota 초과 → 기타로 처리")

        data = {
            "category": "기타",
            "confidence": 0.0,
            "amount": 0,
            "merchant_name": "",
            "date": ""
        }

    except Exception as e:
        print("⚠ AI 분류 에러:", e)

        data = {
            "category": "기타",
            "confidence": 0.0,
            "amount": 0,
            "merchant_name": "",
            "date": ""
        }

    # 🔥 신뢰도 fallback
    if data["confidence"] < 0.7:
        data["category"] = "기타"

    return data