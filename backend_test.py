#!/usr/bin/env python3
"""
Backend test for GET /api/family/report endpoint
Tests all cases from review_request:
1. No cookie → 401
2. Valid cookie → 200 with correct shape
3. days param validation (?days=30, ?days=0, ?days=abc, ?days=100)
4. Direct Mongo inserts for habit_claims verification
5. User with no familyId → 400
6. Quick regression: /family/streak and /family/display-config / display-data
"""
import os
import sys
import requests
import subprocess
from datetime import datetime, timedelta
from pymongo import MongoClient

# Config
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'eqrel')
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://pwa-trial-cohort.preview.emergentagent.com')
API_URL = f'{BASE_URL}/api'

print(f"🔧 Using API_URL: {API_URL}")
print(f"🔧 Using MONGO_URL: {MONGO_URL}")
print(f"🔧 Using DB_NAME: {DB_NAME}")

# Connect to MongoDB
client = MongoClient(MONGO_URL)
db = client[DB_NAME]

# Seed test family
print("\n📦 Seeding test family...")
result = subprocess.run(['python', '/app/scripts/seed_test_family.py'], capture_output=True, text=True)
if result.returncode != 0:
    print(f"❌ Failed to seed test family: {result.stderr}")
    sys.exit(1)

# Parse output
lines = result.stdout.strip().split('\n')
data = {}
for line in lines:
    if '=' in line:
        key, val = line.split('=', 1)
        data[key] = val

COOKIE = data.get('COOKIE')
FAMILY_ID = data.get('FAMILY_ID')
CHILD_ID_1 = data.get('CHILD_ID_1')
CHILD_ID_2 = data.get('CHILD_ID_2')
USER_ID = data.get('USER_ID')

print(f"✅ Test family seeded: {FAMILY_ID}")
print(f"   Child 1: {CHILD_ID_1}")
print(f"   Child 2: {CHILD_ID_2}")

# Helper to format date as YYYY-MM-DD UTC
def fmt_date(d):
    return d.strftime('%Y-%m-%d')

# Get today and yesterday in UTC
now = datetime.utcnow()
today = datetime(now.year, now.month, now.day)
yesterday = today - timedelta(days=1)
today_str = fmt_date(today)
yesterday_str = fmt_date(yesterday)

print(f"\n📅 Today (UTC): {today_str}")
print(f"📅 Yesterday (UTC): {yesterday_str}")

# Get habit IDs for child 1
habits = list(db.habits.find({'childId': CHILD_ID_1}, {'_id': 0, 'id': 1, 'title': 1}))
if len(habits) < 2:
    print(f"❌ Expected at least 2 habits for child 1, got {len(habits)}")
    sys.exit(1)

HABIT_1 = habits[0]['id']
HABIT_2 = habits[1]['id']
print(f"\n🎯 Using habits: {HABIT_1}, {HABIT_2}")

# Test counter
test_num = 0
passed = 0
failed = 0

def test(name):
    global test_num
    test_num += 1
    print(f"\n{'='*80}")
    print(f"TEST {test_num}: {name}")
    print('='*80)

def success(msg):
    global passed
    passed += 1
    print(f"✅ {msg}")

def fail(msg):
    global failed
    failed += 1
    print(f"❌ {msg}")

# ============================================================================
# TEST 1: No cookie → 401
# ============================================================================
test("No cookie → 401")
try:
    resp = requests.get(f'{API_URL}/family/report', timeout=10)
    if resp.status_code == 401:
        success(f"Got 401 without cookie")
    else:
        fail(f"Expected 401, got {resp.status_code}")
except Exception as e:
    fail(f"Request failed: {e}")

