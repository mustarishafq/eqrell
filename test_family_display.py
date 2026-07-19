#!/usr/bin/env python3
"""
Family Display Endpoints Test Suite
Tests the 4 new endpoints:
1. GET /api/family/prayer-location
2. POST /api/family/prayer-location
3. GET /api/family/prayer-times
4. GET /api/family/display-data
"""

import requests
import json
import os
import time
from datetime import datetime, timedelta
from pymongo import MongoClient
from jose import jwt
import uuid

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000')
API_URL = f"{BASE_URL}/api"
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'eqrel')
AUTH_SECRET = os.getenv('AUTH_SECRET', 'eqrel-cohort-a-super-secret-key-change-in-production-2026-11-08')

# MongoDB connection
mongo_client = MongoClient(MONGO_URL)
db = mongo_client[DB_NAME]

# Test data storage
test_users = []
test_sessions = []
test_families = []
test_children = []
test_habits = []

def create_test_jwt(user_id, email, name, sid):
    """Create a JWT token for testing"""
    payload = {
        'sid': sid,
        'userId': user_id,
        'email': email,
        'name': name,
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + timedelta(days=30)
    }
    token = jwt.encode(payload, AUTH_SECRET, algorithm='HS256')
    return token

def create_test_user_with_session(email, name, family_id=None, role=None):
    """Create a test user and session in MongoDB, return JWT token"""
    user_id = str(uuid.uuid4())
    sid = str(uuid.uuid4())
    
    # Insert user
    user = {
        'id': user_id,
        'email': email,
        'name': name,
        'familyId': family_id,
        'role': role,
        'createdAt': datetime.utcnow(),
        'updatedAt': datetime.utcnow()
    }
    db.users.insert_one(user)
    test_users.append(user_id)
    
    # Insert session
    session = {
        'sid': sid,
        'userId': user_id,
        'email': email,
        'expiresAt': datetime.utcnow() + timedelta(days=30),
        'createdAt': datetime.utcnow()
    }
    db.sessions.insert_one(session)
    test_sessions.append(sid)
    
    # Create JWT
    token = create_test_jwt(user_id, email, name, sid)
    
    return {
        'user_id': user_id,
        'email': email,
        'name': name,
        'token': token,
        'sid': sid,
        'family_id': family_id,
        'role': role
    }

def create_test_family(code='TESTFM'):
    """Create a test family"""
    family_id = str(uuid.uuid4())
    family = {
        'id': family_id,
        'code': code,
        'createdAt': datetime.utcnow(),
        'streak': 0,
        'location': None
    }
    db.families.insert_one(family)
    test_families.append(family_id)
    return family_id

def create_test_child(family_id, nickname='Test Child'):
    """Create a test child"""
    child_id = str(uuid.uuid4())
    child = {
        'id': child_id,
        'familyId': family_id,
        'nickname': nickname,
        'dob': '2018-01-01',
        'gender': 'male',
        'ageBand': '5-6',
        'avatarId': 'B01',
        'favColor': 'green',
        'preferredLang': 'ms',
        'mataBina': 0,
        'mataReward': 0,
        'createdAt': datetime.utcnow(),
        'updatedAt': datetime.utcnow()
    }
    db.children.insert_one(child)
    test_children.append(child_id)
    return child_id

def create_test_habit(family_id, child_id, title='Test Habit'):
    """Create a test habit"""
    habit_id = str(uuid.uuid4())
    habit = {
        'id': habit_id,
        'familyId': family_id,
        'childId': child_id,
        'title': title,
        'desc': 'Test habit description',
        'category': 'ibadah',
        'points': 10,
        'frequency': 'daily',
        'active': True,
        'createdAt': datetime.utcnow(),
        'updatedAt': datetime.utcnow()
    }
    db.habits.insert_one(habit)
    test_habits.append(habit_id)
    return habit_id

