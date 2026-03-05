import pytesseract
from PIL import Image


def extract_text(file_obj):
    image = Image.open(file_obj)
    text = pytesseract.image_to_string(image, lang="kor+eng")
    return text