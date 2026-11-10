#!/usr/bin/env python3
"""
Backend Test: Catch-up (Late) Claims
Tests the ability for parents and kids to claim habits for past days.
"""
import os
import sys
import requests
import subprocess
from datetime import datetime, timedelta
from pymongo import MongoClient

# Load environment
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'eqrel')
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000') + '/api'

def get_date_str(days_offset=0):
    """Get UTC date string (YYYY-MM-DD) with offset"""
    return (datetime.utcnow() + timedelta(days=days_offset)).strftime('%Y-%m-%d')

def get_weekday_of_date(date_str):
    """Get weekday (0=Sun, 6=Sat) of a date string"""
    dt = datetime.strptime(date_str, '%Y-%m-%d')
    return (dt.weekday() + 1) % 7  # Convert Python weekday to JS weekday

def run_seed_script():
    """Run seed script and return parent cookie + child IDs"""
    print("\n=== Running seed_test_family.py ===")
    result = subprocess.run(['python', '/app/scripts/seed_test_family.py'], 
                          capture_output=True, text=True, timeout=30)
    
    cookie = None
    child1_id = None
    child2_id = None
    family_id = None
    
    for line in result.stdout.split('\n'):
        if line.startswith('COOKIE='):
            cookie = line.split('=', 1)[1].strip()
        elif line.startswith('CHILD_ID_1='):
            child1_id = line.split('=', 1)[1].strip()
        elif line.startswith('CHILD_ID_2='):
            child2_id = line.split('=', 1)[1].strip()
        elif line.startswith('FAMILY_ID='):
            family_id = line.split('=', 1)[1].strip()
    
    if not cookie or not child1_id:
        print(f"❌ Failed to get credentials from seed script")
        print(f"STDOUT: {result.stdout}")
        print(f"STDERR: {result.stderr}")
        sys.exit(1)
    
    print(f"✅ Parent cookie obtained")
    print(f"✅ Child 1 ID: {child1_id}")
    print(f"✅ Child 2 ID: {child2_id}")
    print(f"✅ Family ID: {family_id}")
    
    return cookie, child1_id, child2_id, family_id

def get_kid_cookie():
    """Get kid device cookie via Way B (parent generates code, kid redeems)"""
    print("\n=== Getting Kid Device Cookie ===")
    
    # Use parent cookie to generate kid code
    parent_cookie, child1_id, child2_id, family_id = run_seed_script()
    
    # Generate kid code for child 1
    resp = requests.post(
        f'{BASE_URL}/family/kid-codes',
        json={'childId': child1_id},
        cookies={'eqrel_session': parent_cookie}
    )
    
    if resp.status_code != 200:
        print(f"❌ Failed to generate kid code: {resp.status_code} {resp.text}")
        return None, None, child1_id, child2_id, family_id
    
    code = resp.json().get('code')
    print(f"✅ Kid code generated: {code}")
    
    # Redeem code to get kid session
    resp = requests.post(
        f'{BASE_URL}/kid/device/redeem',
        json={'code': code}
    )
    
    if resp.status_code != 200:
        print(f"❌ Failed to redeem kid code: {resp.status_code} {resp.text}")
        return None, parent_cookie, child1_id, child2_id, family_id
    
    # Extract kid cookie from response
    kid_cookie = resp.cookies.get('eqrel_session')
    if not kid_cookie:
        print(f"❌ No kid session cookie in response")
        return None, parent_cookie, child1_id, child2_id, family_id
    
    print(f"✅ Kid device cookie obtained")
    return kid_cookie, parent_cookie, child1_id, child2_id, family_id

