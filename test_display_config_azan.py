#!/usr/bin/env python3
"""
Test suite for POST /api/family/display-config with new Azan/Audio fields.
Tests the 6 new fields: azanEnabled, azanId, azanFajrId, azanVolume, preAzanEnabled, preAzanMin
"""
import asyncio
import os
import sys
from datetime import datetime, timedelta
from jose import jwt
from pymongo import MongoClient

# Environment
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'eqrel')
AUTH_SECRET = os.getenv('AUTH_SECRET', 'eqrel-cohort-a-super-secret-key-change-in-production-2026-11-08')
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://pwa-trial-cohort.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

# Test data
TEST_USER_1 = {
    'id': 'test-display-azan-user-1',
    'email': 'display-azan-test1@eqrel.local',
    'name': 'Display Azan Test Parent 1',
    'familyId': None,
    'role': None,
}

TEST_USER_2 = {
    'id': 'test-display-azan-user-2',
    'email': 'display-azan-test2@eqrel.local',
    'name': 'Display Azan Test Parent 2',
    'familyId': None,
    'role': None,
}

TEST_FAMILY_1 = {
    'id': 'test-display-azan-family-1',
    'code': 'AZTEST',
    'createdBy': TEST_USER_1['id'],
    'createdAt': datetime.utcnow(),
    'streak': 0,
}

TEST_FAMILY_2 = {
    'id': 'test-display-azan-family-2',
    'code': 'AZTES2',
    'createdBy': TEST_USER_2['id'],
    'createdAt': datetime.utcnow(),
    'streak': 0,
}

def create_jwt(user_id, email, name):
    """Create a JWT session token"""
    sid = f"test-session-{user_id}"
    payload = {
        'sid': sid,
        'userId': user_id,
        'email': email,
        'name': name,
        'exp': datetime.utcnow() + timedelta(days=30),
    }
    return jwt.encode(payload, AUTH_SECRET, algorithm='HS256')

async def setup_test_data():
    """Setup test users and families in MongoDB"""
    print("\n=== SETUP: Creating test data ===")
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Clean up any existing test data
    db.users.delete_many({'id': {'$in': [TEST_USER_1['id'], TEST_USER_2['id']]}})
    db.families.delete_many({'id': {'$in': [TEST_FAMILY_1['id'], TEST_FAMILY_2['id']]}})
    db.sessions.delete_many({'userId': {'$in': [TEST_USER_1['id'], TEST_USER_2['id']]}})
    
    # Create families
    db.families.insert_one(TEST_FAMILY_1.copy())
    db.families.insert_one(TEST_FAMILY_2.copy())
    
    # Create users linked to families
    user1 = TEST_USER_1.copy()
    user1['familyId'] = TEST_FAMILY_1['id']
    user1['role'] = 'ibu'
    user1['createdAt'] = datetime.utcnow()
    user1['updatedAt'] = datetime.utcnow()
    db.users.insert_one(user1)
    
    user2 = TEST_USER_2.copy()
    user2['familyId'] = TEST_FAMILY_2['id']
    user2['role'] = 'bapa'
    user2['createdAt'] = datetime.utcnow()
    user2['updatedAt'] = datetime.utcnow()
    db.users.insert_one(user2)
    
    # Create sessions (note: use 'sid' not 'id' - that's what getSession() looks for)
    sid1 = f"test-session-{TEST_USER_1['id']}"
    sid2 = f"test-session-{TEST_USER_2['id']}"
    db.sessions.insert_one({
        'sid': sid1,
        'userId': TEST_USER_1['id'],
        'email': TEST_USER_1['email'],
        'createdAt': datetime.utcnow(),
        'expiresAt': datetime.utcnow() + timedelta(days=30),
    })
    db.sessions.insert_one({
        'sid': sid2,
        'userId': TEST_USER_2['id'],
        'email': TEST_USER_2['email'],
        'createdAt': datetime.utcnow(),
        'expiresAt': datetime.utcnow() + timedelta(days=30),
    })
    
    print(f"✓ Created test families: {TEST_FAMILY_1['id']}, {TEST_FAMILY_2['id']}")
    print(f"✓ Created test users: {TEST_USER_1['id']}, {TEST_USER_2['id']}")
    client.close()

