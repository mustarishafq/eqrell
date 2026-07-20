#!/usr/bin/env python3
"""
Backend test suite for Family Display Config - Dim Mode + Background Audio fields
Tests the extended POST /api/family/display-config endpoint with 7 new fields.

New fields tested:
1. dimEnabled (bool, default false)
2. dimStartHour (number 0-23, default 22, clamped)
3. dimEndHour (number 0-23, default 6, clamped)
4. dimLevel (number 10-100, default 30, clamped)
5. bgAudioEnabled (bool, default false)
6. bgAudioUrl (string, max 500 chars, default '', trimmed)
7. bgAudioVolume (number 0-100, default 25, clamped)
"""

import asyncio
import os
import sys
from datetime import datetime, timedelta
from jose import jwt
from pymongo import MongoClient
import aiohttp

# Environment
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'eqrel')
AUTH_SECRET = os.getenv('AUTH_SECRET', 'eqrel-cohort-a-super-secret-key-change-in-production-2026-11-08')
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://pwa-trial-cohort.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

# MongoDB client
client = MongoClient(MONGO_URL)
db = client[DB_NAME]

# Test counters
tests_passed = 0
tests_failed = 0

def log_test(name, passed, details=""):
    global tests_passed, tests_failed
    if passed:
        tests_passed += 1
        print(f"✅ TEST PASSED: {name}")
        if details:
            print(f"   {details}")
    else:
        tests_failed += 1
        print(f"❌ TEST FAILED: {name}")
        if details:
            print(f"   {details}")

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

def setup_test_user_with_family(user_id_suffix):
    """Create a test user with family and session"""
    user_id = f"test-user-dim-{user_id_suffix}-{datetime.now().timestamp()}"
    family_id = f"test-family-dim-{user_id_suffix}-{datetime.now().timestamp()}"
    
    # Create family
    db.families.insert_one({
        'id': family_id,
        'code': f'DIM{user_id_suffix[:3].upper()}',
        'createdAt': datetime.utcnow()
    })
    
    # Create user
    db.users.insert_one({
        'id': user_id,
        'email': f'{user_id}@test.local',
        'name': f'Test User {user_id_suffix}',
        'familyId': family_id,
        'role': 'ibu',
        'createdAt': datetime.utcnow()
    })
    
    # Create session
    sid = f"test-session-{user_id}"
    db.sessions.insert_one({
        'sid': sid,
        'userId': user_id,
        'email': f'{user_id}@test.local',
        'createdAt': datetime.utcnow(),
        'expiresAt': datetime.utcnow() + timedelta(days=30)
    })
    
    # Create JWT token
    token = create_jwt(user_id, f'{user_id}@test.local', f'Test User {user_id_suffix}')
    
    return user_id, family_id, token

def cleanup_test_user(user_id, family_id):
    """Clean up test user, family, and session"""
    db.users.delete_one({'id': user_id})
    db.families.delete_one({'id': family_id})
    db.sessions.delete_one({'userId': user_id})

async def test_auth_guard():
    """Test 1: POST without session → 401"""
    print("\n=== TEST 1: Auth Guard ===")
    
    async with aiohttp.ClientSession() as session:
        url = f"{API_BASE}/family/display-config"
        async with session.post(url, json={'photos': []}) as resp:
            data = await resp.json()
            
            if data.get('error') == 'unauthorized':
                log_test("POST /family/display-config without session returns 401", True)
            else:
                log_test("POST /family/display-config without session returns 401", False, 
                        f"Expected 'unauthorized' error, got: {data}")

async def test_get_auth_guard():
    """Test 2: GET without session → 401"""
    print("\n=== TEST 2: GET Auth Guard ===")
    
    async with aiohttp.ClientSession() as session:
        url = f"{API_BASE}/family/display-config"
        async with session.get(url) as resp:
            data = await resp.json()
            
            if data.get('error') == 'unauthorized':
                log_test("GET /family/display-config without session returns 401", True)
            else:
                log_test("GET /family/display-config without session returns 401", False, 
                        f"Expected 'unauthorized' error, got: {data}")

