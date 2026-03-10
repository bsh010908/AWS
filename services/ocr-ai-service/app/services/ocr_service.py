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

    # fallback 조건
    if len(result) < 15 or "III" in result or "[Web]" in result:
        result = fallback_ocr(bucket, key)

    return result