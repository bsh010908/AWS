FROM python:3.11-slim

WORKDIR /app

# 🔥 Tesseract OCR 설치 (한국어 + 영어)
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-kor \
    tesseract-ocr-eng \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

# requirements 먼저 복사 (캐시 최적화)
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# 전체 코드 복사
COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]