async def test_all_new_fields_persisted():
    """Test 3: POST with all new fields → 200 and all fields persisted correctly"""
    print("\n=== TEST 3: All New Fields Persisted ===")
    
    user_id, family_id, token = setup_test_user_with_family('allfields')
    
    try:
        # POST with all new fields
        payload = {
            'dimEnabled': True,
            'dimStartHour': 21,
            'dimEndHour': 5,
            'dimLevel': 40,
            'bgAudioEnabled': True,
            'bgAudioUrl': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            'bgAudioVolume': 50,
            'photos': []
        }
        
        async with aiohttp.ClientSession() as session:
            url = f"{API_BASE}/family/display-config"
            cookies = {'eqrel_session': token}
            
            async with session.post(url, json=payload, cookies=cookies) as resp:
                post_data = await resp.json()
                
                if not post_data.get('ok'):
                    log_test("POST with all new fields returns ok:true", False, f"Response: {post_data}")
                    return
                
                log_test("POST with all new fields returns ok:true", True)
            
            # Verify via GET
            async with session.get(url, cookies=cookies) as resp:
                get_data = await resp.json()
                config = get_data.get('config', {})
                
                # Check all fields
                checks = [
                    ('dimEnabled', config.get('dimEnabled') == True, f"Expected True, got {config.get('dimEnabled')}"),
                    ('dimStartHour', config.get('dimStartHour') == 21, f"Expected 21, got {config.get('dimStartHour')}"),
                    ('dimEndHour', config.get('dimEndHour') == 5, f"Expected 5, got {config.get('dimEndHour')}"),
                    ('dimLevel', config.get('dimLevel') == 40, f"Expected 40, got {config.get('dimLevel')}"),
                    ('bgAudioEnabled', config.get('bgAudioEnabled') == True, f"Expected True, got {config.get('bgAudioEnabled')}"),
                    ('bgAudioUrl', config.get('bgAudioUrl') == 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 
                     f"Expected YouTube URL, got {config.get('bgAudioUrl')}"),
                    ('bgAudioVolume', config.get('bgAudioVolume') == 50, f"Expected 50, got {config.get('bgAudioVolume')}")
                ]
                
                for field_name, passed, details in checks:
                    log_test(f"Field {field_name} persisted correctly", passed, details if not passed else "")
    
    finally:
        cleanup_test_user(user_id, family_id)

async def test_defaults_when_fields_missing():
    """Test 4: Defaults when fields missing"""
    print("\n=== TEST 4: Default Values ===")
    
    user_id, family_id, token = setup_test_user_with_family('defaults')
    
    try:
        # POST with no new fields (only photos to make it valid)
        payload = {'photos': []}
        
        async with aiohttp.ClientSession() as session:
            url = f"{API_BASE}/family/display-config"
            cookies = {'eqrel_session': token}
            
            async with session.post(url, json=payload, cookies=cookies) as resp:
                post_data = await resp.json()
                
                if not post_data.get('ok'):
                    log_test("POST with missing fields returns ok:true", False, f"Response: {post_data}")
                    return
            
            # Verify defaults via GET
            async with session.get(url, cookies=cookies) as resp:
                get_data = await resp.json()
                config = get_data.get('config', {})
                
                # Check default values
                checks = [
                    ('dimEnabled default', config.get('dimEnabled') == False, f"Expected False, got {config.get('dimEnabled')}"),
                    ('dimStartHour default', config.get('dimStartHour') == 22, f"Expected 22, got {config.get('dimStartHour')}"),
                    ('dimEndHour default', config.get('dimEndHour') == 6, f"Expected 6, got {config.get('dimEndHour')}"),
                    ('dimLevel default', config.get('dimLevel') == 30, f"Expected 30, got {config.get('dimLevel')}"),
                    ('bgAudioEnabled default', config.get('bgAudioEnabled') == False, f"Expected False, got {config.get('bgAudioEnabled')}"),
                    ('bgAudioUrl default', config.get('bgAudioUrl') == '', f"Expected empty string, got '{config.get('bgAudioUrl')}'"),
                    ('bgAudioVolume default', config.get('bgAudioVolume') == 25, f"Expected 25, got {config.get('bgAudioVolume')}")
                ]
                
                for field_name, passed, details in checks:
                    log_test(field_name, passed, details if not passed else "")
    
    finally:
        cleanup_test_user(user_id, family_id)

