"""Usage limit checking and tracking"""

from datetime import datetime
from typing import cast
from fastapi import HTTPException
from ..database import get_supabase_client

# Type alias for user data from database
UserData = dict[str, str | int | bool | None]


async def check_usage_limit(user_id: str) -> bool:
    """Check if user can upload another document."""
    try:
        supabase = get_supabase_client()
        response = supabase.table("users").select("*").eq("id", user_id).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="User not found")

        user = cast(UserData, response.data[0])

        # Check if usage needs reset
        reset_date_str = cast(str, user["usage_reset_date"])
        usage_reset_date = datetime.fromisoformat(reset_date_str.replace("Z", "+00:00"))
        if datetime.now(usage_reset_date.tzinfo) >= usage_reset_date:
            _ = await reset_usage(user_id)
            return True

        # Check if under limit
        processed = cast(int, user["documents_processed_this_month"])
        limit = cast(int, user["documents_limit"])
        return processed < limit

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Usage check failed: {str(e)}")


async def increment_usage(user_id: str) -> bool:
    """Increment user's document count after successful upload."""
    try:
        supabase = get_supabase_client()
        response = supabase.table("users").select("documents_processed_this_month").eq("id", user_id).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="User not found")

        user_data = cast(UserData, response.data[0])
        current_count = cast(int, user_data["documents_processed_this_month"])

        _ = supabase.table("users").update({
            "documents_processed_this_month": current_count + 1
        }).eq("id", user_id).execute()

        return True

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Usage increment failed: {str(e)}")


async def reset_usage(user_id: str) -> bool:
    """Reset user's monthly usage counter."""
    try:
        supabase = get_supabase_client()

        # Calculate next reset date (1st of next month)
        now = datetime.now()
        if now.month == 12:
            next_month = now.replace(year=now.year + 1, month=1, day=1)
        else:
            next_month = now.replace(month=now.month + 1, day=1)

        _ = supabase.table("users").update({
            "documents_processed_this_month": 0,
            "usage_reset_date": next_month.date().isoformat()
        }).eq("id", user_id).execute()

        return True

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Usage reset failed: {str(e)}")


async def get_usage_stats(user_id: str) -> dict[str, str | int]:
    """Get user's current usage statistics."""
    try:
        supabase = get_supabase_client()
        response = supabase.table("users").select(
            "documents_processed_this_month, documents_limit, subscription_tier, usage_reset_date"
        ).eq("id", user_id).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="User not found")

        return cast(dict[str, str | int], response.data[0])

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get usage stats: {str(e)}")
