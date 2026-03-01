import pytesseract
from PIL import Image

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

def extract_text(file_obj):
    image = Image.open(file_obj)
    return pytesseract.image_to_string(image, lang="kor+eng")