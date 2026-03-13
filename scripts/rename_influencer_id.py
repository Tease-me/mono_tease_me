import argparse
import asyncio
import sys
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

# Ensure project root is on sys.path when run as a file path.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.core.config import settings
from app.db.models import (
    ApiUsageLog,
    CallRecord,
    Chat,
    Chat18,
    ContentViolation,
    Influencer,
    InfluencerCreditTransaction,
    InfluencerFollower,
    InfluencerKnowledgeChunk,
    InfluencerKnowledgeDocument,
    InfluencerKnowledgeSync,
    InfluencerSubscription,
    InfluencerSubscriptionAddonPurchase,
    InfluencerSubscriptionPayment,
    InfluencerWallet,
    PayPalTopUp,
    ReEngagementLog,
    RelationshipState,
)
from app.db.session import SessionLocal
from app.utils.storage.s3 import s3


@dataclass(frozen=True)
class TableUpdateSpec:
    name: str
    model: type[Any]
    column_name: str


@dataclass(frozen=True)
class S3Move:
    old_key: str
    new_key: str
    required: bool = False


@dataclass
class S3MigrationPlan:
    moves: list[S3Move]
    profile_photo_key: str | None
    profile_video_key: str | None
    samples: list[dict] | None


TABLE_UPDATE_SPECS: tuple[TableUpdateSpec, ...] = (
    TableUpdateSpec("influencer_followers", InfluencerFollower, "influencer_id"),
    TableUpdateSpec("chats", Chat, "influencer_id"),
    TableUpdateSpec("chats_18", Chat18, "influencer_id"),
    TableUpdateSpec("calls", CallRecord, "influencer_id"),
    TableUpdateSpec("content_violations", ContentViolation, "influencer_id"),
    TableUpdateSpec("re_engagement_logs", ReEngagementLog, "influencer_id"),
    TableUpdateSpec("relationship_state", RelationshipState, "influencer_id"),
    TableUpdateSpec("api_usage_logs", ApiUsageLog, "influencer_id"),
    TableUpdateSpec("influencer_wallets", InfluencerWallet, "influencer_id"),
    TableUpdateSpec("influencer_credit_transactions", InfluencerCreditTransaction, "influencer_id"),
    TableUpdateSpec("influencer_subscriptions", InfluencerSubscription, "influencer_id"),
    TableUpdateSpec(
        "influencer_subscription_addon_purchases",
        InfluencerSubscriptionAddonPurchase,
        "influencer_id",
    ),
    TableUpdateSpec(
        "influencer_subscription_payments",
        InfluencerSubscriptionPayment,
        "influencer_id",
    ),
    TableUpdateSpec("paypal_topups", PayPalTopUp, "influencer_id"),
    TableUpdateSpec("influencer_knowledge_documents", InfluencerKnowledgeDocument, "influencer_id"),
    TableUpdateSpec("influencer_knowledge_chunks", InfluencerKnowledgeChunk, "influencer_id"),
    TableUpdateSpec("influencer_knowledge_sync", InfluencerKnowledgeSync, "influencer_id"),
)


def rewrite_s3_key(key: str | None, old_id: str, new_id: str) -> str | None:
    if not key:
        return key

    prefixes = (
        f"{settings.INFLUENCER_PREFIX}/{old_id}/",
        f"influencer-audio/{old_id}/",
        f"samples/{old_id}/",
    )
    replacements = (
        f"{settings.INFLUENCER_PREFIX}/{new_id}/",
        f"influencer-audio/{new_id}/",
        f"samples/{new_id}/",
    )

    for old_prefix, new_prefix in zip(prefixes, replacements, strict=True):
        if key.startswith(old_prefix):
            return f"{new_prefix}{key[len(old_prefix):]}"
    return key


def rewrite_samples(samples: list[dict] | None, old_id: str, new_id: str) -> list[dict] | None:
    if samples is None:
        return None

    rewritten: list[dict] = []
    for sample in samples:
        new_sample = dict(sample)
        s3_key = sample.get("s3_key")
        if isinstance(s3_key, str):
            new_sample["s3_key"] = rewrite_s3_key(s3_key, old_id, new_id)
        rewritten.append(new_sample)
    return rewritten


def list_influencer_update_specs() -> tuple[TableUpdateSpec, ...]:
    return TABLE_UPDATE_SPECS


def iter_required_s3_keys(influencer: Influencer, old_id: str, new_id: str) -> list[S3Move]:
    required: list[S3Move] = []
    for key in (influencer.profile_photo_key, influencer.profile_video_key):
        if not key:
            continue
        new_key = rewrite_s3_key(key, old_id, new_id)
        if new_key and new_key != key:
            required.append(S3Move(old_key=key, new_key=new_key, required=True))

    for sample in influencer.samples or []:
        sample_key = sample.get("s3_key")
        if not isinstance(sample_key, str):
            continue
        new_key = rewrite_s3_key(sample_key, old_id, new_id)
        if new_key and new_key != sample_key:
            required.append(S3Move(old_key=sample_key, new_key=new_key, required=True))

    deduped: dict[str, S3Move] = {}
    for move in required:
        existing = deduped.get(move.old_key)
        if existing is None or move.required:
            deduped[move.old_key] = move
    return list(deduped.values())


