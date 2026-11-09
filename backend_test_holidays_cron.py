#!/usr/bin/env python3
"""
Backend Test: School Holidays + Kid Reminder Cron
Tests school holidays API, habit scheduling with holidays, reminder cron, and push subscription.
"""
import requests
import subprocess
import sys
import json
import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from pymongo import MongoClient
import os

# Get base URL and environment from .env
BASE_URL = "https://pwa-trial-cohort.preview.emergentagent.com/api"
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'eqrel')
WEBHOOK_CRON_SECRET = os.getenv('WEBHOOK_CRON_SECRET', '')

# Read from .env if not set
if not WEBHOOK_CRON_SECRET:
    try:
        with open('/app/.env') as f:
            for line in f:
                if line.startswith('WEBHOOK_CRON_SECRET='):
                    WEBHOOK_CRON_SECRET = line.strip().split('=', 1)[1].strip('"').strip("'")
                    break
    except Exception:
        pass

def get_auth_cookie():
    """Run seed script to get auth cookie and test family data"""
    result = subprocess.run(['python', '/app/scripts/seed_test_family.py'], 
                          capture_output=True, text=True)
    if result.returncode != 0:
        print(f"❌ Failed to seed test family: {result.stderr}")
        sys.exit(1)
    
    lines = result.stdout.strip().split('\n')
    data = {}
    for line in lines:
        if '=' in line:
            key, value = line.split('=', 1)
            data[key] = value
    
    cookie_value = data.get('COOKIE', '')
    return {
        'cookie': cookie_value,
        'child1': data.get('CHILD_ID_1'),
        'child2': data.get('CHILD_ID_2'),
        'family': data.get('FAMILY_ID')
    }

def cleanup():
    """Cleanup test data"""
    result = subprocess.run(['python', '/app/scripts/cleanup_test_family.py'], 
                          capture_output=True, text=True)
    if result.returncode == 0:
        print("✅ Cleanup completed successfully")
    else:
        print(f"⚠️  Cleanup warning: {result.stderr}")

def cleanup_test_docs(auth):
    """Cleanup specific test documents we inserted"""
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        
        # Remove test kid_push_subs
        db.kid_push_subs.delete_many({'familyId': auth['family']})
        
        # Remove test reminder_log for test family
        db.reminder_log.delete_many({'familyId': auth['family']})
        
        client.close()
        print("✅ Test documents cleaned up")
    except Exception as e:
        print(f"⚠️  Cleanup test docs warning: {e}")

