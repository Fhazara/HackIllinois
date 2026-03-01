import modal
import urllib.request
import os

# Create a Modal app for scheduling
app = modal.App("thrift-alert-cron")

@app.function(schedule=modal.Cron("*/15 * * * *"))
def run_alert_check():
    """
    Triggers the Next.js API cron endpoint every 15 minutes.
    The Next.js backend handles Postgres DB connections, agent execution, 
    and Notification dispatch (Mock Email/SMS).
    """
    # Prefer an environment variable for the production deployment URL
    # Fallback to localhost for testing in development
    app_url = os.environ.get("NEXT_PUBLIC_APP_URL", "http://localhost:3000")
    endpoint = f"{app_url}/api/alerts/cron"
    
    print(f"Triggering Thrift Notification System check at: {endpoint}")
    
    try:
        # We simply GET the endpoint to trigger the job
        req = urllib.request.Request(endpoint, method="GET")
        with urllib.request.urlopen(req, timeout=300) as response:
            result = response.read().decode('utf-8')
            print("Alert Check Completed Successfully:", result)
    except Exception as e:
        print(f"Failed to trigger alert cron endpoint: {e}")

# Note: Deploy this separately with `modal deploy modal/alert_cron.py`
