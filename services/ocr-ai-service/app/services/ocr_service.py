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
        if block["BlockType"] == "LINE":
            text = block.get("Text", "").strip()
            if text:
                print("OCR LINE:", text)   # ⭐ 여기
                lines.append(text)

    result = "\n".join(lines)

    print("===== OCR RESULT =====")
    print(result)
    print("======================")

    return result