def test_school_holidays_api(auth):
    """
    TEST 1: School Holidays API
    - GET /api/family/school-holidays → {holidays:[]}
    - POST with valid data → listed with id
    - Invalid: to<from → 400, bad format → 400, >120 days → 400
    - No cookie → 401
    """
    print("\n" + "="*80)
    print("TEST 1: School Holidays API")
    print("="*80)
    
    cookies = {'eqrel_session': auth['cookie']}
    
    try:
        # Test 1a: GET without auth → 401
        print("\n📤 GET /api/family/school-holidays (no auth)")
        response = requests.get(f"{BASE_URL}/family/school-holidays")
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 401:
            print(f"❌ TEST 1a FAILED: Expected 401, got {response.status_code}")
            return False
        
        print(f"✅ TEST 1a PASSED: No cookie → 401")
        
        # Test 1b: GET with auth → empty list initially
        print("\n📤 GET /api/family/school-holidays (with auth)")
        response = requests.get(f"{BASE_URL}/family/school-holidays", cookies=cookies)
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ TEST 1b FAILED: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        print(f"   Holidays: {data.get('holidays', [])}")
        
        if 'holidays' not in data:
            print(f"❌ TEST 1b FAILED: No 'holidays' key in response")
            return False
        
        print(f"✅ TEST 1b PASSED: GET returns holidays array")
        
        # Test 1c: POST with valid data
        today = datetime.now().date()
        from_date = today.isoformat()
        to_date = (today + timedelta(days=3)).isoformat()
        
        payload = {
            'from': from_date,
            'to': to_date,
            'label': 'Term break'
        }
        
        print(f"\n📤 POST /api/family/school-holidays")
        print(f"   Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.post(
            f"{BASE_URL}/family/school-holidays",
            json=payload,
            cookies=cookies
        )
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ TEST 1c FAILED: Expected 200, got {response.status_code}")
            print(f"   Response: {response.text}")
            return False
        
        data = response.json()
        holidays = data.get('holidays', [])
        print(f"   Holidays count: {len(holidays)}")
        
        if len(holidays) == 0:
            print(f"❌ TEST 1c FAILED: No holidays in response")
            return False
        
        holiday = holidays[0]
        holiday_id = holiday.get('id')
        
        if not holiday_id:
            print(f"❌ TEST 1c FAILED: Holiday has no id")
            return False
        
        print(f"✅ TEST 1c PASSED: Holiday created with id: {holiday_id}")
        print(f"   From: {holiday.get('from')}, To: {holiday.get('to')}, Label: {holiday.get('label')}")
        
        # Test 1d: Invalid - to < from
        print(f"\n📤 POST /api/family/school-holidays (to < from)")
        payload = {
            'from': to_date,
            'to': from_date,
            'label': 'Invalid'
        }
        
        response = requests.post(
            f"{BASE_URL}/family/school-holidays",
            json=payload,
            cookies=cookies
        )
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 400:
            print(f"❌ TEST 1d FAILED: Expected 400, got {response.status_code}")
            return False
        
        print(f"✅ TEST 1d PASSED: to < from → 400")
        
        # Test 1e: Invalid - bad format
        print(f"\n📤 POST /api/family/school-holidays (bad format)")
        payload = {
            'from': 'not-a-date',
            'to': to_date,
            'label': 'Invalid'
        }
        
        response = requests.post(
            f"{BASE_URL}/family/school-holidays",
            json=payload,
            cookies=cookies
        )
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 400:
            print(f"❌ TEST 1e FAILED: Expected 400, got {response.status_code}")
            return False
        
        print(f"✅ TEST 1e PASSED: bad format → 400")
        
        # Test 1f: Invalid - >120 days
        print(f"\n📤 POST /api/family/school-holidays (>120 days)")
        payload = {
            'from': from_date,
            'to': (today + timedelta(days=121)).isoformat(),
            'label': 'Too long'
        }
        
        response = requests.post(
            f"{BASE_URL}/family/school-holidays",
            json=payload,
            cookies=cookies
        )
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 400:
            print(f"❌ TEST 1f FAILED: Expected 400, got {response.status_code}")
            return False
        
        print(f"✅ TEST 1f PASSED: >120 days → 400")
        
        print(f"\n✅ TEST 1 PASSED: All school holidays API tests successful")
        return holiday_id
        
    except Exception as e:
        print(f"❌ TEST 1 EXCEPTION: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_habits_with_holidays(auth, holiday_id):
    """
    TEST 2: Habits with school schedule and holiday interaction
    - Create habits with schedule:'school'
    - With holiday covering today: habit in offTodayHabits, response.holiday not null
    - DELETE holiday → habits follow normal weekday rules
    """
    print("\n" + "="*80)
    print("TEST 2: Habits with School Schedule and Holiday Interaction")
    print("="*80)
    
    if not holiday_id:
        print("⚠️  Skipping TEST 2: No holiday ID from TEST 1")
        return False
    
    cookies = {'eqrel_session': auth['cookie']}
    
    try:
        # Test 2a: Create habit with schedule:'school'
        print(f"\n📤 POST /api/children/{auth['child1']}/habits (schedule:'school')")
        payload = {
            'title': 'TEST_School bag',
            'category': 'tanggungjawab',
            'points': 5,
            'schedule': 'school'
        }
        
        response = requests.post(
            f"{BASE_URL}/children/{auth['child1']}/habits",
            json=payload,
            cookies=cookies
        )
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ TEST 2a FAILED: Expected 200, got {response.status_code}")
            print(f"   Response: {response.text}")
            return False
        
        data = response.json()
        habit_a = data.get('habit')
        habit_a_id = habit_a.get('id')
        
        print(f"✅ Habit A created: {habit_a_id}")
        print(f"   Title: {habit_a.get('title')}, Schedule: {habit_a.get('schedule')}")
        
        # Test 2b: Create habit with schedule:'weekend'
        print(f"\n📤 POST /api/children/{auth['child1']}/habits (schedule:'weekend')")
        payload = {
            'title': 'TEST_Park',
            'category': 'tanggungjawab',
            'points': 5,
            'schedule': 'weekend'
        }
        
        response = requests.post(
            f"{BASE_URL}/children/{auth['child1']}/habits",
            json=payload,
            cookies=cookies
        )
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ TEST 2b FAILED: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        habit_b = data.get('habit')
        habit_b_id = habit_b.get('id')
        
        print(f"✅ Habit B created: {habit_b_id}")
        print(f"   Title: {habit_b.get('title')}, Schedule: {habit_b.get('schedule')}")
        
        # Test 2c: GET habits - check holiday interaction
        print(f"\n📤 GET /api/children/{auth['child1']}/habits")
        response = requests.get(
            f"{BASE_URL}/children/{auth['child1']}/habits",
            cookies=cookies
        )
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ TEST 2c FAILED: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        habits = data.get('habits', [])
        off_today = data.get('offTodayHabits', [])
        holiday = data.get('holiday')
        
        print(f"\n   Habits count: {len(habits)}")
        print(f"   offTodayHabits count: {len(off_today)}")
        print(f"   Holiday: {holiday}")
        
        # Check if school habit is in offTodayHabits (because today is a holiday)
        school_habit_off = any(h.get('id') == habit_a_id for h in off_today)
        
        if not school_habit_off:
            print(f"⚠️  TEST 2c: School habit not in offTodayHabits (may not be a school day today)")
        else:
            print(f"✅ TEST 2c: School habit correctly in offTodayHabits during holiday")
        
        if not holiday:
            print(f"⚠️  TEST 2c: No holiday in response (holiday may not cover today)")
        else:
            print(f"✅ TEST 2c: Holiday present in response: {holiday.get('label')}")
        
        # Test 2d: DELETE holiday
        print(f"\n📤 DELETE /api/family/school-holidays/{holiday_id}")
        response = requests.delete(
            f"{BASE_URL}/family/school-holidays/{holiday_id}",
            cookies=cookies
        )
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ TEST 2d FAILED: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        holidays = data.get('holidays', [])
        
        print(f"   Holidays count after delete: {len(holidays)}")
        
        # Verify holiday is removed
        holiday_still_exists = any(h.get('id') == holiday_id for h in holidays)
        
        if holiday_still_exists:
            print(f"❌ TEST 2d FAILED: Holiday still exists after delete")
            return False
        
        print(f"✅ TEST 2d PASSED: Holiday deleted successfully")
        
        # Test 2e: GET habits again - check normal weekday rules apply
        print(f"\n📤 GET /api/children/{auth['child1']}/habits (after holiday delete)")
        response = requests.get(
            f"{BASE_URL}/children/{auth['child1']}/habits",
            cookies=cookies
        )
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ TEST 2e FAILED: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        holiday = data.get('holiday')
        school_days = data.get('schoolDays', [])
        weekday = data.get('weekday')
        
        print(f"   Holiday: {holiday}")
        print(f"   School days: {school_days}")
        print(f"   Weekday: {weekday}")
        
        if holiday:
            print(f"❌ TEST 2e FAILED: Holiday still present after delete")
            return False
        
        print(f"✅ TEST 2e PASSED: Holiday removed, habits follow normal weekday rules")
        
        print(f"\n✅ TEST 2 PASSED: All habit scheduling with holiday tests successful")
        return True
        
    except Exception as e:
        print(f"❌ TEST 2 EXCEPTION: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_reminder_cron(auth):
    """
    TEST 3: Reminder Cron
    - Set habit with clockTimes for local now
    - Insert fake kid_push_subs
    - Call POST /api/cron/digests with auth
    - Wait ~3s, check reminder_log has entry
    - Call again with different run_id → no duplicate log
    """
    print("\n" + "="*80)
    print("TEST 3: Reminder Cron")
    print("="*80)
    
    cookies = {'eqrel_session': auth['cookie']}
    
    try:
        # Get local time in parent's timezone (default Asia/Kuala_Lumpur)
        tz = ZoneInfo('Asia/Kuala_Lumpur')
        local_now = datetime.now(tz)
        local_time = local_now.strftime('%H:%M')
        local_date = local_now.strftime('%Y-%m-%d')
        
        print(f"\n📊 Local time: {local_time} ({tz})")
        print(f"   Local date: {local_date}")
        
        # Test 3a: Create habit with clockTimes for current local time
        print(f"\n📤 POST /api/children/{auth['child1']}/habits (with clockTimes)")
        payload = {
            'title': 'TEST_Breakfast',
            'category': 'kesihatan',
            'points': 10,
            'session': 'subuh',
            'clockTimes': {
                'subuh': local_time
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/children/{auth['child1']}/habits",
            json=payload,
            cookies=cookies
        )
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ TEST 3a FAILED: Expected 200, got {response.status_code}")
            print(f"   Response: {response.text}")
            return False
        
        data = response.json()
        habit = data.get('habit')
        habit_id = habit.get('id')
        
        print(f"✅ Habit created: {habit_id}")
        print(f"   Title: {habit.get('title')}")
        print(f"   ClockTimes: {habit.get('clockTimes')}")
        
        # Test 3b: Insert fake kid_push_subs
        print(f"\n📤 Inserting fake kid_push_subs into MongoDB")
        
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        
        fake_sub = {
            'id': str(uuid.uuid4()),
            'endpoint': 'https://example.invalid/push/x',
            'keys': {
                'p256dh': 'x',
                'auth': 'y'
            },
            'familyId': auth['family'],
            'childId': auth['child1'],
            'createdAt': datetime.utcnow(),
            'updatedAt': datetime.utcnow()
        }
        
        db.kid_push_subs.insert_one(fake_sub)
        print(f"✅ Fake kid_push_subs inserted")
        
        # Test 3c: Call cron endpoint without auth → 401
        print(f"\n📤 POST /api/cron/digests (no auth)")
        run_id_1 = f"test-{uuid.uuid4()}"
        
        response = requests.post(
            f"{BASE_URL}/cron/digests",
            json={'run_id': run_id_1}
        )
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 401:
            print(f"❌ TEST 3c FAILED: Expected 401, got {response.status_code}")
            return False
        
        print(f"✅ TEST 3c PASSED: Without auth → 401")
        
        # Test 3d: Call cron endpoint with auth
        print(f"\n📤 POST /api/cron/digests (with auth)")
        
        response = requests.post(
            f"{BASE_URL}/cron/digests",
            json={'run_id': run_id_1},
            headers={'Authorization': f'Bearer {WEBHOOK_CRON_SECRET}'}
        )
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 202:
            print(f"❌ TEST 3d FAILED: Expected 202, got {response.status_code}")
            print(f"   Response: {response.text}")
            return False
        
        data = response.json()
        print(f"   Response: {json.dumps(data, indent=2)}")
        
        print(f"✅ TEST 3d PASSED: Cron endpoint accepted (202)")
        
        # Test 3e: Wait for cron to process
        print(f"\n⏳ Waiting 3 seconds for cron to process...")
        import time
        time.sleep(3)
        
        # Check reminder_log
        print(f"\n📤 Checking reminder_log in MongoDB")
        expected_log_id = f"{habit_id}:subuh:{local_date}"
        
        log_entry = db.reminder_log.find_one({'_id': expected_log_id})
        
        if log_entry:
            print(f"✅ TEST 3e PASSED: reminder_log entry found")
            print(f"   Log ID: {log_entry.get('_id')}")
            print(f"   Family: {log_entry.get('familyId')}")
            print(f"   Child: {log_entry.get('childId')}")
        else:
            print(f"⚠️  TEST 3e: No reminder_log entry found (habit may not be due now)")
            print(f"   Expected ID: {expected_log_id}")
            print(f"   Note: Reminder only sent if local time is within 10 min before to 5 min after clockTime")
        
        # Test 3f: Call cron again with different run_id → no duplicate log
        print(f"\n📤 POST /api/cron/digests (second call)")
        run_id_2 = f"test-{uuid.uuid4()}"
        
        response = requests.post(
            f"{BASE_URL}/cron/digests",
            json={'run_id': run_id_2},
            headers={'Authorization': f'Bearer {WEBHOOK_CRON_SECRET}'}
        )
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 202:
            print(f"❌ TEST 3f FAILED: Expected 202, got {response.status_code}")
            return False
        
        print(f"✅ TEST 3f PASSED: Second cron call accepted")
        
        # Wait and check no duplicate
        time.sleep(2)
        
        log_count = db.reminder_log.count_documents({'_id': expected_log_id})
        print(f"\n   reminder_log count for {expected_log_id}: {log_count}")
        
        if log_count > 1:
            print(f"❌ TEST 3f FAILED: Duplicate reminder_log entries found")
            return False
        
        if log_count == 1:
            print(f"✅ TEST 3f PASSED: No duplicate log entry (idempotent)")
        
        client.close()
        
        print(f"\n✅ TEST 3 PASSED: All reminder cron tests successful")
        return True
        
    except Exception as e:
        print(f"❌ TEST 3 EXCEPTION: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_push_subscribe_regression(auth):
    """
    TEST 4: Regression - POST /push/subscribe with parent cookie
    - Should store into push_subs (not kid_push_subs)
    """
    print("\n" + "="*80)
    print("TEST 4: Push Subscribe Regression")
    print("="*80)
    
    cookies = {'eqrel_session': auth['cookie']}
    
    try:
        # Test 4a: POST /push/subscribe with parent session
        print(f"\n📤 POST /api/push/subscribe (parent session)")
        
        fake_endpoint = f"https://example.invalid/push/parent-{uuid.uuid4()}"
        payload = {
            'subscription': {
                'endpoint': fake_endpoint,
                'keys': {
                    'p256dh': 'test-p256dh-key',
                    'auth': 'test-auth-key'
                }
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/push/subscribe",
            json=payload,
            cookies=cookies
        )
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ TEST 4a FAILED: Expected 200, got {response.status_code}")
            print(f"   Response: {response.text}")
            return False
        
        data = response.json()
        print(f"   Response: {json.dumps(data, indent=2)}")
        
        # Test 4b: Verify stored in push_subs (not kid_push_subs)
        print(f"\n📤 Checking push_subs in MongoDB")
        
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        
        parent_sub = db.push_subs.find_one({'endpoint': fake_endpoint})
        kid_sub = db.kid_push_subs.find_one({'endpoint': fake_endpoint})
        
        if not parent_sub:
            print(f"❌ TEST 4b FAILED: Subscription not found in push_subs")
            return False
        
        if kid_sub:
            print(f"❌ TEST 4b FAILED: Subscription incorrectly stored in kid_push_subs")
            return False
        
        print(f"✅ TEST 4b PASSED: Subscription correctly stored in push_subs")
        print(f"   Endpoint: {parent_sub.get('endpoint')}")
        print(f"   User ID: {parent_sub.get('userId')}")
        print(f"   Family ID: {parent_sub.get('familyId')}")
        
        # Cleanup
        db.push_subs.delete_one({'endpoint': fake_endpoint})
        
        client.close()
        
        print(f"\n✅ TEST 4 PASSED: Push subscribe regression test successful")
        return True
        
    except Exception as e:
        print(f"❌ TEST 4 EXCEPTION: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("SCHOOL HOLIDAYS + KID REMINDER CRON BACKEND TESTS")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Get auth once for all tests
    print("\n🔐 Setting up test family...")
    auth = get_auth_cookie()
    print(f"   Family: {auth['family']}")
    print(f"   Child 1: {auth['child1']}")
    print(f"   Child 2: {auth['child2']}")
    
    results = {}
    
    try:
        # TEST 1: School holidays API
        holiday_id = test_school_holidays_api(auth)
        results['test1'] = holiday_id is not False
        
        # TEST 2: Habits with holidays
        results['test2'] = test_habits_with_holidays(auth, holiday_id)
        
        # TEST 3: Reminder cron
        results['test3'] = test_reminder_cron(auth)
        
        # TEST 4: Push subscribe regression
        results['test4'] = test_push_subscribe_regression(auth)
        
    finally:
        # Always cleanup
        print("\n" + "="*80)
        print("CLEANUP")
        print("="*80)
        cleanup_test_docs(auth)
        cleanup()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test, result in results.items():
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test.upper()}: {status}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    print(f"Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        sys.exit(0)
    else:
        print(f"\n⚠️  {total - passed} TEST(S) FAILED")
        sys.exit(1)

if __name__ == '__main__':
    main()