def create_test_claim(family_id, child_id, habit_id, status='verified', date_str=None):
    """Create a test habit claim"""
    if date_str is None:
        now = datetime.utcnow()
        date_str = f"{now.year}-{str(now.month).zfill(2)}-{str(now.day).zfill(2)}"
    
    claim = {
        'habitId': habit_id,
        'childId': child_id,
        'familyId': family_id,
        'dateStr': date_str,
        'status': status,
        'rubric': 'sah',
        'pointsAwarded': 10,
        'claimedAt': datetime.utcnow(),
        'claimedBy': 'test-user',
        'verifiedAt': datetime.utcnow(),
        'verifiedBy': 'test-user'
    }
    db.habit_claims.insert_one(claim)

def cleanup_test_data():
    """Clean up all test data from MongoDB"""
    print("\n🧹 Cleaning up test data...")
    
    # Delete test users
    if test_users:
        result = db.users.delete_many({'id': {'$in': test_users}})
        print(f"   Deleted {result.deleted_count} test users")
    
    # Delete test sessions
    if test_sessions:
        result = db.sessions.delete_many({'sid': {'$in': test_sessions}})
        print(f"   Deleted {result.deleted_count} test sessions")
    
    # Delete test families
    if test_families:
        result = db.families.delete_many({'id': {'$in': test_families}})
        print(f"   Deleted {result.deleted_count} test families")
    
    # Delete test children
    if test_children:
        result = db.children.delete_many({'id': {'$in': test_children}})
        print(f"   Deleted {result.deleted_count} test children")
    
    # Delete test habits
    if test_habits:
        result = db.habits.delete_many({'id': {'$in': test_habits}})
        print(f"   Deleted {result.deleted_count} test habits")
    
    # Delete test habit claims
    result = db.habit_claims.delete_many({'familyId': {'$in': test_families}})
    print(f"   Deleted {result.deleted_count} test habit claims")
    
    # Delete prayer times cache for test families
    result = db.prayer_times_cache.delete_many({'familyId': {'$in': test_families}})
    print(f"   Deleted {result.deleted_count} prayer times cache entries")
    
    print("✅ Cleanup complete\n")

