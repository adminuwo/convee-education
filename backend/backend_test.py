#!/usr/bin/env python3
"""
Comprehensive Backend API Test Suite
Enterprise AI Collaboration Platform
"""

import requests
import sys
import json
from datetime import datetime, timedelta

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

class BackendTester:
    def __init__(self, base_url="https://workstream-hub-10.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_base = f"{base_url}/api/v1"
        self.token = None
        self.refresh_token = None
        self.user = None
        self.org_id = None
        self.channel_id = None
        self.task_id = None
        self.meeting_id = None
        self.file_id = None
        
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.failed_tests = []
        
    def log(self, msg, color=Colors.BLUE):
        print(f"{color}{msg}{Colors.END}")
        
    def test(self, name, method, endpoint, expected_status, data=None, params=None, files=None, save_response=None):
        """Run a single API test"""
        url = f"{self.api_base}/{endpoint}" if not endpoint.startswith('http') else endpoint
        headers = {'Content-Type': 'application/json'}
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        if self.org_id:
            headers['x-org-id'] = self.org_id
            
        if files:
            headers.pop('Content-Type', None)
        
        self.tests_run += 1
        print(f"\n[{self.tests_run}] Testing: {name}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=30)
            elif method == 'POST':
                if files:
                    response = requests.post(url, headers=headers, files=files, data=data, timeout=30)
                else:
                    response = requests.post(url, headers=headers, json=data, params=params, timeout=30)
            elif method == 'PATCH':
                response = requests.patch(url, headers=headers, json=data, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                self.log(f"  ✅ PASS - Status: {response.status_code}", Colors.GREEN)
                
                # Save response data if requested
                if save_response and response.status_code < 400:
                    try:
                        resp_data = response.json()
                        if save_response == 'token':
                            self.token = resp_data.get('accessToken')
                            self.refresh_token = resp_data.get('refreshToken')
                            self.user = resp_data.get('user')
                            
                            # Try to get org_id from user memberships
                            if self.user:
                                memberships = self.user.get('memberships', [])
                                if memberships and len(memberships) > 0:
                                    self.org_id = memberships[0].get('orgId')
                                    self.log(f"  → Saved token and org_id: {self.org_id}", Colors.BLUE)
                                else:
                                    self.log(f"  → Saved token but no memberships found", Colors.YELLOW)
                            else:
                                self.log(f"  → Saved token but no user data", Colors.YELLOW)
                        elif save_response == 'channel_id':
                            self.channel_id = resp_data.get('id') or resp_data.get('channel', {}).get('id')
                            self.log(f"  → Saved channel_id: {self.channel_id}", Colors.BLUE)
                        elif save_response == 'task_id':
                            self.task_id = resp_data.get('id')
                            self.log(f"  → Saved task_id: {self.task_id}", Colors.BLUE)
                        elif save_response == 'meeting_id':
                            self.meeting_id = resp_data.get('id')
                            self.log(f"  → Saved meeting_id: {self.meeting_id}", Colors.BLUE)
                        elif save_response == 'file_id':
                            self.file_id = resp_data.get('id')
                            self.log(f"  → Saved file_id: {self.file_id}", Colors.BLUE)
                    except Exception:
                        pass
                
                return True, response
            else:
                self.tests_failed += 1
                self.failed_tests.append({
                    'name': name,
                    'expected': expected_status,
                    'actual': response.status_code,
                    'endpoint': endpoint
                })
                self.log(f"  ❌ FAIL - Expected {expected_status}, got {response.status_code}", Colors.RED)
                try:
                    error_data = response.json()
                    self.log(f"  → Error: {json.dumps(error_data, indent=2)}", Colors.YELLOW)
                except Exception:
                    self.log(f"  → Response: {response.text[:200]}", Colors.YELLOW)
                return False, response
                
        except Exception as e:
            self.tests_failed += 1
            self.failed_tests.append({
                'name': name,
                'expected': expected_status,
                'actual': 'Exception',
                'endpoint': endpoint,
                'error': str(e)
            })
            self.log(f"  ❌ FAIL - Exception: {str(e)}", Colors.RED)
            return False, None
    
    def run_all_tests(self):
        """Run all backend tests"""
        self.log("\n" + "="*80, Colors.BLUE)
        self.log("ENTERPRISE AI COLLABORATION PLATFORM - BACKEND API TESTS", Colors.BLUE)
        self.log("="*80 + "\n", Colors.BLUE)
        
        # 1. Health Check
        self.log("\n### 1. HEALTH CHECK ###", Colors.BLUE)
        self.test("Health endpoint", "GET", f"{self.base_url}/api/health", 200)
        
        # 2. Auth Tests
        self.log("\n### 2. AUTHENTICATION ###", Colors.BLUE)
        
        # Login with admin user
        success, _ = self.test(
            "Login with admin@demo.edu",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@demo.edu", "password": "Admin1234!"},
            save_response='token'
        )
        
        if not success:
            self.log("\n❌ CRITICAL: Login failed. Cannot proceed with authenticated tests.", Colors.RED)
            return
        
        self.log(f"\n  → Token: {self.token[:20] if self.token else 'None'}...", Colors.BLUE)
        self.log(f"  → User ID: {self.user.get('id') if self.user else 'None'}", Colors.BLUE)
        self.log(f"  → Org ID: {self.org_id}", Colors.BLUE)
        
        # Get current user
        success, resp = self.test("Get current user (me)", "GET", "auth/me", 200)
        
        # Try to get org_id from /auth/me if not already set
        if not self.org_id and success and resp:
            try:
                me_data = resp.json()
                memberships = me_data.get('memberships', [])
                if memberships and len(memberships) > 0:
                    self.org_id = memberships[0].get('orgId')
                    self.log(f"  → Got org_id from /auth/me: {self.org_id}", Colors.BLUE)
            except Exception:
                pass
        
        # Refresh token
        if self.refresh_token:
            self.test(
                "Refresh access token",
                "POST",
                "auth/refresh",
                200,
                data={"refreshToken": self.refresh_token}
            )
        
        # 3. Organization Tests
        self.log("\n### 3. ORGANIZATIONS ###", Colors.BLUE)
        
        success, resp = self.test("List organizations", "GET", "orgs", 200)
        
        # Try to get org_id from orgs list if still not set
        if not self.org_id and success and resp:
            try:
                orgs = resp.json()
                if orgs and len(orgs) > 0:
                    self.org_id = orgs[0].get('id')
                    self.log(f"  → Got org_id from orgs list: {self.org_id}", Colors.BLUE)
            except Exception:
                pass
        
        if self.org_id:
            self.test(f"Get organization details", "GET", f"orgs/{self.org_id}", 200)
            self.test(f"List organization members", "GET", f"orgs/{self.org_id}/members", 200)
            self.test(f"List departments", "GET", f"orgs/{self.org_id}/departments", 200)
            self.test(f"List projects", "GET", f"orgs/{self.org_id}/projects", 200)
        
        # 4. Channel Tests
        self.log("\n### 4. CHANNELS ###", Colors.BLUE)
        
        if self.org_id:
            success, resp = self.test(
                "List channels",
                "GET",
                "channels",
                200,
                params={"orgId": self.org_id}
            )
            
            # Get first channel ID if available
            if success and resp:
                try:
                    channels = resp.json()
                    if channels and len(channels) > 0:
                        self.channel_id = channels[0]['id']
                        self.log(f"  → Using existing channel: {self.channel_id}", Colors.BLUE)
                except Exception:
                    pass
            
            # Create a test channel
            test_channel_name = f"test-channel-{datetime.now().strftime('%H%M%S')}"
            success, resp = self.test(
                "Create public channel",
                "POST",
                "channels",
                201,
                data={
                    "orgId": self.org_id,
                    "name": test_channel_name,
                    "description": "Test channel",
                    "type": "PUBLIC"
                },
                save_response='channel_id'
            )
            
            if self.channel_id:
                self.test(f"Get channel details", "GET", f"channels/{self.channel_id}", 200)
                self.test(f"Join channel", "POST", f"channels/{self.channel_id}/join", 200)
                
                # Send a message
                success, resp = self.test(
                    "Send message to channel",
                    "POST",
                    f"channels/{self.channel_id}/messages",
                    201,
                    data={"content": "Test message from backend_test.py", "type": "TEXT"}
                )
                
                message_id = None
                if success and resp:
                    try:
                        msg_data = resp.json()
                        message_id = msg_data.get('id')
                    except Exception:
                        pass
                
                self.test(f"List channel messages", "GET", f"channels/{self.channel_id}/messages", 200)
                
                if message_id:
                    self.test(
                        "Add reaction to message",
                        "POST",
                        f"channels/{self.channel_id}/messages/{message_id}/react",
                        200,
                        data={"emoji": "👍"}
                    )
                    
                    self.test(
                        "Pin message",
                        "POST",
                        f"channels/{self.channel_id}/messages/{message_id}/pin",
                        200
                    )
                
                self.test(f"Get pinned messages", "GET", f"channels/{self.channel_id}/pinned", 200)
                self.test(
                    f"Search in channel",
                    "GET",
                    f"channels/{self.channel_id}/search",
                    200,
                    params={"q": "test"}
                )
        
        # 5. Task Tests
        self.log("\n### 5. TASKS ###", Colors.BLUE)
        
        if self.org_id:
            self.test(
                "List tasks",
                "GET",
                "tasks",
                200,
                params={"orgId": self.org_id}
            )
            
            # Create a task
            tomorrow = (datetime.now() + timedelta(days=1)).isoformat()
            success, resp = self.test(
                "Create task",
                "POST",
                "tasks",
                201,
                data={
                    "orgId": self.org_id,
                    "title": "Test Task from backend_test.py",
                    "description": "This is a test task",
                    "priority": "HIGH",
                    "status": "TODO",
                    "dueDate": tomorrow,
                    "assigneeIds": [self.user['id']] if self.user else []
                },
                save_response='task_id'
            )
            
            if self.task_id:
                self.test(f"Get task details", "GET", f"tasks/{self.task_id}", 200)
                
                self.test(
                    "Update task status",
                    "PATCH",
                    f"tasks/{self.task_id}",
                    200,
                    data={"status": "IN_PROGRESS"}
                )
                
                self.test(
                    "Add task comment",
                    "POST",
                    f"tasks/{self.task_id}/comments",
                    201,
                    data={"content": "Test comment"}
                )
        
        # 6. AI Tests
        self.log("\n### 6. AI INTEGRATION ###", Colors.BLUE)
        
        self.test(
            "AI Chat",
            "POST",
            "ai/chat",
            200,
            data={
                "message": "Hello, what can you help me with?",
                "sessionKey": f"test-session-{datetime.now().strftime('%H%M%S')}"
            }
        )
        
        if self.channel_id:
            self.test(
                "AI Summarize Channel",
                "POST",
                "ai/summarize-channel",
                200,
                data={"channelId": self.channel_id}
            )
        
        # 7. Notifications
        self.log("\n### 7. NOTIFICATIONS ###", Colors.BLUE)
        
        self.test("List notifications", "GET", "notifications", 200)
        
        # 8. Dashboard Tests
        self.log("\n### 8. DASHBOARDS ###", Colors.BLUE)
        
        if self.org_id:
            self.test(
                "Employee dashboard",
                "GET",
                "dashboard/employee",
                200,
                params={"orgId": self.org_id}
            )
            
            self.test(
                "Manager dashboard",
                "GET",
                "dashboard/manager",
                200,
                params={"orgId": self.org_id}
            )
            
            self.test(
                "Analytics dashboard",
                "GET",
                "dashboard/analytics",
                200,
                params={"orgId": self.org_id}
            )
        
        # 9. Meetings
        self.log("\n### 9. MEETINGS ###", Colors.BLUE)
        
        if self.org_id:
            self.test(
                "List meetings",
                "GET",
                "meetings",
                200,
                params={"orgId": self.org_id}
            )
            
            # Create a meeting
            start_time = (datetime.now() + timedelta(hours=1)).isoformat()
            end_time = (datetime.now() + timedelta(hours=2)).isoformat()
            
            success, resp = self.test(
                "Create meeting",
                "POST",
                "meetings",
                201,
                data={
                    "orgId": self.org_id,
                    "title": "Test Meeting",
                    "description": "Backend test meeting",
                    "startTime": start_time,
                    "endTime": end_time,
                    "attendeeIds": [self.user['id']] if self.user else []
                },
                save_response='meeting_id'
            )
            
            if self.meeting_id:
                self.test(f"Get meeting details", "GET", f"meetings/{self.meeting_id}", 200)
                
                self.test(
                    "Update meeting notes",
                    "PATCH",
                    f"meetings/{self.meeting_id}",
                    200,
                    data={"notes": "Test meeting notes"}
                )
        
        # 10. Files
        self.log("\n### 10. FILES ###", Colors.BLUE)
        
        if self.org_id:
            self.test(
                "List files",
                "GET",
                "files",
                200,
                params={"orgId": self.org_id}
            )
            
            # Upload a test file
            test_file_content = b"Test file content from backend_test.py"
            files_data = {
                'file': ('test.txt', test_file_content, 'text/plain')
            }
            
            success, resp = self.test(
                "Upload file",
                "POST",
                "files/upload",
                201,
                files=files_data,
                data={'orgId': self.org_id},
                save_response='file_id'
            )
        
        # 11. Search
        self.log("\n### 11. GLOBAL SEARCH ###", Colors.BLUE)
        
        if self.org_id:
            self.test(
                "Global search",
                "GET",
                "search",
                200,
                params={"q": "test", "orgId": self.org_id}
            )
        
        # 12. Users
        self.log("\n### 12. USERS ###", Colors.BLUE)
        
        self.test("List users", "GET", "users", 200)
        
        if self.user:
            self.test(f"Get user profile", "GET", f"users/{self.user['id']}", 200)
    
    def print_summary(self):
        """Print test summary"""
        self.log("\n" + "="*80, Colors.BLUE)
        self.log("TEST SUMMARY", Colors.BLUE)
        self.log("="*80, Colors.BLUE)
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        
        self.log(f"\nTotal Tests: {self.tests_run}", Colors.BLUE)
        self.log(f"Passed: {self.tests_passed}", Colors.GREEN)
        self.log(f"Failed: {self.tests_failed}", Colors.RED)
        self.log(f"Success Rate: {success_rate:.1f}%", Colors.BLUE)
        
        if self.failed_tests:
            self.log("\n### FAILED TESTS ###", Colors.RED)
            for i, test in enumerate(self.failed_tests, 1):
                self.log(f"\n{i}. {test['name']}", Colors.RED)
                self.log(f"   Endpoint: {test['endpoint']}", Colors.YELLOW)
                self.log(f"   Expected: {test['expected']}, Got: {test['actual']}", Colors.YELLOW)
                if 'error' in test:
                    self.log(f"   Error: {test['error']}", Colors.YELLOW)
        
        self.log("\n" + "="*80 + "\n", Colors.BLUE)
        
        return 0 if self.tests_failed == 0 else 1

def main():
    tester = BackendTester()
    tester.run_all_tests()
    return tester.print_summary()

if __name__ == "__main__":
    sys.exit(main())
