import boto3

textract = boto3.client("textract", region_name="ap-northeast-2")


def extract_text_from_s3(bucket: str, key: str) -> str:

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
                lines.append(text)

    return "\n".join(lines)