def run_tests():
    """Run all Family Display endpoint tests"""
    print("=" * 80)
    print("FAMILY DISPLAY ENDPOINTS TEST SUITE")
    print("=" * 80)
    
    passed = 0
    failed = 0
    
    try:
        # ═══════════════════════════════════════════════════════════════
        # SECTION 1: Auth Guards (401 without session)
        # ═══════════════════════════════════════════════════════════════
        print("\n" + "=" * 80)
        print("SECTION 1: Auth Guards - All endpoints require authentication")
        print("=" * 80)
        
        # Test 1: GET /family/prayer-location without auth → 401
        try:
            print("\n[TEST 1] GET /family/prayer-location without auth → 401")
            r = requests.get(f"{API_URL}/family/prayer-location")
            assert r.status_code == 401, f"Expected 401, got {r.status_code}"
            print("✅ PASS: Returns 401 without auth")
            passed += 1
        except AssertionError as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        
        # Test 2: POST /family/prayer-location without auth → 401
        try:
            print("\n[TEST 2] POST /family/prayer-location without auth → 401")
            r = requests.post(f"{API_URL}/family/prayer-location", json={'city': 'Test', 'country': 'Test'})
            assert r.status_code == 401, f"Expected 401, got {r.status_code}"
            print("✅ PASS: Returns 401 without auth")
            passed += 1
        except AssertionError as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        
        # Test 3: GET /family/prayer-times without auth → 401
        try:
            print("\n[TEST 3] GET /family/prayer-times without auth → 401")
            r = requests.get(f"{API_URL}/family/prayer-times")
            assert r.status_code == 401, f"Expected 401, got {r.status_code}"
            print("✅ PASS: Returns 401 without auth")
            passed += 1
        except AssertionError as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        
        # Test 4: GET /family/display-data without auth → 401
        try:
            print("\n[TEST 4] GET /family/display-data without auth → 401")
            r = requests.get(f"{API_URL}/family/display-data")
            assert r.status_code == 401, f"Expected 401, got {r.status_code}"
            print("✅ PASS: Returns 401 without auth")
            passed += 1
        except AssertionError as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        
        # ═══════════════════════════════════════════════════════════════
        # SECTION 2: User without family
        # ═══════════════════════════════════════════════════════════════
        print("\n" + "=" * 80)
        print("SECTION 2: User without family")
        print("=" * 80)
        
        # Create user without family
        user_no_family = create_test_user_with_session('nofamily@test.com', 'No Family User')
        headers_no_family = {'Cookie': f"eqrel_session={user_no_family['token']}"}
        
        # Test 5: GET /family/prayer-location without family → returns null
        try:
            print("\n[TEST 5] GET /family/prayer-location without family → returns null")
            r = requests.get(f"{API_URL}/family/prayer-location", headers=headers_no_family)
            assert r.status_code == 200, f"Expected 200, got {r.status_code}"
            data = r.json()
            assert data.get('location') is None, f"Expected location=null, got {data.get('location')}"
            print("✅ PASS: Returns location=null for user without family")
            passed += 1
        except AssertionError as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        
        # Test 6: POST /family/prayer-location without family → 400
        try:
            print("\n[TEST 6] POST /family/prayer-location without family → 400")
            r = requests.post(f"{API_URL}/family/prayer-location", 
                            headers=headers_no_family,
                            json={'city': 'Kuala Lumpur', 'country': 'Malaysia'})
            assert r.status_code == 400, f"Expected 400, got {r.status_code}"
            print("✅ PASS: Returns 400 for user without family")
            passed += 1
        except AssertionError as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        
        # Test 7: GET /family/display-data without family → 400
        try:
            print("\n[TEST 7] GET /family/display-data without family → 400")
            r = requests.get(f"{API_URL}/family/display-data", headers=headers_no_family)
            assert r.status_code == 400, f"Expected 400, got {r.status_code}"
            print("✅ PASS: Returns 400 for user without family")
            passed += 1
        except AssertionError as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        
        # ═══════════════════════════════════════════════════════════════
        # SECTION 3: Prayer Location - Validation
        # ═══════════════════════════════════════════════════════════════
        print("\n" + "=" * 80)
        print("SECTION 3: Prayer Location - Validation")
        print("=" * 80)
        
        # Create family A with user
        family_a_id = create_test_family('TESTA1')
        user_a = create_test_user_with_session('usera@test.com', 'User A', family_a_id, 'ibu')
        headers_a = {'Cookie': f"eqrel_session={user_a['token']}"}
        
        # Test 8: POST /family/prayer-location with missing city → 400
        try:
            print("\n[TEST 8] POST /family/prayer-location with missing city → 400")
            r = requests.post(f"{API_URL}/family/prayer-location", 
                            headers=headers_a,
                            json={'country': 'Malaysia'})
            assert r.status_code == 400, f"Expected 400, got {r.status_code}"
            data = r.json()
            assert 'error' in data, "Expected error message in response"
            print(f"✅ PASS: Returns 400 with error: {data.get('error')}")
            passed += 1
        except AssertionError as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        
        # Test 9: POST /family/prayer-location with missing country → 400
        try:
            print("\n[TEST 9] POST /family/prayer-location with missing country → 400")
            r = requests.post(f"{API_URL}/family/prayer-location", 
                            headers=headers_a,
                            json={'city': 'Kuala Lumpur'})
            assert r.status_code == 400, f"Expected 400, got {r.status_code}"
            data = r.json()
            assert 'error' in data, "Expected error message in response"
            print(f"✅ PASS: Returns 400 with error: {data.get('error')}")
            passed += 1
        except AssertionError as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        
        # Test 10: POST /family/prayer-location with empty city → 400
        try:
            print("\n[TEST 10] POST /family/prayer-location with empty city → 400")
            r = requests.post(f"{API_URL}/family/prayer-location", 
                            headers=headers_a,
                            json={'city': '', 'country': 'Malaysia'})
            assert r.status_code == 400, f"Expected 400, got {r.status_code}"
            print("✅ PASS: Returns 400 for empty city")
            passed += 1
        except AssertionError as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        
        # ═══════════════════════════════════════════════════════════════
        # SECTION 4: Prayer Location - Save & Retrieve
        # ═══════════════════════════════════════════════════════════════
        print("\n" + "=" * 80)
        print("SECTION 4: Prayer Location - Save & Retrieve")
        print("=" * 80)
        
        # Test 11: POST /family/prayer-location with valid data → 200
        try:
            print("\n[TEST 11] POST /family/prayer-location with valid data → 200")
            r = requests.post(f"{API_URL}/family/prayer-location", 
                            headers=headers_a,
                            json={
                                'city': 'Kuala Lumpur',
                                'country': 'Malaysia',
                                'method': 3,
                                'latitude': 3.139,
                                'longitude': 101.6869
                            })
            assert r.status_code == 200, f"Expected 200, got {r.status_code}"
            data = r.json()
            assert data.get('ok') is True, "Expected ok=true"
            assert 'location' in data, "Expected location in response"
            loc = data['location']
            assert loc['city'] == 'Kuala Lumpur', f"Expected city='Kuala Lumpur', got {loc.get('city')}"
            assert loc['country'] == 'Malaysia', f"Expected country='Malaysia', got {loc.get('country')}"
            assert loc['method'] == 3, f"Expected method=3, got {loc.get('method')}"
            assert loc['latitude'] == 3.139, f"Expected latitude=3.139, got {loc.get('latitude')}"
            assert loc['longitude'] == 101.6869, f"Expected longitude=101.6869, got {loc.get('longitude')}"
            print("✅ PASS: Location saved successfully with all fields")
            passed += 1
        except AssertionError as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        
        # Test 12: GET /family/prayer-location → returns saved location
        try:
            print("\n[TEST 12] GET /family/prayer-location → returns saved location")
            r = requests.get(f"{API_URL}/family/prayer-location", headers=headers_a)
            assert r.status_code == 200, f"Expected 200, got {r.status_code}"
            data = r.json()
            assert 'location' in data, "Expected location in response"
            loc = data['location']
            assert loc is not None, "Expected location to be set"
            assert loc['city'] == 'Kuala Lumpur', f"Expected city='Kuala Lumpur', got {loc.get('city')}"
            assert loc['country'] == 'Malaysia', f"Expected country='Malaysia', got {loc.get('country')}"
            assert loc['method'] == 3, f"Expected method=3, got {loc.get('method')}"
            print("✅ PASS: Retrieved saved location successfully")
            passed += 1
        except AssertionError as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        
        # Test 13: Update location (without lat/lon) → 200
        try:
            print("\n[TEST 13] Update location without lat/lon → 200")
            r = requests.post(f"{API_URL}/family/prayer-location", 
                            headers=headers_a,
                            json={
                                'city': 'Jakarta',
                                'country': 'Indonesia',
                                'method': 2
                            })
            assert r.status_code == 200, f"Expected 200, got {r.status_code}"
            data = r.json()
            loc = data['location']
            assert loc['city'] == 'Jakarta', f"Expected city='Jakarta', got {loc.get('city')}"
            assert loc['country'] == 'Indonesia', f"Expected country='Indonesia', got {loc.get('country')}"
            assert loc['method'] == 2, f"Expected method=2, got {loc.get('method')}"
            assert loc['latitude'] is None, f"Expected latitude=null, got {loc.get('latitude')}"
            assert loc['longitude'] is None, f"Expected longitude=null, got {loc.get('longitude')}"
            print("✅ PASS: Location updated successfully without coordinates")
            passed += 1
        except AssertionError as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        
        # ═══════════════════════════════════════════════════════════════
        # SECTION 5: Prayer Times - Without Location
        # ═══════════════════════════════════════════════════════════════
        print("\n" + "=" * 80)
        print("SECTION 5: Prayer Times - Without Location")
        print("=" * 80)
        
        # Create family B without location
        family_b_id = create_test_family('TESTB1')
        user_b = create_test_user_with_session('userb@test.com', 'User B', family_b_id, 'bapa')
        headers_b = {'Cookie': f"eqrel_session={user_b['token']}"}
        
        # Test 14: GET /family/prayer-times without location set → 404
        try:
            print("\n[TEST 14] GET /family/prayer-times without location set → 404")
            r = requests.get(f"{API_URL}/family/prayer-times", headers=headers_b)
            assert r.status_code == 404, f"Expected 404, got {r.status_code}"
            data = r.json()
            assert 'error' in data, "Expected error message"
            assert 'not set' in data['error'].lower(), f"Expected 'not set' in error, got: {data['error']}"
            print(f"✅ PASS: Returns 404 with error: {data.get('error')}")
            passed += 1
        except AssertionError as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        
        # ═══════════════════════════════════════════════════════════════
        # SECTION 6: Prayer Times - Fetch from Aladhan API
        # ═══════════════════════════════════════════════════════════════
        print("\n" + "=" * 80)
        print("SECTION 6: Prayer Times - Fetch from Aladhan API")
        print("=" * 80)
        
        # Test 15: GET /family/prayer-times with location set → 200 with timings
        try:
            print("\n[TEST 15] GET /family/prayer-times with location set → 200 with timings")
            print("   Note: This test calls the real Aladhan API. May fail if no internet.")
            r = requests.get(f"{API_URL}/family/prayer-times", headers=headers_a)
            
            if r.status_code == 502:
                print("⚠️  SKIP: Aladhan API not reachable (502). This is expected in test env without internet.")
                # Don't count as pass or fail
            else:
                assert r.status_code == 200, f"Expected 200, got {r.status_code}"
                data = r.json()
                assert 'date' in data, "Expected date field"
                assert 'timings' in data, "Expected timings field"
                assert 'location' in data, "Expected location field"
                
                timings = data['timings']
                required_prayers = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']
                for prayer in required_prayers:
                    assert prayer in timings, f"Expected {prayer} in timings"
                    assert isinstance(timings[prayer], str), f"Expected {prayer} to be string (HH:MM)"
                    assert ':' in timings[prayer], f"Expected {prayer} to be in HH:MM format"
                
                print(f"✅ PASS: Prayer times fetched successfully")
                print(f"   Date: {data['date']}")
                print(f"   Timings: Fajr={timings['Fajr']}, Dhuhr={timings['Dhuhr']}, Asr={timings['Asr']}, Maghrib={timings['Maghrib']}, Isha={timings['Isha']}")
                passed += 1
        except AssertionError as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        
        # ═══════════════════════════════════════════════════════════════
        # SECTION 7: Prayer Times - Caching
        # ═══════════════════════════════════════════════════════════════
        print("\n" + "=" * 80)
        print("SECTION 7: Prayer Times - Caching")
        print("=" * 80)
        
        # Test 16: Second GET on same day should be cached
        try:
            print("\n[TEST 16] Second GET /family/prayer-times should be cached")
            
            # First call (may hit API or cache from previous test)
            start1 = time.time()
            r1 = requests.get(f"{API_URL}/family/prayer-times", headers=headers_a)
            time1 = time.time() - start1
            
            if r1.status_code == 502:
                print("⚠️  SKIP: Aladhan API not reachable. Cannot test caching.")
            else:
                assert r1.status_code == 200, f"Expected 200, got {r1.status_code}"
                data1 = r1.json()
                
                # Second call (should definitely be cached)
                start2 = time.time()
                r2 = requests.get(f"{API_URL}/family/prayer-times", headers=headers_a)
                time2 = time.time() - start2
                
                assert r2.status_code == 200, f"Expected 200, got {r2.status_code}"
                data2 = r2.json()
                
                # Verify same data
                assert data1['date'] == data2['date'], "Expected same date"
                assert data1['timings'] == data2['timings'], "Expected same timings"
                
                # Verify cache entry exists in DB
                now = datetime.utcnow()
                date_str = f"{now.year}-{str(now.month).zfill(2)}-{str(now.day).zfill(2)}"
                cache_entry = db.prayer_times_cache.find_one({
                    'familyId': family_a_id,
                    'dateStr': date_str
                })
                assert cache_entry is not None, "Expected cache entry in DB"
                assert 'timings' in cache_entry, "Expected timings in cache entry"
                assert 'fetchedAt' in cache_entry, "Expected fetchedAt in cache entry"
                
                print(f"✅ PASS: Prayer times cached successfully")
                print(f"   First call: {time1:.3f}s, Second call: {time2:.3f}s")
                print(f"   Cache entry found in DB for date: {date_str}")
                passed += 1
        except AssertionError as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        
        # ═══════════════════════════════════════════════════════════════
        # SECTION 8: Display Data - Bundle
        # ═══════════════════════════════════════════════════════════════
        print("\n" + "=" * 80)
        print("SECTION 8: Display Data - Bundle")
        print("=" * 80)
        
        # Create children and habits for family A
        child_a1_id = create_test_child(family_a_id, 'Ahmad')
        child_a2_id = create_test_child(family_a_id, 'Fatimah')
        
        # Create habits for child A1
        habit_a1_1 = create_test_habit(family_a_id, child_a1_id, 'Solat Subuh')
        habit_a1_2 = create_test_habit(family_a_id, child_a1_id, 'Solat Zohor')
        habit_a1_3 = create_test_habit(family_a_id, child_a1_id, 'Baca Quran')
        
        # Create habits for child A2
        habit_a2_1 = create_test_habit(family_a_id, child_a2_id, 'Solat Subuh')
        habit_a2_2 = create_test_habit(family_a_id, child_a2_id, 'Solat Zohor')
        
        # Create claims for today (2 done for child A1, 1 done for child A2)
        now = datetime.utcnow()
        today_str = f"{now.year}-{str(now.month).zfill(2)}-{str(now.day).zfill(2)}"
        create_test_claim(family_a_id, child_a1_id, habit_a1_1, 'verified', today_str)
        create_test_claim(family_a_id, child_a1_id, habit_a1_2, 'claimed', today_str)
        create_test_claim(family_a_id, child_a2_id, habit_a2_1, 'verified', today_str)
        
        # Test 17: GET /family/display-data → returns family + children with habits stats
        try:
            print("\n[TEST 17] GET /family/display-data → returns family + children with habits stats")
            r = requests.get(f"{API_URL}/family/display-data", headers=headers_a)
            assert r.status_code == 200, f"Expected 200, got {r.status_code}"
            data = r.json()
            
            assert 'family' in data, "Expected family field"
            assert 'children' in data, "Expected children field"
            
            family = data['family']
            assert family['id'] == family_a_id, f"Expected family id={family_a_id}"
            
            children = data['children']
            assert len(children) == 2, f"Expected 2 children, got {len(children)}"
            
            # Find child A1
            child_a1 = next((c for c in children if c['nickname'] == 'Ahmad'), None)
            assert child_a1 is not None, "Expected to find child Ahmad"
            assert 'habitsTotal' in child_a1, "Expected habitsTotal field"
            assert 'habitsDone' in child_a1, "Expected habitsDone field"
            assert child_a1['habitsTotal'] == 3, f"Expected habitsTotal=3, got {child_a1['habitsTotal']}"
            assert child_a1['habitsDone'] == 2, f"Expected habitsDone=2 (verified + claimed), got {child_a1['habitsDone']}"
            
            # Find child A2
            child_a2 = next((c for c in children if c['nickname'] == 'Fatimah'), None)
            assert child_a2 is not None, "Expected to find child Fatimah"
            assert child_a2['habitsTotal'] == 2, f"Expected habitsTotal=2, got {child_a2['habitsTotal']}"
            assert child_a2['habitsDone'] == 1, f"Expected habitsDone=1, got {child_a2['habitsDone']}"
            
            print("✅ PASS: Display data bundle returned correctly")
            print(f"   Family: {family['id']}")
            print(f"   Child 1: {child_a1['nickname']} - {child_a1['habitsDone']}/{child_a1['habitsTotal']} habits done")
            print(f"   Child 2: {child_a2['nickname']} - {child_a2['habitsDone']}/{child_a2['habitsTotal']} habits done")
            passed += 1
        except AssertionError as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        
        # Test 18: Display data includes mataBina and mataReward
        try:
            print("\n[TEST 18] Display data includes mataBina and mataReward")
            r = requests.get(f"{API_URL}/family/display-data", headers=headers_a)
            assert r.status_code == 200, f"Expected 200, got {r.status_code}"
            data = r.json()
            children = data['children']
            
            for child in children:
                assert 'mataBina' in child, f"Expected mataBina field for child {child['nickname']}"
                assert 'mataReward' in child, f"Expected mataReward field for child {child['nickname']}"
                assert isinstance(child['mataBina'], (int, float)), f"Expected mataBina to be number"
                assert isinstance(child['mataReward'], (int, float)), f"Expected mataReward to be number"
            
            print("✅ PASS: Display data includes mataBina and mataReward for all children")
            passed += 1
        except AssertionError as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        
        # ═══════════════════════════════════════════════════════════════
        # SECTION 9: Cross-Family Isolation
        # ═══════════════════════════════════════════════════════════════
        print("\n" + "=" * 80)
        print("SECTION 9: Cross-Family Isolation")
        print("=" * 80)
        
        # Test 19: User B should not see family A's prayer location
        try:
            print("\n[TEST 19] User B should not see family A's prayer location")
            r = requests.get(f"{API_URL}/family/prayer-location", headers=headers_b)
            assert r.status_code == 200, f"Expected 200, got {r.status_code}"
            data = r.json()
            assert data.get('location') is None, f"Expected location=null for family B, got {data.get('location')}"
            print("✅ PASS: Family B does not see family A's location")
            passed += 1
        except AssertionError as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        
        # Test 20: Set location for family B
        try:
            print("\n[TEST 20] Set location for family B")
            r = requests.post(f"{API_URL}/family/prayer-location", 
                            headers=headers_b,
                            json={'city': 'Cairo', 'country': 'Egypt', 'method': 5})
            assert r.status_code == 200, f"Expected 200, got {r.status_code}"
            data = r.json()
            loc = data['location']
            assert loc['city'] == 'Cairo', f"Expected city='Cairo', got {loc.get('city')}"
            print("✅ PASS: Family B location set successfully")
            passed += 1
        except AssertionError as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        
        # Test 21: Family A should still have Jakarta location (not Cairo)
        try:
            print("\n[TEST 21] Family A should still have Jakarta location (not Cairo)")
            r = requests.get(f"{API_URL}/family/prayer-location", headers=headers_a)
            assert r.status_code == 200, f"Expected 200, got {r.status_code}"
            data = r.json()
            loc = data['location']
            assert loc['city'] == 'Jakarta', f"Expected city='Jakarta', got {loc.get('city')}"
            assert loc['country'] == 'Indonesia', f"Expected country='Indonesia', got {loc.get('country')}"
            print("✅ PASS: Family A location unchanged (Jakarta)")
            passed += 1
        except AssertionError as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        
        # Test 22: Family B should have Cairo location
        try:
            print("\n[TEST 22] Family B should have Cairo location")
            r = requests.get(f"{API_URL}/family/prayer-location", headers=headers_b)
            assert r.status_code == 200, f"Expected 200, got {r.status_code}"
            data = r.json()
            loc = data['location']
            assert loc['city'] == 'Cairo', f"Expected city='Cairo', got {loc.get('city')}"
            assert loc['country'] == 'Egypt', f"Expected country='Egypt', got {loc.get('country')}"
            print("✅ PASS: Family B location correct (Cairo)")
            passed += 1
        except AssertionError as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        
        # Test 23: Family B display-data should not include family A's children
        try:
            print("\n[TEST 23] Family B display-data should not include family A's children")
            r = requests.get(f"{API_URL}/family/display-data", headers=headers_b)
            assert r.status_code == 200, f"Expected 200, got {r.status_code}"
            data = r.json()
            children = data['children']
            assert len(children) == 0, f"Expected 0 children for family B, got {len(children)}"
            print("✅ PASS: Family B sees no children (correct isolation)")
            passed += 1
        except AssertionError as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ FAIL: {e}")
            failed += 1
        
        # ═══════════════════════════════════════════════════════════════
        # FINAL SUMMARY
        # ═══════════════════════════════════════════════════════════════
        print("\n" + "=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        print(f"✅ PASSED: {passed}")
        print(f"❌ FAILED: {failed}")
        print(f"📊 TOTAL:  {passed + failed}")
        
        if failed == 0:
            print("\n🎉 ALL TESTS PASSED!")
        else:
            print(f"\n⚠️  {failed} test(s) failed")
        
        return passed, failed
        
    finally:
        cleanup_test_data()

if __name__ == '__main__':
    try:
        passed, failed = run_tests()
        exit(0 if failed == 0 else 1)
    except Exception as e:
        print(f"\n💥 FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        cleanup_test_data()
        exit(1)