async def test_clamping_dim_hours():
    """Test 5: Clamping dimStartHour and dimEndHour"""
    print("\n=== TEST 5: Clamping Dim Hours ===")
    
    user_id, family_id, token = setup_test_user_with_family('clamphours')
    
    try:
        async with aiohttp.ClientSession() as session:
            url = f"{API_BASE}/family/display-config"
            cookies = {'eqrel_session': token}
            
            # Test 1: dimStartHour = 30 → clamped to 23
            await session.post(url, json={'dimStartHour': 30, 'photos': []}, cookies=cookies)
            async with session.get(url, cookies=cookies) as resp:
                config = (await resp.json()).get('config', {})
                log_test("dimStartHour=30 clamped to 23", config.get('dimStartHour') == 23, 
                        f"Expected 23, got {config.get('dimStartHour')}")
            
            # Test 2: dimStartHour = -5 → clamped to 0
            await session.post(url, json={'dimStartHour': -5, 'photos': []}, cookies=cookies)
            async with session.get(url, cookies=cookies) as resp:
                config = (await resp.json()).get('config', {})
                log_test("dimStartHour=-5 clamped to 0", config.get('dimStartHour') == 0, 
                        f"Expected 0, got {config.get('dimStartHour')}")
            
            # Test 3: dimEndHour = 25 → clamped to 23
            await session.post(url, json={'dimEndHour': 25, 'photos': []}, cookies=cookies)
            async with session.get(url, cookies=cookies) as resp:
                config = (await resp.json()).get('config', {})
                log_test("dimEndHour=25 clamped to 23", config.get('dimEndHour') == 23, 
                        f"Expected 23, got {config.get('dimEndHour')}")
    
    finally:
        cleanup_test_user(user_id, family_id)

async def test_clamping_dim_level():
    """Test 6: Clamping dimLevel (10-100)"""
    print("\n=== TEST 6: Clamping Dim Level ===")
    
    user_id, family_id, token = setup_test_user_with_family('clamplevel')
    
    try:
        async with aiohttp.ClientSession() as session:
            url = f"{API_BASE}/family/display-config"
            cookies = {'eqrel_session': token}
            
            # Test 1: dimLevel = 5 → clamped to 10 (min is 10 not 0)
            await session.post(url, json={'dimLevel': 5, 'photos': []}, cookies=cookies)
            async with session.get(url, cookies=cookies) as resp:
                config = (await resp.json()).get('config', {})
                log_test("dimLevel=5 clamped to 10", config.get('dimLevel') == 10, 
                        f"Expected 10, got {config.get('dimLevel')}")
            
            # Test 2: dimLevel = 150 → clamped to 100
            await session.post(url, json={'dimLevel': 150, 'photos': []}, cookies=cookies)
            async with session.get(url, cookies=cookies) as resp:
                config = (await resp.json()).get('config', {})
                log_test("dimLevel=150 clamped to 100", config.get('dimLevel') == 100, 
                        f"Expected 100, got {config.get('dimLevel')}")
            
            # Test 3: dimLevel = 50 → stays 50
            await session.post(url, json={'dimLevel': 50, 'photos': []}, cookies=cookies)
            async with session.get(url, cookies=cookies) as resp:
                config = (await resp.json()).get('config', {})
                log_test("dimLevel=50 stays 50", config.get('dimLevel') == 50, 
                        f"Expected 50, got {config.get('dimLevel')}")
    
    finally:
        cleanup_test_user(user_id, family_id)

