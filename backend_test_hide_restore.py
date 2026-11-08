#!/usr/bin/env python3
"""
Backend test for reward template hide/restore feature.
Tests ONLY the hide/restore functionality as specified in review request.
"""
import requests
import json
import sys
import subprocess
import os

# Get base URL from .env
def get_base_url():
    with open('/app/.env', 'r') as f:
        for line in f:
            if line.startswith('NEXT_PUBLIC_BASE_URL='):
                return line.split('=', 1)[1].strip()
    return 'http://localhost:3000'

BASE_URL = get_base_url() + '/api'
print(f"Testing against: {BASE_URL}")

# Create a requests session for better connection handling
session = requests.Session()
session.headers.update({'Content-Type': 'application/json'})

# Run seed script to get parent session
print("\n=== SETUP: Running seed_test_family.py ===")
result = subprocess.run(['python', '/app/scripts/seed_test_family.py'], capture_output=True, text=True)
if result.returncode != 0:
    print(f"❌ Seed script failed: {result.stderr}")
    sys.exit(1)

# Parse output to get cookie and child IDs
parent_cookie = None
child_id_1 = None
child_id_2 = None
for line in result.stdout.split('\n'):
    if line.startswith('COOKIE='):
        parent_cookie = line.split('=', 1)[1].strip()
    elif line.startswith('CHILD_ID_1='):
        child_id_1 = line.split('=', 1)[1].strip()
    elif line.startswith('CHILD_ID_2='):
        child_id_2 = line.split('=', 1)[1].strip()

if not parent_cookie or not child_id_1:
    print(f"❌ Failed to parse seed output")
    sys.exit(1)

print(f"✅ Parent session created")
print(f"✅ Child 1 ID: {child_id_1}")
print(f"✅ Child 2 ID: {child_id_2}")

# Template IDs from rewardTemplates.js
TEMPLATE_IDS = ['rw-01', 'rw-02', 'rw-03', 'rw-04', 'rw-05', 'rw-06', 'rw-07', 'rw-08', 
                'rw-09', 'rw-10', 'rw-11', 'rw-12', 'rw-13', 'rw-14', 'rw-15']
FIRST_TEMPLATE = TEMPLATE_IDS[0]  # rw-01
SECOND_TEMPLATE = TEMPLATE_IDS[1]  # rw-02

# Helper to make requests with parent session
def req(method, path, json_data=None, cookies=None):
    url = f"{BASE_URL}{path}"
    if cookies is None:
        cookies = {'eqrel_session': parent_cookie}
    try:
        if method == 'GET':
            r = session.get(url, cookies=cookies, timeout=20)
        elif method == 'POST':
            r = session.post(url, json=json_data, cookies=cookies, timeout=20)
        elif method == 'DELETE':
            r = session.delete(url, cookies=cookies, timeout=20)
        return r
    except requests.exceptions.Timeout as e:
        print(f"⚠️  Request timeout: {method} {path}")
        return None
    except requests.exceptions.ConnectionError as e:
        print(f"⚠️  Connection error: {method} {path} - {e}")
        return None
    except Exception as e:
        print(f"❌ Request failed: {method} {path} - {e}")
        return None

print("\n" + "="*70)
print("TEST 1: GET /api/rewards/catalog → 200 with custom and hiddenTemplates")
print("="*70)
try:
    r = req('GET', '/rewards/catalog')
    if r and r.status_code == 200:
        data = r.json()
        if 'custom' in data and 'hiddenTemplates' in data:
            if isinstance(data['hiddenTemplates'], list):
                print(f"✅ TEST 1 PASSED: catalog returns custom={len(data['custom'])}, hiddenTemplates={data['hiddenTemplates']}")
            else:
                print(f"❌ TEST 1 FAILED: hiddenTemplates is not a list: {type(data['hiddenTemplates'])}")
        else:
            print(f"❌ TEST 1 FAILED: Missing fields. Got: {data.keys()}")
    else:
        print(f"❌ TEST 1 FAILED: Status {r.status_code if r else 'None'}")
