import os
from supabase import create_client, Client

# --- DATABASE CONNECTION SECRETS ---
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://csvlbbeetlvfiqutimcj.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzdmxiYmVldGx2ZmlxdXRpbWNqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQyMTU4MiwiZXhwIjoyMDkxOTk3NTgyfQ.7LRTv4NgvSKTtb7npIChVv-AF8QgM1LqtujcdlCrb20")

def get_live_metrics(project_id):
    """
    Fetches real container usage data from the Supabase database.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Warning: Missing SUPABASE_URL or SUPABASE_KEY environment variables.")
        return None

    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # Querying the table created by Team A11
        response = supabase.table("project_metrics") \
            .select("runtime_minutes, memory_mb, cpu_usage_percent") \
            .eq("project_id", project_id) \
            .execute()
        
        # Return the first matching row if data exists
        if response.data and len(response.data) > 0:
            return response.data[0] 
        return None
        
    except Exception as e:
        print(f"Database Error for project '{project_id}': {e}")
        return None

def calculate_cost(runtime_minutes, memory_mb):
    """
    Implements the Billing Formula:
    Cost = (runtime(minutes) * 2) + (memory(MB) * 0.01)
    """
    runtime_cost = runtime_minutes * 2
    memory_cost = memory_mb * 0.01
    total_cost = runtime_cost + memory_cost
    
    return round(total_cost, 2)

def generate_usage_response(project_id):
    """
    Logic for: GET /usage/{project_id}
    Retrieves and formats resource usage data using the live database.
    """
    metrics = get_live_metrics(project_id)
    
    if not metrics:
        return {"status": "error", "code": 404, "message": f"Metrics for Project '{project_id}' not found in database."}

    return {
        "status": "success",
        "code": 200,
        "project_id": project_id,
        "data": {
            "runtime_minutes": metrics.get("runtime_minutes", 0),
            "memory_mb": metrics.get("memory_mb", 0),
            "cpu_usage_percent": metrics.get("cpu_usage_percent", 0.0)
        }
    }

def generate_billing_response(project_id):
    """
    Logic for: GET /billing/{project_id}
    Retrieves metrics from the live database, calculates the total cost, and formats the invoice.
    """
    metrics = get_live_metrics(project_id)
    
    if not metrics:
        return {"status": "error", "code": 404, "message": f"Cannot calculate bill. Project '{project_id}' not found in database."}

    runtime_mins = metrics.get("runtime_minutes", 0)
    memory_mb = metrics.get("memory_mb", 0)

    # Perform the core calculation
    total_cost = calculate_cost(runtime_mins, memory_mb)

    return {
        "status": "success",
        "code": 200,
        "project_id": project_id,
        "invoice": {
            "currency": "USD", 
            "total_cost": total_cost,
            "breakdown": {
                "runtime_cost": runtime_mins * 2,
                "memory_cost": round(memory_mb * 0.01, 2)
            }
        }
    }

if __name__ == "__main__":    
    print("Testing connection to Supabase...")
    test_project = "project_alpha"
    
    usage_res = generate_usage_response(test_project)
    print(f"\nUsage Response for {test_project}:")
    print(usage_res)

    billing_res = generate_billing_response(test_project)
    print(f"\nBilling Response for {test_project}:")
    print(billing_res)