import requests
import time

BASE = "http://localhost:8001/api/v1"

def test_endpoint(name, method, url, headers=None, json=None, params=None):
    start = time.time()
    try:
        if method == "GET":
            r = requests.get(url, headers=headers, params=params, timeout=10)
        elif method == "POST":
            r = requests.post(url, headers=headers, json=json, params=params, timeout=10)
        elif method == "PATCH":
            r = requests.patch(url, headers=headers, json=json, params=params, timeout=10)
        elapsed = (time.time() - start) * 1000
        print(f"[{r.status_code}] {elapsed:6.1f}ms  {name} ({url})")
        return r.status_code, r.json() if r.status_code < 400 else r.text
    except Exception as e:
        elapsed = (time.time() - start) * 1000
        print(f"[ERR] {elapsed:6.1f}ms  {name} ({url}): {e}")
        return 0, str(e)

print("--- TESTING ALL BACKEND ENDPOINTS ---")

# 1. Login
status, data = test_endpoint("Login", "POST", f"{BASE}/auth/login", json={"email": "admin@demo.edu", "password": "Admin1234!"})
if status != 200:
    print("Login failed, exiting")
    exit(1)

token = data.get("accessToken")
headers = {"Authorization": f"Bearer {token}"}

# 2. Auth me
status, me = test_endpoint("Auth Me", "GET", f"{BASE}/auth/me", headers=headers)
memberships = me.get("memberships", [])
org_id = memberships[0]["orgId"] if memberships else None
print(f"User ID: {me.get('id')}, Org ID: {org_id}")

if org_id:
    headers["x-org-id"] = org_id

# 3. Orgs
test_endpoint("List Orgs", "GET", f"{BASE}/orgs", headers=headers)
if org_id:
    test_endpoint("Get Org Detail", "GET", f"{BASE}/orgs/{org_id}", headers=headers)
    test_endpoint("Org Members", "GET", f"{BASE}/orgs/{org_id}/members", headers=headers)
    test_endpoint("Org Departments", "GET", f"{BASE}/orgs/{org_id}/departments", headers=headers)
    test_endpoint("Org Projects", "GET", f"{BASE}/orgs/{org_id}/projects", headers=headers)
    test_endpoint("Role Permissions", "GET", f"{BASE}/orgs/{org_id}/role-permissions", headers=headers)

# 4. Channels
if org_id:
    test_endpoint("List Channels", "GET", f"{BASE}/channels", headers=headers, params={"orgId": org_id})

# 5. Tasks
if org_id:
    test_endpoint("List Tasks", "GET", f"{BASE}/tasks", headers=headers, params={"orgId": org_id})

# 6. Dashboards
if org_id:
    test_endpoint("Dash Employee", "GET", f"{BASE}/dashboard/employee", headers=headers, params={"orgId": org_id})
    test_endpoint("Dash Manager", "GET", f"{BASE}/dashboard/manager", headers=headers, params={"orgId": org_id})
    test_endpoint("Dash OrgAdmin", "GET", f"{BASE}/dashboard/org-admin", headers=headers, params={"orgId": org_id})
    test_endpoint("Dash Director", "GET", f"{BASE}/dashboard/director", headers=headers, params={"orgId": org_id})
    test_endpoint("Dash SuperAdmin", "GET", f"{BASE}/dashboard/super-admin", headers=headers)
    test_endpoint("Dash Analytics", "GET", f"{BASE}/dashboard/analytics", headers=headers, params={"orgId": org_id})

# 7. Meetings, Files, Notifications, Search, Users
if org_id:
    test_endpoint("List Meetings", "GET", f"{BASE}/meetings", headers=headers, params={"orgId": org_id})
    test_endpoint("List Files", "GET", f"{BASE}/files", headers=headers, params={"orgId": org_id})
    test_endpoint("List Notifications", "GET", f"{BASE}/notifications", headers=headers)
    test_endpoint("Search", "GET", f"{BASE}/search", headers=headers, params={"q": "test", "orgId": org_id})
    test_endpoint("List Users", "GET", f"{BASE}/users", headers=headers)
    test_endpoint("Attendance Stats", "GET", f"{BASE}/attendance/stats", headers=headers, params={"orgId": org_id})
    test_endpoint("Parent MyChildren", "GET", f"{BASE}/parent/my-children", headers=headers)
