import boto3
import pytesseract
from PIL import Image
import requests
import io

textract = boto3.client("textract", region_name="ap-northeast-2")


def fallback_ocr(bucket: str, key: str) -> str:
    print("⚠ Textract 결과 이상 → Tesseract fallback 실행")

    url = f"https://{bucket}.s3.amazonaws.com/{key}"

    response = requests.get(url)
    image = Image.open(io.BytesIO(response.content))

    text = pytesseract.image_to_string(image, lang="kor+eng")

    print("===== TESSERACT RESULT =====")
    print(text)
    print("============================")

    return text


def korean_ratio(text: str) -> float:
    korean = sum(1 for c in text if "가" <= c <= "힣")
    return korean / max(len(text), 1)


def extract_text_from_s3(bucket: str, key: str) -> str:
    print("===== TEXTRACT START =====")
    print("S3 Bucket:", bucket)
    print("S3 Key:", key)

    response = textract.detect_document_text(
        Document={
            "S3Object": {
                "Bucket": bucket,
                "Name": key,
            }
        }
    )

    lines = []

    for block in response.get("Blocks", []):
        if block.get("BlockType") != "LINE":
            continue

        text = block.get("Text", "").strip()
        confidence = block.get("Confidence", 0)

        if not text:
            continue

        print(f"OCR LINE ({confidence:.1f}%):", text)
        lines.append(text)

    result = "\n".join(lines)

    print("===== OCR RESULT =====")
    print(result)
    print("======================")

    # OCR 품질 검사
    line_count = len(lines)
    kr_ratio = korean_ratio(result)

    if line_count <= 2 or kr_ratio < 0.05:
        print("⚠ OCR 품질 낮음 → Tesseract fallback 실행")
        result = fallback_ocr(bucket, key)

    return result