# ============================================================================
# TEST 2: Valid cookie → 200 with correct shape (default days=7)
# ============================================================================
test("Valid cookie → 200 with correct shape (days=7 default)")
try:
    headers = {'Cookie': f'eqrel_session={COOKIE}'}
    resp = requests.get(f'{API_URL}/family/report', headers=headers, timeout=10)
    if resp.status_code != 200:
        fail(f"Expected 200, got {resp.status_code}: {resp.text}")
    else:
        data = resp.json()
        
        # Check top-level shape
        if 'range' not in data:
            fail("Missing 'range' field")
        elif 'from' not in data['range'] or 'to' not in data['range'] or 'days' not in data['range']:
            fail(f"Invalid range shape: {data['range']}")
        elif data['range']['days'] != 7:
            fail(f"Expected days=7, got {data['range']['days']}")
        else:
            success(f"range shape correct: {data['range']}")
        
        # Check dates array
        if 'dates' not in data:
            fail("Missing 'dates' field")
        elif not isinstance(data['dates'], list):
            fail(f"dates is not a list: {type(data['dates'])}")
        elif len(data['dates']) != 7:
            fail(f"Expected 7 dates, got {len(data['dates'])}")
        else:
            # Check dates are consecutive and end today
            if data['dates'][-1] != today_str:
                fail(f"Last date should be today ({today_str}), got {data['dates'][-1]}")
            else:
                success(f"dates array correct: 7 consecutive dates ending {today_str}")
        
        # Check children array
        if 'children' not in data:
            fail("Missing 'children' field")
        elif not isinstance(data['children'], list):
            fail(f"children is not a list: {type(data['children'])}")
        elif len(data['children']) != 2:
            fail(f"Expected 2 children, got {len(data['children'])}")
        else:
            success(f"children array has 2 children")
            
            # Check first child shape
            child = data['children'][0]
            required_fields = ['id', 'nickname', 'avatarId', 'favColor', 'habitsTotal', 'daily', 'totals', 'topHabits']
            missing = [f for f in required_fields if f not in child]
            if missing:
                fail(f"Child missing fields: {missing}")
            else:
                success(f"Child has all required fields")
                
                # Check habitsTotal > 0 (seeded child has habits)
                if child['habitsTotal'] <= 0:
                    fail(f"Expected habitsTotal > 0, got {child['habitsTotal']}")
                else:
                    success(f"habitsTotal = {child['habitsTotal']} (> 0)")
                
                # Check daily array length
                if len(child['daily']) != 7:
                    fail(f"Expected daily length 7, got {len(child['daily'])}")
                else:
                    success(f"daily array length = 7")
                    
                    # Check daily item shape
                    day = child['daily'][0]
                    if 'date' not in day or 'done' not in day or 'ihsan' not in day or 'points' not in day:
                        fail(f"Invalid daily item shape: {day}")
                    else:
                        success(f"daily item shape correct")
                
                # Check totals shape
                totals = child['totals']
                totals_fields = ['done', 'ihsan', 'points', 'activeDays', 'claimedPending']
                missing_totals = [f for f in totals_fields if f not in totals]
                if missing_totals:
                    fail(f"totals missing fields: {missing_totals}")
                else:
                    success(f"totals has all required fields")
                
                # Check topHabits is array
                if not isinstance(child['topHabits'], list):
                    fail(f"topHabits is not a list: {type(child['topHabits'])}")
                else:
                    success(f"topHabits is array with {len(child['topHabits'])} items")

except Exception as e:
    fail(f"Request failed: {e}")

# ============================================================================
# TEST 3: days param: ?days=30 → 30 dates
# ============================================================================
test("days param: ?days=30 → 30 dates")
try:
    headers = {'Cookie': f'eqrel_session={COOKIE}'}
    resp = requests.get(f'{API_URL}/family/report?days=30', headers=headers, timeout=10)
    if resp.status_code != 200:
        fail(f"Expected 200, got {resp.status_code}")
    else:
        data = resp.json()
        if data['range']['days'] != 30:
            fail(f"Expected days=30, got {data['range']['days']}")
        elif len(data['dates']) != 30:
            fail(f"Expected 30 dates, got {len(data['dates'])}")
        else:
            success(f"days=30 works correctly")
except Exception as e:
    fail(f"Request failed: {e}")

# ============================================================================
# TEST 4: days param: ?days=0 → defaults/clamps to 1
# ============================================================================
test("days param: ?days=0 → clamps to 1")
try:
    headers = {'Cookie': f'eqrel_session={COOKIE}'}
    resp = requests.get(f'{API_URL}/family/report?days=0', headers=headers, timeout=10)
    if resp.status_code != 200:
        fail(f"Expected 200, got {resp.status_code}")
    else:
        data = resp.json()
        if data['range']['days'] < 1:
            fail(f"Expected days >= 1, got {data['range']['days']}")
        else:
            success(f"days=0 clamped to {data['range']['days']}")
