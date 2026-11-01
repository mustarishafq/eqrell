#!/usr/bin/env python3
"""
Backend test for Rest Mode (Mod Musafir & Hari Rehat) — family-wide + per-child
Tests all endpoints and edge cases as specified in the review request.
"""
import os
import sys
import requests
from datetime import datetime, timedelta

# Read test credentials from file
COOKIE = None
FAMILY_ID = None
CHILD_ID_1 = None
CHILD_ID_2 = None

try:
    with open('/tmp/eqrel_test_ids.txt', 'r') as f:
        for line in f:
            if line.startswith('FAMILY_ID='):
                FAMILY_ID = line.strip().split('=')[1]
            elif line.startswith('CHILD_ID_1='):
                CHILD_ID_1 = line.strip().split('=')[1]
            elif line.startswith('CHILD_ID_2='):
                CHILD_ID_2 = line.strip().split('=')[1]
except FileNotFoundError:
    pass

# Get cookie from seed script output (run fresh seed)
lines = os.popen('python /app/scripts/seed_test_family.py 2>/dev/null').read().strip().split('\n')
for line in lines:
    if line.startswith('COOKIE='):
        COOKIE = line.split('=', 1)[1]
    elif line.startswith('FAMILY_ID='):
        FAMILY_ID = line.split('=')[1]
    elif line.startswith('CHILD_ID_1='):
        CHILD_ID_1 = line.split('=')[1]
    elif line.startswith('CHILD_ID_2='):
        CHILD_ID_2 = line.split('=')[1]

BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000')
API_URL = f'{BASE_URL}/api'

def req(method, path, **kwargs):
    """Make API request with auth cookie"""
    headers = kwargs.pop('headers', {})
    if COOKIE and 'no_auth' not in kwargs:
        headers['Cookie'] = f'eqrel_session={COOKIE}'
    kwargs.pop('no_auth', None)
    url = f'{API_URL}{path}'
    return requests.request(method, url, headers=headers, **kwargs)

def today():
    return datetime.utcnow().strftime('%Y-%m-%d')

def tomorrow():
    return (datetime.utcnow() + timedelta(days=1)).strftime('%Y-%m-%d')

