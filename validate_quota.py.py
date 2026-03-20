from supabase import create_client, Client

# Credentials
URL = "https://vcljwtfpqxipltsfosjj.supabase.co"
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjbGp3dGZwcXhpcGx0c2Zvc2pqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzM5NjE4MywiZXhwIjoyMDg4OTcyMTgzfQ.OU1GEpL1P-FgabjhBFFev8klCq6iHHFqH6lWcASjRts"

supabase: Client = create_client(URL, KEY)


def view_db_status():
    """
    Utility to display the current state of project quotas and usage.
    Helps verify the DB state before and after running validation tests.
    """
    print("=" * 55)
    print(" LIVE DATABASE RESOURCE OVERVIEW ")
    print("=" * 55)

    try:
        # Fetch limits and live usage
        quotas = supabase.table("project_quotas").select("*").execute()
        containers = supabase.table("containers").select("*").execute()

        print(f"{'Project ID':<15} | {'Max Quota':<10} | {'Current Usage'}")
        print("-" * 55)

        for q in quotas.data:
            p_id = q["project_id"]
            max_q = q["max_containers"]
            # Calculate current usage from the containers table
            usage = sum(1 for c in containers.data if c["project_id"] == p_id)
            print(f"{p_id:<15} | {max_q:<10} | {usage}")

    except Exception as e:
        print(f"Error fetching DB status: {e}")

    print("=" * 55 + "\n")


def validate_quota(project_id, requested_containers):
    """
    Validates limits against the live Supabase DB provided by Team A11.
    My primary task and testing Mannan's script.
    """
    try:
        # 1. Fetch Max Limit (From project_quotas table)
        quota_res = (
            supabase.table("project_quotas")
            .select("max_containers")
            .eq("project_id", project_id)
            .execute()
        )

        if not quota_res.data:
            return {
                "status": "error",
                "code": 404,
                "message": f"Project '{project_id}' not found.",
            }

        max_limit = quota_res.data[0]["max_containers"]

        # 2. Fetch Live Usage (From containers table)
        usage_res = (
            supabase.table("containers")
            .select("id", count="exact")
            .eq("project_id", project_id)
            .execute()
        )
        current_running = usage_res.count if usage_res.count is not None else 0

        # 3. Quota Logic (Step 1 Breakdown)
        if (current_running + requested_containers) > max_limit:
            return {
                "status": "error",
                "code": 403,
                "message": f"Quota Exceeded. {current_running}/{max_limit} used. Cannot add {requested_containers}.",
            }

        return {
            "status": "success",
            "code": 200,
            "message": f"Validation Passed. New total: {current_running + requested_containers}/{max_limit}.",
        }

    except Exception as e:
        return {
            "status": "error",
            "code": 500,
            "message": f"Internal Server Error: {str(e)}",
        }


# --- INTEGRATED TEST CASES FOR DEMO ---
if __name__ == "__main__":
    # Display the database state first
    view_db_status()

    print("--- Team A10: Phase 1 Validation Suite ---\n")

    # Case 1: Failure - Project 1 is already at 3/3
    print("Scenario 1: project_1 requests 1 more container...")
    print(validate_quota("project_1", 1))

    # Case 2: Success - Project 2 has 0/5 used
    print("\nScenario 2: project_2 requests 2 containers...")
    print(validate_quota("project_2", 2))

    # Case 3: Edge Case - Project 3 has 0/2 used but requests 3
    print("\nScenario 3: project_3 requests 3 containers (Over Limit)...")
    print(validate_quota("project_3", 3))

    # Case 4: Error - Project doesn't exist
    print("\nScenario 4: Request for non-existent project...")
    print(validate_quota("project_999", 1))