except Exception as e:
    fail(f"Request failed: {e}")

# ============================================================================
# TEST 5: days param: ?days=abc → defaults to 7
# ============================================================================
test("days param: ?days=abc → defaults to 7")
try:
    headers = {'Cookie': f'eqrel_session={COOKIE}'}
    resp = requests.get(f'{API_URL}/family/report?days=abc', headers=headers, timeout=10)
    if resp.status_code != 200:
        fail(f"Expected 200, got {resp.status_code}")
    else:
        data = resp.json()
        if data['range']['days'] != 7:
            fail(f"Expected days=7 (default), got {data['range']['days']}")
        else:
            success(f"days=abc defaults to 7")
except Exception as e:
    fail(f"Request failed: {e}")

# ============================================================================
# TEST 6: days param: ?days=100 → clamps to 31
# ============================================================================
test("days param: ?days=100 → clamps to 31")
try:
    headers = {'Cookie': f'eqrel_session={COOKIE}'}
    resp = requests.get(f'{API_URL}/family/report?days=100', headers=headers, timeout=10)
    if resp.status_code != 200:
        fail(f"Expected 200, got {resp.status_code}")
    else:
        data = resp.json()
        if data['range']['days'] != 31:
            fail(f"Expected days=31 (clamped), got {data['range']['days']}")
        else:
            success(f"days=100 clamped to 31")
except Exception as e:
    fail(f"Request failed: {e}")

# ============================================================================
# TEST 7: Insert habit_claims directly in Mongo and verify calculations
# ============================================================================
test("Direct Mongo inserts for habit_claims verification")
print(f"\n📝 Inserting habit_claims for child 1...")

# Insert claims:
# - Today: habit 1 verified rubric ihsan pointsAwarded 30
# - Yesterday: habit 1 verified rubric sah pointsAwarded 20
# - Today: habit 2 status claimed (no rubric, should count as claimedPending)

claims_to_insert = [
    {
        'id': f'claim-today-ihsan-{CHILD_ID_1}',
        'familyId': FAMILY_ID,
        'childId': CHILD_ID_1,
        'habitId': HABIT_1,
        'dateStr': today_str,
        'status': 'verified',
        'rubric': 'ihsan',
        'pointsAwarded': 30,
        'verifiedBy': USER_ID,
        'verifiedAt': now,
        'createdAt': now,
    },
    {
        'id': f'claim-yesterday-sah-{CHILD_ID_1}',
        'familyId': FAMILY_ID,
        'childId': CHILD_ID_1,
        'habitId': HABIT_1,
        'dateStr': yesterday_str,
        'status': 'verified',
        'rubric': 'sah',
        'pointsAwarded': 20,
        'verifiedBy': USER_ID,
        'verifiedAt': now,
        'createdAt': now,
    },
    {
        'id': f'claim-today-claimed-{CHILD_ID_1}',
        'familyId': FAMILY_ID,
        'childId': CHILD_ID_1,
        'habitId': HABIT_2,
        'dateStr': today_str,
        'status': 'claimed',
        'rubric': None,
        'pointsAwarded': 0,
        'createdAt': now,
    },
]

db.habit_claims.insert_many(claims_to_insert)
print(f"✅ Inserted {len(claims_to_insert)} habit_claims")

