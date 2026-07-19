#!/usr/bin/env python3
"""
Focused test suite to verify the 2 specific Azan fixes:
1. Line 696: azanVolume default handling (Number(body.azanVolume ?? 80) instead of Number(body.azanVolume) ?? 80)
2. Line 697: preAzanEnabled default handling (body.preAzanEnabled !== false instead of !!body.preAzanEnabled)
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

TEST_USER = {
    'id': 'test-azan-fix-user',
    'email': 'azan-fix-test@eqrel.local',
    'name': 'Azan Fix Test User',
    'familyId': 'test-azan-fix-family',
    'role': 'ibu',
}

TEST_FAMILY = {
    'id': 'test-azan-fix-family',
    'code': 'AZFIX1',
    'createdBy': TEST_USER['id'],
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
    """Setup test user and family in MongoDB"""
    print("\n=== SETUP: Creating test data ===")
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Clean up any existing test data
    db.users.delete_many({'id': TEST_USER['id']})
    db.families.delete_many({'id': TEST_FAMILY['id']})
    db.sessions.delete_many({'userId': TEST_USER['id']})
    
    # Create family
    db.families.insert_one(TEST_FAMILY.copy())
    
    # Create user linked to family
    user = TEST_USER.copy()
    user['createdAt'] = datetime.utcnow()
    user['updatedAt'] = datetime.utcnow()
    db.users.insert_one(user)
    
    # Create session
    sid = f"test-session-{TEST_USER['id']}"
    db.sessions.insert_one({
        'sid': sid,
        'userId': TEST_USER['id'],
        'email': TEST_USER['email'],
        'createdAt': datetime.utcnow(),
        'expiresAt': datetime.utcnow() + timedelta(days=30),
    })
    
    print(f"✓ Created test family: {TEST_FAMILY['id']}")
    print(f"✓ Created test user: {TEST_USER['id']}")
    client.close()

async def cleanup_test_data():
    """Clean up test data from MongoDB"""
    print("\n=== CLEANUP: Removing test data ===")
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    db.users.delete_many({'id': TEST_USER['id']})
    db.families.delete_many({'id': TEST_FAMILY['id']})
    db.sessions.delete_many({'userId': TEST_USER['id']})
    
    print("✓ Cleaned up test data")
    client.close()

async def test_fix_1_azan_volume_undefined():
    """
    FIX 1 TEST: POST with azanVolume=undefined → should default to 80
    
    Before fix: Number(body.azanVolume) ?? 80 = Number(undefined) ?? 80 = NaN ?? 80 = NaN (nullish coalesce doesn't catch NaN)
    After fix:  Number(body.azanVolume ?? 80) = Number(80) = 80 ✓
    """
    print("\n=== FIX 1 TEST: azanVolume undefined → defaults to 80 ===")
    try:
        import aiohttp
        token = create_jwt(TEST_USER['id'], TEST_USER['email'], TEST_USER['name'])
        
        # POST with NO azanVolume field at all (undefined)
        payload = {
            'photos': [],
            'showHabits': True,
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
                
                volume = config.get('azanVolume')
                print(f"   Received azanVolume: {volume} (type: {type(volume).__name__})")
                
                if volume == 80:
                    print("✅ FIX 1 VERIFIED: azanVolume correctly defaults to 80 when undefined")
                    return True
                else:
                    print(f"❌ FIX 1 FAILED: Expected azanVolume=80, got {volume}")
                    return False
                
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_fix_1_azan_volume_explicit_undefined():
    """
    FIX 1 TEST: POST with azanVolume explicitly set to undefined/null → should default to 80
    """
    print("\n=== FIX 1 TEST: azanVolume=null → defaults to 80 ===")
    try:
        import aiohttp
        token = create_jwt(TEST_USER['id'], TEST_USER['email'], TEST_USER['name'])
        
        # POST with azanVolume explicitly set to None (null in JSON)
        payload = {
            'photos': [],
            'azanVolume': None,
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
                
                volume = config.get('azanVolume')
                print(f"   Received azanVolume: {volume} (type: {type(volume).__name__})")
                
                if volume == 80:
                    print("✅ FIX 1 VERIFIED: azanVolume correctly defaults to 80 when null")
                    return True
                else:
                    print(f"❌ FIX 1 FAILED: Expected azanVolume=80, got {volume}")
                    return False
                
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_fix_2_pre_azan_enabled_undefined():
    """
    FIX 2 TEST: POST with preAzanEnabled=undefined → should default to true
    
    Before fix: !!body.preAzanEnabled = !!undefined = false ✗
    After fix:  body.preAzanEnabled !== false = undefined !== false = true ✓
    """
    print("\n=== FIX 2 TEST: preAzanEnabled undefined → defaults to true ===")
    try:
        import aiohttp
        token = create_jwt(TEST_USER['id'], TEST_USER['email'], TEST_USER['name'])
        
        # POST with NO preAzanEnabled field at all (undefined)
        payload = {
            'photos': [],
            'showHabits': True,
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
                
                enabled = config.get('preAzanEnabled')
                print(f"   Received preAzanEnabled: {enabled} (type: {type(enabled).__name__})")
                
                if enabled is True:
                    print("✅ FIX 2 VERIFIED: preAzanEnabled correctly defaults to true when undefined")
                    return True
                else:
                    print(f"❌ FIX 2 FAILED: Expected preAzanEnabled=true, got {enabled}")
                    return False
                
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_fix_2_pre_azan_enabled_false():
    """
    FIX 2 TEST: POST with preAzanEnabled=false explicitly → should persist as false
    """
    print("\n=== FIX 2 TEST: preAzanEnabled=false explicitly → persists as false ===")
    try:
        import aiohttp
        token = create_jwt(TEST_USER['id'], TEST_USER['email'], TEST_USER['name'])
        
        # POST with preAzanEnabled explicitly set to false
        payload = {
            'photos': [],
            'preAzanEnabled': False,
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
                
                enabled = config.get('preAzanEnabled')
                print(f"   Received preAzanEnabled: {enabled} (type: {type(enabled).__name__})")
                
                if enabled is False:
                    print("✅ FIX 2 VERIFIED: preAzanEnabled correctly persists as false when explicitly set")
                    return True
                else:
                    print(f"❌ FIX 2 FAILED: Expected preAzanEnabled=false, got {enabled}")
                    return False
                
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_fix_2_pre_azan_enabled_true():
    """
    FIX 2 TEST: POST with preAzanEnabled=true explicitly → should persist as true
    """
    print("\n=== FIX 2 TEST: preAzanEnabled=true explicitly → persists as true ===")
    try:
        import aiohttp
        token = create_jwt(TEST_USER['id'], TEST_USER['email'], TEST_USER['name'])
        
        # POST with preAzanEnabled explicitly set to true
        payload = {
            'photos': [],
            'preAzanEnabled': True,
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
                
                enabled = config.get('preAzanEnabled')
                print(f"   Received preAzanEnabled: {enabled} (type: {type(enabled).__name__})")
                
                if enabled is True:
                    print("✅ FIX 2 VERIFIED: preAzanEnabled correctly persists as true when explicitly set")
                    return True
                else:
                    print(f"❌ FIX 2 FAILED: Expected preAzanEnabled=true, got {enabled}")
                    return False
                
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    """Run all focused fix verification tests"""
    print("=" * 80)
    print("AZAN FIXES VERIFICATION TEST SUITE")
    print("=" * 80)
    print("\nVerifying 2 specific fixes:")
    print("  FIX 1 (Line 696): azanVolume default handling")
    print("  FIX 2 (Line 697): preAzanEnabled default handling")
    
    try:
        # Setup
        await setup_test_data()
        
        # Run tests
        results = []
        results.append(("FIX 1: azanVolume undefined → 80", await test_fix_1_azan_volume_undefined()))
        results.append(("FIX 1: azanVolume null → 80", await test_fix_1_azan_volume_explicit_undefined()))
        results.append(("FIX 2: preAzanEnabled undefined → true", await test_fix_2_pre_azan_enabled_undefined()))
        results.append(("FIX 2: preAzanEnabled=false → false", await test_fix_2_pre_azan_enabled_false()))
        results.append(("FIX 2: preAzanEnabled=true → true", await test_fix_2_pre_azan_enabled_true()))
        
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
            print("\n🎉 ALL FIXES VERIFIED - BOTH BUGS ARE FIXED!")
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