def test_parent_catchup_claims():
    """Test parent catch-up claims functionality"""
    print("\n" + "="*80)
    print("PARENT CATCH-UP CLAIMS TESTS")
    print("="*80)
    
    cookie, child1_id, child2_id, family_id = run_seed_script()
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    today = get_date_str(0)
    yesterday = get_date_str(-1)
    day7_ago = get_date_str(-7)
    day8_ago = get_date_str(-8)
    tomorrow = get_date_str(1)
    day2_ago = get_date_str(-2)
    
    print(f"\nDate references:")
    print(f"  Today: {today}")
    print(f"  Yesterday: {yesterday}")
    print(f"  7 days ago: {day7_ago}")
    print(f"  8 days ago: {day8_ago}")
    print(f"  Tomorrow: {tomorrow}")
    
    # TEST 1: Create daily habit, backdate createdAt, test various date claims
    print("\n--- TEST 1: Daily habit with backdated createdAt ---")
    
    # Create habit
    resp = requests.post(
        f'{BASE_URL}/children/{child1_id}/habits',
        json={
            'title': 'TEST_Catchup_Daily',
            'points': 10,
            'recurring': 'daily',
            'icon': '📚',
            'category': 'learning'
        },
        cookies={'eqrel_session': cookie}
    )
    
    if resp.status_code != 200:
        print(f"❌ Failed to create habit: {resp.status_code} {resp.text}")
        return False
    
    result = resp.json()
    habit_id = result.get('habit', {}).get('id')
    print(f"✅ Created habit: {habit_id}")
    
    if not habit_id:
        print(f"❌ No habit ID in response: {result}")
        return False
    
    # Backdate createdAt to 10 days ago
    ten_days_ago = datetime.utcnow() - timedelta(days=10)
    db.habits.update_one(
        {'id': habit_id},
        {'$set': {'createdAt': ten_days_ago}}
    )
    print(f"✅ Backdated habit createdAt to 10 days ago")
    
    # Get child's initial mataBina
    child_before = db.children.find_one({'id': child1_id})
    mata_bina_before = child_before.get('mataBina', 0)
    print(f"  Child mataBina before: {mata_bina_before}")
    
    # TEST 1a: Claim yesterday with rubric 'sah'
    print("\n  TEST 1a: Claim yesterday with rubric 'sah'")
    resp = requests.post(
        f'{BASE_URL}/habits/{habit_id}/claim',
        json={'dateStr': yesterday, 'rubric': 'sah'},
        cookies={'eqrel_session': cookie}
    )
    
    if resp.status_code != 200:
        print(f"  ❌ Failed to claim yesterday: {resp.status_code} {resp.text}")
        return False
    
    result = resp.json()
    if result.get('points') != 10:
        print(f"  ❌ Expected 10 points, got {result.get('points')}")
        return False
    
    # Verify mataBina increased by 10
    child_after = db.children.find_one({'id': child1_id})
    mata_bina_after = child_after.get('mataBina', 0)
    
    if mata_bina_after != mata_bina_before + 10:
        print(f"  ❌ Expected mataBina {mata_bina_before + 10}, got {mata_bina_after}")
        return False
    
    print(f"  ✅ Claimed yesterday successfully, points: 10, mataBina: {mata_bina_before} → {mata_bina_after}")
    
    # TEST 1b: Claim 7 days ago (should work)
    print("\n  TEST 1b: Claim 7 days ago (should work)")
    resp = requests.post(
        f'{BASE_URL}/habits/{habit_id}/claim',
        json={'dateStr': day7_ago, 'rubric': 'sah'},
        cookies={'eqrel_session': cookie}
    )
    
    if resp.status_code != 200:
        print(f"  ❌ Failed to claim 7 days ago: {resp.status_code} {resp.text}")
        return False
    
    print(f"  ✅ Claimed 7 days ago successfully")
    
    # TEST 1c: Claim 8 days ago (should fail - too far back)
    print("\n  TEST 1c: Claim 8 days ago (should fail - too far back)")
    resp = requests.post(
        f'{BASE_URL}/habits/{habit_id}/claim',
        json={'dateStr': day8_ago, 'rubric': 'sah'},
        cookies={'eqrel_session': cookie}
    )
    
    if resp.status_code != 400:
        print(f"  ❌ Expected 400, got {resp.status_code}")
        return False
    
    if 'Too far back' not in resp.text:
        print(f"  ❌ Expected 'Too far back' error, got: {resp.text}")
        return False
    
    print(f"  ✅ Correctly rejected 8 days ago claim (400)")
    
    # TEST 1d: Claim tomorrow (should fail - future date)
    print("\n  TEST 1d: Claim tomorrow (should fail - future date)")
    resp = requests.post(
        f'{BASE_URL}/habits/{habit_id}/claim',
        json={'dateStr': tomorrow, 'rubric': 'sah'},
        cookies={'eqrel_session': cookie}
    )
    
    if resp.status_code != 400:
        print(f"  ❌ Expected 400, got {resp.status_code}")
        return False
    
    if 'not come yet' not in resp.text:
        print(f"  ❌ Expected 'not come yet' error, got: {resp.text}")
        return False
    
    print(f"  ✅ Correctly rejected tomorrow claim (400)")
    
    # TEST 1e: Claim with bad date format (should fail)
    print("\n  TEST 1e: Claim with bad date format (should fail)")
    resp = requests.post(
        f'{BASE_URL}/habits/{habit_id}/claim',
        json={'dateStr': 'not-a-date', 'rubric': 'sah'},
        cookies={'eqrel_session': cookie}
    )
    
    if resp.status_code != 400:
        print(f"  ❌ Expected 400, got {resp.status_code}")
        return False
    
    if 'Invalid date' not in resp.text:
        print(f"  ❌ Expected 'Invalid date' error, got: {resp.text}")
        return False
    
    print(f"  ✅ Correctly rejected bad date format (400)")
    
    # TEST 2: Habit with createdAt today, claim yesterday (should fail)
    print("\n--- TEST 2: Habit created today, claim yesterday (should fail) ---")
    
    resp = requests.post(
        f'{BASE_URL}/children/{child1_id}/habits',
        json={
            'title': 'TEST_Catchup_New',
            'points': 5,
            'recurring': 'daily',
            'icon': '✏️',
            'category': 'learning'
        },
        cookies={'eqrel_session': cookie}
    )
    
    new_habit_id = resp.json().get('habit', {}).get('id')
    print(f"✅ Created new habit: {new_habit_id}")
    
    resp = requests.post(
        f'{BASE_URL}/habits/{new_habit_id}/claim',
        json={'dateStr': yesterday, 'rubric': 'sah'},
        cookies={'eqrel_session': cookie}
    )
    
    if resp.status_code != 400:
        print(f"❌ Expected 400, got {resp.status_code}")
        return False
    
    if 'did not exist' not in resp.text:
        print(f"❌ Expected 'did not exist' error, got: {resp.text}")
        return False
    
    print(f"✅ Correctly rejected claim for day before habit existed (400)")
    
    # TEST 3: Habit with custom schedule excluding yesterday's weekday
    print("\n--- TEST 3: Custom schedule excluding yesterday's weekday ---")
    
    yesterday_weekday = get_weekday_of_date(yesterday)
    # Pick a different weekday
    custom_days = [d for d in range(7) if d != yesterday_weekday][:3]
    
    print(f"  Yesterday weekday: {yesterday_weekday}")
    print(f"  Custom schedule days: {custom_days}")
    
    resp = requests.post(
        f'{BASE_URL}/children/{child1_id}/habits',
        json={
            'title': 'TEST_Catchup_Custom',
            'points': 5,
            'recurring': 'daily',
            'schedule': 'custom',
            'days': custom_days,
            'icon': '🎯',
            'category': 'learning'
        },
        cookies={'eqrel_session': cookie}
    )
    
    custom_habit_id = resp.json().get('habit', {}).get('id')
    print(f"✅ Created custom schedule habit: {custom_habit_id}")
    
    # Backdate this habit too
    db.habits.update_one(
        {'id': custom_habit_id},
        {'$set': {'createdAt': ten_days_ago}}
    )
    
    resp = requests.post(
        f'{BASE_URL}/habits/{custom_habit_id}/claim',
        json={'dateStr': yesterday, 'rubric': 'sah'},
        cookies={'eqrel_session': cookie}
    )
    
    if resp.status_code != 400:
        print(f"❌ Expected 400, got {resp.status_code}")
        return False
    
    if 'not scheduled' not in resp.text:
        print(f"❌ Expected 'not scheduled' error, got: {resp.text}")
        return False
    
    print(f"✅ Correctly rejected claim for off-schedule day (400)")
    
    # TEST 4: GET /children/:id/catchup
    print("\n--- TEST 4: GET /children/:id/catchup ---")
    
    resp = requests.get(
        f'{BASE_URL}/children/{child1_id}/catchup',
        cookies={'eqrel_session': cookie}
    )
    
    if resp.status_code != 200:
        print(f"❌ Failed to get catchup: {resp.status_code} {resp.text}")
        return False
    
    catchup = resp.json()
    days = catchup.get('days', [])
    
    print(f"✅ Got catchup data: {len(days)} days")
    
    if len(days) == 0:
        print(f"❌ Expected at least 1 day in catchup, got 0")
        return False
    
    # Find yesterday in the days array
    yesterday_data = next((d for d in days if d['dateStr'] == yesterday), None)
    
    if not yesterday_data:
        print(f"❌ Yesterday not found in catchup days")
        return False
    
    print(f"  Yesterday data: {yesterday_data}")
    
    if yesterday_data.get('daysAgo') != 1:
        print(f"  ❌ Expected daysAgo=1, got {yesterday_data.get('daysAgo')}")
        return False
    
    if yesterday_data.get('done', 0) < 1:
        print(f"  ❌ Expected done>=1 (we claimed a habit), got {yesterday_data.get('done')}")
        return False
    
    print(f"  ✅ Yesterday shows done={yesterday_data.get('done')}, daysAgo=1")
    
    # Verify structure
    required_keys = ['dateStr', 'daysAgo', 'total', 'done', 'pending', 'missed']
    for key in required_keys:
        if key not in yesterday_data:
            print(f"  ❌ Missing key '{key}' in catchup day data")
            return False
    
    print(f"  ✅ All required keys present in catchup data")
    
    # TEST 5: GET /children/:id/habits?date=yesterday
    print("\n--- TEST 5: GET /children/:id/habits?date=yesterday ---")
    
    resp = requests.get(
        f'{BASE_URL}/children/{child1_id}/habits?date={yesterday}',
        cookies={'eqrel_session': cookie}
    )
    
    if resp.status_code != 200:
        print(f"❌ Failed to get habits for yesterday: {resp.status_code} {resp.text}")
        return False
    
    habits = resp.json().get('habits', [])
    
    # Find our claimed habit
    claimed_habit = next((h for h in habits if h['id'] == habit_id), None)
    
    if not claimed_habit:
        print(f"❌ Habit {habit_id} not found in yesterday's habits")
        return False
    
    if claimed_habit.get('todayStatus') != 'verified':
        print(f"❌ Expected todayStatus='verified', got '{claimed_habit.get('todayStatus')}'")
        return False
    
    print(f"✅ Yesterday's habit shows todayStatus='verified'")
    
    # TEST 5b: GET habits for 9 days ago (should fail)
    print("\n  TEST 5b: GET habits for 9 days ago (should fail)")
    day9_ago = get_date_str(-9)
    
    resp = requests.get(
        f'{BASE_URL}/children/{child1_id}/habits?date={day9_ago}',
        cookies={'eqrel_session': cookie}
    )
    
    if resp.status_code != 400:
        print(f"  ❌ Expected 400, got {resp.status_code}")
        return False
    
    if 'Too far back' not in resp.text:
        print(f"  ❌ Expected 'Too far back' error, got: {resp.text}")
        return False
    
    print(f"  ✅ Correctly rejected 9 days ago query (400)")
    
    # TEST 6: Multi-time habit with late claim and verify-queue
    print("\n--- TEST 6: Multi-time habit with late claim ---")
    
    # Create multi-time habit
    resp = requests.post(
        f'{BASE_URL}/children/{child1_id}/habits',
        json={
            'title': 'TEST_Catchup_Multi',
            'points': 8,
            'recurring': 'multi',
            'sessions': ['subuh', 'isyak'],
            'icon': '🕌',
            'category': 'ibadah'
        },
        cookies={'eqrel_session': cookie}
    )
    
    multi_habit_id = resp.json().get('habit', {}).get('id')
    print(f"✅ Created multi-time habit: {multi_habit_id}")
    
    # Backdate it
    db.habits.update_one(
        {'id': multi_habit_id},
        {'$set': {'createdAt': ten_days_ago}}
    )
    
    # Claim yesterday's isyak session with status:'claimed' (no rubric)
    print(f"  Claiming yesterday's isyak session (status:'claimed', no rubric)")
    resp = requests.post(
        f'{BASE_URL}/habits/{multi_habit_id}/claim',
        json={'dateStr': yesterday, 'session': 'isyak', 'status': 'claimed'},
        cookies={'eqrel_session': cookie}
    )
    
    if resp.status_code != 200:
        print(f"  ❌ Failed to claim isyak: {resp.status_code} {resp.text}")
        return False
    
    print(f"  ✅ Claimed isyak session for yesterday")
    
    # Check verify-queue
    print(f"  Checking verify-queue/items")
    resp = requests.get(
        f'{BASE_URL}/verify-queue/items',
        cookies={'eqrel_session': cookie}
    )
    
    if resp.status_code != 200:
        print(f"  ❌ Failed to get verify-queue: {resp.status_code} {resp.text}")
        return False
    
    items = resp.json().get('items', [])
    
    # Find our claim
    expected_claim_id = f"{multi_habit_id}__{yesterday}__isyak"
    queue_item = next((i for i in items if i['claimId'] == expected_claim_id), None)
    
    if not queue_item:
        print(f"  ❌ Claim not found in verify-queue. Expected claimId: {expected_claim_id}")
        print(f"  Available items: {[i['claimId'] for i in items]}")
        return False
    
    if queue_item.get('daysAgo') != 1:
        print(f"  ❌ Expected daysAgo=1, got {queue_item.get('daysAgo')}")
        return False
    
    if queue_item.get('late') != True:
        print(f"  ❌ Expected late=True, got {queue_item.get('late')}")
        return False
    
    print(f"  ✅ Found in verify-queue: claimId={expected_claim_id}, daysAgo=1, late=True")
    
    # Verify the claim
    print(f"  Verifying the claim with rubric 'sah'")
    resp = requests.post(
        f'{BASE_URL}/verify-queue/items/{expected_claim_id}/verify',
        json={'rubric': 'sah'},
        cookies={'eqrel_session': cookie}
    )
    
    if resp.status_code != 200:
        print(f"  ❌ Failed to verify claim: {resp.status_code} {resp.text}")
        return False
    
    print(f"  ✅ Verified isyak session")
    
    # Verify that subuh session is NOT verified
    claim_subuh = db.habit_claims.find_one({
        'habitId': multi_habit_id,
        'dateStr': yesterday,
        'session': 'subuh'
    })
    
    if claim_subuh:
        print(f"  ❌ Subuh session should not be claimed, but found: {claim_subuh}")
        return False
    
    print(f"  ✅ Subuh session not claimed (correct)")
    
    # TEST 7: verify-all includes pending claim from 2 days ago
    print("\n--- TEST 7: verify-all includes pending claim from 2 days ago ---")
    
    # Create another habit and claim 2 days ago
    resp = requests.post(
        f'{BASE_URL}/children/{child1_id}/habits',
        json={
            'title': 'TEST_Catchup_VerifyAll',
            'points': 6,
            'recurring': 'daily',
            'icon': '📖',
            'category': 'learning'
        },
        cookies={'eqrel_session': cookie}
    )
    
    verify_all_habit_id = resp.json().get('habit', {}).get('id')
    
    # Backdate it
    db.habits.update_one(
        {'id': verify_all_habit_id},
        {'$set': {'createdAt': ten_days_ago}}
    )
    
    # Claim 2 days ago with status:'claimed'
    resp = requests.post(
        f'{BASE_URL}/habits/{verify_all_habit_id}/claim',
        json={'dateStr': day2_ago, 'status': 'claimed'},
        cookies={'eqrel_session': cookie}
    )
    
    if resp.status_code != 200:
        print(f"  ❌ Failed to claim 2 days ago: {resp.status_code} {resp.text}")
        return False
    
    print(f"  ✅ Claimed 2 days ago with status:'claimed'")
    
    # Call verify-all
    resp = requests.post(
        f'{BASE_URL}/verify-queue/verify-all',
        json={'rubric': 'sah'},
        cookies={'eqrel_session': cookie}
    )
    
    if resp.status_code != 200:
        print(f"  ❌ Failed to verify-all: {resp.status_code} {resp.text}")
        return False
    
    result = resp.json()
    verified_count = result.get('verified', 0)
    
    if verified_count < 1:
        print(f"  ❌ Expected at least 1 verified claim, got {verified_count}")
        return False
    
    print(f"  ✅ verify-all verified {verified_count} claims (including 2 days ago)")
    
    # Verify the claim is now verified
    claim_2days = db.habit_claims.find_one({
        'habitId': verify_all_habit_id,
        'dateStr': day2_ago
    })
    
    if not claim_2days or claim_2days.get('status') != 'verified':
        print(f"  ❌ Claim from 2 days ago not verified. Status: {claim_2days.get('status') if claim_2days else 'not found'}")
        return False
    
    print(f"  ✅ Claim from 2 days ago now verified")
    
    # REGRESSION TEST: Today claims still work
    print("\n--- REGRESSION: Today claims (no dateStr) still work ---")
    
    # Daily habit claim
    resp = requests.post(
        f'{BASE_URL}/habits/{habit_id}/claim',
        json={'rubric': 'sah'},
        cookies={'eqrel_session': cookie}
    )
    
    if resp.status_code != 200:
        print(f"  ❌ Failed to claim today (daily): {resp.status_code} {resp.text}")
        return False
    
    print(f"  ✅ Today claim works for daily habit")
    
    # Multi-time habit claim
    resp = requests.post(
        f'{BASE_URL}/habits/{multi_habit_id}/claim',
        json={'session': 'subuh', 'rubric': 'sah'},
        cookies={'eqrel_session': cookie}
    )
    
    if resp.status_code != 200:
        print(f"  ❌ Failed to claim today (multi): {resp.status_code} {resp.text}")
        return False
    
    print(f"  ✅ Today claim works for multi-time habit")
    
    print("\n" + "="*80)
    print("✅ ALL PARENT CATCH-UP TESTS PASSED")
    print("="*80)
    
    return True

