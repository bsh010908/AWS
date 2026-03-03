from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime
from calendar import monthrange

from app.models.transaction import Transaction
from app.models.category import Category

import os
from openai import OpenAI


# ===============================
# 공통 월 범위 계산
# ===============================
def _build_month_range(year: int, month: int):
    start_date = datetime(year, month, 1)

    if month == 12:
        end_date = datetime(year + 1, 1, 1)
    else:
        end_date = datetime(year, month + 1, 1)

    return start_date, end_date


# ===============================
# 월 요약
# ===============================
def get_monthly_summary(db: Session, current_user: dict, year: int, month: int):

    user_id = current_user["user_id"]
    plan = current_user["plan"]

    start_date, end_date = _build_month_range(year, month)

    # 현재 월 합계 + 건수
    current_summary = (
        db.query(
            func.coalesce(func.sum(Transaction.amount), 0).label("total"),
            func.count(Transaction.tx_id).label("count"),
        )
        .filter(Transaction.user_id == user_id)
        .filter(Transaction.occurred_at >= start_date)
        .filter(Transaction.occurred_at < end_date)
        .first()
    )

    total_amount = current_summary.total or 0
    tx_count = current_summary.count or 0

    # 최다 소비 카테고리
    top_category = (
        db.query(
            Category.name.label("category"),
            func.coalesce(func.sum(Transaction.amount), 0).label("total"),
        )
        .join(Transaction, Transaction.category_id == Category.category_id)
        .filter(Transaction.user_id == user_id)
        .filter(Transaction.occurred_at >= start_date)
        .filter(Transaction.occurred_at < end_date)
        .group_by(Category.name)
        .order_by(func.sum(Transaction.amount).desc())
        .first()
    )

    # ===============================
    # 🔥 평균 / 예상 소비 계산
    # ===============================
    now = datetime.now()

    if year == now.year and month == now.month:
        days_passed = now.day
    else:
        days_passed = monthrange(year, month)[1]

    last_day = monthrange(year, month)[1]

    avg_daily = round(total_amount / days_passed, 1) if days_passed > 0 else 0
    predicted_total = int(avg_daily * last_day)

    response = {
        "year": year,
        "month": month,
        "total_amount": total_amount,
        "transaction_count": tx_count,
        "avg_daily_amount": avg_daily,          # 🔥 추가
        "predicted_total": predicted_total,     # 🔥 추가
        "top_category": {
            "name": top_category.category if top_category else None,
            "amount": top_category.total if top_category else 0,
        },
    }

    # ===============================
    # 🔥 PRO 사용자 전월 비교
    # ===============================
    if plan == "PRO":

        if month == 1:
            prev_year = year - 1
            prev_month = 12
        else:
            prev_year = year
            prev_month = month - 1

        prev_start, prev_end = _build_month_range(prev_year, prev_month)

        prev_total = (
            db.query(func.coalesce(func.sum(Transaction.amount), 0))
            .filter(Transaction.user_id == user_id)
            .filter(Transaction.occurred_at >= prev_start)
            .filter(Transaction.occurred_at < prev_end)
            .scalar()
        )

        diff_amount = total_amount - prev_total

        if prev_total == 0:
            change_rate = 100.0 if total_amount > 0 else 0.0
        else:
            change_rate = round((diff_amount / prev_total) * 100, 1)

        response.update(
            {
                "last_month_total": prev_total,
                "diff_amount": diff_amount,
                "change_rate": change_rate,
            }
        )

    return response
# ===============================
# 카테고리 통계
# ===============================
def get_category_stats(db: Session, current_user: dict, year: int, month: int):

    user_id = current_user["user_id"]
    start_date, end_date = _build_month_range(year, month)

    results = (
        db.query(
            Category.name.label("category"),
            func.coalesce(func.sum(Transaction.amount), 0).label("total"),
        )
        .join(Transaction, Transaction.category_id == Category.category_id)
        .filter(Transaction.user_id == user_id)
        .filter(Transaction.occurred_at >= start_date)
        .filter(Transaction.occurred_at < end_date)
        .group_by(Category.name)
        .all()
    )

    total_sum = sum(row.total for row in results)

    return [
        {
            "category": row.category,
            "total_amount": row.total,
            "percentage": round((row.total / total_sum) * 100, 1)
            if total_sum > 0 else 0,
        }
        for row in results
        if row.total > 0
    ]


# ===============================
# 일별 통계
# ===============================
def get_daily_stats(db: Session, current_user: dict, year: int, month: int):

    user_id = current_user["user_id"]
    start_date, end_date = _build_month_range(year, month)

    results = (
        db.query(
            func.date(Transaction.occurred_at).label("date"),
            func.coalesce(func.sum(Transaction.amount), 0).label("total"),
        )
        .filter(Transaction.user_id == user_id)
        .filter(Transaction.occurred_at >= start_date)
        .filter(Transaction.occurred_at < end_date)
        .group_by(func.date(Transaction.occurred_at))
        .all()
    )

    result_map = {str(row.date): row.total for row in results}

    last_day = monthrange(year, month)[1]

    daily_list = []

    for day in range(1, last_day + 1):
        date_str = f"{year}-{month:02d}-{day:02d}"
        daily_list.append(
            {
                "date": date_str,
                "total_amount": result_map.get(date_str, 0),
            }
        )

    return daily_list


# ===============================
# 최근 거래
# ===============================
def get_recent_transactions(db: Session, current_user: dict, limit: int = 5):

    user_id = current_user["user_id"]

    transactions = (
        db.query(Transaction)
        .filter(Transaction.user_id == user_id)
        .order_by(desc(Transaction.occurred_at))
        .limit(limit)
        .all()
    )

    return [
        {
            "id": tx.tx_id,
            "amount": tx.amount,
            "category": tx.category.name if tx.category else None,
            "occurred_at": tx.occurred_at,
            "memo": tx.memo,
            "merchant_name": (
                tx.document.merchant_name
                if hasattr(tx, "document") and tx.document and tx.document.merchant_name
                else None
            ),
        }
        for tx in transactions
    ]

# ===============================
# 🔥 AI 소비 인사이트 생성
# ===============================
def generate_ai_insight(summary: dict):

    try:
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        prompt = f"""
        다음은 한 사용자의 월 소비 데이터입니다.

        총 지출: {summary.get("total_amount")}원
        전월 대비 증감액: {summary.get("diff_amount", 0)}원
        증감률: {summary.get("change_rate", 0)}%
        가장 많이 쓴 카테고리: {summary.get("top_category", {}).get("name")}

        위 데이터를 바탕으로 1~2문장으로 간단한 소비 분석을 작성해주세요.
        한국어로 자연스럽게 작성해주세요.
        """

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "당신은 가계부 소비 분석 전문가입니다."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.7,
            max_tokens=120,
        )

        return response.choices[0].message.content.strip()

    except Exception as e:
        print("AI insight error:", e)
        return None

# ===============================
# 대시보드 통합 
# ===============================
def get_dashboard_overview(db: Session, current_user: dict, year: int, month: int):

    summary = get_monthly_summary(db, current_user, year, month)
    category = get_category_stats(db, current_user, year, month)
    daily = get_daily_stats(db, current_user, year, month)
    recent = get_recent_transactions(db, current_user)

    return {
        "summary": summary,
        "category_chart": category,
        "daily_chart": daily,
        "recent_transactions": recent,
    }