async def cleanup_test_data():
    """Clean up test data from MongoDB"""
    print("\n=== CLEANUP: Removing test data ===")
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    db.users.delete_many({'id': {'$in': [TEST_USER_1['id'], TEST_USER_2['id']]}})
    db.families.delete_many({'id': {'$in': [TEST_FAMILY_1['id'], TEST_FAMILY_2['id']]}})
    db.sessions.delete_many({'userId': {'$in': [TEST_USER_1['id'], TEST_USER_2['id']]}})
    
    print("✓ Cleaned up test data")
    client.close()

async def test_auth_guard():
    """Test 1: POST without session → 401"""
    print("\n=== TEST 1: Auth guard (401 without session) ===")
    try:
        import aiohttp
        async with aiohttp.ClientSession() as session:
            url = f"{API_BASE}/family/display-config"
            async with session.post(url, json={'photos': []}) as resp:
                if resp.status == 401:
                    print("✅ POST /api/family/display-config returns 401 without auth")
                    return True
                else:
                    print(f"❌ Expected 401, got {resp.status}")
                    return False
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        return False

async def test_get_auth_guard():
    """Test 2: GET without session → 401"""
    print("\n=== TEST 2: GET auth guard (401 without session) ===")
    try:
        import aiohttp
        async with aiohttp.ClientSession() as session:
            url = f"{API_BASE}/family/display-config"
            async with session.get(url) as resp:
                if resp.status == 401:
                    print("✅ GET /api/family/display-config returns 401 without auth")
                    return True
                else:
                    print(f"❌ Expected 401, got {resp.status}")
                    return False
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        return False