def test_kid_catchup_claims():
    """Test kid catch-up claims functionality"""
    print("\n" + "="*80)
    print("KID CATCH-UP CLAIMS TESTS")
    print("="*80)
    
    kid_cookie, parent_cookie, child1_id, child2_id, family_id = get_kid_cookie()
    
    if not kid_cookie:
        print("⚠️  Could not obtain kid cookie, skipping kid tests")
        return True
    
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    today = get_date_str(0)
    yesterday = get_date_str(-1)
    day2_ago = get_date_str(-2)
    
    # Get current local time in Asia/Kuala_Lumpur
    # KL is UTC+8, so we can calculate it
    from datetime import datetime, timezone, timedelta
    
    utc_now = datetime.now(timezone.utc)
    kl_offset = timedelta(hours=8)
    kl_now = utc_now + kl_offset
    kl_hour = kl_now.hour
    kl_minute = kl_now.minute
    kl_minutes_since_midnight = kl_hour * 60 + kl_minute
    
    print(f"\nCurrent KL time: {kl_hour:02d}:{kl_minute:02d} ({kl_minutes_since_midnight} minutes since midnight)")
    print(f"Kid catchup cutoff: 14:00 (840 minutes)")
    
    # Create a daily habit for testing
    resp = requests.post(
        f'{BASE_URL}/children/{child1_id}/habits',
        json={
            'title': 'TEST_Kid_Catchup',
            'points': 10,
            'recurring': 'daily',
            'icon': '📚',
            'category': 'learning'
        },
        cookies={'eqrel_session': parent_cookie}
    )
    
    habit_id = resp.json().get('habit', {}).get('id')
    print(f"✅ Created habit for kid testing: {habit_id}")
    
    # Backdate it
    ten_days_ago = datetime.utcnow() - timedelta(days=10)
    db.habits.update_one(
        {'id': habit_id},
        {'$set': {'createdAt': ten_days_ago}}
    )
    
    # TEST 1: Kid claim yesterday - allowed only if local time < 14:00
    print("\n--- TEST 1: Kid claim yesterday (time-dependent) ---")
    
    resp = requests.post(
        f'{BASE_URL}/habits/{habit_id}/claim',
        json={'dateStr': yesterday},
        cookies={'eqrel_session': kid_cookie}
    )
    
    if kl_minutes_since_midnight < 840:  # Before 14:00
        if resp.status_code != 200:
            print(f"  ❌ Expected 200 (before 14:00), got {resp.status_code}: {resp.text}")
            return False
        print(f"  ✅ Kid can claim yesterday (before 14:00 KL time)")
    else:  # After 14:00
        if resp.status_code != 400:
            print(f"  ❌ Expected 400 (after 14:00), got {resp.status_code}")
            return False
        if 'until midday' not in resp.text:
            print(f"  ❌ Expected 'until midday' error, got: {resp.text}")
            return False
        print(f"  ✅ Kid cannot claim yesterday (after 14:00 KL time)")
    
    # TEST 2: Kid claim with rubric (should fail - 403)
    print("\n--- TEST 2: Kid claim with rubric (should fail - 403) ---")
    
    # Create another habit
    resp = requests.post(
        f'{BASE_URL}/children/{child1_id}/habits',
        json={
            'title': 'TEST_Kid_Rubric',
            'points': 5,
            'recurring': 'daily',
            'icon': '✏️',
            'category': 'learning'
        },
        cookies={'eqrel_session': parent_cookie}
    )
    
    rubric_habit_id = resp.json().get('habit', {}).get('id')
    
    resp = requests.post(
        f'{BASE_URL}/habits/{rubric_habit_id}/claim',
        json={'rubric': 'sah'},
        cookies={'eqrel_session': kid_cookie}
    )
    
    if resp.status_code != 403:
        print(f"  ❌ Expected 403, got {resp.status_code}")
        return False
    
    print(f"  ✅ Kid correctly blocked from using rubric (403)")
    
    # TEST 3: Late kid claim on autoVerify habit stays 'claimed'
    print("\n--- TEST 3: Late kid claim on autoVerify habit ---")
    
    # Create habit with autoVerify (low points, new habit)
    resp = requests.post(
        f'{BASE_URL}/children/{child1_id}/habits',
        json={
            'title': 'TEST_Kid_AutoVerify',
            'points': 3,
            'recurring': 'daily',
            'icon': '🎯',
            'category': 'learning'
        },
        cookies={'eqrel_session': parent_cookie}
    )
    
    auto_habit_id = resp.json().get('habit', {}).get('id')
    
    # Backdate it
    db.habits.update_one(
        {'id': auto_habit_id},
        {'$set': {'createdAt': ten_days_ago}}
    )
    
    # Kid claims yesterday (if allowed by time)
    if kl_minutes_since_midnight < 840:
        resp = requests.post(
            f'{BASE_URL}/habits/{auto_habit_id}/claim',
            json={'dateStr': yesterday},
            cookies={'eqrel_session': kid_cookie}
        )
        
        if resp.status_code != 200:
            print(f"  ❌ Failed to claim: {resp.status_code} {resp.text}")
            return False
        
        # Check claim status in DB
        claim = db.habit_claims.find_one({
            'habitId': auto_habit_id,
            'dateStr': yesterday
        })
        
        if not claim:
            print(f"  ❌ Claim not found in DB")
            return False
        
        if claim.get('status') != 'claimed':
            print(f"  ❌ Expected status='claimed', got '{claim.get('status')}'")
            return False
        
        print(f"  ✅ Late kid claim on autoVerify habit stays 'claimed' (not auto-verified)")
    else:
        print(f"  ⚠️  Skipped (after 14:00 KL time)")
    
    # TEST 4: Kid claim 2 days ago (should fail - 400)
    print("\n--- TEST 4: Kid claim 2 days ago (should fail - 400) ---")
    
    resp = requests.post(
        f'{BASE_URL}/habits/{habit_id}/claim',
        json={'dateStr': day2_ago},
        cookies={'eqrel_session': kid_cookie}
    )
    
    if resp.status_code != 400:
        print(f"  ❌ Expected 400, got {resp.status_code}")
        return False
    
    if 'Too far back' not in resp.text and 'until midday' not in resp.text:
        print(f"  ❌ Expected error about too far back, got: {resp.text}")
        return False
    
    print(f"  ✅ Kid correctly blocked from claiming 2 days ago (400)")
    
    print("\n" + "="*80)
    print("✅ ALL KID CATCH-UP TESTS PASSED")
    print("="*80)
    
    return True

def cleanup():
    """Cleanup test data"""
    print("\n=== Cleaning up test data ===")
    result = subprocess.run(['python', '/app/scripts/cleanup_test_family.py'], 
                          capture_output=True, text=True, timeout=30)
    print(result.stdout)
    if result.returncode == 0:
        print("✅ Cleanup completed")
    else:
        print(f"⚠️  Cleanup had issues: {result.stderr}")

if __name__ == '__main__':
    try:
        # Run parent tests
        parent_success = test_parent_catchup_claims()
        
        if not parent_success:
            print("\n❌ PARENT TESTS FAILED")
            cleanup()
            sys.exit(1)
        
        # Run kid tests
        kid_success = test_kid_catchup_claims()
        
        if not kid_success:
            print("\n❌ KID TESTS FAILED")
            cleanup()
            sys.exit(1)
        
        # Cleanup
        cleanup()
        
        print("\n" + "="*80)
        print("✅✅✅ ALL CATCH-UP CLAIMS TESTS PASSED ✅✅✅")
        print("="*80)
        
    except Exception as e:
        print(f"\n❌ TEST FAILED WITH EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
        cleanup()
        sys.exit(1)