def build_s3_migration_plan(
    influencer: Influencer,
    old_id: str,
    new_id: str,
    discovered_keys: list[str],
) -> S3MigrationPlan:
    moves: dict[str, S3Move] = {}
    for key in discovered_keys:
        new_key = rewrite_s3_key(key, old_id, new_id)
        if new_key and new_key != key:
            moves[key] = S3Move(old_key=key, new_key=new_key, required=False)

    for move in iter_required_s3_keys(influencer, old_id, new_id):
        moves[move.old_key] = move

    return S3MigrationPlan(
        moves=sorted(moves.values(), key=lambda item: item.old_key),
        profile_photo_key=rewrite_s3_key(influencer.profile_photo_key, old_id, new_id),
        profile_video_key=rewrite_s3_key(influencer.profile_video_key, old_id, new_id),
        samples=rewrite_samples(influencer.samples, old_id, new_id),
    )


def list_s3_keys_for_prefix(s3_client: Any, bucket: str, prefix: str) -> list[str]:
    keys: list[str] = []
    continuation_token: str | None = None
    while True:
        params: dict[str, Any] = {"Bucket": bucket, "Prefix": prefix}
        if continuation_token:
            params["ContinuationToken"] = continuation_token
        resp = s3_client.list_objects_v2(**params)
        keys.extend(obj["Key"] for obj in resp.get("Contents", []))
        if not resp.get("IsTruncated"):
            break
        continuation_token = resp.get("NextContinuationToken")
    return keys


def discover_influencer_s3_keys(s3_client: Any, bucket: str, old_id: str) -> list[str]:
    prefixes = (
        f"{settings.INFLUENCER_PREFIX}/{old_id}/",
        f"influencer-audio/{old_id}/",
        f"samples/{old_id}/",
    )
    found: list[str] = []
    for prefix in prefixes:
        found.extend(list_s3_keys_for_prefix(s3_client, bucket, prefix))
    return sorted(set(found))


def apply_s3_plan(s3_client: Any, bucket: str, plan: S3MigrationPlan) -> list[str]:
    copied_keys: list[str] = []
    for move in plan.moves:
        s3_client.copy_object(
            Bucket=bucket,
            CopySource={"Bucket": bucket, "Key": move.old_key},
            Key=move.new_key,
        )
        copied_keys.append(move.new_key)
    return copied_keys


def cleanup_s3_keys(s3_client: Any, bucket: str, keys: list[str]) -> None:
    for key in keys:
        s3_client.delete_object(Bucket=bucket, Key=key)


def influencer_to_row_data(influencer: Influencer) -> dict[str, Any]:
    data: dict[str, Any] = {}
    for column in Influencer.__table__.columns:
        if column.name == "id":
            continue
        data[column.name] = getattr(influencer, column.name)
    return data