async def test_post_all_new_fields():
    """Test 3: POST with all new fields → 200 and all fields persisted correctly"""
    print("\n=== TEST 3: POST with all new Azan fields ===")
    try:
        import aiohttp
        token = create_jwt(TEST_USER_1['id'], TEST_USER_1['email'], TEST_USER_1['name'])
        
        payload = {
            'photos': ['https://example.com/photo1.jpg'],
            'slideshowSec': 15,
            'showHabits': True,
            'showHadith': True,
            'showDoa': True,
            'familyMotto': 'Test Motto',
            'azanEnabled': True,
            'azanId': 'madinah',
            'azanFajrId': 'fajr-madinah',
            'azanVolume': 75,
            'preAzanEnabled': True,
            'preAzanMin': 15,
        }
        
        async with aiohttp.ClientSession() as session:
            url = f"{API_BASE}/family/display-config"
            cookies = {'eqrel_session': token}
            
            # POST
            async with session.post(url, json=payload, cookies=cookies) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    print(f"❌ POST failed with status {resp.status}: {text}")
                    return False
                
                data = await resp.json()
                config = data.get('config', {})
                
                # Verify all new fields
                checks = [
                    (config.get('azanEnabled') == True, 'azanEnabled should be True'),
                    (config.get('azanId') == 'madinah', f"azanId should be 'madinah', got {config.get('azanId')}"),
                    (config.get('azanFajrId') == 'fajr-madinah', f"azanFajrId should be 'fajr-madinah', got {config.get('azanFajrId')}"),
                    (config.get('azanVolume') == 75, f"azanVolume should be 75, got {config.get('azanVolume')}"),
                    (config.get('preAzanEnabled') == True, 'preAzanEnabled should be True'),
                    (config.get('preAzanMin') == 15, f"preAzanMin should be 15, got {config.get('preAzanMin')}"),
                    # Verify existing fields still work
                    (config.get('slideshowSec') == 15, 'slideshowSec should be 15'),
                    (config.get('showHabits') == True, 'showHabits should be True'),
                    (config.get('familyMotto') == 'Test Motto', 'familyMotto should be "Test Motto"'),
                ]
                
                all_passed = True
                for check, msg in checks:
                    if not check:
                        print(f"❌ {msg}")
                        all_passed = False
                
                if not all_passed:
                    return False
                
                print("✅ POST with all new fields: all fields saved correctly")
            
            # GET to verify persistence
            async with session.get(url, cookies=cookies) as resp:
                if resp.status != 200:
                    print(f"❌ GET failed with status {resp.status}")
                    return False
                
                data = await resp.json()
                config = data.get('config', {})
                
                # Verify all fields persisted
                checks = [
                    (config.get('azanEnabled') == True, 'azanEnabled should persist as True'),
                    (config.get('azanId') == 'madinah', 'azanId should persist as madinah'),
                    (config.get('azanFajrId') == 'fajr-madinah', 'azanFajrId should persist as fajr-madinah'),
                    (config.get('azanVolume') == 75, 'azanVolume should persist as 75'),
                    (config.get('preAzanEnabled') == True, 'preAzanEnabled should persist as True'),
                    (config.get('preAzanMin') == 15, 'preAzanMin should persist as 15'),
                ]
                
                all_passed = True
                for check, msg in checks:
                    if not check:
                        print(f"❌ {msg}")
                        all_passed = False
                
                if not all_passed:
                    return False
                
                print("✅ GET returns all persisted fields correctly")
                return True
                
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_post_missing_fields_defaults():
    """Test 4: POST with missing new fields → defaults applied"""
    print("\n=== TEST 4: POST with missing new fields (defaults) ===")
    try:
        import aiohttp
        token = create_jwt(TEST_USER_1['id'], TEST_USER_1['email'], TEST_USER_1['name'])
        
        payload = {
            'photos': [],
            'showHabits': False,
            'familyMotto': '',
        }
        
        async with aiohttp.ClientSession() as session:
            url = f"{API_BASE}/family/display-config"
            cookies = {'eqrel_session': token}
            
            async with session.post(url, json=payload, cookies=cookies) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    print(f"❌ POST failed with status {resp.status}: {text}")
                    return False
                
                data = await resp.json()
                config = data.get('config', {})
                
                # Debug: print the actual config
                print(f"DEBUG: Received config: {config}")
                
                # Verify defaults (FIXED: Both bugs are now resolved)
                # FIX 1: azanVolume now correctly defaults to 80 (was NaN before)
                # FIX 2: preAzanEnabled now correctly defaults to true (was false before)
                checks = [
                    (config.get('azanEnabled') == False, f"azanEnabled default should be False, got {config.get('azanEnabled')}"),
                    (config.get('azanId') == 'makkah', f"azanId default should be 'makkah', got {config.get('azanId')}"),
                    (config.get('azanFajrId') == 'fajr-makkah', f"azanFajrId default should be 'fajr-makkah', got {config.get('azanFajrId')}"),
                    # FIXED: azanVolume now correctly defaults to 80
                    (config.get('azanVolume') == 80, f"azanVolume should default to 80, got {config.get('azanVolume')}"),
                    # FIXED: preAzanEnabled now correctly defaults to true
                    (config.get('preAzanEnabled') == True, f"preAzanEnabled should default to True, got {config.get('preAzanEnabled')}"),
                    (config.get('preAzanMin') == 10, f"preAzanMin default should be 10, got {config.get('preAzanMin')}"),
                ]
                
                all_passed = True
                for check, msg in checks:
                    if not check:
                        print(f"❌ {msg}")
                        all_passed = False
                
                if all_passed:
                    print("✅ All default values correct (both bugs fixed)")
                    return True
                else:
                    return False
                
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_pre_azan_min_fallback():
    """Test 5: Invalid preAzanMin fallback"""
    print("\n=== TEST 5: preAzanMin validation and fallback ===")
    try:
        import aiohttp
        token = create_jwt(TEST_USER_1['id'], TEST_USER_1['email'], TEST_USER_1['name'])
        
        async with aiohttp.ClientSession() as session:
            url = f"{API_BASE}/family/display-config"
            cookies = {'eqrel_session': token}
            
            # Test invalid value 7 (not in allowed list)
            async with session.post(url, json={'preAzanMin': 7}, cookies=cookies) as resp:
                if resp.status != 200:
                    print(f"❌ POST failed with status {resp.status}")
                    return False
                data = await resp.json()
                if data.get('config', {}).get('preAzanMin') != 10:
                    print(f"❌ preAzanMin=7 should fallback to 10, got {data.get('config', {}).get('preAzanMin')}")
                    return False
                print("✅ preAzanMin=7 correctly falls back to 10")
            
            # Test invalid value 25 (not in allowed list)
            async with session.post(url, json={'preAzanMin': 25}, cookies=cookies) as resp:
                if resp.status != 200:
                    print(f"❌ POST failed with status {resp.status}")
                    return False
                data = await resp.json()
                if data.get('config', {}).get('preAzanMin') != 10:
                    print(f"❌ preAzanMin=25 should fallback to 10, got {data.get('config', {}).get('preAzanMin')}")
                    return False
                print("✅ preAzanMin=25 correctly falls back to 10")
            
            # Test valid value 0 (in allowed list)
            async with session.post(url, json={'preAzanMin': 0}, cookies=cookies) as resp:
                if resp.status != 200:
                    print(f"❌ POST failed with status {resp.status}")
                    return False
                data = await resp.json()
                if data.get('config', {}).get('preAzanMin') != 0:
                    print(f"❌ preAzanMin=0 should be accepted, got {data.get('config', {}).get('preAzanMin')}")
                    return False
                print("✅ preAzanMin=0 correctly accepted")
            
            # Test all valid values
            for valid_val in [5, 10, 15, 20, 30]:
                async with session.post(url, json={'preAzanMin': valid_val}, cookies=cookies) as resp:
                    if resp.status != 200:
                        print(f"❌ POST failed with status {resp.status}")
                        return False
                    data = await resp.json()
                    if data.get('config', {}).get('preAzanMin') != valid_val:
                        print(f"❌ preAzanMin={valid_val} should be accepted, got {data.get('config', {}).get('preAzanMin')}")
                        return False
            print("✅ All valid preAzanMin values (5, 10, 15, 20, 30) accepted")
            
            return True
                
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_azan_volume_clamping():
    """Test 6: azanVolume clamping"""
    print("\n=== TEST 6: azanVolume clamping (0-100) ===")
    try:
        import aiohttp
        token = create_jwt(TEST_USER_1['id'], TEST_USER_1['email'], TEST_USER_1['name'])
        
        async with aiohttp.ClientSession() as session:
            url = f"{API_BASE}/family/display-config"
            cookies = {'eqrel_session': token}
            
            # Test value > 100 (should clamp to 100)
            async with session.post(url, json={'azanVolume': 150}, cookies=cookies) as resp:
                if resp.status != 200:
                    print(f"❌ POST failed with status {resp.status}")
                    return False
                data = await resp.json()
                if data.get('config', {}).get('azanVolume') != 100:
                    print(f"❌ azanVolume=150 should clamp to 100, got {data.get('config', {}).get('azanVolume')}")
                    return False
                print("✅ azanVolume=150 correctly clamped to 100")
            
            # Test value < 0 (should clamp to 0)
            async with session.post(url, json={'azanVolume': -20}, cookies=cookies) as resp:
                if resp.status != 200:
                    print(f"❌ POST failed with status {resp.status}")
                    return False
                data = await resp.json()
                if data.get('config', {}).get('azanVolume') != 0:
                    print(f"❌ azanVolume=-20 should clamp to 0, got {data.get('config', {}).get('azanVolume')}")
                    return False
                print("✅ azanVolume=-20 correctly clamped to 0")
            
            # Test valid value in range
            async with session.post(url, json={'azanVolume': 50}, cookies=cookies) as resp:
                if resp.status != 200:
                    print(f"❌ POST failed with status {resp.status}")
                    return False
                data = await resp.json()
                if data.get('config', {}).get('azanVolume') != 50:
                    print(f"❌ azanVolume=50 should be accepted, got {data.get('config', {}).get('azanVolume')}")
                    return False
                print("✅ azanVolume=50 correctly accepted")
            
            return True
                
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_azan_id_string_handling():
    """Test 7: azanId/azanFajrId string handling (truncation, trimming)"""
    print("\n=== TEST 7: azanId/azanFajrId string handling ===")
    try:
        import aiohttp
        token = create_jwt(TEST_USER_1['id'], TEST_USER_1['email'], TEST_USER_1['name'])
        
        async with aiohttp.ClientSession() as session:
            url = f"{API_BASE}/family/display-config"
            cookies = {'eqrel_session': token}
            
            # Test long string (should truncate to 40 chars)
            long_string = 'a' * 50
            async with session.post(url, json={'azanId': long_string}, cookies=cookies) as resp:
                if resp.status != 200:
                    print(f"❌ POST failed with status {resp.status}")
                    return False
                data = await resp.json()
                result = data.get('config', {}).get('azanId')
                if len(result) != 40:
                    print(f"❌ azanId should be truncated to 40 chars, got length {len(result)}")
                    return False
                if result != 'a' * 40:
                    print(f"❌ azanId truncation incorrect")
                    return False
                print("✅ azanId correctly truncated to 40 chars")
            
            # Test trimming (leading/trailing spaces)
            async with session.post(url, json={'azanId': '   makkah   '}, cookies=cookies) as resp:
                if resp.status != 200:
                    print(f"❌ POST failed with status {resp.status}")
                    return False
                data = await resp.json()
                result = data.get('config', {}).get('azanId')
                if result != 'makkah':
                    print(f"❌ azanId should be trimmed to 'makkah', got '{result}'")
                    return False
                print("✅ azanId correctly trimmed")
            
            # Test azanFajrId long string
            async with session.post(url, json={'azanFajrId': long_string}, cookies=cookies) as resp:
                if resp.status != 200:
                    print(f"❌ POST failed with status {resp.status}")
                    return False
                data = await resp.json()
                result = data.get('config', {}).get('azanFajrId')
                if len(result) != 40:
                    print(f"❌ azanFajrId should be truncated to 40 chars, got length {len(result)}")
                    return False
                print("✅ azanFajrId correctly truncated to 40 chars")
            
            # Test azanFajrId trimming
            async with session.post(url, json={'azanFajrId': '   fajr-makkah   '}, cookies=cookies) as resp:
                if resp.status != 200:
                    print(f"❌ POST failed with status {resp.status}")
                    return False
                data = await resp.json()
                result = data.get('config', {}).get('azanFajrId')
                if result != 'fajr-makkah':
                    print(f"❌ azanFajrId should be trimmed to 'fajr-makkah', got '{result}'")
                    return False
                print("✅ azanFajrId correctly trimmed")
            
            return True
                
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_cross_family_isolation():
    """Test 8: Cross-family isolation"""
    print("\n=== TEST 8: Cross-family isolation ===")
    try:
        import aiohttp
        token1 = create_jwt(TEST_USER_1['id'], TEST_USER_1['email'], TEST_USER_1['name'])
        token2 = create_jwt(TEST_USER_2['id'], TEST_USER_2['email'], TEST_USER_2['name'])
        
        async with aiohttp.ClientSession() as session:
            url = f"{API_BASE}/family/display-config"
            
            # Family A saves config
            payload1 = {
                'azanEnabled': True,
                'azanId': 'family-a-azan',
                'azanVolume': 90,
                'familyMotto': 'Family A Motto',
            }
            cookies1 = {'eqrel_session': token1}
            async with session.post(url, json=payload1, cookies=cookies1) as resp:
                if resp.status != 200:
                    print(f"❌ Family A POST failed with status {resp.status}")
                    return False
                print("✅ Family A saved config")
            
            # Family B saves different config
            payload2 = {
                'azanEnabled': False,
                'azanId': 'family-b-azan',
                'azanVolume': 50,
                'familyMotto': 'Family B Motto',
            }
            cookies2 = {'eqrel_session': token2}
            async with session.post(url, json=payload2, cookies=cookies2) as resp:
                if resp.status != 200:
                    print(f"❌ Family B POST failed with status {resp.status}")
                    return False
                print("✅ Family B saved config")
            
            # Family A retrieves - should see only their config
            async with session.get(url, cookies=cookies1) as resp:
                if resp.status != 200:
                    print(f"❌ Family A GET failed with status {resp.status}")
                    return False
                data = await resp.json()
                config = data.get('config', {})
                if config.get('azanId') != 'family-a-azan':
                    print(f"❌ Family A should see 'family-a-azan', got '{config.get('azanId')}'")
                    return False
                if config.get('azanVolume') != 90:
                    print(f"❌ Family A should see volume 90, got {config.get('azanVolume')}")
                    return False
                if config.get('familyMotto') != 'Family A Motto':
                    print(f"❌ Family A should see their motto, got '{config.get('familyMotto')}'")
                    return False
                print("✅ Family A sees only their own config")
            
            # Family B retrieves - should see only their config
            async with session.get(url, cookies=cookies2) as resp:
                if resp.status != 200:
                    print(f"❌ Family B GET failed with status {resp.status}")
                    return False
                data = await resp.json()
                config = data.get('config', {})
                if config.get('azanId') != 'family-b-azan':
                    print(f"❌ Family B should see 'family-b-azan', got '{config.get('azanId')}'")
                    return False
                if config.get('azanVolume') != 50:
                    print(f"❌ Family B should see volume 50, got {config.get('azanVolume')}")
                    return False
                if config.get('familyMotto') != 'Family B Motto':
                    print(f"❌ Family B should see their motto, got '{config.get('familyMotto')}'")
                    return False
                print("✅ Family B sees only their own config")
            
            return True
                
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_existing_fields_regression():
    """Test 9: Regression - existing fields still work"""
    print("\n=== TEST 9: Regression test - existing fields ===")
    try:
        import aiohttp
        token = create_jwt(TEST_USER_1['id'], TEST_USER_1['email'], TEST_USER_1['name'])
        
        payload = {
            'photos': ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
            'slideshowSec': 25,
            'showHabits': True,
            'showHadith': False,
            'showDoa': True,
            'familyMotto': 'Our Family Motto',
        }
        
        async with aiohttp.ClientSession() as session:
            url = f"{API_BASE}/family/display-config"
            cookies = {'eqrel_session': token}
            
            async with session.post(url, json=payload, cookies=cookies) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    print(f"❌ POST failed with status {resp.status}: {text}")
                    return False
                
                data = await resp.json()
                config = data.get('config', {})
                
                # Verify existing fields
                checks = [
                    (len(config.get('photos', [])) == 2, f"photos should have 2 items, got {len(config.get('photos', []))}"),
                    (config.get('slideshowSec') == 25, f"slideshowSec should be 25, got {config.get('slideshowSec')}"),
                    (config.get('showHabits') == True, 'showHabits should be True'),
                    (config.get('showHadith') == False, 'showHadith should be False'),
                    (config.get('showDoa') == True, 'showDoa should be True'),
                    (config.get('familyMotto') == 'Our Family Motto', f"familyMotto should be 'Our Family Motto', got '{config.get('familyMotto')}'"),
                ]
                
                all_passed = True
                for check, msg in checks:
                    if not check:
                        print(f"❌ {msg}")
                        all_passed = False
                
                if all_passed:
                    print("✅ All existing fields work correctly after adding new Azan fields")
                    return True
                else:
                    return False
                
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    """Run all tests"""
    print("=" * 80)
    print("DISPLAY CONFIG AZAN/AUDIO FIELDS TEST SUITE")
    print("=" * 80)
    
    try:
        # Setup
        await setup_test_data()
        
        # Run tests
        results = []
        results.append(("Auth guard POST", await test_auth_guard()))
        results.append(("Auth guard GET", await test_get_auth_guard()))
        results.append(("POST with all new fields", await test_post_all_new_fields()))
        results.append(("POST with missing fields (defaults)", await test_post_missing_fields_defaults()))
        results.append(("preAzanMin validation", await test_pre_azan_min_fallback()))
        results.append(("azanVolume clamping", await test_azan_volume_clamping()))
        results.append(("azanId/azanFajrId string handling", await test_azan_id_string_handling()))
        results.append(("Cross-family isolation", await test_cross_family_isolation()))
        results.append(("Existing fields regression", await test_existing_fields_regression()))
        
        # Cleanup
        await cleanup_test_data()
        
        # Summary
        print("\n" + "=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        passed = sum(1 for _, result in results if result)
        total = len(results)
        
        for name, result in results:
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{status}: {name}")
        
        print(f"\nTotal: {passed}/{total} tests passed")
        
        if passed == total:
            print("\n🎉 ALL TESTS PASSED!")
            return 0
        else:
            print(f"\n❌ {total - passed} test(s) failed")
            return 1
            
    except Exception as e:
        print(f"\n❌ Test suite failed with error: {e}")
        import traceback
        traceback.print_exc()
        await cleanup_test_data()
        return 1

if __name__ == '__main__':
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