except Exception as e:
    print(f"❌ TEST 1 FAILED: {e}")

print("\n" + "="*70)
print("TEST 2: POST /api/rewards/templates/hide with valid templateId")
print("="*70)
try:
    # Hide first template
    r = req('POST', '/rewards/templates/hide', {'templateId': FIRST_TEMPLATE})
    if r and r.status_code == 200:
        data = r.json()
        if data.get('ok') and FIRST_TEMPLATE in data.get('hiddenTemplates', []):
            print(f"✅ TEST 2a PASSED: {FIRST_TEMPLATE} hidden successfully")
            
            # Verify it's in the list
            r2 = req('GET', '/rewards/catalog')
            if r2 and r2.status_code == 200:
                data2 = r2.json()
                if FIRST_TEMPLATE in data2.get('hiddenTemplates', []):
                    print(f"✅ TEST 2b PASSED: {FIRST_TEMPLATE} appears in catalog hiddenTemplates")
                else:
                    print(f"❌ TEST 2b FAILED: {FIRST_TEMPLATE} not in hiddenTemplates: {data2.get('hiddenTemplates')}")
            
            # Hide again - should not create duplicates
            r3 = req('POST', '/rewards/templates/hide', {'templateId': FIRST_TEMPLATE})
            if r3 and r3.status_code == 200:
                data3 = r3.json()
                count = data3.get('hiddenTemplates', []).count(FIRST_TEMPLATE)
                if count == 1:
                    print(f"✅ TEST 2c PASSED: No duplicates when hiding same template twice")
                else:
                    print(f"❌ TEST 2c FAILED: Duplicate found, count={count}")
            
            # Hide second template
            r4 = req('POST', '/rewards/templates/hide', {'templateId': SECOND_TEMPLATE})
            if r4 and r4.status_code == 200:
                data4 = r4.json()
                if FIRST_TEMPLATE in data4.get('hiddenTemplates', []) and SECOND_TEMPLATE in data4.get('hiddenTemplates', []):
                    print(f"✅ TEST 2d PASSED: Both templates hidden: {data4.get('hiddenTemplates')}")
                else:
                    print(f"❌ TEST 2d FAILED: Missing templates in list: {data4.get('hiddenTemplates')}")
        else:
            print(f"❌ TEST 2a FAILED: Response: {data}")
    else:
        print(f"❌ TEST 2a FAILED: Status {r.status_code if r else 'None'}")
except Exception as e:
    print(f"❌ TEST 2 FAILED: {e}")

print("\n" + "="*70)
print("TEST 3: POST /api/rewards/templates/hide - Error cases")
print("="*70)
try:
    # Unknown templateId → 404
    import time
    time.sleep(0.5)  # Small delay between requests
    r = req('POST', '/rewards/templates/hide', {'templateId': 'rw-99'})
    if r:
        if r.status_code == 404:
            print(f"✅ TEST 3a PASSED: Unknown templateId returns 404")
        else:
            print(f"❌ TEST 3a FAILED: Expected 404, got {r.status_code}, body: {r.text[:200]}")
    else:
        print(f"❌ TEST 3a FAILED: Request returned None (timeout or connection error)")
    
    # Missing templateId → 400
    time.sleep(0.5)
    r2 = req('POST', '/rewards/templates/hide', {})
    if r2:
        if r2.status_code == 400:
            print(f"✅ TEST 3b PASSED: Missing templateId returns 400")
        else:
            print(f"❌ TEST 3b FAILED: Expected 400, got {r2.status_code}, body: {r2.text[:200]}")
    else:
        print(f"❌ TEST 3b FAILED: Request returned None (timeout or connection error)")
    
    # No cookie → 401
    time.sleep(0.5)
    r3 = req('POST', '/rewards/templates/hide', {'templateId': FIRST_TEMPLATE}, cookies={})
    if r3:
        if r3.status_code == 401:
            print(f"✅ TEST 3c PASSED: No cookie returns 401")
        else:
            print(f"❌ TEST 3c FAILED: Expected 401, got {r3.status_code}, body: {r3.text[:200]}")
    else:
        print(f"❌ TEST 3c FAILED: Request returned None (timeout or connection error)")