async def gather_reference_counts(db: AsyncSession, old_id: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for spec in TABLE_UPDATE_SPECS:
        model_column = getattr(spec.model, spec.column_name)
        count = await db.scalar(
            select(func.count()).select_from(spec.model).where(model_column == old_id)
        )
        counts[spec.name] = int(count or 0)
    return counts


async def update_reference_tables(db: AsyncSession, old_id: str, new_id: str) -> dict[str, int]:
    updated_counts: dict[str, int] = {}
    for spec in TABLE_UPDATE_SPECS:
        model_column = getattr(spec.model, spec.column_name)
        result = await db.execute(
            update(spec.model).where(model_column == old_id).values({spec.column_name: new_id})
        )
        updated_counts[spec.name] = int(result.rowcount or 0)
    return updated_counts


async def preflight(db: AsyncSession, old_id: str, new_id: str) -> tuple[Influencer, dict[str, int]]:
    influencer = await db.get(Influencer, old_id)
    if influencer is None:
        raise ValueError(f"Influencer '{old_id}' not found")

    existing = await db.get(Influencer, new_id)
    if existing is not None:
        raise ValueError(f"Influencer '{new_id}' already exists")

    counts = await gather_reference_counts(db, old_id)
    return influencer, counts


async def rename_influencer(
    db: AsyncSession,
    *,
    old_id: str,
    new_id: str,
    skip_s3: bool,
    s3_client: Any,
    bucket_name: str,
) -> dict[str, Any]:
    counts: dict[str, int] = {}
    s3_plan: S3MigrationPlan | None = None
    copied_keys: list[str] = []
    old_keys_to_delete: list[str] = []
    try:
        async with db.begin():
            influencer, counts = await preflight(db, old_id, new_id)
            discovered_keys = [] if skip_s3 else discover_influencer_s3_keys(s3_client, bucket_name, old_id)
            s3_plan = build_s3_migration_plan(influencer, old_id, new_id, discovered_keys)

            if skip_s3:
                next_profile_photo_key = influencer.profile_photo_key
                next_profile_video_key = influencer.profile_video_key
                next_samples = influencer.samples
            else:
                copied_keys = apply_s3_plan(s3_client, bucket_name, s3_plan)
                old_keys_to_delete = [move.old_key for move in s3_plan.moves]
                next_profile_photo_key = s3_plan.profile_photo_key
                next_profile_video_key = s3_plan.profile_video_key
                next_samples = s3_plan.samples

            row_data = influencer_to_row_data(influencer)
            if influencer.email:
                influencer.email = f"renamed-{uuid.uuid4()}-{influencer.email}"
                await db.flush()

            row_data["profile_photo_key"] = next_profile_photo_key
            row_data["profile_video_key"] = next_profile_video_key
            row_data["samples"] = next_samples

            replacement = Influencer(id=new_id, **row_data)
            db.add(replacement)
            await db.flush()

            updated_counts = await update_reference_tables(db, old_id, new_id)
            await db.execute(delete(Influencer).where(Influencer.id == old_id))
    except Exception:
        if copied_keys:
            cleanup_s3_keys(s3_client, bucket_name, copied_keys)
        raise

    if copied_keys:
        cleanup_s3_keys(s3_client, bucket_name, old_keys_to_delete)

    return {
        "old_id": old_id,
        "new_id": new_id,
        "reference_counts": counts,
        "updated_counts": updated_counts,
        "s3_moves": len(s3_plan.moves if s3_plan is not None else []),
        "s3_old_keys_deleted": len(old_keys_to_delete),
        "skip_s3": skip_s3,
    }


async def build_dry_run_report(
    db: AsyncSession,
    *,
    old_id: str,
    new_id: str,
    skip_s3: bool,
    s3_client: Any,
    bucket_name: str,
) -> dict[str, Any]:
    influencer, counts = await preflight(db, old_id, new_id)
    discovered_keys = [] if skip_s3 else discover_influencer_s3_keys(s3_client, bucket_name, old_id)
    s3_plan = build_s3_migration_plan(influencer, old_id, new_id, discovered_keys)
    return {
        "old_id": old_id,
        "new_id": new_id,
        "reference_counts": counts,
        "s3_moves": len(s3_plan.moves),
        "s3_move_pairs": [(move.old_key, move.new_key) for move in s3_plan.moves],
        "skip_s3": skip_s3,
    }


def print_report(report: dict[str, Any], *, dry_run: bool) -> None:
    mode = "DRY RUN" if dry_run else "EXECUTED"
    print(f"[{mode}] influencer rename {report['old_id']} -> {report['new_id']}")
    print("Reference counts:")
    for table_name, count in report["reference_counts"].items():
        print(f"  - {table_name}: {count}")
    if dry_run:
        print(f"S3 moves planned: {report['s3_moves']}")
        for old_key, new_key in report.get("s3_move_pairs", []):
            print(f"  - {old_key} -> {new_key}")
    else:
        print("Updated counts:")
        for table_name, count in report["updated_counts"].items():
            print(f"  - {table_name}: {count}")
        print(f"S3 moves completed: {report['s3_moves']}")
        print(f"S3 old keys deleted: {report['s3_old_keys_deleted']}")


async def _run(args: argparse.Namespace) -> int:
    async with SessionLocal() as db:
        if args.execute:
            report = await rename_influencer(
                db,
                old_id=args.old_id,
                new_id=args.new_id,
                skip_s3=args.skip_s3,
                s3_client=s3,
                bucket_name=settings.BUCKET_NAME,
            )
            print_report(report, dry_run=False)
            return 0

        report = await build_dry_run_report(
            db,
            old_id=args.old_id,
            new_id=args.new_id,
            skip_s3=args.skip_s3,
            s3_client=s3,
            bucket_name=settings.BUCKET_NAME,
        )
        print_report(report, dry_run=True)
        return 0


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Rename an influencer ID and update all references")
    parser.add_argument("--old-id", required=True, help="Current influencer ID")
    parser.add_argument("--new-id", required=True, help="Replacement influencer ID")
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Perform the rename. Without this flag the script runs in dry-run mode.",
    )
    parser.add_argument(
        "--skip-s3",
        action="store_true",
        help="Skip S3 key migration and only update relational DB references.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv)
    try:
        exit_code = asyncio.run(_run(args))
    except KeyboardInterrupt:
        print("Cancelled.")
        exit_code = 1
    except Exception as exc:
        print(f"Error: {exc}")
        exit_code = 1
    raise SystemExit(exit_code)


if __name__ == "__main__":
    main()
