import argparse
import asyncio
import os
import sys

from sqlalchemy import select

# Ensure app is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.models import Influencer, InfluencerCreditTransaction, InfluencerWallet, User
from app.db.session import SessionLocal


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Insert fake wallet top-up data for an existing user and influencer."
    )
    parser.add_argument("--user-id", type=int, required=True, help="Existing user id")
    parser.add_argument(
        "--influencer-id",
        type=str,
        required=True,
        help="Existing influencer id",
    )
    parser.add_argument(
        "--cents",
        type=int,
        required=True,
        help="Positive number of cents to credit",
    )
    parser.add_argument(
        "--is-18",
        action="store_true",
        help="Credit the 18+ wallet instead of the default wallet",
    )
    parser.add_argument(
        "--source",
        type=str,
        default="fake_script",
        help="Source label to store in transaction meta",
    )
    return parser


async def fake_topup(
    *,
    user_id: int,
    influencer_id: str,
    cents: int,
    is_18: bool,
    source: str,
) -> None:
    if cents <= 0:
        raise ValueError("--cents must be a positive integer")

    async with SessionLocal() as db:
        user = await db.get(User, user_id)
        if not user:
            raise ValueError(f"User not found: {user_id}")

        influencer = await db.get(Influencer, influencer_id)
        if not influencer:
            raise ValueError(f"Influencer not found: {influencer_id}")

        wallet = await db.scalar(
            select(InfluencerWallet).where(
                InfluencerWallet.user_id == user_id,
                InfluencerWallet.influencer_id == influencer_id,
                InfluencerWallet.is_18.is_(is_18),
            )
        )

        previous_balance = 0
        if not wallet:
            wallet = InfluencerWallet(
                user_id=user_id,
                influencer_id=influencer_id,
                is_18=is_18,
                balance_cents=0,
            )
            db.add(wallet)
            await db.flush()
        else:
            previous_balance = int(wallet.balance_cents or 0)

        wallet.balance_cents = previous_balance + cents
        db.add(wallet)

        tx = InfluencerCreditTransaction(
            user_id=user_id,
            influencer_id=influencer_id,
            feature="topup",
            units=cents,
            amount_cents=cents,
            meta={
                "source": source,
                "script": "fake_topup",
            },
        )
        db.add(tx)

        await db.commit()
        await db.refresh(wallet)
        await db.refresh(tx)

        print("Fake wallet top-up created.")
        print(f"user_id={user_id}")
        print(f"influencer_id={influencer_id}")
        print(f"is_18={is_18}")
        print(f"credited_cents={cents}")
        print(f"previous_balance_cents={previous_balance}")
        print(f"new_balance_cents={int(wallet.balance_cents or 0)}")
        print(f"transaction_id={tx.id}")


async def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    await fake_topup(
        user_id=args.user_id,
        influencer_id=args.influencer_id,
        cents=args.cents,
        is_18=args.is_18,
        source=args.source,
    )


if __name__ == "__main__":
    asyncio.run(main())