except Exception as e:
    print(f"❌ TEST 3 FAILED: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*70)
print("TEST 4: POST /api/rewards/request with hidden template → 410")
print("="*70)
try:
    import time
    # First, ensure child has mataReward balance
    # Get child data
    r_child = req('GET', '/children')
    if r_child and r_child.status_code == 200:
        children = r_child.json().get('children', [])
        if children:
            child = children[0]
            child_id = child['id']
            current_balance = child.get('mataReward', 0)
            print(f"Child {child_id} has mataReward balance: {current_balance}")
            
            # Give child enough mataReward if needed (via MongoDB)
            if current_balance < 50:
                print(f"Giving child mataReward via MongoDB...")
                import pymongo
                mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
                db_name = os.getenv('DB_NAME', 'eqrel')
                client = pymongo.MongoClient(mongo_url)
                db = client[db_name]
                db.children.update_one({'id': child_id}, {'$set': {'mataReward': 50}})
                print(f"✅ Set mataReward to 50")
            
            time.sleep(0.5)
            # Try to request hidden template (FIRST_TEMPLATE is hidden from TEST 2)
            snapshot = {
                'title': 'Screen time 15 min',
                'cost': 25,
                'icon': '📺',
                'category': 'screen'
            }
            r = req('POST', '/rewards/request', {
                'childId': child_id,
                'rewardId': FIRST_TEMPLATE,
                'isTemplate': True,
                'snapshot': snapshot
            })
            if r:
                if r.status_code == 410:
                    print(f"✅ TEST 4a PASSED: Hidden template request returns 410")
                else:
                    print(f"❌ TEST 4a FAILED: Expected 410, got {r.status_code}, body: {r.text[:300]}")
            else:
                print(f"❌ TEST 4a FAILED: Request returned None (timeout or connection error)")
            
            time.sleep(0.5)
            # Try to request non-hidden template (should work - 200 or 402 if balance low)
            # Use a template that's not hidden (rw-03)
            NON_HIDDEN = 'rw-03'
            snapshot2 = {
                'title': 'Special ice cream',
                'cost': 40,
                'icon': '🍦',
                'category': 'food'
            }
            r2 = req('POST', '/rewards/request', {
                'childId': child_id,
                'rewardId': NON_HIDDEN,
                'isTemplate': True,
                'snapshot': snapshot2
            })
            if r2:
                if r2.status_code in [200, 402]:
                    if r2.status_code == 200:
                        print(f"✅ TEST 4b PASSED: Non-hidden template request returns 200")
                    else:
                        print(f"✅ TEST 4b PASSED: Non-hidden template request returns 402 (low balance)")
                else:
                    print(f"❌ TEST 4b FAILED: Expected 200 or 402, got {r2.status_code}, body: {r2.text[:300]}")
            else:
                print(f"❌ TEST 4b FAILED: Request returned None (timeout or connection error)")
        else:
            print(f"❌ TEST 4 FAILED: No children found")
    else:
        print(f"❌ TEST 4 FAILED: Could not get children, status: {r_child.status_code if r_child else 'None'}")
except Exception as e:
    print(f"❌ TEST 4 FAILED: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*70)
print("TEST 5: POST /api/rewards/templates/restore")
print("="*70)
try:
    # Restore first template
    r = req('POST', '/rewards/templates/restore', {'templateId': FIRST_TEMPLATE})
    if r and r.status_code == 200:
        data = r.json()
        if FIRST_TEMPLATE not in data.get('hiddenTemplates', []):
            print(f"✅ TEST 5a PASSED: {FIRST_TEMPLATE} restored (removed from hiddenTemplates)")
            
            # Verify SECOND_TEMPLATE is still hidden
            if SECOND_TEMPLATE in data.get('hiddenTemplates', []):
                print(f"✅ TEST 5b PASSED: {SECOND_TEMPLATE} still hidden")
            else:
                print(f"❌ TEST 5b FAILED: {SECOND_TEMPLATE} should still be hidden")
        else:
            print(f"❌ TEST 5a FAILED: {FIRST_TEMPLATE} still in hiddenTemplates: {data.get('hiddenTemplates')}")
    else:
        print(f"❌ TEST 5a FAILED: Status {r.status_code if r else 'None'}")
    
    # Restore all (empty body)
    r2 = req('POST', '/rewards/templates/restore', {})
    if r2 and r2.status_code == 200:
        data2 = r2.json()
        if len(data2.get('hiddenTemplates', [])) == 0:
            print(f"✅ TEST 5c PASSED: All templates restored (hiddenTemplates = [])")
        else:
            print(f"❌ TEST 5c FAILED: hiddenTemplates not empty: {data2.get('hiddenTemplates')}")
    else:
        print(f"❌ TEST 5c FAILED: Status {r2.status_code if r2 else 'None'}")
except Exception as e:
    print(f"❌ TEST 5 FAILED: {e}")

print("\n" + "="*70)
print("TEST 6: Kid-role session → 403 on hide (if easy)")
print("="*70)
try:
    import time
    # Get kid device session by linking a device
    # POST /kid/device/start
    r_start = req('POST', '/kid/device/start', {}, cookies={})
    if r_start and r_start.status_code == 200:
        device_data = r_start.json()
        device_id = device_data.get('deviceId')
        secret = device_data.get('secret')
        code = device_data.get('code')
        print(f"Kid device started: code={code}")
        
        time.sleep(0.5)
        # Parent approves device for child 1
        r_approve = req('POST', '/kid/device/approve', {'code': code, 'childId': child_id_1})
        if r_approve and r_approve.status_code == 200:
            print(f"✅ Device approved for child {child_id_1}")
            
            time.sleep(0.5)
            # Connect device to get kid session
            r_connect = req('POST', '/kid/device/connect', {'deviceId': device_id, 'secret': secret}, cookies={})
            if r_connect and r_connect.status_code == 200:
                connect_data = r_connect.json()
                if connect_data.get('status') == 'approved':
                    # Extract kid session cookie from response
                    kid_cookie = r_connect.cookies.get('eqrel_session')
                    if kid_cookie:
                        print(f"✅ Kid session obtained")
                        
                        time.sleep(0.5)
                        # Try to hide template with kid session → should return 403
                        r_hide = req('POST', '/rewards/templates/hide', {'templateId': FIRST_TEMPLATE}, 
                                   cookies={'eqrel_session': kid_cookie})
                        if r_hide:
                            if r_hide.status_code == 403:
                                print(f"✅ TEST 6 PASSED: Kid session returns 403 on hide")
                            else:
                                print(f"❌ TEST 6 FAILED: Expected 403, got {r_hide.status_code}, body: {r_hide.text[:200]}")
                        else:
                            print(f"❌ TEST 6 FAILED: Request returned None (timeout or connection error)")
                    else:
                        print(f"⚠️  TEST 6 SKIPPED: Could not extract kid session cookie")
                else:
                    print(f"⚠️  TEST 6 SKIPPED: Device connect status: {connect_data.get('status')}")
            else:
                print(f"⚠️  TEST 6 SKIPPED: Device connect failed: {r_connect.status_code if r_connect else 'None'}")
        else:
            print(f"⚠️  TEST 6 SKIPPED: Device approve failed: {r_approve.status_code if r_approve else 'None'}")
    else:
        print(f"⚠️  TEST 6 SKIPPED: Device start failed: {r_start.status_code if r_start else 'None'}")
except Exception as e:
    print(f"⚠️  TEST 6 SKIPPED: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*70)
print("CLEANUP: Running cleanup_test_family.py")
print("="*70)
result = subprocess.run(['python', '/app/scripts/cleanup_test_family.py'], capture_output=True, text=True)
if result.returncode == 0:
    print("✅ Cleanup completed successfully")
else:
    print(f"⚠️  Cleanup had issues: {result.stderr}")

print("\n" + "="*70)
print("SUMMARY")
print("="*70)
print("All tests for reward template hide/restore feature completed.")
print("Check results above for pass/fail status.")
