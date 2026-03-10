import boto3

textract = boto3.client("textract", region_name="ap-northeast-2")


def extract_text_from_s3(bucket: str, key: str) -> str:
    response = textract.analyze_expense(
        Document={
            "S3Object": {
                "Bucket": bucket,
                "Name": key,
            }
        }
    )

    lines = []

    for expense_doc in response.get("ExpenseDocuments", []):
        for field in expense_doc.get("SummaryFields", []):

            label = field.get("Type", {}).get("Text", "")
            value = field.get("ValueDetection", {}).get("Text", "")

            if label and value:
                lines.append(f"{label}: {value}")
            elif value:
                lines.append(value)

    return "\n".join(lines)