#!/usr/bin/env python3
"""
TV Device Link Backend Test Suite
Tests all TV device pairing endpoints and permissions
"""
import requests
import time
import os
from datetime import datetime, timedelta
from pymongo import MongoClient

# Get environment variables
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://pwa-trial-cohort.preview.emergentagent.com')
API_URL = f"{BASE_URL}/api"

# Test credentials from seed script
PARENT_COOKIE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzaWQiOiJ0ZXN0LXNlc3Npb24tYTJiOTVmZTciLCJ1c2VySWQiOiJ0ZXN0LXVzZXItYTJiOTVmZTciLCJlbWFpbCI6InRlc3QtYTJiOTVmZTdAZXFyZWwubG9jYWwiLCJuYW1lIjoiVGVzdCBQYXJlbnQiLCJmYW1pbHlJZCI6InRlc3QtZmFtLWEyYjk1ZmU3Iiwicm9sZSI6InBhcmVudCIsImlhdCI6MTc5MzUxNjE3MCwiZXhwIjoxNzk2MTA4MTcwfQ.aCMJfFyk9RCYfrPw1Sbq5at8j-Sw2yhX4soSeuLMLNo"
FAMILY_ID = "test-fam-a2b95fe7"

# MongoDB connection
client = MongoClient(MONGO_URL)
db = client['eqrel']

# Test state
test_results = []
tv_device_id = None
tv_secret = None
tv_code = None
tv_session = None