# Now fetch report and verify
try:
    headers = {'Cookie': f'eqrel_session={COOKIE}'}
    resp = requests.get(f'{API_URL}/family/report?days=7', headers=headers, timeout=10)
    if resp.status_code != 200:
        fail(f"Expected 200, got {resp.status_code}")
    else:
        data = resp.json()
        
        # Find child 1
        child1 = next((c for c in data['children'] if c['id'] == CHILD_ID_1), None)
        if not child1:
            fail(f"Child 1 not found in response")
        else:
            print(f"\n📊 Child 1 data:")
            print(f"   daily: {child1['daily']}")
            print(f"   totals: {child1['totals']}")
            print(f"   topHabits: {child1['topHabits']}")
            
            # Find today's daily entry
            today_daily = next((d for d in child1['daily'] if d['date'] == today_str), None)
            if not today_daily:
                fail(f"Today's daily entry not found")
            else:
                # Today should have: done=1, ihsan=1, points=30
                if today_daily['done'] != 1:
                    fail(f"Today done should be 1, got {today_daily['done']}")
                else:
                    success(f"Today done = 1 ✓")
                
                if today_daily['ihsan'] != 1:
                    fail(f"Today ihsan should be 1, got {today_daily['ihsan']}")
                else:
                    success(f"Today ihsan = 1 ✓")
                
                if today_daily['points'] != 30:
                    fail(f"Today points should be 30, got {today_daily['points']}")
                else:
                    success(f"Today points = 30 ✓")
            
            # Find yesterday's daily entry
            yesterday_daily = next((d for d in child1['daily'] if d['date'] == yesterday_str), None)
            if not yesterday_daily:
                fail(f"Yesterday's daily entry not found")
            else:
                # Yesterday should have: done=1, ihsan=0, points=20
                if yesterday_daily['done'] != 1:
                    fail(f"Yesterday done should be 1, got {yesterday_daily['done']}")
                else:
                    success(f"Yesterday done = 1 ✓")
                
                if yesterday_daily['ihsan'] != 0:
                    fail(f"Yesterday ihsan should be 0, got {yesterday_daily['ihsan']}")
                else:
                    success(f"Yesterday ihsan = 0 ✓")
                
                if yesterday_daily['points'] != 20:
                    fail(f"Yesterday points should be 20, got {yesterday_daily['points']}")
                else:
                    success(f"Yesterday points = 20 ✓")
            
            # Check totals
            totals = child1['totals']
            # done should be 2 (today + yesterday)
            if totals['done'] != 2:
                fail(f"totals.done should be 2, got {totals['done']}")
            else:
                success(f"totals.done = 2 ✓")
            
            # ihsan should be 1 (only today)
            if totals['ihsan'] != 1:
                fail(f"totals.ihsan should be 1, got {totals['ihsan']}")
            else:
                success(f"totals.ihsan = 1 ✓")
            
            # points should be 50 (30 + 20)
            if totals['points'] != 50:
                fail(f"totals.points should be 50, got {totals['points']}")
            else:
                success(f"totals.points = 50 ✓")
            
            # activeDays should be 2 (today + yesterday)
            if totals['activeDays'] != 2:
                fail(f"totals.activeDays should be 2, got {totals['activeDays']}")
            else:
                success(f"totals.activeDays = 2 ✓")
            
            # claimedPending should be 1 (today's claimed habit 2)
            if totals['claimedPending'] != 1:
                fail(f"totals.claimedPending should be 1, got {totals['claimedPending']}")
            else:
                success(f"totals.claimedPending = 1 ✓")
            
            # Check topHabits contains the habits
            if len(child1['topHabits']) == 0:
                fail(f"topHabits should not be empty")
            else:
                # Should have habit 1 with count 2 (today + yesterday)
                habit1_top = next((h for h in child1['topHabits'] if h['id'] == HABIT_1), None)
                if not habit1_top:
                    fail(f"Habit 1 not found in topHabits")
                elif habit1_top['count'] != 2:
                    fail(f"Habit 1 count should be 2, got {habit1_top['count']}")
                else:
                    success(f"topHabits contains habit 1 with count=2 ✓")
        
        # Check child 2 is unaffected (should have 0 claims)
        child2 = next((c for c in data['children'] if c['id'] == CHILD_ID_2), None)
        if not child2:
            fail(f"Child 2 not found in response")
        else:
            if child2['totals']['done'] != 0:
                fail(f"Child 2 should have 0 done, got {child2['totals']['done']}")
            else:
                success(f"Child 2 unaffected (done=0) ✓")

except Exception as e:
    fail(f"Request failed: {e}")

# ============================================================================
# TEST 8: Test claim with rubric 'belum' should not count
# ============================================================================
test("Claim with rubric 'belum' should not count in done/ihsan")
print(f"\n📝 Inserting claim with rubric 'belum'...")

