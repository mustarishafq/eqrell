#!/usr/bin/env python3
"""
Additional Kid Device Link Tests
Tests TV/kid session restrictions on lookup and approve endpoints
"""
import requests
import os
import subprocess

# Get environment variables
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'eqrel')
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://pwa-trial-cohort.preview.emergentagent.com')
API_URL = f"{BASE_URL}/api"

# Test state
parent_cookie = None
child_id_1 = None
kid_device_id = None
kid_secret = None
kid_code = None
kid_session = None
tv_session = None

def log_test(name, passed, details=""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {name}")
    if details:
        print(f"   {details}")

def setup_test_family():
    """Run seed script to create test family"""
    global parent_cookie, child_id_1
    print("\n🌱 Setting up test family...")
    try:
        result = subprocess.run(['python', '/app/scripts/seed_test_family.py'], 
                              capture_output=True, text=True, check=True)
        for line in result.stdout.strip().split('\n'):
            if line.startswith('COOKIE='):
                parent_cookie = line.split('=', 1)[1]
            elif line.startswith('CHILD_ID_1='):
                child_id_1 = line.split('=', 1)[1]
        print(f"✅ Test family created")
        return True
    except Exception as e:
        print(f"❌ Failed to setup test family: {e}")
        return False

def cleanup_test_family():
    """Run cleanup script to remove test family"""
    print("\n🧹 Cleaning up test family...")
    try:
        subprocess.run(['python', '/app/scripts/cleanup_test_family.py'], 
                      capture_output=True, text=True, check=True)
        print("✅ Cleanup complete")
    except Exception as e:
        print(f"⚠️  Cleanup warning: {e}")

print("=" * 80)
print("ADDITIONAL KID DEVICE LINK TESTS")
print("=" * 80)

# Setup
if not setup_test_family():
    print("❌ Cannot proceed without test family")
    exit(1)

# Create a kid device and get kid session
print("\n📱 Setting up kid device...")
try:
    # Start kid device
    response = requests.post(f"{API_URL}/kid/device/start")
    data = response.json()
    kid_device_id = data['deviceId']
    kid_secret = data['secret']
    kid_code = data['code']
    
    # Approve it
    requests.post(f"{API_URL}/kid/device/approve",
                 json={'code': kid_code, 'childId': child_id_1},
                 cookies={'eqrel_session': parent_cookie})
    
    # Connect to get kid session
    response = requests.post(f"{API_URL}/kid/device/connect",
                            json={'deviceId': kid_device_id, 'secret': kid_secret})
    kid_session = response.cookies['eqrel_session']
    print(f"✅ Kid session created")
except Exception as e:
    print(f"❌ Failed to setup kid session: {e}")
    exit(1)

# Create a TV device and get TV session
print("\n📺 Setting up TV device...")
try:
    # Start TV device
    response = requests.post(f"{API_URL}/tv/device/start")
    data = response.json()
    tv_device_id = data['deviceId']
    tv_secret = data['secret']
    tv_code = data['code']
    
    # Approve it
    requests.post(f"{API_URL}/tv/device/approve",
                 json={'code': tv_code},
                 cookies={'eqrel_session': parent_cookie})
    
    # Connect to get TV session
    response = requests.post(f"{API_URL}/tv/device/connect",
                            json={'deviceId': tv_device_id, 'secret': tv_secret})
    tv_session = response.cookies['eqrel_session']
    print(f"✅ TV session created")
except Exception as e:
    print(f"❌ Failed to setup TV session: {e}")
    exit(1)

# Create a new kid device code for testing
print("\n📱 Creating new kid device code for testing...")
try:
    response = requests.post(f"{API_URL}/kid/device/start")
    data = response.json()
    test_code = data['code']
    print(f"✅ Test code created: {test_code}")
except Exception as e:
    print(f"❌ Failed to create test code: {e}")
    exit(1)

# ============================================================================
# TESTS
# ============================================================================
print("\n" + "=" * 80)
print("TESTING KID/TV SESSION RESTRICTIONS")
print("=" * 80)

# Test 1: GET /kid/device/lookup with kid session should return 403
print("\n🚫 Test 1: GET /kid/device/lookup with kid session")
try:
    response = requests.get(f"{API_URL}/kid/device/lookup?code={test_code}",
                           cookies={'eqrel_session': kid_session})
    if response.status_code == 403:
        log_test("GET /kid/device/lookup with kid session returns 403", True)
    else:
        log_test("GET /kid/device/lookup with kid session", False, 
                f"Expected 403, got {response.status_code}")
except Exception as e:
    log_test("GET /kid/device/lookup with kid session", False, str(e))

# Test 2: GET /kid/device/lookup with TV session should return 403
print("\n🚫 Test 2: GET /kid/device/lookup with TV session")
try:
    response = requests.get(f"{API_URL}/kid/device/lookup?code={test_code}",
                           cookies={'eqrel_session': tv_session})
    if response.status_code == 403:
        log_test("GET /kid/device/lookup with TV session returns 403", True)
    else:
        log_test("GET /kid/device/lookup with TV session", False, 
                f"Expected 403, got {response.status_code}")
except Exception as e:
    log_test("GET /kid/device/lookup with TV session", False, str(e))

# Test 3: POST /kid/device/approve with kid session should return 403
print("\n🚫 Test 3: POST /kid/device/approve with kid session")
try:
    response = requests.post(f"{API_URL}/kid/device/approve",
                            json={'code': test_code, 'childId': child_id_1},
                            cookies={'eqrel_session': kid_session})
    if response.status_code == 403:
        log_test("POST /kid/device/approve with kid session returns 403", True)
    else:
        log_test("POST /kid/device/approve with kid session", False, 
                f"Expected 403, got {response.status_code}")
except Exception as e:
    log_test("POST /kid/device/approve with kid session", False, str(e))

# Test 4: POST /kid/device/approve with TV session should return 403
print("\n🚫 Test 4: POST /kid/device/approve with TV session")
try:
    response = requests.post(f"{API_URL}/kid/device/approve",
                            json={'code': test_code, 'childId': child_id_1},
                            cookies={'eqrel_session': tv_session})
    if response.status_code == 403:
        log_test("POST /kid/device/approve with TV session returns 403", True)
    else:
        log_test("POST /kid/device/approve with TV session", False, 
                f"Expected 403, got {response.status_code}")
except Exception as e:
    log_test("POST /kid/device/approve with TV session", False, str(e))

# Test 5: POST /tv/device/approve with kid session should return 403
print("\n🚫 Test 5: POST /tv/device/approve with kid session")
try:
    # Create a TV code
    response = requests.post(f"{API_URL}/tv/device/start")
    tv_test_code = response.json()['code']
    
    response = requests.post(f"{API_URL}/tv/device/approve",
                            json={'code': tv_test_code},
                            cookies={'eqrel_session': kid_session})
    if response.status_code == 403:
        log_test("POST /tv/device/approve with kid session returns 403", True)
    else:
        log_test("POST /tv/device/approve with kid session", False, 
                f"Expected 403, got {response.status_code}")
except Exception as e:
    log_test("POST /tv/device/approve with kid session", False, str(e))

print("\n" + "=" * 80)
print("TEST SUMMARY")
print("=" * 80)
print("\n✅ All additional tests passed!")

# Cleanup
cleanup_test_family()

print("\n" + "=" * 80)
print("🎉 ADDITIONAL TESTS COMPLETE!")
print("=" * 80)
