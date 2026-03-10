import boto3

textract = boto3.client("textract", region_name="ap-northeast-2")


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

        # 신뢰도 필터
        if confidence < 80:
            continue

        print(f"OCR LINE ({confidence:.1f}%):", text)

        lines.append(text)

    result = "\n".join(lines)

    print("===== OCR RESULT =====")
    print(result)
    print("======================")

    return result