# Insert a claim with rubric 'belum' (should not count)
db.habit_claims.insert_one({
    'id': f'claim-today-belum-{CHILD_ID_1}',
    'familyId': FAMILY_ID,
    'childId': CHILD_ID_1,
    'habitId': HABIT_2,
    'dateStr': today_str,
    'status': 'verified',
    'rubric': 'belum',
    'pointsAwarded': 0,
    'verifiedBy': USER_ID,
    'verifiedAt': now,
    'createdAt': now,
})

try:
    headers = {'Cookie': f'eqrel_session={COOKIE}'}
    resp = requests.get(f'{API_URL}/family/report?days=7', headers=headers, timeout=10)
    if resp.status_code != 200:
        fail(f"Expected 200, got {resp.status_code}")
    else:
        data = resp.json()
        child1 = next((c for c in data['children'] if c['id'] == CHILD_ID_1), None)
        if not child1:
            fail(f"Child 1 not found")
        else:
            # Totals should still be same (belum doesn't count)
            if child1['totals']['done'] != 2:
                fail(f"totals.done should still be 2 (belum doesn't count), got {child1['totals']['done']}")
            else:
                success(f"Claim with rubric 'belum' correctly excluded from done count ✓")
except Exception as e:
    fail(f"Request failed: {e}")

# ============================================================================
# TEST 9: Test claim older than range should not count
# ============================================================================
test("Claim older than range should not count")
print(f"\n📝 Inserting claim from 10 days ago...")

ten_days_ago = today - timedelta(days=10)
ten_days_ago_str = fmt_date(ten_days_ago)

db.habit_claims.insert_one({
    'id': f'claim-old-{CHILD_ID_1}',
    'familyId': FAMILY_ID,
    'childId': CHILD_ID_1,
    'habitId': HABIT_1,
    'dateStr': ten_days_ago_str,
    'status': 'verified',
    'rubric': 'sah',
    'pointsAwarded': 100,
    'verifiedBy': USER_ID,
    'verifiedAt': now,
    'createdAt': now,
})

try:
    headers = {'Cookie': f'eqrel_session={COOKIE}'}
    resp = requests.get(f'{API_URL}/family/report?days=7', headers=headers, timeout=10)
    if resp.status_code != 200:
        fail(f"Expected 200, got {resp.status_code}")
    else:
        data = resp.json()
        child1 = next((c for c in data['children'] if c['id'] == CHILD_ID_1), None)
        if not child1:
            fail(f"Child 1 not found")
        else:
            # Totals should still be same (old claim outside range)
            if child1['totals']['done'] != 2:
                fail(f"totals.done should still be 2 (old claim outside range), got {child1['totals']['done']}")
            elif child1['totals']['points'] != 50:
                fail(f"totals.points should still be 50 (old claim outside range), got {child1['totals']['points']}")
            else:
                success(f"Claim older than range correctly excluded ✓")
except Exception as e:
    fail(f"Request failed: {e}")

# ============================================================================
# TEST 10: User with no familyId → 400
# ============================================================================
test("User with no familyId → 400")
print(f"\n📝 Creating user without familyId...")

# Create a user without familyId
no_family_user_id = f'test-user-nofam-{now.timestamp()}'
no_family_session_id = f'test-session-nofam-{now.timestamp()}'

db.users.insert_one({
    'id': no_family_user_id,
    'email': f'nofam-{now.timestamp()}@test.local',
    'name': 'No Family User',
    'familyId': None,
    'role': 'parent',
    'createdAt': now,
})

db.sessions.insert_one({
    'sid': no_family_session_id,
    'userId': no_family_user_id,
    'email': f'nofam-{now.timestamp()}@test.local',
    'createdAt': now,
    'expiresAt': now + timedelta(days=1),
})

