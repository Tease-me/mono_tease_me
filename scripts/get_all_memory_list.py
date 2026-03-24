import argparse
import asyncio
import sys
from pathlib import Path

# Ensure project root is on sys.path when run as a file path.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


async def run_with_summary(
    user_id: int,
    influencer_id: str,
    summarize: bool,
    summary_model: str,
) -> int:
    try:
        from app.agents.memory import get_all_memory_list, get_summarized_memories
        from app.core.session import SessionLocal

        async with SessionLocal() as db:
            memories = await get_all_memory_list(db, user_id, influencer_id)
            summary = ""
            if summarize and memories:
                summary = await get_summarized_memories(
                    db,
                    user_id=user_id,
                    influencer_id=influencer_id,
                    model=summary_model,
                )
    except Exception as exc:
        print(f"Error: failed to fetch memories: {exc}")
        return 1

    print(f"user_id={user_id} influencer_id={influencer_id} count={len(memories)}")
    if not memories:
        print("(no memories found)")
        return 0

    for idx, content in enumerate(memories, start=1):
        print(f"{idx}. {content}")

    if summarize:
        print("\n--- LLM Summary ---")
        if memories:
            print(summary)
        else:
            print("No memories available to summarize.")

    return 0


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Print all memories/messages for a user-influencer pair"
    )
    parser.add_argument("--user-id", type=int, required=True, help="User ID")
    parser.add_argument(
        "--influencer-id",
        type=str,
        required=True,
        help="Influencer ID",
    )
    parser.add_argument(
        "--summary-model",
        type=str,
        default="gpt-4o-mini",
        help="OpenAI model for summary (default: gpt-4o-mini)",
    )
    parser.add_argument(
        "--summarize",
        dest="summarize",
        action="store_true",
        help="Generate LLM summary after printing list (default: on)",
    )
    parser.add_argument(
        "--no-summarize",
        dest="summarize",
        action="store_false",
        help="Skip LLM summary and print only list",
    )
    parser.set_defaults(summarize=True)
    args = parser.parse_args()

    try:
        exit_code = asyncio.run(
            run_with_summary(
                args.user_id,
                args.influencer_id,
                summarize=args.summarize,
                summary_model=args.summary_model,
            )
        )
    except KeyboardInterrupt:
        print("Cancelled.")
        exit_code = 1
    except Exception as exc:
        print(f"Error: {exc}")
        exit_code = 1

    raise SystemExit(exit_code)


if __name__ == "__main__":
    main()