async def test_clamping_bg_audio_volume():
    """Test 7: Clamping bgAudioVolume (0-100)"""
    print("\n=== TEST 7: Clamping Background Audio Volume ===")
    
    user_id, family_id, token = setup_test_user_with_family('clampvol')
    
    try:
        async with aiohttp.ClientSession() as session:
            url = f"{API_BASE}/family/display-config"
            cookies = {'eqrel_session': token}
            
            # Test 1: bgAudioVolume = 200 → clamped to 100
            await session.post(url, json={'bgAudioVolume': 200, 'photos': []}, cookies=cookies)
            async with session.get(url, cookies=cookies) as resp:
                config = (await resp.json()).get('config', {})
                log_test("bgAudioVolume=200 clamped to 100", config.get('bgAudioVolume') == 100, 
                        f"Expected 100, got {config.get('bgAudioVolume')}")
            
            # Test 2: bgAudioVolume = -10 → clamped to 0
            await session.post(url, json={'bgAudioVolume': -10, 'photos': []}, cookies=cookies)
            async with session.get(url, cookies=cookies) as resp:
                config = (await resp.json()).get('config', {})
                log_test("bgAudioVolume=-10 clamped to 0", config.get('bgAudioVolume') == 0, 
                        f"Expected 0, got {config.get('bgAudioVolume')}")
    
    finally:
        cleanup_test_user(user_id, family_id)

async def test_url_truncation_and_trimming():
    """Test 8: URL truncation and trimming"""
    print("\n=== TEST 8: URL Truncation and Trimming ===")
    
    user_id, family_id, token = setup_test_user_with_family('url')
    
    try:
        async with aiohttp.ClientSession() as session:
            url = f"{API_BASE}/family/display-config"
            cookies = {'eqrel_session': token}
            
            # Test 1: URL of 600 chars → truncated to 500
            long_url = 'https://www.youtube.com/watch?v=' + 'a' * 600
            await session.post(url, json={'bgAudioUrl': long_url, 'photos': []}, cookies=cookies)
            async with session.get(url, cookies=cookies) as resp:
                config = (await resp.json()).get('config', {})
                url_length = len(config.get('bgAudioUrl', ''))
                log_test("URL of 600 chars truncated to 500", url_length == 500, 
                        f"Expected length 500, got {url_length}")
            
            # Test 2: URL with leading/trailing spaces → trimmed
            spaced_url = '   https://www.youtube.com/watch?v=test123   '
            await session.post(url, json={'bgAudioUrl': spaced_url, 'photos': []}, cookies=cookies)
            async with session.get(url, cookies=cookies) as resp:
                config = (await resp.json()).get('config', {})
                stored_url = config.get('bgAudioUrl', '')
                log_test("URL with spaces trimmed", stored_url == 'https://www.youtube.com/watch?v=test123', 
                        f"Expected trimmed URL, got '{stored_url}'")
            
            # Test 3: Empty string → stored as ''
            await session.post(url, json={'bgAudioUrl': '', 'photos': []}, cookies=cookies)
            async with session.get(url, cookies=cookies) as resp:
                config = (await resp.json()).get('config', {})
                log_test("Empty URL stored as empty string", config.get('bgAudioUrl') == '', 
                        f"Expected '', got '{config.get('bgAudioUrl')}'")
    
    finally:
        cleanup_test_user(user_id, family_id)

