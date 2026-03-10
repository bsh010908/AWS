import boto3
import uuid
from datetime import datetime

BUCKET = "aws-ledger-receipts"

s3 = boto3.client("s3")


def upload_receipt_to_s3(file):
    ext = file.filename.split(".")[-1].lower()
    key = f"receipts/{datetime.now().strftime('%Y/%m')}/{uuid.uuid4()}.{ext}"

    file.file.seek(0)

    s3.upload_fileobj(
        file.file,
        BUCKET,
        key,
        ExtraArgs={"ContentType": file.content_type},
    )

    return key