def log_test(name, passed, details=""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {name}")
    if details:
        print(f"   {details}")
    test_results.append({"name": name, "passed": passed, "details": details})

def cleanup_tv_devices():
    """Clean up any TV devices created during testing"""
    try:
        result = db.tv_devices.delete_many({})
        print(f"🧹 Cleaned up {result.deleted_count} TV device(s)")
    except Exception as e:
        print(f"⚠️  Cleanup warning: {e}")

print("=" * 80)
print("TV DEVICE LINK BACKEND TEST SUITE")
print("=" * 80)
print(f"API URL: {API_URL}")
print(f"Family ID: {FAMILY_ID}")
print()

# ============================================================================
# TEST 1: POST /api/tv/device/start (no auth)
# ============================================================================
print("\n[TEST 1] POST /api/tv/device/start - TV initiates pairing")
try:
    # Create a separate session for TV (no parent cookie)
    tv_session = requests.Session()
    
    # Send request with Samsung TV user agent
    headers = {
        'User-Agent': 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/537.36',
        'Content-Type': 'application/json'
    }
    response = tv_session.post(f"{API_URL}/tv/device/start", headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        if all(k in data for k in ['deviceId', 'secret', 'code', 'expiresAt']):
            tv_device_id = data['deviceId']
            tv_secret = data['secret']
            tv_code = data['code']
            
            # Verify code is 6 digits
            if len(tv_code) == 6 and tv_code.isdigit():
                log_test("TV device start - returns deviceId, secret, 6-digit code", True, 
                        f"Code: {tv_code}, Device: {tv_device_id[:8]}...")
                
                # Verify label is detected from User-Agent
                doc = db.tv_devices.find_one({'id': tv_device_id})
                if doc and doc.get('label') == 'Samsung TV':
                    log_test("TV device start - Samsung TV label detected from UA", True)
                else:
                    log_test("TV device start - Samsung TV label detected from UA", False, 
                            f"Expected 'Samsung TV', got '{doc.get('label') if doc else 'NOT FOUND'}'")
            else:
                log_test("TV device start - 6-digit code format", False, f"Code: {tv_code}")
        else:
            log_test("TV device start - response structure", False, f"Missing keys in: {data}")
    else:
        log_test("TV device start", False, f"Status {response.status_code}: {response.text}")
except Exception as e:
    log_test("TV device start", False, f"Exception: {e}")

# ============================================================================
# TEST 2: POST /api/tv/device/connect - wrong secret
# ============================================================================
print("\n[TEST 2] POST /api/tv/device/connect - wrong secret → 404 unknown")
try:
    response = tv_session.post(f"{API_URL}/tv/device/connect", json={
        'deviceId': tv_device_id,
        'secret': 'wrong_secret_12345'
    })
    
    if response.status_code == 404:
        data = response.json()
        if data.get('status') == 'unknown':
            log_test("TV connect - wrong secret returns 404 unknown", True)
        else:
            log_test("TV connect - wrong secret status", False, f"Expected 'unknown', got {data}")
    else:
        log_test("TV connect - wrong secret", False, f"Expected 404, got {response.status_code}")
except Exception as e:
    log_test("TV connect - wrong secret", False, f"Exception: {e}")

# ============================================================================
# TEST 3: POST /api/tv/device/connect - before approval → pending
# ============================================================================
print("\n[TEST 3] POST /api/tv/device/connect - before approval → pending")
try:
    response = tv_session.post(f"{API_URL}/tv/device/connect", json={
        'deviceId': tv_device_id,
        'secret': tv_secret
    })
    
    if response.status_code == 200:
        data = response.json()
        if data.get('status') == 'pending':
            log_test("TV connect - before approval returns pending", True)
        else:
            log_test("TV connect - before approval status", False, f"Expected 'pending', got {data}")
    else:
        log_test("TV connect - before approval", False, f"Status {response.status_code}: {response.text}")
except Exception as e:
    log_test("TV connect - before approval", False, f"Exception: {e}")

# ============================================================================
# TEST 4: POST /api/tv/device/connect - expired code
# ============================================================================
print("\n[TEST 4] POST /api/tv/device/connect - expired code → expired")
try:
    # Manually set expiresAt to the past in DB
    past_time = datetime.utcnow() - timedelta(minutes=15)
    db.tv_devices.update_one(
        {'id': tv_device_id},
        {'$set': {'expiresAt': past_time}}
    )
    
    response = tv_session.post(f"{API_URL}/tv/device/connect", json={
        'deviceId': tv_device_id,
        'secret': tv_secret
    })
    
    if response.status_code == 200:
        data = response.json()
        if data.get('status') == 'expired':
            log_test("TV connect - expired code returns expired", True)
        else:
            log_test("TV connect - expired status", False, f"Expected 'expired', got {data}")
    else:
        log_test("TV connect - expired", False, f"Status {response.status_code}: {response.text}")
    
    # Restore expiresAt for next tests
    future_time = datetime.utcnow() + timedelta(minutes=10)
    db.tv_devices.update_one(
        {'id': tv_device_id},
        {'$set': {'expiresAt': future_time}}
    )
except Exception as e:
    log_test("TV connect - expired", False, f"Exception: {e}")

# ============================================================================
# TEST 5: GET /api/tv/device/lookup - no auth → 401
# ============================================================================
print("\n[TEST 5] GET /api/tv/device/lookup - no auth → 401")
try:
    response = requests.get(f"{API_URL}/tv/device/lookup?code={tv_code}")
    
    if response.status_code == 401:
        log_test("TV lookup - no auth returns 401", True)
    else:
        log_test("TV lookup - no auth", False, f"Expected 401, got {response.status_code}")
except Exception as e:
    log_test("TV lookup - no auth", False, f"Exception: {e}")

# ============================================================================
# TEST 6: GET /api/tv/device/lookup - with parent cookie
# ============================================================================
print("\n[TEST 6] GET /api/tv/device/lookup - parent auth → device info")
try:
    parent_session = requests.Session()
    parent_session.cookies.set('eqrel_session', PARENT_COOKIE)
    
    response = parent_session.get(f"{API_URL}/tv/device/lookup?code={tv_code}")
    
    if response.status_code == 200:
        data = response.json()
        device = data.get('device', {})
        if device.get('code') == tv_code and device.get('label') == 'Samsung TV':
            log_test("TV lookup - returns device with code and label", True, 
                    f"Label: {device.get('label')}")
        else:
            log_test("TV lookup - device data", False, f"Got: {device}")
    else:
        log_test("TV lookup - parent auth", False, f"Status {response.status_code}: {response.text}")
except Exception as e:
    log_test("TV lookup - parent auth", False, f"Exception: {e}")

# ============================================================================
# TEST 7: GET /api/tv/device/lookup - invalid code → 404
# ============================================================================
print("\n[TEST 7] GET /api/tv/device/lookup - invalid code → 404")
try:
    response = parent_session.get(f"{API_URL}/tv/device/lookup?code=999999")
    
    if response.status_code == 404:
        log_test("TV lookup - invalid code returns 404", True)
    else:
        log_test("TV lookup - invalid code", False, f"Expected 404, got {response.status_code}")
except Exception as e:
    log_test("TV lookup - invalid code", False, f"Exception: {e}")

# ============================================================================
# TEST 8: POST /api/tv/device/approve - bad format → 400
# ============================================================================
print("\n[TEST 8] POST /api/tv/device/approve - bad code format → 400")
try:
    response = parent_session.post(f"{API_URL}/tv/device/approve", json={
        'code': 'ABC123',  # Not 6 digits
        'name': 'Test TV'
    })
    
    if response.status_code == 400:
        log_test("TV approve - bad format returns 400", True)
    else:
        log_test("TV approve - bad format", False, f"Expected 400, got {response.status_code}")
except Exception as e:
    log_test("TV approve - bad format", False, f"Exception: {e}")

# ============================================================================
# TEST 9: POST /api/tv/device/approve - no auth → 401
# ============================================================================
print("\n[TEST 9] POST /api/tv/device/approve - no auth → 401")
try:
    response = requests.post(f"{API_URL}/tv/device/approve", json={
        'code': tv_code,
        'name': 'Test TV'
    })
    
    if response.status_code == 401:
        log_test("TV approve - no auth returns 401", True)
    else:
        log_test("TV approve - no auth", False, f"Expected 401, got {response.status_code}")
except Exception as e:
    log_test("TV approve - no auth", False, f"Exception: {e}")

# ============================================================================
# TEST 10: POST /api/tv/device/approve - valid approval
# ============================================================================
print("\n[TEST 10] POST /api/tv/device/approve - valid approval")
try:
    response = parent_session.post(f"{API_URL}/tv/device/approve", json={
        'code': tv_code,
        'name': 'Living room TV'
    })
    
    if response.status_code == 200:
        data = response.json()
        if data.get('ok') and data.get('device', {}).get('name') == 'Living room TV':
            log_test("TV approve - successful approval", True, 
                    f"Device: {data.get('device', {}).get('id', '')[:8]}...")
        else:
            log_test("TV approve - response data", False, f"Got: {data}")
    else:
        log_test("TV approve - valid approval", False, f"Status {response.status_code}: {response.text}")
except Exception as e:
    log_test("TV approve - valid approval", False, f"Exception: {e}")

# ============================================================================
# TEST 11: POST /api/tv/device/approve - re-approve same code → 404
# ============================================================================
print("\n[TEST 11] POST /api/tv/device/approve - re-approve same code → 404")
try:
    response = parent_session.post(f"{API_URL}/tv/device/approve", json={
        'code': tv_code,
        'name': 'Another TV'
    })
    
    if response.status_code == 404:
        log_test("TV approve - re-approve returns 404", True)
    else:
        log_test("TV approve - re-approve", False, f"Expected 404, got {response.status_code}")
except Exception as e:
    log_test("TV approve - re-approve", False, f"Exception: {e}")

# ============================================================================
# TEST 12: POST /api/tv/device/connect - after approval → approved + cookie
# ============================================================================
print("\n[TEST 12] POST /api/tv/device/connect - after approval → approved + session")
try:
    response = tv_session.post(f"{API_URL}/tv/device/connect", json={
        'deviceId': tv_device_id,
        'secret': tv_secret
    })
    
    if response.status_code == 200:
        data = response.json()
        if data.get('status') == 'approved':
            # Check if session cookie was set
            if 'eqrel_session' in tv_session.cookies:
                log_test("TV connect - after approval returns approved + cookie", True, 
                        f"Family: {data.get('familyName', 'N/A')}")
            else:
                log_test("TV connect - session cookie", False, "Cookie not set")
        else:
            log_test("TV connect - after approval status", False, f"Expected 'approved', got {data}")
    else:
        log_test("TV connect - after approval", False, f"Status {response.status_code}: {response.text}")
except Exception as e:
    log_test("TV connect - after approval", False, f"Exception: {e}")

# ============================================================================
# TEST 13: GET /api/family/display-data - TV session works
# ============================================================================
print("\n[TEST 13] GET /api/family/display-data - TV session can access")
try:
    response = tv_session.get(f"{API_URL}/family/display-data")
    
    if response.status_code == 200:
        data = response.json()
        if 'family' in data and 'children' in data:
            log_test("TV session - can access display-data", True)
        else:
            log_test("TV session - display-data structure", False, f"Got: {list(data.keys())}")
    else:
        log_test("TV session - display-data", False, f"Status {response.status_code}: {response.text}")
except Exception as e:
    log_test("TV session - display-data", False, f"Exception: {e}")

# ============================================================================
# TEST 14: GET /api/family/display-config - TV session works
# ============================================================================
print("\n[TEST 14] GET /api/family/display-config - TV session can access")
try:
    response = tv_session.get(f"{API_URL}/family/display-config")
    
    if response.status_code == 200:
        log_test("TV session - can access display-config", True)
    else:
        log_test("TV session - display-config", False, f"Status {response.status_code}: {response.text}")
except Exception as e:
    log_test("TV session - display-config", False, f"Exception: {e}")

# ============================================================================
# TEST 15: POST /api/tv/device/approve - TV session cannot approve → 403
# ============================================================================
print("\n[TEST 15] POST /api/tv/device/approve - TV session forbidden → 403")
try:
    # Create a new device to try approving
    new_tv = requests.post(f"{API_URL}/tv/device/start", headers={
        'User-Agent': 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0)'
    })
    new_code = new_tv.json().get('code')
    
    response = tv_session.post(f"{API_URL}/tv/device/approve", json={
        'code': new_code,
        'name': 'Hacker TV'
    })
    
    if response.status_code == 403:
        log_test("TV session - cannot approve devices (403)", True)
    else:
        log_test("TV session - approve forbidden", False, f"Expected 403, got {response.status_code}")
except Exception as e:
    log_test("TV session - approve forbidden", False, f"Exception: {e}")

# ============================================================================
# TEST 16: GET /api/tv/device/lookup - TV session cannot lookup → 403
# ============================================================================
print("\n[TEST 16] GET /api/tv/device/lookup - TV session forbidden → 403")
try:
    response = tv_session.get(f"{API_URL}/tv/device/lookup?code=123456")
    
    if response.status_code == 403:
        log_test("TV session - cannot lookup devices (403)", True)
    else:
        log_test("TV session - lookup forbidden", False, f"Expected 403, got {response.status_code}")
except Exception as e:
    log_test("TV session - lookup forbidden", False, f"Exception: {e}")

# ============================================================================
# TEST 17: GET /api/family/tv-devices - TV session cannot list → 403
# ============================================================================
print("\n[TEST 17] GET /api/family/tv-devices - TV session forbidden → 403")
try:
    response = tv_session.get(f"{API_URL}/family/tv-devices")
    
    if response.status_code == 403:
        log_test("TV session - cannot list devices (403)", True)
    else:
        log_test("TV session - list forbidden", False, f"Expected 403, got {response.status_code}")
except Exception as e:
    log_test("TV session - list forbidden", False, f"Exception: {e}")

# ============================================================================
# TEST 18: GET /api/family/tv-devices - parent can list
# ============================================================================
print("\n[TEST 18] GET /api/family/tv-devices - parent can list devices")
try:
    response = parent_session.get(f"{API_URL}/family/tv-devices")
    
    if response.status_code == 200:
        data = response.json()
        devices = data.get('devices', [])
        if len(devices) > 0:
            device = devices[0]
            if (device.get('name') == 'Living room TV' and 
                device.get('label') == 'Samsung TV' and
                'approvedAt' in device and
                'secretHash' not in device):
                log_test("TV devices list - contains approved device without secretHash", True, 
                        f"Found: {device.get('name')}")
            else:
                log_test("TV devices list - device data", False, f"Got: {device}")
        else:
            log_test("TV devices list - no devices", False, "Expected at least 1 device")
    else:
        log_test("TV devices list", False, f"Status {response.status_code}: {response.text}")
except Exception as e:
    log_test("TV devices list", False, f"Exception: {e}")

# ============================================================================
# TEST 19: POST /api/family/tv-devices/:id/revoke - parent can revoke
# ============================================================================
print("\n[TEST 19] POST /api/family/tv-devices/:id/revoke - parent revokes device")
try:
    response = parent_session.post(f"{API_URL}/family/tv-devices/{tv_device_id}/revoke")
    
    if response.status_code == 200:
        data = response.json()
        if data.get('ok'):
            log_test("TV revoke - successful revocation", True)
        else:
            log_test("TV revoke - response", False, f"Got: {data}")
    else:
        log_test("TV revoke", False, f"Status {response.status_code}: {response.text}")
except Exception as e:
    log_test("TV revoke", False, f"Exception: {e}")

# ============================================================================
# TEST 20: GET /api/family/display-data - revoked TV session → 401
# ============================================================================
print("\n[TEST 20] GET /api/family/display-data - revoked TV session → 401")
try:
    response = tv_session.get(f"{API_URL}/family/display-data")
    
    if response.status_code == 401:
        log_test("Revoked TV session - cannot access display-data (401)", True)
    else:
        log_test("Revoked TV session - display-data", False, f"Expected 401, got {response.status_code}")
except Exception as e:
    log_test("Revoked TV session - display-data", False, f"Exception: {e}")

# ============================================================================
# TEST 21: POST /api/tv/device/connect - revoked device → revoked status
# ============================================================================
print("\n[TEST 21] POST /api/tv/device/connect - revoked device → revoked")
try:
    # Create new session without cookie
    fresh_tv = requests.Session()
    response = fresh_tv.post(f"{API_URL}/tv/device/connect", json={
        'deviceId': tv_device_id,
        'secret': tv_secret
    })
    
    if response.status_code == 200:
        data = response.json()
        if data.get('status') == 'revoked':
            log_test("TV connect - revoked device returns revoked status", True)
        else:
            log_test("TV connect - revoked status", False, f"Expected 'revoked', got {data}")
    else:
        log_test("TV connect - revoked", False, f"Status {response.status_code}: {response.text}")
except Exception as e:
    log_test("TV connect - revoked", False, f"Exception: {e}")

# ============================================================================
# TEST 22: GET /api/family/tv-devices - revoked device not in list
# ============================================================================
print("\n[TEST 22] GET /api/family/tv-devices - revoked device not in list")
try:
    response = parent_session.get(f"{API_URL}/family/tv-devices")
    
    if response.status_code == 200:
        data = response.json()
        devices = data.get('devices', [])
        device_ids = [d.get('id') for d in devices]
        if tv_device_id not in device_ids:
            log_test("TV devices list - revoked device not shown", True)
        else:
            log_test("TV devices list - revoked device", False, "Revoked device still in list")
    else:
        log_test("TV devices list - after revoke", False, f"Status {response.status_code}: {response.text}")
except Exception as e:
    log_test("TV devices list - after revoke", False, f"Exception: {e}")

# ============================================================================
# TEST 23: POST /api/family/tv-devices/:id/revoke - revoke again → 404
# ============================================================================
print("\n[TEST 23] POST /api/family/tv-devices/:id/revoke - revoke again → 404")
try:
    response = parent_session.post(f"{API_URL}/family/tv-devices/{tv_device_id}/revoke")
    
    if response.status_code == 404:
        log_test("TV revoke - revoke again returns 404", True)
    else:
        log_test("TV revoke - revoke again", False, f"Expected 404, got {response.status_code}")
except Exception as e:
    log_test("TV revoke - revoke again", False, f"Exception: {e}")

# ============================================================================
# TEST 24: POST /api/family/tv-devices/:id/revoke - wrong family → 404
# ============================================================================
print("\n[TEST 24] POST /api/family/tv-devices/:id/revoke - wrong family device → 404")
try:
    fake_device_id = "fake-device-id-12345"
    response = parent_session.post(f"{API_URL}/family/tv-devices/{fake_device_id}/revoke")
    
    if response.status_code == 404:
        log_test("TV revoke - wrong family device returns 404", True)
    else:
        log_test("TV revoke - wrong family", False, f"Expected 404, got {response.status_code}")
except Exception as e:
    log_test("TV revoke - wrong family", False, f"Exception: {e}")

# ============================================================================
# TEST 25: REGRESSION - Legacy POST /api/family/tv-pair/generate
# ============================================================================
print("\n[TEST 25] REGRESSION - POST /api/family/tv-pair/generate (legacy)")
try:
    response = parent_session.post(f"{API_URL}/family/tv-pair/generate")
    
    if response.status_code == 200:
        data = response.json()
        if data.get('ok') and 'code' in data and len(data['code']) == 6:
            legacy_code = data['code']
            log_test("Legacy TV pair - generate code works", True, f"Code: {legacy_code}")
            
            # ============================================================================
            # TEST 26: REGRESSION - POST /api/tv-pair/redeem
            # ============================================================================
            print("\n[TEST 26] REGRESSION - POST /api/tv-pair/redeem (legacy)")
            legacy_tv = requests.Session()
            redeem_response = legacy_tv.post(f"{API_URL}/tv-pair/redeem", json={
                'code': legacy_code
            })
            
            if redeem_response.status_code == 200:
                redeem_data = redeem_response.json()
                if redeem_data.get('ok') and 'eqrel_session' in legacy_tv.cookies:
                    log_test("Legacy TV pair - redeem code works + sets cookie", True)
                    
                    # Test that legacy TV session can access display-data
                    display_response = legacy_tv.get(f"{API_URL}/family/display-data")
                    if display_response.status_code == 200:
                        log_test("Legacy TV session - can access display-data", True)
                    else:
                        log_test("Legacy TV session - display-data", False, 
                                f"Status {display_response.status_code}")
                else:
                    log_test("Legacy TV pair - redeem response", False, f"Got: {redeem_data}")
            else:
                log_test("Legacy TV pair - redeem", False, 
                        f"Status {redeem_response.status_code}: {redeem_response.text}")
        else:
            log_test("Legacy TV pair - generate response", False, f"Got: {data}")
    else:
        log_test("Legacy TV pair - generate", False, f"Status {response.status_code}: {response.text}")
except Exception as e:
    log_test("Legacy TV pair", False, f"Exception: {e}")

# ============================================================================
# SUMMARY
# ============================================================================
print("\n" + "=" * 80)
print("TEST SUMMARY")
print("=" * 80)

passed = sum(1 for t in test_results if t['passed'])
failed = sum(1 for t in test_results if not t['passed'])
total = len(test_results)

print(f"\nTotal Tests: {total}")
print(f"✅ Passed: {passed}")
print(f"❌ Failed: {failed}")
print(f"Success Rate: {(passed/total*100):.1f}%")

if failed > 0:
    print("\n❌ FAILED TESTS:")
    for t in test_results:
        if not t['passed']:
            print(f"  - {t['name']}")
            if t['details']:
                print(f"    {t['details']}")

# Cleanup
print("\n" + "=" * 80)
cleanup_tv_devices()
print("=" * 80)

# Exit with appropriate code
exit(0 if failed == 0 else 1)