async def test_regression_existing_fields():
    """Test 9: Regression - existing fields still work"""
    print("\n=== TEST 9: Regression - Existing Fields ===")
    
    user_id, family_id, token = setup_test_user_with_family('regression')
    
    try:
        # POST with existing fields + new fields
        payload = {
            'photos': ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
            'slideshowSec': 15,
            'showHabits': True,
            'showHadith': True,
            'showDoa': False,
            'familyMotto': 'Test Family Motto',
            'azanEnabled': True,
            'azanId': 'makkah',
            'azanFajrId': 'fajr-makkah',
            'azanVolume': 75,
            'preAzanEnabled': True,
            'preAzanMin': 15,
            # New fields
            'dimEnabled': True,
            'dimStartHour': 20,
            'dimEndHour': 7,
            'dimLevel': 35,
            'bgAudioEnabled': True,
            'bgAudioUrl': 'https://www.youtube.com/watch?v=test',
            'bgAudioVolume': 30
        }
        
        async with aiohttp.ClientSession() as session:
            url = f"{API_BASE}/family/display-config"
            cookies = {'eqrel_session': token}
            
            async with session.post(url, json=payload, cookies=cookies) as resp:
                post_data = await resp.json()
                
                if not post_data.get('ok'):
                    log_test("POST with all fields returns ok:true", False, f"Response: {post_data}")
                    return
            
            # Verify all fields via GET
            async with session.get(url, cookies=cookies) as resp:
                get_data = await resp.json()
                config = get_data.get('config', {})
                
                # Check existing fields
                existing_checks = [
                    ('photos', len(config.get('photos', [])) == 2, f"Expected 2 photos, got {len(config.get('photos', []))}"),
                    ('slideshowSec', config.get('slideshowSec') == 15, f"Expected 15, got {config.get('slideshowSec')}"),
                    ('showHabits', config.get('showHabits') == True, f"Expected True, got {config.get('showHabits')}"),
                    ('showHadith', config.get('showHadith') == True, f"Expected True, got {config.get('showHadith')}"),
                    ('showDoa', config.get('showDoa') == False, f"Expected False, got {config.get('showDoa')}"),
                    ('familyMotto', config.get('familyMotto') == 'Test Family Motto', f"Expected motto, got {config.get('familyMotto')}"),
                    ('azanEnabled', config.get('azanEnabled') == True, f"Expected True, got {config.get('azanEnabled')}"),
                    ('azanVolume', config.get('azanVolume') == 75, f"Expected 75, got {config.get('azanVolume')}"),
                    ('preAzanEnabled', config.get('preAzanEnabled') == True, f"Expected True, got {config.get('preAzanEnabled')}"),
                    ('preAzanMin', config.get('preAzanMin') == 15, f"Expected 15, got {config.get('preAzanMin')}")
                ]
                
                # Check new fields
                new_checks = [
                    ('dimEnabled', config.get('dimEnabled') == True, f"Expected True, got {config.get('dimEnabled')}"),
                    ('dimStartHour', config.get('dimStartHour') == 20, f"Expected 20, got {config.get('dimStartHour')}"),
                    ('dimEndHour', config.get('dimEndHour') == 7, f"Expected 7, got {config.get('dimEndHour')}"),
                    ('dimLevel', config.get('dimLevel') == 35, f"Expected 35, got {config.get('dimLevel')}"),
                    ('bgAudioEnabled', config.get('bgAudioEnabled') == True, f"Expected True, got {config.get('bgAudioEnabled')}"),
                    ('bgAudioUrl', 'youtube.com' in config.get('bgAudioUrl', ''), f"Expected YouTube URL, got {config.get('bgAudioUrl')}"),
                    ('bgAudioVolume', config.get('bgAudioVolume') == 30, f"Expected 30, got {config.get('bgAudioVolume')}")
                ]
                
                for field_name, passed, details in existing_checks + new_checks:
                    log_test(f"Regression: {field_name} works", passed, details if not passed else "")
    
    finally:
        cleanup_test_user(user_id, family_id)

async def main():
    print("=" * 80)
    print("BACKEND TEST SUITE: Family Display Config - Dim Mode + Background Audio")
    print("=" * 80)
    
    try:
        # Run all tests
        await test_auth_guard()
        await test_get_auth_guard()
        await test_all_new_fields_persisted()
        await test_defaults_when_fields_missing()
        await test_clamping_dim_hours()
        await test_clamping_dim_level()
        await test_clamping_bg_audio_volume()
        await test_url_truncation_and_trimming()
        await test_regression_existing_fields()
        
        # Summary
        print("\n" + "=" * 80)
        print(f"TEST SUMMARY: {tests_passed} passed, {tests_failed} failed")
        print("=" * 80)
        
        if tests_failed == 0:
            print("✅ ALL TESTS PASSED - Dim Mode + Background Audio endpoints are production-ready!")
            return 0
        else:
            print(f"❌ {tests_failed} TEST(S) FAILED - Please review the failures above")
            return 1
            
    except Exception as e:
        print(f"\n❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        client.close()

if __name__ == '__main__':
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
