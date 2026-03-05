# AWS

uvicorn app.main:app --reload --host 0.0.0.0 --port 8001

pip freeze > requirements.txt

stripe listen --forward-to http://localhost:8001/billing/webhook

docker compose up --build
docker compose down -v