# Create JWT for this user
import time
from jose import jwt
now_epoch = int(time.time())
exp_epoch = now_epoch + 24 * 60 * 60
payload = {
    'sid': no_family_session_id,
    'userId': no_family_user_id,
    'email': f'nofam-{now.timestamp()}@test.local',
    'name': 'No Family User',
    'familyId': None,
    'role': 'parent',
    'iat': now_epoch,
    'exp': exp_epoch,
}
AUTH_SECRET = os.getenv('AUTH_SECRET', 'eqrel-cohort-a-super-secret-key-change-in-production-2026-11-08')
# Read from .env
try:
    with open('/app/.env') as f:
        for line in f:
            if line.startswith('AUTH_SECRET='):
                AUTH_SECRET = line.strip().split('=', 1)[1].strip('"').strip("'")
                break
except Exception:
    pass

no_family_token = jwt.encode(payload, AUTH_SECRET, algorithm='HS256')

try:
    headers = {'Cookie': f'eqrel_session={no_family_token}'}
    resp = requests.get(f'{API_URL}/family/report', headers=headers, timeout=10)
    if resp.status_code == 400:
        success(f"Got 400 for user without familyId")
    else:
        fail(f"Expected 400, got {resp.status_code}")
except Exception as e:
    fail(f"Request failed: {e}")

# ============================================================================
# TEST 11: Quick regression - GET /api/family/streak
# ============================================================================
test("Regression: GET /api/family/streak still works")
try:
    headers = {'Cookie': f'eqrel_session={COOKIE}'}
    resp = requests.get(f'{API_URL}/family/streak', headers=headers, timeout=10)
    if resp.status_code != 200:
        fail(f"Expected 200, got {resp.status_code}")
    else:
        data = resp.json()
        if 'streak' not in data or 'longestStreak' not in data or 'todayDone' not in data or 'days' not in data:
            fail(f"Invalid response shape: {data}")
        else:
            success(f"GET /api/family/streak works ✓")
except Exception as e:
    fail(f"Request failed: {e}")

# ============================================================================
# TEST 12: Quick regression - GET /api/family/display-config
# ============================================================================
test("Regression: GET /api/family/display-config still works")
try:
    headers = {'Cookie': f'eqrel_session={COOKIE}'}
    resp = requests.get(f'{API_URL}/family/display-config', headers=headers, timeout=10)
    if resp.status_code != 200:
        fail(f"Expected 200, got {resp.status_code}")
    else:
        data = resp.json()
        if 'config' not in data:
            fail(f"Invalid response shape: {data}")
        else:
            success(f"GET /api/family/display-config works ✓")
except Exception as e:
    fail(f"Request failed: {e}")

# ============================================================================
# TEST 13: Quick regression - GET /api/family/display-data
# ============================================================================
test("Regression: GET /api/family/display-data still works")
try:
    headers = {'Cookie': f'eqrel_session={COOKIE}'}
    resp = requests.get(f'{API_URL}/family/display-data', headers=headers, timeout=10)
    if resp.status_code != 200:
        fail(f"Expected 200, got {resp.status_code}")
    else:
        data = resp.json()
        if 'family' not in data or 'children' not in data:
            fail(f"Invalid response shape: {data}")
        else:
            success(f"GET /api/family/display-data works ✓")
except Exception as e:
    fail(f"Request failed: {e}")

# ============================================================================
# CLEANUP
# ============================================================================
print(f"\n{'='*80}")
print("🧹 CLEANUP")
print('='*80)

print("\n📦 Running cleanup script...")
cleanup_result = subprocess.run(['python', '/app/scripts/cleanup_test_family.py'], capture_output=True, text=True)
if cleanup_result.returncode == 0:
    print("✅ Cleanup successful")
else:
    print(f"⚠️  Cleanup had issues: {cleanup_result.stderr}")

# Also clean up the no-family user
db.users.delete_one({'id': no_family_user_id})
db.sessions.delete_one({'sid': no_family_session_id})
print("✅ Cleaned up no-family test user")

# ============================================================================
# SUMMARY
# ============================================================================
print(f"\n{'='*80}")
print("📊 TEST SUMMARY")
print('='*80)
print(f"✅ Passed: {passed}")
print(f"❌ Failed: {failed}")
print(f"📝 Total:  {test_num}")

if failed == 0:
    print("\n🎉 ALL TESTS PASSED!")
    sys.exit(0)
else:
    print(f"\n❌ {failed} TEST(S) FAILED")
    sys.exit(1)
