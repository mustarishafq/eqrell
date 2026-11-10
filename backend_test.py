#!/usr/bin/env python3
"""
Backend test for Maghrib-based kid catch-up cutoff.
Tests that kid catch-up cutoff changed from fixed 14:00 to today's Maghrib time.
"""
import os
import sys
import requests
import subprocess
from datetime import datetime, timedelta
from pymongo import MongoClient
import pytz

# Config
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://pwa-trial-cohort.preview.emergentagent.com')
API_URL = f'{BASE_URL}/api'
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'eqrel')

# Malaysia timezone
KL_TZ = pytz.timezone('Asia/Kuala_Lumpur')

def get_local_time():
    """Get current time in Asia/Kuala_Lumpur timezone"""
    return datetime.now(KL_TZ)

def get_local_date_str():
    """Get current date string in Asia/Kuala_Lumpur timezone"""
    return get_local_time().strftime('%Y-%m-%d')

def get_yesterday_utc():
    """Get yesterday's date in UTC (YYYY-MM-DD)"""
    return (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d')

def format_time_hhmm(dt):
    """Format datetime to HH:MM"""
    return dt.strftime('%H:%M')

def run_seed_script():
    """Run seed_test_family.py and extract credentials"""
    print("\n=== Running seed_test_family.py ===")
    result = subprocess.run(['python', '/app/scripts/seed_test_family.py'], 
                          capture_output=True, text=True)
    if result.returncode != 0:
        print(f"❌ Seed script failed: {result.stderr}")
        sys.exit(1)
    
    # Parse output
    creds = {}
    for line in result.stdout.strip().split('\n'):
        if '=' in line:
            key, val = line.split('=', 1)
            creds[key] = val
    
    print(f"✅ Test family created: {creds.get('FAMILY_ID')}")
    print(f"   Child 1: {creds.get('CHILD_ID_1')}")
    print(f"   Child 2: {creds.get('CHILD_ID_2')}")
    return creds

def create_kid_device(parent_cookie, child_id):
    """Create kid device and return kid session cookie"""
    print(f"\n=== Creating kid device for child {child_id} ===")
    
    # Step 1: Kid device start
    resp = requests.post(f'{API_URL}/kid/device/start')
    if resp.status_code != 200:
        print(f"❌ Kid device start failed: {resp.status_code} {resp.text}")
        return None
    
    device_data = resp.json()
    device_id = device_data['deviceId']
    secret = device_data['secret']
    code = device_data['code']
    print(f"✅ Kid device started: code={code}")
    
    # Step 2: Parent approves
    resp = requests.post(f'{API_URL}/kid/device/approve',
                        json={'code': code, 'childId': child_id},
                        cookies={'eqrel_session': parent_cookie})
    if resp.status_code != 200:
        print(f"❌ Kid device approve failed: {resp.status_code} {resp.text}")
        return None
    print(f"✅ Kid device approved by parent")
    
    # Step 3: Kid connects
    resp = requests.post(f'{API_URL}/kid/device/connect',
                        json={'deviceId': device_id, 'secret': secret})
    if resp.status_code != 200:
        print(f"❌ Kid device connect failed: {resp.status_code} {resp.text}")
        return None
    
    # Extract session cookie
    kid_cookie = resp.cookies.get('eqrel_session')
    if not kid_cookie:
        print(f"❌ No session cookie in connect response")
        return None
    
    print(f"✅ Kid device connected, session cookie obtained")
    return kid_cookie

def test_maghrib_cutoff():
    """Main test function"""
    print("\n" + "="*80)
    print("TESTING: Kid Catch-up Cutoff Changed to Maghrib Time")
    print("="*80)
    
    # Setup
    creds = run_seed_script()
    parent_cookie = creds['COOKIE']
    family_id = creds['FAMILY_ID']
    child_id = creds['CHILD_ID_1']
    
    # Create kid device
    kid_cookie = create_kid_device(parent_cookie, child_id)
    if not kid_cookie:
        print("❌ Failed to create kid device")
        sys.exit(1)
    
    # Connect to MongoDB
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Get current local time
    local_now = get_local_time()
    local_date_str = get_local_date_str()
    yesterday_utc = get_yesterday_utc()
    
    print(f"\n📅 Current local time (KL): {local_now.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"📅 Local date string: {local_date_str}")
    print(f"📅 Yesterday UTC: {yesterday_utc}")
    
    # Get a habit ID for testing and backdate it
    habit = db.habits.find_one({'childId': child_id, 'active': True})
    if not habit:
        print("❌ No active habit found for child")
        sys.exit(1)
    habit_id = habit['id']
    
    # Backdate habit creation to 30 days ago so we can claim yesterday
    backdated_created_at = datetime.utcnow() - timedelta(days=30)
    db.habits.update_one(
        {'id': habit_id},
        {'$set': {'createdAt': backdated_created_at}}
    )
    print(f"\n✅ Using habit: {habit['title']} (ID: {habit_id})")
    print(f"   Backdated createdAt to: {backdated_created_at.strftime('%Y-%m-%d')}")
    
    # TEST 1: Maghrib 1 hour AFTER current time → kid can claim yesterday
    print("\n" + "="*80)
    print("TEST 1: Maghrib 1 hour AFTER current time → kid can claim yesterday")
    print("="*80)
    
    maghrib_after = local_now + timedelta(hours=1)
    maghrib_after_str = format_time_hhmm(maghrib_after)
    print(f"Setting Maghrib to: {maghrib_after_str} (1 hour after current time)")
    
    # Insert prayer_times_cache
    db.prayer_times_cache.delete_many({'familyId': family_id})
    db.prayer_times_cache.insert_one({
        'familyId': family_id,
        'dateStr': local_date_str,
        'timings': {
            'Fajr': '06:00',
            'Dhuhr': '13:00',
            'Asr': '16:30',
            'Maghrib': maghrib_after_str,
            'Isha': '20:00'
        }
    })
    print(f"✅ Inserted prayer_times_cache for {local_date_str}")
    
    # Kid claims yesterday
    print(f"\nKid claiming yesterday ({yesterday_utc})...")
    resp = requests.post(f'{API_URL}/habits/{habit_id}/claim',
                        json={'dateStr': yesterday_utc},
                        cookies={'eqrel_session': kid_cookie})
    
    if resp.status_code == 200:
        print(f"✅ TEST 1 PASSED: Kid claim yesterday returned 200 (allowed before Maghrib)")
        claim_data = resp.json()
        print(f"   Claim status: {claim_data.get('status')}")
    else:
        print(f"❌ TEST 1 FAILED: Expected 200, got {resp.status_code}")
        print(f"   Response: {resp.text}")
    
    # Check GET /api/children/:id/catchup (use parent cookie - kid sessions can't access this endpoint)
    print(f"\nChecking GET /api/children/{child_id}/catchup...")
    resp = requests.get(f'{API_URL}/children/{child_id}/catchup',
                       cookies={'eqrel_session': parent_cookie})
    
    if resp.status_code == 200:
        catchup_data = resp.json()
        kid_until = catchup_data.get('kidUntil')
        print(f"✅ GET catchup returned 200")
        print(f"   kidUntil: {kid_until}")
        
        if kid_until == maghrib_after_str:
            print(f"✅ TEST 1 PASSED: kidUntil matches Maghrib time ({maghrib_after_str})")
        else:
            print(f"❌ TEST 1 FAILED: kidUntil={kid_until}, expected {maghrib_after_str}")
    else:
        print(f"❌ GET catchup failed: {resp.status_code} {resp.text}")
    
    # Clean up claim for next test
    db.habit_claims.delete_many({'habitId': habit_id, 'dateStr': yesterday_utc})
    
    # TEST 2: Maghrib 1 hour BEFORE current time → kid cannot claim yesterday
    print("\n" + "="*80)
    print("TEST 2: Maghrib 1 hour BEFORE current time → kid cannot claim yesterday")
    print("="*80)
    
    maghrib_before = local_now - timedelta(hours=1)
    maghrib_before_str = format_time_hhmm(maghrib_before)
    print(f"Setting Maghrib to: {maghrib_before_str} (1 hour before current time)")
    
    # Update prayer_times_cache
    db.prayer_times_cache.update_one(
        {'familyId': family_id, 'dateStr': local_date_str},
        {'$set': {'timings.Maghrib': maghrib_before_str}}
    )
    print(f"✅ Updated prayer_times_cache Maghrib to {maghrib_before_str}")
    
    # Kid tries to claim yesterday
    print(f"\nKid claiming yesterday ({yesterday_utc})...")
    resp = requests.post(f'{API_URL}/habits/{habit_id}/claim',
                        json={'dateStr': yesterday_utc},
                        cookies={'eqrel_session': kid_cookie})
    
    if resp.status_code == 400:
        print(f"✅ TEST 2 PASSED: Kid claim yesterday returned 400 (blocked after Maghrib)")
        print(f"   Error: {resp.json().get('error')}")
    else:
        print(f"❌ TEST 2 FAILED: Expected 400, got {resp.status_code}")
        print(f"   Response: {resp.text}")
    
    # Check GET catchup with parent cookie (parent sees 7-day window)
    resp = requests.get(f'{API_URL}/children/{child_id}/catchup',
                       cookies={'eqrel_session': parent_cookie})
    
    if resp.status_code == 200:
        catchup_data = resp.json()
        days = catchup_data.get('days', [])
        kid_until = catchup_data.get('kidUntil')
        print(f"✅ GET catchup returned 200")
        print(f"   kidUntil: {kid_until}")
        print(f"   Parent sees {len(days)} days (7-day window)")
        
        if kid_until == maghrib_before_str:
            print(f"✅ TEST 2 PASSED: kidUntil correctly shows Maghrib cutoff ({maghrib_before_str})")
        else:
            print(f"❌ TEST 2 FAILED: kidUntil={kid_until}, expected {maghrib_before_str}")
        
        # Note: Parent session returns 7-day window, kid session would return empty array
        print(f"   Note: Kid session would see empty days array (after Maghrib cutoff)")
    else:
        print(f"❌ GET catchup failed: {resp.status_code} {resp.text}")
    
    # TEST 3: No cache doc → fallback to 19:15
    print("\n" + "="*80)
    print("TEST 3: No cache doc → fallback to 19:15")
    print("="*80)
    
    # Delete prayer_times_cache
    db.prayer_times_cache.delete_many({'familyId': family_id})
    print(f"✅ Deleted all prayer_times_cache docs for family")
    
    # Check GET catchup (use parent cookie)
    resp = requests.get(f'{API_URL}/children/{child_id}/catchup',
                       cookies={'eqrel_session': parent_cookie})
    
    if resp.status_code == 200:
        catchup_data = resp.json()
        kid_until = catchup_data.get('kidUntil')
        print(f"✅ GET catchup returned 200")
        print(f"   kidUntil: {kid_until}")
        
        if kid_until == '19:15':
            print(f"✅ TEST 3 PASSED: kidUntil fallback to 19:15 when no cache doc")
        else:
            print(f"❌ TEST 3 FAILED: kidUntil={kid_until}, expected 19:15")
    else:
        print(f"❌ GET catchup failed: {resp.status_code} {resp.text}")
    
    # Test claim behavior with fallback
    current_hour = local_now.hour
    current_minute = local_now.minute
    current_minutes = current_hour * 60 + current_minute
    fallback_minutes = 19 * 60 + 15  # 19:15 = 1155 minutes
    
    print(f"\nCurrent time: {local_now.strftime('%H:%M')} ({current_minutes} minutes)")
    print(f"Fallback cutoff: 19:15 ({fallback_minutes} minutes)")
    
    if current_minutes < fallback_minutes:
        print(f"Current time is BEFORE 19:15 → kid should be able to claim yesterday")
        resp = requests.post(f'{API_URL}/habits/{habit_id}/claim',
                            json={'dateStr': yesterday_utc},
                            cookies={'eqrel_session': kid_cookie})
        
        if resp.status_code == 200:
            print(f"✅ TEST 3 PASSED: Kid claim allowed before 19:15 fallback")
        else:
            print(f"❌ TEST 3 FAILED: Expected 200, got {resp.status_code}")
            print(f"   Response: {resp.text}")
        
        # Clean up
        db.habit_claims.delete_many({'habitId': habit_id, 'dateStr': yesterday_utc})
    else:
        print(f"Current time is AFTER 19:15 → kid should NOT be able to claim yesterday")
        resp = requests.post(f'{API_URL}/habits/{habit_id}/claim',
                            json={'dateStr': yesterday_utc},
                            cookies={'eqrel_session': kid_cookie})
        
        if resp.status_code == 400:
            print(f"✅ TEST 3 PASSED: Kid claim blocked after 19:15 fallback")
        else:
            print(f"❌ TEST 3 FAILED: Expected 400, got {resp.status_code}")
            print(f"   Response: {resp.text}")
    
    # TEST 4: Parent 7-day window unaffected
    print("\n" + "="*80)
    print("TEST 4: Parent 7-day window unaffected")
    print("="*80)
    
    # Parent should be able to claim up to 7 days back regardless of Maghrib time
    days_ago_7 = (datetime.utcnow() - timedelta(days=7)).strftime('%Y-%m-%d')
    days_ago_8 = (datetime.utcnow() - timedelta(days=8)).strftime('%Y-%m-%d')
    
    print(f"Parent claiming 7 days ago ({days_ago_7})...")
    resp = requests.post(f'{API_URL}/habits/{habit_id}/claim',
                        json={'dateStr': days_ago_7, 'status': 'claimed'},
                        cookies={'eqrel_session': parent_cookie})
    
    if resp.status_code == 200:
        print(f"✅ TEST 4 PASSED: Parent can claim 7 days ago (200)")
    else:
        print(f"❌ TEST 4 FAILED: Expected 200, got {resp.status_code}")
        print(f"   Response: {resp.text}")
    
    # Clean up
    db.habit_claims.delete_many({'habitId': habit_id, 'dateStr': days_ago_7})
    
    print(f"\nParent claiming 8 days ago ({days_ago_8})...")
    resp = requests.post(f'{API_URL}/habits/{habit_id}/claim',
                        json={'dateStr': days_ago_8, 'status': 'claimed'},
                        cookies={'eqrel_session': parent_cookie})
    
    if resp.status_code == 400:
        print(f"✅ TEST 4 PASSED: Parent cannot claim 8 days ago (400)")
        print(f"   Error: {resp.json().get('error')}")
    else:
        print(f"❌ TEST 4 FAILED: Expected 400, got {resp.status_code}")
        print(f"   Response: {resp.text}")
    
    # Cleanup
    print("\n" + "="*80)
    print("CLEANUP")
    print("="*80)
    
    # Delete prayer_times_cache docs
    result = db.prayer_times_cache.delete_many({'familyId': family_id})
    print(f"✅ Deleted {result.deleted_count} prayer_times_cache docs")
    
    # Run cleanup script
    print("\nRunning cleanup_test_family.py...")
    result = subprocess.run(['python', '/app/scripts/cleanup_test_family.py'],
                          capture_output=True, text=True)
    if result.returncode == 0:
        print(f"✅ Cleanup completed: {result.stdout.strip()}")
    else:
        print(f"❌ Cleanup failed: {result.stderr}")
    
    client.close()
    
    print("\n" + "="*80)
    print("ALL TESTS COMPLETED")
    print("="*80)

if __name__ == '__main__':
    try:
        test_maghrib_cutoff()
    except Exception as e:
        print(f"\n❌ TEST FAILED WITH EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