def yesterday():
    return (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d')

def days_from_now(n):
    return (datetime.utcnow() + timedelta(days=n)).strftime('%Y-%m-%d')

print("=" * 80)
print("REST MODE BACKEND TESTS")
print("=" * 80)
print(f"API URL: {API_URL}")
print(f"Family ID: {FAMILY_ID}")
print(f"Child 1 ID: {CHILD_ID_1}")
print(f"Child 2 ID: {CHILD_ID_2}")
print()

test_count = 0
pass_count = 0

def test(name, condition, details=""):
    global test_count, pass_count
    test_count += 1
    if condition:
        pass_count += 1
        print(f"✅ TEST {test_count}: {name}")
        if details:
            print(f"   {details}")
    else:
        print(f"❌ TEST {test_count}: {name}")
        if details:
            print(f"   {details}")
    return condition

# ============================================================================
# SECTION 1: GET /api/family/rest-mode — Initial state
# ============================================================================
print("\n" + "=" * 80)
print("SECTION 1: GET /api/family/rest-mode — Initial state")
print("=" * 80)

r = req('GET', '/family/rest-mode')
test("GET /family/rest-mode returns 200", r.status_code == 200, f"Status: {r.status_code}")
data = r.json()
test("restMode is null initially", data.get('restMode') is None, f"restMode: {data.get('restMode')}")
test("children array present", 'children' in data and isinstance(data['children'], list), f"children count: {len(data.get('children', []))}")
test("children have id, nickname, restMode fields", 
     all('id' in c and 'nickname' in c and 'restMode' in c for c in data.get('children', [])),
     f"First child: {data.get('children', [{}])[0] if data.get('children') else 'N/A'}")

# ============================================================================
# SECTION 2: GET /api/family/rest-mode — Auth guard
# ============================================================================
print("\n" + "=" * 80)
print("SECTION 2: Auth guard")
print("=" * 80)

r = req('GET', '/family/rest-mode', no_auth=True)
test("GET without auth returns 401", r.status_code == 401, f"Status: {r.status_code}")

# ============================================================================
# SECTION 3: Ensure core habits exist before starting rest
# ============================================================================
print("\n" + "=" * 80)
print("SECTION 3: Ensure core Solat habits exist (call GET /children/:id/habits)")
print("=" * 80)

# Call GET /children/:id/habits to trigger ensureSolatCore
r = req('GET', f'/children/{CHILD_ID_1}/habits')
test("GET /children/:id/habits returns 200", r.status_code == 200, f"Status: {r.status_code}")
habits_data = r.json()
core_habits = [h for h in habits_data.get('habits', []) if h.get('core')]
test("Core Solat habits created for child 1", len(core_habits) > 0, f"Core habits count: {len(core_habits)}")

# ============================================================================
# SECTION 4: POST /api/family/rest-mode — Invalid inputs
# ============================================================================
print("\n" + "=" * 80)
print("SECTION 4: POST /api/family/rest-mode — Invalid inputs")
print("=" * 80)

# Invalid reason
r = req('POST', '/family/rest-mode', json={'reason': 'invalid'})
test("Invalid reason returns 400", r.status_code == 400, f"Status: {r.status_code}, Error: {r.json().get('error')}")

# Unknown childId
r = req('POST', '/family/rest-mode', json={'reason': 'musafir', 'childId': 'unknown-child-id'})
test("Unknown childId returns 404", r.status_code == 404, f"Status: {r.status_code}, Error: {r.json().get('error')}")

# until before today
r = req('POST', '/family/rest-mode', json={'reason': 'musafir', 'until': yesterday()})
test("until before today returns 400", r.status_code == 400, f"Status: {r.status_code}, Error: {r.json().get('error')}")

# ============================================================================
# SECTION 5: POST /api/family/rest-mode — Days clamping
# ============================================================================
print("\n" + "=" * 80)
print("SECTION 5: Days clamping (1..14)")
print("=" * 80)

# days=30 should clamp to 14
r = req('POST', '/family/rest-mode', json={'reason': 'musafir', 'days': 30})
test("days=30 clamped to 14", r.status_code == 200, f"Status: {r.status_code}")
if r.status_code == 200:
    rest_data = r.json()
    test("restMode.days === 14", rest_data.get('restMode', {}).get('days') == 14, 
         f"days: {rest_data.get('restMode', {}).get('days')}")
    test("paused count > 0", rest_data.get('paused', 0) > 0, f"paused: {rest_data.get('paused')}")

# End the rest to clean up
r = req('POST', '/family/rest-mode/end')
test("End family rest after clamping test", r.status_code == 200, f"Status: {r.status_code}")

# ============================================================================
# SECTION 6: POST /api/family/rest-mode — until parameter
# ============================================================================
print("\n" + "=" * 80)
print("SECTION 6: until parameter (YYYY-MM-DD)")
print("=" * 80)

# until=today+2 should give days=3
until_date = days_from_now(2)
r = req('POST', '/family/rest-mode', json={'reason': 'rehat', 'until': until_date})
test("until=today+2 returns 200", r.status_code == 200, f"Status: {r.status_code}")
if r.status_code == 200:
    rest_data = r.json()
    test("days === 3 (today, tomorrow, day after)", rest_data.get('restMode', {}).get('days') == 3,
         f"days: {rest_data.get('restMode', {}).get('days')}")

# End the rest
r = req('POST', '/family/rest-mode/end')
test("End family rest after until test", r.status_code == 200, f"Status: {r.status_code}")

# ============================================================================
# SECTION 7: Family-scope rest mode
# ============================================================================
print("\n" + "=" * 80)
print("SECTION 7: Family-scope rest mode (no childId)")
print("=" * 80)

# Start family rest
r = req('POST', '/family/rest-mode', json={'reason': 'musafir', 'days': 3})
test("Start family rest returns 200", r.status_code == 200, f"Status: {r.status_code}")
family_rest_data = r.json()
test("restMode.scope === 'family'", family_rest_data.get('restMode', {}).get('scope') == 'family',
     f"scope: {family_rest_data.get('restMode', {}).get('scope')}")
test("restMode.reason === 'musafir'", family_rest_data.get('restMode', {}).get('reason') == 'musafir',
     f"reason: {family_rest_data.get('restMode', {}).get('reason')}")
test("paused count > 0 (non-core habits paused)", family_rest_data.get('paused', 0) > 0,
     f"paused: {family_rest_data.get('paused')}")

# Verify GET returns family restMode
r = req('GET', '/family/rest-mode')
test("GET shows family restMode", r.status_code == 200 and r.json().get('restMode') is not None,
     f"restMode: {r.json().get('restMode', {}).get('reason') if r.status_code == 200 else 'N/A'}")

# Verify children have no child-level restMode (cleared by family rest)
if r.status_code == 200:
    children = r.json().get('children', [])
    test("All children have restMode=null (family rest clears child rest)", 
         all(c.get('restMode') is None for c in children),
         f"Children restModes: {[c.get('restMode') for c in children]}")

# ============================================================================
# SECTION 8: Core habits NOT paused during family rest
# ============================================================================
print("\n" + "=" * 80)
print("SECTION 8: Core Solat habits NOT paused during family rest")
print("=" * 80)

r = req('GET', f'/children/{CHILD_ID_1}/habits')
test("GET /children/:id/habits returns 200", r.status_code == 200, f"Status: {r.status_code}")
if r.status_code == 200:
    habits = r.json().get('habits', [])
    paused_habits = r.json().get('pausedHabits', [])
    core_habits = [h for h in habits if h.get('core')]
    core_paused = [h for h in paused_habits if h.get('core')]
    test("Core habits still in active habits list", len(core_habits) > 0, f"Core habits: {len(core_habits)}")
    test("Core habits NOT in pausedHabits", len(core_paused) == 0, f"Core paused: {len(core_paused)}")

# ============================================================================
# SECTION 9: GET /children/:id/habits returns restMode
# ============================================================================
print("\n" + "=" * 80)
print("SECTION 9: GET /children/:id/habits includes restMode field")
print("=" * 80)

r = req('GET', f'/children/{CHILD_ID_1}/habits')
if r.status_code == 200:
    rest_mode = r.json().get('restMode')
    test("restMode field present", rest_mode is not None, f"restMode: {rest_mode}")
    if rest_mode:
        test("restMode.scope === 'family'", rest_mode.get('scope') == 'family',
             f"scope: {rest_mode.get('scope')}")
        test("restMode.reason === 'musafir'", rest_mode.get('reason') == 'musafir',
             f"reason: {rest_mode.get('reason')}")

# ============================================================================
# SECTION 10: GET /world/:childId returns restMode
# ============================================================================
print("\n" + "=" * 80)
print("SECTION 10: GET /world/:childId includes restMode field")
print("=" * 80)

r = req('GET', f'/world/{CHILD_ID_1}')
test("GET /world/:childId returns 200", r.status_code == 200, f"Status: {r.status_code}")
if r.status_code == 200:
    rest_mode = r.json().get('restMode')
    test("restMode field present", rest_mode is not None, f"restMode: {rest_mode}")
    if rest_mode:
        test("restMode.scope === 'family'", rest_mode.get('scope') == 'family',
             f"scope: {rest_mode.get('scope')}")

# ============================================================================
# SECTION 11: Try to start child rest while family rest active → 409
# ============================================================================
print("\n" + "=" * 80)
print("SECTION 11: Child rest while family rest active → 409")
print("=" * 80)

r = req('POST', '/family/rest-mode', json={'reason': 'rehat', 'days': 2, 'childId': CHILD_ID_1})
test("Child rest while family active returns 409", r.status_code == 409,
     f"Status: {r.status_code}, Error: {r.json().get('error')}")

# ============================================================================
# SECTION 12: End family rest
# ============================================================================
print("\n" + "=" * 80)
print("SECTION 12: POST /family/rest-mode/end (family scope)")
print("=" * 80)

r = req('POST', '/family/rest-mode/end')
test("End family rest returns 200", r.status_code == 200, f"Status: {r.status_code}")
if r.status_code == 200:
    end_data = r.json()
    test("resumed count > 0", end_data.get('resumed', 0) > 0, f"resumed: {end_data.get('resumed')}")
    test("scope === 'family'", end_data.get('scope') == 'family', f"scope: {end_data.get('scope')}")

# Verify GET shows no family restMode
r = req('GET', '/family/rest-mode')
test("GET shows restMode=null after end", r.status_code == 200 and r.json().get('restMode') is None,
     f"restMode: {r.json().get('restMode')}")

# Verify habits resumed
r = req('GET', f'/children/{CHILD_ID_1}/habits')
if r.status_code == 200:
    paused_with_rest_reason = [h for h in r.json().get('pausedHabits', []) 
                                if h.get('pauseReason') in ['musafir', 'rehat']]
    test("No habits paused with musafir/rehat reason", len(paused_with_rest_reason) == 0,
         f"Paused with rest reason: {len(paused_with_rest_reason)}")

# ============================================================================
# SECTION 13: Per-child rest mode
# ============================================================================
print("\n" + "=" * 80)
print("SECTION 13: Per-child rest mode")
print("=" * 80)

# Start rest for child 1 only
r = req('POST', '/family/rest-mode', json={'reason': 'rehat', 'days': 2, 'childId': CHILD_ID_1})
test("Start child rest returns 200", r.status_code == 200, f"Status: {r.status_code}")
child_rest_data = r.json()
test("restMode.scope === 'child'", child_rest_data.get('restMode', {}).get('scope') == 'child',
     f"scope: {child_rest_data.get('restMode', {}).get('scope')}")
test("restMode.childId === CHILD_ID_1", child_rest_data.get('restMode', {}).get('childId') == CHILD_ID_1,
     f"childId: {child_rest_data.get('restMode', {}).get('childId')}")

# Verify GET shows child 1 has restMode, child 2 doesn't
r = req('GET', '/family/rest-mode')
if r.status_code == 200:
    children = r.json().get('children', [])
    child1 = next((c for c in children if c['id'] == CHILD_ID_1), None)
    child2 = next((c for c in children if c['id'] == CHILD_ID_2), None)
    test("Child 1 has restMode", child1 and child1.get('restMode') is not None,
         f"Child 1 restMode: {child1.get('restMode') if child1 else 'N/A'}")
    test("Child 2 has restMode=null", child2 and child2.get('restMode') is None,
         f"Child 2 restMode: {child2.get('restMode') if child2 else 'N/A'}")

# Verify child 2 habits show restMode=null
r = req('GET', f'/children/{CHILD_ID_2}/habits')
if r.status_code == 200:
    test("Child 2 habits restMode=null", r.json().get('restMode') is None,
         f"Child 2 restMode: {r.json().get('restMode')}")

# ============================================================================
# SECTION 14: Family rest supersedes child rest
# ============================================================================
print("\n" + "=" * 80)
print("SECTION 14: Family rest supersedes child rest")
print("=" * 80)

# Start family rest (should clear child 1's rest)
r = req('POST', '/family/rest-mode', json={'reason': 'musafir', 'days': 2})
test("Start family rest returns 200", r.status_code == 200, f"Status: {r.status_code}")

# Verify child 1 restMode cleared
r = req('GET', '/family/rest-mode')
if r.status_code == 200:
    children = r.json().get('children', [])
    child1 = next((c for c in children if c['id'] == CHILD_ID_1), None)
    test("Child 1 restMode cleared by family rest", child1 and child1.get('restMode') is None,
         f"Child 1 restMode: {child1.get('restMode') if child1 else 'N/A'}")
    test("Family restMode active", r.json().get('restMode') is not None,
         f"Family restMode: {r.json().get('restMode', {}).get('reason')}")

# End family rest for next tests
r = req('POST', '/family/rest-mode/end')
test("End family rest", r.status_code == 200, f"Status: {r.status_code}")

# ============================================================================
# SECTION 15: End child rest while family rest active → 409
# ============================================================================
print("\n" + "=" * 80)
print("SECTION 15: End child rest while family rest active → 409")
print("=" * 80)

# Start family rest
r = req('POST', '/family/rest-mode', json={'reason': 'musafir', 'days': 2})
test("Start family rest", r.status_code == 200, f"Status: {r.status_code}")

# Try to end child rest
r = req('POST', '/family/rest-mode/end', json={'childId': CHILD_ID_1})
test("End child rest while family active returns 409", r.status_code == 409,
     f"Status: {r.status_code}, Error: {r.json().get('error')}")

# Clean up
r = req('POST', '/family/rest-mode/end')
test("End family rest cleanup", r.status_code == 200, f"Status: {r.status_code}")

# ============================================================================
# SECTION 16: Regression - Solat pause endpoints still work
# ============================================================================
print("\n" + "=" * 80)
print("SECTION 16: Regression - Solat pause endpoints")
print("=" * 80)

# POST /children/:id/solat-pause
r = req('POST', f'/children/{CHILD_ID_1}/solat-pause', json={'reason': 'sakit', 'days': 1})
test("POST /children/:id/solat-pause returns 200", r.status_code == 200,
     f"Status: {r.status_code}")

# Verify solatPause in GET /children/:id/habits
r = req('GET', f'/children/{CHILD_ID_1}/habits')
if r.status_code == 200:
    solat_pause = r.json().get('solatPause')
    test("solatPause field present", solat_pause is not None, f"solatPause: {solat_pause}")
    if solat_pause:
        test("solatPause.reason === 'sakit'", solat_pause.get('reason') == 'sakit',
             f"reason: {solat_pause.get('reason')}")

# POST /children/:id/solat-resume
r = req('POST', f'/children/{CHILD_ID_1}/solat-resume')
test("POST /children/:id/solat-resume returns 200", r.status_code == 200,
     f"Status: {r.status_code}")

# ============================================================================
# SECTION 17: GET /family/streak with frozen days
# ============================================================================
print("\n" + "=" * 80)
print("SECTION 17: GET /family/streak with frozen days")
print("=" * 80)

# Start a rest period to add frozen days
r = req('POST', '/family/rest-mode', json={'reason': 'musafir', 'days': 2})
test("Start family rest for streak test", r.status_code == 200, f"Status: {r.status_code}")

# Get streak
r = req('GET', '/family/streak')
test("GET /family/streak returns 200", r.status_code == 200, f"Status: {r.status_code}")
if r.status_code == 200:
    streak_data = r.json()
    test("streak field present", 'streak' in streak_data, f"streak: {streak_data.get('streak')}")
    test("longestStreak field present", 'longestStreak' in streak_data,
         f"longestStreak: {streak_data.get('longestStreak')}")
    test("todayDone field present", 'todayDone' in streak_data,
         f"todayDone: {streak_data.get('todayDone')}")

# Clean up
r = req('POST', '/family/rest-mode/end')
test("End family rest cleanup", r.status_code == 200, f"Status: {r.status_code}")

# ============================================================================
# SUMMARY
# ============================================================================
print("\n" + "=" * 80)
print("TEST SUMMARY")
print("=" * 80)
print(f"Total tests: {test_count}")
print(f"Passed: {pass_count}")
print(f"Failed: {test_count - pass_count}")
print(f"Success rate: {pass_count / test_count * 100:.1f}%")
print("=" * 80)

if pass_count == test_count:
    print("✅ ALL TESTS PASSED")
    sys.exit(0)
else:
    print(f"❌ {test_count - pass_count} TEST(S) FAILED")
    sys.exit(1)
