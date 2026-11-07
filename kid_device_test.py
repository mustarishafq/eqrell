#!/usr/bin/env python3
"""
Kid Device Link Backend Test Suite
Tests all kid device pairing endpoints and permissions
"""
import requests
import time
import os
import subprocess
from datetime import datetime, timedelta
from pymongo import MongoClient

# Get environment variables
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'eqrel')
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://pwa-trial-cohort.preview.emergentagent.com')
API_URL = f"{BASE_URL}/api"

# MongoDB connection
client = MongoClient(MONGO_URL)
db = client[DB_NAME]

# Test state
test_results = []
parent_cookie = None
child_id_1 = None
child_id_2 = None
family_id = None

# Kid device state (Way A)
kid_device_id = None
kid_secret = None
kid_code = None
kid_session = None

# Kid device state (Way B)
parent_code = None
kid_device_id_b = None
kid_secret_b = None
kid_session_b = None

def log_test(name, passed, details=""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {name}")
    if details:
        print(f"   {details}")
    test_results.append({"name": name, "passed": passed, "details": details})

def setup_test_family():
    """Run seed script to create test family"""
    global parent_cookie, child_id_1, child_id_2, family_id
    print("\n🌱 Setting up test family...")
    try:
        result = subprocess.run(['python', '/app/scripts/seed_test_family.py'], 
                              capture_output=True, text=True, check=True)
        for line in result.stdout.strip().split('\n'):
            if line.startswith('COOKIE='):
                parent_cookie = line.split('=', 1)[1]
            elif line.startswith('CHILD_ID_1='):
                child_id_1 = line.split('=', 1)[1]
            elif line.startswith('CHILD_ID_2='):
                child_id_2 = line.split('=', 1)[1]
            elif line.startswith('FAMILY_ID='):
                family_id = line.split('=', 1)[1]
        print(f"✅ Test family created: {family_id}")
        print(f"   Child 1: {child_id_1}")
        print(f"   Child 2: {child_id_2}")
        return True
    except Exception as e:
        print(f"❌ Failed to setup test family: {e}")
        return False

def cleanup_test_family():
    """Run cleanup script to remove test family"""
    print("\n🧹 Cleaning up test family...")
    try:
        # Also clean up kid devices and codes
        db.kid_devices.delete_many({'familyId': {'$regex': '^test-fam-'}})
        db.kid_link_codes.delete_many({'familyId': {'$regex': '^test-fam-'}})
        db.kid_code_attempts.delete_many({})
        
        subprocess.run(['python', '/app/scripts/cleanup_test_family.py'], 
                      capture_output=True, text=True, check=True)
        print("✅ Cleanup complete")
    except Exception as e:
        print(f"⚠️  Cleanup warning: {e}")

print("=" * 80)
print("KID DEVICE LINK BACKEND TEST SUITE")
print("=" * 80)

# Setup test family
if not setup_test_family():
    print("❌ Cannot proceed without test family")
    exit(1)

# ============================================================================
# WAY A: Kid device shows code, parent approves
# ============================================================================
print("\n" + "=" * 80)
print("WAY A: KID DEVICE SHOWS CODE, PARENT APPROVES")
print("=" * 80)

# Test 1: POST /kid/device/start (no auth)
print("\n📱 Test 1: POST /kid/device/start")
try:
    response = requests.post(f"{API_URL}/kid/device/start", 
                            headers={'User-Agent': 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)'})
    if response.status_code == 200:
        data = response.json()
        if 'deviceId' in data and 'secret' in data and 'code' in data and 'expiresAt' in data:
            kid_device_id = data['deviceId']
            kid_secret = data['secret']
            kid_code = data['code']
            log_test("POST /kid/device/start returns deviceId, secret, code, expiresAt", True, 
                    f"Code: {kid_code}, Device: {kid_device_id[:8]}...")
        else:
            log_test("POST /kid/device/start returns required fields", False, 
                    f"Missing fields in response: {data}")
    else:
        log_test("POST /kid/device/start", False, f"Status {response.status_code}: {response.text}")
except Exception as e:
    log_test("POST /kid/device/start", False, str(e))

# Test 2: GET /kid/device/lookup with parent auth
print("\n🔍 Test 2: GET /kid/device/lookup (parent)")
try:
    # Valid code with parent auth
    response = requests.get(f"{API_URL}/kid/device/lookup?code={kid_code}",
                           cookies={'eqrel_session': parent_cookie})
    if response.status_code == 200:
        data = response.json()
        if 'device' in data and data['device']['code'] == kid_code:
            log_test("GET /kid/device/lookup with valid code (parent)", True, 
                    f"Device label: {data['device'].get('label', 'N/A')}")
        else:
            log_test("GET /kid/device/lookup returns device info", False, f"Response: {data}")
    else:
        log_test("GET /kid/device/lookup with valid code", False, 
                f"Status {response.status_code}: {response.text}")
except Exception as e:
    log_test("GET /kid/device/lookup with valid code", False, str(e))

# Test 3: GET /kid/device/lookup with invalid code
print("\n🔍 Test 3: GET /kid/device/lookup with invalid code")
try:
    response = requests.get(f"{API_URL}/kid/device/lookup?code=999999",
                           cookies={'eqrel_session': parent_cookie})
    if response.status_code == 404:
        log_test("GET /kid/device/lookup with invalid code returns 404", True)
    else:
        log_test("GET /kid/device/lookup with invalid code", False, 
                f"Expected 404, got {response.status_code}")
except Exception as e:
    log_test("GET /kid/device/lookup with invalid code", False, str(e))

# Test 4: GET /kid/device/lookup without auth
print("\n🔍 Test 4: GET /kid/device/lookup without auth")
try:
    response = requests.get(f"{API_URL}/kid/device/lookup?code={kid_code}")
    if response.status_code == 401:
        log_test("GET /kid/device/lookup without auth returns 401", True)
    else:
        log_test("GET /kid/device/lookup without auth", False, 
                f"Expected 401, got {response.status_code}")
except Exception as e:
    log_test("GET /kid/device/lookup without auth", False, str(e))

# Test 5: POST /kid/device/connect before approval (should return 'pending')
print("\n🔌 Test 5: POST /kid/device/connect before approval")
try:
    response = requests.post(f"{API_URL}/kid/device/connect",
                            json={'deviceId': kid_device_id, 'secret': kid_secret})
    if response.status_code == 200:
        data = response.json()
        if data.get('status') == 'pending':
            log_test("POST /kid/device/connect before approval returns 'pending'", True)
        else:
            log_test("POST /kid/device/connect status", False, 
                    f"Expected 'pending', got '{data.get('status')}'")
    else:
        log_test("POST /kid/device/connect before approval", False, 
                f"Status {response.status_code}: {response.text}")
except Exception as e:
    log_test("POST /kid/device/connect before approval", False, str(e))

# Test 6: POST /kid/device/connect with wrong secret
print("\n🔌 Test 6: POST /kid/device/connect with wrong secret")
try:
    response = requests.post(f"{API_URL}/kid/device/connect",
                            json={'deviceId': kid_device_id, 'secret': 'wrong_secret'})
    if response.status_code == 404:
        data = response.json()
        if data.get('status') == 'unknown':
            log_test("POST /kid/device/connect with wrong secret returns 404 'unknown'", True)
        else:
            log_test("POST /kid/device/connect wrong secret status", False, 
                    f"Expected 'unknown', got '{data.get('status')}'")
    else:
        log_test("POST /kid/device/connect with wrong secret", False, 
                f"Expected 404, got {response.status_code}")
except Exception as e:
    log_test("POST /kid/device/connect with wrong secret", False, str(e))

# Test 7: POST /kid/device/approve (parent)
print("\n✅ Test 7: POST /kid/device/approve (parent)")
try:
    response = requests.post(f"{API_URL}/kid/device/approve",
                            json={'code': kid_code, 'childId': child_id_1, 'name': 'Ali iPad'},
                            cookies={'eqrel_session': parent_cookie})
    if response.status_code == 200:
        data = response.json()
        if data.get('ok') and 'device' in data:
            log_test("POST /kid/device/approve approves device", True, 
                    f"Device: {data['device'].get('name', 'N/A')}")
        else:
            log_test("POST /kid/device/approve response", False, f"Response: {data}")
    else:
        log_test("POST /kid/device/approve", False, 
                f"Status {response.status_code}: {response.text}")
except Exception as e:
    log_test("POST /kid/device/approve", False, str(e))

# Test 8: POST /kid/device/connect after approval (should return 'approved' with session)
print("\n🔌 Test 8: POST /kid/device/connect after approval")
try:
    response = requests.post(f"{API_URL}/kid/device/connect",
                            json={'deviceId': kid_device_id, 'secret': kid_secret})
    if response.status_code == 200:
        data = response.json()
        if data.get('status') == 'approved':
            # Check for session cookie
            if 'eqrel_session' in response.cookies:
                kid_session = response.cookies['eqrel_session']
                log_test("POST /kid/device/connect after approval returns 'approved' with cookie", True,
                        f"Child: {data.get('childName', 'N/A')}")
            else:
                log_test("POST /kid/device/connect session cookie", False, 
                        "No eqrel_session cookie in response")
        else:
            log_test("POST /kid/device/connect after approval status", False, 
                    f"Expected 'approved', got '{data.get('status')}'")
    else:
        log_test("POST /kid/device/connect after approval", False, 
                f"Status {response.status_code}: {response.text}")
except Exception as e:
    log_test("POST /kid/device/connect after approval", False, str(e))

# ============================================================================
# KID SESSION PERMISSIONS (Single Child)
# ============================================================================
print("\n" + "=" * 80)
print("KID SESSION PERMISSIONS (SINGLE CHILD)")
print("=" * 80)

# Test 9: GET /auth/me with kid session
print("\n👤 Test 9: GET /auth/me with kid session")
try:
    response = requests.get(f"{API_URL}/auth/me",
                           cookies={'eqrel_session': kid_session})
    if response.status_code == 200:
        data = response.json()
        device = data.get('device', {})
        if device.get('role') == 'kid' and device.get('childId') == child_id_1:
            log_test("GET /auth/me returns kid device info", True, 
                    f"Role: kid, ChildId: {child_id_1[:8]}...")
        else:
            log_test("GET /auth/me device info", False, f"Device: {device}")
    else:
        log_test("GET /auth/me with kid session", False, 
                f"Status {response.status_code}: {response.text}")
except Exception as e:
    log_test("GET /auth/me with kid session", False, str(e))

# Test 10: GET /children with kid session (should only return child 1)
print("\n👶 Test 10: GET /children with kid session")
try:
    response = requests.get(f"{API_URL}/children",
                           cookies={'eqrel_session': kid_session})
    if response.status_code == 200:
        data = response.json()
        children = data.get('children', [])
        if len(children) == 1 and children[0]['id'] == child_id_1:
            log_test("GET /children returns only linked child", True, 
                    f"Child: {children[0].get('nickname', 'N/A')}")
        else:
            log_test("GET /children filtering", False, 
                    f"Expected 1 child ({child_id_1}), got {len(children)}")
    else:
        log_test("GET /children with kid session", False, 
                f"Status {response.status_code}: {response.text}")
except Exception as e:
    log_test("GET /children with kid session", False, str(e))

# Test 11: Access child 2 habits (should return 403)
print("\n🚫 Test 11: GET /children/:id/habits for other child")
try:
    response = requests.get(f"{API_URL}/children/{child_id_2}/habits",
                           cookies={'eqrel_session': kid_session})
    if response.status_code == 403:
        log_test("GET /children/:id/habits for other child returns 403", True)
    else:
        log_test("GET /children/:id/habits for other child", False, 
                f"Expected 403, got {response.status_code}")
except Exception as e:
    log_test("GET /children/:id/habits for other child", False, str(e))

# Test 12: Parent-only endpoints should return 403
print("\n🚫 Test 12: Parent-only endpoints return 403")
parent_endpoints = [
    '/family/report',
    '/family/pin/verify',
    '/family/kid-codes',
    '/family/kid-devices',
    '/family/display-config',
]

for endpoint in parent_endpoints:
    try:
        if endpoint == '/family/display-config':
            response = requests.post(f"{API_URL}{endpoint}",
                                   json={},
                                   cookies={'eqrel_session': kid_session})
        elif endpoint == '/family/pin/verify':
            response = requests.post(f"{API_URL}{endpoint}",
                                   json={'pin': '1234'},
                                   cookies={'eqrel_session': kid_session})
        elif endpoint == '/family/kid-codes':
            response = requests.post(f"{API_URL}{endpoint}",
                                   json={'childId': child_id_1},
                                   cookies={'eqrel_session': kid_session})
        else:
            response = requests.get(f"{API_URL}{endpoint}",
                                  cookies={'eqrel_session': kid_session})
        
        if response.status_code == 403:
            log_test(f"{endpoint} returns 403 for kid session", True)
        else:
            log_test(f"{endpoint} for kid session", False, 
                    f"Expected 403, got {response.status_code}")
    except Exception as e:
        log_test(f"{endpoint} for kid session", False, str(e))

# Test 13: POST /children should return 403
print("\n🚫 Test 13: POST /children returns 403")
try:
    response = requests.post(f"{API_URL}/children",
                            json={'nickname': 'Test', 'ageBand': 'k1'},
                            cookies={'eqrel_session': kid_session})
    if response.status_code == 403:
        log_test("POST /children returns 403 for kid session", True)
    else:
        log_test("POST /children for kid session", False, 
                f"Expected 403, got {response.status_code}")
except Exception as e:
    log_test("POST /children for kid session", False, str(e))

# Test 14: Habit claim with rubric should return 403
print("\n🚫 Test 14: POST /habits/:id/claim with rubric returns 403")
try:
    # Get a habit for child 1
    habits_response = requests.get(f"{API_URL}/children/{child_id_1}/habits",
                                  cookies={'eqrel_session': kid_session})
    if habits_response.status_code == 200:
        habits = habits_response.json().get('habits', [])
        if habits:
            habit_id = habits[0]['id']
            response = requests.post(f"{API_URL}/habits/{habit_id}/claim",
                                   json={'rubric': 'ihsan'},
                                   cookies={'eqrel_session': kid_session})
            if response.status_code == 403:
                log_test("POST /habits/:id/claim with rubric returns 403", True)
            else:
                log_test("POST /habits/:id/claim with rubric", False, 
                        f"Expected 403, got {response.status_code}")
        else:
            log_test("POST /habits/:id/claim with rubric", False, "No habits found for testing")
    else:
        log_test("POST /habits/:id/claim with rubric", False, 
                f"Could not fetch habits: {habits_response.status_code}")
except Exception as e:
    log_test("POST /habits/:id/claim with rubric", False, str(e))

# Test 15: Habit claim with status='verified' should return 403
print("\n🚫 Test 15: POST /habits/:id/claim with status='verified' returns 403")
try:
    habits_response = requests.get(f"{API_URL}/children/{child_id_1}/habits",
                                  cookies={'eqrel_session': kid_session})
    if habits_response.status_code == 200:
        habits = habits_response.json().get('habits', [])
        if habits:
            habit_id = habits[0]['id']
            response = requests.post(f"{API_URL}/habits/{habit_id}/claim",
                                   json={'status': 'verified'},
                                   cookies={'eqrel_session': kid_session})
            if response.status_code == 403:
                log_test("POST /habits/:id/claim with status='verified' returns 403", True)
            else:
                log_test("POST /habits/:id/claim with status='verified'", False, 
                        f"Expected 403, got {response.status_code}")
        else:
            log_test("POST /habits/:id/claim with status='verified'", False, 
                    "No habits found for testing")
    else:
        log_test("POST /habits/:id/claim with status='verified'", False, 
                f"Could not fetch habits: {habits_response.status_code}")
except Exception as e:
    log_test("POST /habits/:id/claim with status='verified'", False, str(e))

# Test 16: Plain habit claim should work (200)
print("\n✅ Test 16: POST /habits/:id/claim (plain claim)")
try:
    habits_response = requests.get(f"{API_URL}/children/{child_id_1}/habits",
                                  cookies={'eqrel_session': kid_session})
    if habits_response.status_code == 200:
        habits = habits_response.json().get('habits', [])
        # Find a per-prayer habit (needs session)
        per_prayer_habit = next((h for h in habits if h.get('recurring') == 'perPrayer'), None)
        if per_prayer_habit:
            habit_id = per_prayer_habit['id']
            response = requests.post(f"{API_URL}/habits/{habit_id}/claim",
                                   json={'session': 'subuh'},
                                   cookies={'eqrel_session': kid_session})
            if response.status_code == 200:
                log_test("POST /habits/:id/claim (plain claim) returns 200", True)
            else:
                log_test("POST /habits/:id/claim (plain claim)", False, 
                        f"Expected 200, got {response.status_code}: {response.text}")
        else:
            log_test("POST /habits/:id/claim (plain claim)", False, 
                    "No per-prayer habit found for testing")
    else:
        log_test("POST /habits/:id/claim (plain claim)", False, 
                f"Could not fetch habits: {habits_response.status_code}")
except Exception as e:
    log_test("POST /habits/:id/claim (plain claim)", False, str(e))

# Test 17: World demerit with delta=1 should return 403
print("\n🚫 Test 17: POST /world/:id/demerit with delta=1 returns 403")
try:
    response = requests.post(f"{API_URL}/world/{child_id_1}/demerit",
                            json={'delta': 1},
                            cookies={'eqrel_session': kid_session})
    if response.status_code == 403:
        log_test("POST /world/:id/demerit with delta=1 returns 403", True)
    else:
        log_test("POST /world/:id/demerit with delta=1", False, 
                f"Expected 403, got {response.status_code}")
except Exception as e:
    log_test("POST /world/:id/demerit with delta=1", False, str(e))

# Test 18: World demerit with delta=-1 should be allowed (200)
print("\n✅ Test 18: POST /world/:id/demerit with delta=-1 allowed")
try:
    response = requests.post(f"{API_URL}/world/{child_id_1}/demerit",
                            json={'delta': -1},
                            cookies={'eqrel_session': kid_session})
    if response.status_code == 200:
        log_test("POST /world/:id/demerit with delta=-1 returns 200", True)
    else:
        log_test("POST /world/:id/demerit with delta=-1", False, 
                f"Expected 200, got {response.status_code}: {response.text}")
except Exception as e:
    log_test("POST /world/:id/demerit with delta=-1", False, str(e))

# Test 19: Quiz start with own childId should work
print("\n✅ Test 19: POST /quiz/start with own childId")
try:
    response = requests.post(f"{API_URL}/quiz/start",
                            json={'childId': child_id_1},
                            cookies={'eqrel_session': kid_session})
    if response.status_code == 200:
        log_test("POST /quiz/start with own childId returns 200", True)
    else:
        log_test("POST /quiz/start with own childId", False, 
                f"Expected 200, got {response.status_code}: {response.text}")
except Exception as e:
    log_test("POST /quiz/start with own childId", False, str(e))

# Test 20: Quiz start with other childId should return 403
print("\n🚫 Test 20: POST /quiz/start with other childId returns 403")
try:
    response = requests.post(f"{API_URL}/quiz/start",
                            json={'childId': child_id_2},
                            cookies={'eqrel_session': kid_session})
    if response.status_code == 403:
        log_test("POST /quiz/start with other childId returns 403", True)
    else:
        log_test("POST /quiz/start with other childId", False, 
                f"Expected 403, got {response.status_code}")
except Exception as e:
    log_test("POST /quiz/start with other childId", False, str(e))

# Test 21: Rewards proposals with own childId should work
print("\n✅ Test 21: GET /rewards/proposals with own childId")
try:
    response = requests.get(f"{API_URL}/rewards/proposals?childId={child_id_1}",
                           cookies={'eqrel_session': kid_session})
    if response.status_code == 200:
        log_test("GET /rewards/proposals with own childId returns 200", True)
    else:
        log_test("GET /rewards/proposals with own childId", False, 
                f"Expected 200, got {response.status_code}: {response.text}")
except Exception as e:
    log_test("GET /rewards/proposals with own childId", False, str(e))

# ============================================================================
# WAY B: Parent shows code, kid redeems
# ============================================================================
print("\n" + "=" * 80)
print("WAY B: PARENT SHOWS CODE, KID REDEEMS")
print("=" * 80)

# Test 22: POST /family/kid-codes (parent)
print("\n🎫 Test 22: POST /family/kid-codes (parent)")
try:
    response = requests.post(f"{API_URL}/family/kid-codes",
                            json={'childId': None},
                            cookies={'eqrel_session': parent_cookie})
    if response.status_code == 200:
        data = response.json()
        if 'code' in data and 'expiresAt' in data:
            parent_code = data['code']
            log_test("POST /family/kid-codes returns code", True, f"Code: {parent_code}")
        else:
            log_test("POST /family/kid-codes response", False, f"Response: {data}")
    else:
        log_test("POST /family/kid-codes", False, 
                f"Status {response.status_code}: {response.text}")
except Exception as e:
    log_test("POST /family/kid-codes", False, str(e))

# Test 23: POST /kid/device/redeem (kid device)
print("\n🎁 Test 23: POST /kid/device/redeem")
try:
    response = requests.post(f"{API_URL}/kid/device/redeem",
                            json={'code': parent_code},
                            headers={'User-Agent': 'Mozilla/5.0 (Android 13; Mobile)'})
    if response.status_code == 200:
        data = response.json()
        if data.get('status') == 'approved' and 'deviceId' in data and 'secret' in data:
            kid_device_id_b = data['deviceId']
            kid_secret_b = data['secret']
            if 'eqrel_session' in response.cookies:
                kid_session_b = response.cookies['eqrel_session']
                log_test("POST /kid/device/redeem returns approved with deviceId, secret, cookie", True,
                        f"Device: {kid_device_id_b[:8]}...")
            else:
                log_test("POST /kid/device/redeem session cookie", False, 
                        "No eqrel_session cookie in response")
        else:
            log_test("POST /kid/device/redeem response", False, f"Response: {data}")
    else:
        log_test("POST /kid/device/redeem", False, 
                f"Status {response.status_code}: {response.text}")
except Exception as e:
    log_test("POST /kid/device/redeem", False, str(e))

# Test 24: Shared session sees both children
print("\n👶👶 Test 24: GET /children with shared session")
try:
    response = requests.get(f"{API_URL}/children",
                           cookies={'eqrel_session': kid_session_b})
    if response.status_code == 200:
        data = response.json()
        children = data.get('children', [])
        if len(children) == 2:
            log_test("GET /children with shared session returns both children", True,
                    f"Children: {len(children)}")
        else:
            log_test("GET /children with shared session", False, 
                    f"Expected 2 children, got {len(children)}")
    else:
        log_test("GET /children with shared session", False, 
                f"Status {response.status_code}: {response.text}")
except Exception as e:
    log_test("GET /children with shared session", False, str(e))

# Test 25: Reusing code should return 404
print("\n🚫 Test 25: POST /kid/device/redeem with reused code")
try:
    response = requests.post(f"{API_URL}/kid/device/redeem",
                            json={'code': parent_code})
    if response.status_code == 404:
        log_test("POST /kid/device/redeem with reused code returns 404", True)
    else:
        log_test("POST /kid/device/redeem with reused code", False, 
                f"Expected 404, got {response.status_code}")
except Exception as e:
    log_test("POST /kid/device/redeem with reused code", False, str(e))

# Test 26: 13 wrong codes should return 429
print("\n🚫 Test 26: POST /kid/device/redeem rate limiting (13 wrong codes)")
try:
    for i in range(13):
        response = requests.post(f"{API_URL}/kid/device/redeem",
                                json={'code': f'{100000 + i}'})
    
    if response.status_code == 429:
        log_test("POST /kid/device/redeem rate limiting returns 429 after 13 attempts", True)
    else:
        log_test("POST /kid/device/redeem rate limiting", False, 
                f"Expected 429, got {response.status_code}")
except Exception as e:
    log_test("POST /kid/device/redeem rate limiting", False, str(e))

# ============================================================================
# DEVICE MANAGEMENT & REVOCATION
# ============================================================================
print("\n" + "=" * 80)
print("DEVICE MANAGEMENT & REVOCATION")
print("=" * 80)

# Test 27: GET /family/kid-devices (parent)
print("\n📱 Test 27: GET /family/kid-devices (parent)")
try:
    response = requests.get(f"{API_URL}/family/kid-devices",
                           cookies={'eqrel_session': parent_cookie})
    if response.status_code == 200:
        data = response.json()
        devices = data.get('devices', [])
        if len(devices) >= 2:
            log_test("GET /family/kid-devices returns device list", True, 
                    f"Devices: {len(devices)}")
        else:
            log_test("GET /family/kid-devices device count", False, 
                    f"Expected at least 2 devices, got {len(devices)}")
    else:
        log_test("GET /family/kid-devices", False, 
                f"Status {response.status_code}: {response.text}")
except Exception as e:
    log_test("GET /family/kid-devices", False, str(e))

# Test 28: POST /family/kid-devices/:id/revoke (parent)
print("\n🚫 Test 28: POST /family/kid-devices/:id/revoke (parent)")
try:
    response = requests.post(f"{API_URL}/family/kid-devices/{kid_device_id}/revoke",
                            cookies={'eqrel_session': parent_cookie})
    if response.status_code == 200:
        log_test("POST /family/kid-devices/:id/revoke revokes device", True)
    else:
        log_test("POST /family/kid-devices/:id/revoke", False, 
                f"Status {response.status_code}: {response.text}")
except Exception as e:
    log_test("POST /family/kid-devices/:id/revoke", False, str(e))

# Test 29: Kid session gets 401 after revocation
print("\n🚫 Test 29: Revoked kid session gets 401")
try:
    response = requests.get(f"{API_URL}/children",
                           cookies={'eqrel_session': kid_session})
    if response.status_code == 401:
        log_test("Revoked kid session gets 401 on /children", True)
    else:
        log_test("Revoked kid session", False, 
                f"Expected 401, got {response.status_code}")
except Exception as e:
    log_test("Revoked kid session", False, str(e))

# Test 30: Connect returns 'revoked' status
print("\n🚫 Test 30: POST /kid/device/connect returns 'revoked'")
try:
    response = requests.post(f"{API_URL}/kid/device/connect",
                            json={'deviceId': kid_device_id, 'secret': kid_secret})
    if response.status_code == 200:
        data = response.json()
        if data.get('status') == 'revoked':
            log_test("POST /kid/device/connect returns 'revoked' status", True)
        else:
            log_test("POST /kid/device/connect revoked status", False, 
                    f"Expected 'revoked', got '{data.get('status')}'")
    else:
        log_test("POST /kid/device/connect for revoked device", False, 
                f"Status {response.status_code}: {response.text}")
except Exception as e:
    log_test("POST /kid/device/connect for revoked device", False, str(e))

# Test 31: Parent session still works
print("\n✅ Test 31: Parent session still works after kid device revocation")
try:
    response = requests.get(f"{API_URL}/children",
                           cookies={'eqrel_session': parent_cookie})
    if response.status_code == 200:
        log_test("Parent session still works after revocation", True)
    else:
        log_test("Parent session after revocation", False, 
                f"Expected 200, got {response.status_code}")
except Exception as e:
    log_test("Parent session after revocation", False, str(e))

# ============================================================================
# REGRESSION: TV LINK ENDPOINTS
# ============================================================================
print("\n" + "=" * 80)
print("REGRESSION: TV LINK ENDPOINTS (QUICK CHECK)")
print("=" * 80)

# Test 32: POST /tv/device/start still works
print("\n📺 Test 32: POST /tv/device/start (regression)")
try:
    response = requests.post(f"{API_URL}/tv/device/start",
                            headers={'User-Agent': 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0)'})
    if response.status_code == 200:
        data = response.json()
        if 'deviceId' in data and 'code' in data:
            tv_code = data['code']
            log_test("POST /tv/device/start still works (regression)", True, f"Code: {tv_code}")
        else:
            log_test("POST /tv/device/start response", False, f"Response: {data}")
    else:
        log_test("POST /tv/device/start (regression)", False, 
                f"Status {response.status_code}: {response.text}")
except Exception as e:
    log_test("POST /tv/device/start (regression)", False, str(e))

# Test 33: GET /tv/device/lookup still works
print("\n📺 Test 33: GET /tv/device/lookup (regression)")
try:
    response = requests.get(f"{API_URL}/tv/device/lookup?code={tv_code}",
                           cookies={'eqrel_session': parent_cookie})
    if response.status_code == 200:
        log_test("GET /tv/device/lookup still works (regression)", True)
    else:
        log_test("GET /tv/device/lookup (regression)", False, 
                f"Status {response.status_code}: {response.text}")
except Exception as e:
    log_test("GET /tv/device/lookup (regression)", False, str(e))

# ============================================================================
# SUMMARY
# ============================================================================
print("\n" + "=" * 80)
print("TEST SUMMARY")
print("=" * 80)

passed = sum(1 for t in test_results if t['passed'])
failed = sum(1 for t in test_results if not t['passed'])
total = len(test_results)

print(f"\n✅ Passed: {passed}/{total}")
print(f"❌ Failed: {failed}/{total}")

if failed > 0:
    print("\n❌ FAILED TESTS:")
    for t in test_results:
        if not t['passed']:
            print(f"  - {t['name']}")
            if t['details']:
                print(f"    {t['details']}")

# Cleanup
cleanup_test_family()

print("\n" + "=" * 80)
if failed == 0:
    print("🎉 ALL TESTS PASSED!")
else:
    print(f"⚠️  {failed} TEST(S) FAILED")
print("=" * 80)

# Exit with appropriate code
exit(0 if failed == 0 else 1)
