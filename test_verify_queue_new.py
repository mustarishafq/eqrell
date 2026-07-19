#!/usr/bin/env python3
"""
Test Suite for NEW Verify Queue Endpoints
Tests GET /api/verify-queue/items and POST /api/verify-queue/items/:claimId/verify
"""

import requests
import json
import os
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
test_data = {
    'users': [],
    'sessions': [],
    'families': [],
    'children': [],
    'habits': [],
    'claims': []
}

# Test results
results = {
    'total': 0,
    'passed': 0,
    'failed': 0,
    'tests': []
}

def record_result(test_name, passed, details=""):
    """Record test result"""
    results['total'] += 1
    if passed:
        results['passed'] += 1
        print(f"   ✅ {test_name}")
    else:
        results['failed'] += 1
        print(f"   ❌ {test_name}")
    if details:
        print(f"      {details}")
    results['tests'].append({'name': test_name, 'passed': passed, 'details': details})

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
    test_data['users'].append(user_id)
    
    # Insert session
    session = {
        'sid': sid,
        'userId': user_id,
        'email': email,
        'expiresAt': datetime.utcnow() + timedelta(days=30),
        'createdAt': datetime.utcnow()
    }
    db.sessions.insert_one(session)
    test_data['sessions'].append(sid)
    
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

def create_test_family(code=None):
    """Create a test family"""
    family_id = str(uuid.uuid4())
    if not code:
        code = ''.join([chr(65 + (i % 26)) for i in range(6)])  # Simple 6-char code
    
    family = {
        'id': family_id,
        'code': code,
        'createdAt': datetime.utcnow()
    }
    db.families.insert_one(family)
    test_data['families'].append(family_id)
    
    return family_id, code

def create_test_child(family_id, nickname, gender='male'):
    """Create a test child"""
    child_id = str(uuid.uuid4())
    
    child = {
        'id': child_id,
        'familyId': family_id,
        'nickname': nickname,
        'dob': '2018-01-01',
        'gender': gender,
        'ageBand': '5-6',
        'avatarId': 'B01',
        'favColor': 'blue',
        'preferredLang': 'ms',
        'todayCompleted': 0,
        'todayTotal': 0,
        'lightLevel': 1,
        'blackClouds': 0,
        'buildingCount': 0,
        'createdAt': datetime.utcnow(),
        'updatedAt': datetime.utcnow()
    }
    db.children.insert_one(child)
    test_data['children'].append(child_id)
    
    return child_id

def create_test_habit(family_id, child_id, title, points=20):
    """Create a test habit"""
    habit_id = str(uuid.uuid4())
    
    habit = {
        'id': habit_id,
        'familyId': family_id,
        'childId': child_id,
        'title': title,
        'desc': f'Test habit: {title}',
        'category': 'ibadah',
        'points': points,
        'frequency': 'daily',
        'active': True,
        'createdAt': datetime.utcnow(),
        'updatedAt': datetime.utcnow()
    }
    db.habits.insert_one(habit)
    test_data['habits'].append(habit_id)
    
    return habit_id

def create_test_claim(family_id, habit_id, child_id, user_id, status='claimed', date_str=None):
    """Create a test habit claim"""
    if not date_str:
        date_str = datetime.utcnow().strftime('%Y-%m-%d')
    
    claim = {
        'habitId': habit_id,
        'dateStr': date_str,
        'familyId': family_id,
        'childId': child_id,
        'status': status,
        'claimedAt': datetime.utcnow(),
        'claimedBy': user_id
    }
    db.habit_claims.insert_one(claim)
    test_data['claims'].append(f"{habit_id}__{date_str}")
    
    return f"{habit_id}__{date_str}"

def cleanup_test_data():
    """Clean up all test data from MongoDB"""
    print("\n🧹 Cleaning up test data...")
    
    # Delete test users
    if test_data['users']:
        result = db.users.delete_many({'id': {'$in': test_data['users']}})
        print(f"   Deleted {result.deleted_count} test users")
    
    # Delete test sessions
    if test_data['sessions']:
        result = db.sessions.delete_many({'sid': {'$in': test_data['sessions']}})
        print(f"   Deleted {result.deleted_count} test sessions")
    
    # Delete test families
    if test_data['families']:
        result = db.families.delete_many({'id': {'$in': test_data['families']}})
        print(f"   Deleted {result.deleted_count} test families")
    
    # Delete test children
    if test_data['children']:
        result = db.children.delete_many({'id': {'$in': test_data['children']}})
        print(f"   Deleted {result.deleted_count} test children")
    
    # Delete test habits
    if test_data['habits']:
        result = db.habits.delete_many({'id': {'$in': test_data['habits']}})
        print(f"   Deleted {result.deleted_count} test habits")
    
    # Delete test claims
    if test_data['families']:
        result = db.habit_claims.delete_many({'familyId': {'$in': test_data['families']}})
        print(f"   Deleted {result.deleted_count} test habit claims")
    
    # Delete verify logs for test families
    if test_data['families']:
        result = db.verify_log.delete_many({'familyId': {'$in': test_data['families']}})
        print(f"   Deleted {result.deleted_count} verify log entries")
    
    print("✅ Cleanup complete\n")

def run_verify_queue_tests():
    """Run all verify queue tests"""
    print("\n" + "=" * 80)
    print("🧪 VERIFY QUEUE NEW ENDPOINTS TEST SUITE")
    print("=" * 80)
    
    try:
        # ===== SECTION 1: GET /api/verify-queue/items - Unauthenticated =====
        print("\n" + "=" * 80)
        print("SECTION 1: GET /api/verify-queue/items - Unauthenticated")
        print("=" * 80)
        
        print("\n🧪 Test 1.1: GET /api/verify-queue/items without auth")
        try:
            response = requests.get(f"{API_URL}/verify-queue/items", timeout=10)
            print(f"   Status: {response.status_code}")
            if response.status_code == 401:
                record_result("GET /verify-queue/items returns 401 without auth", True)
            else:
                record_result("GET /verify-queue/items returns 401 without auth", False, f"Got {response.status_code}")
        except Exception as e:
            record_result("GET /verify-queue/items returns 401 without auth", False, str(e))
        
        # ===== SECTION 2: GET /api/verify-queue/items - User without family =====
        print("\n" + "=" * 80)
        print("SECTION 2: GET /api/verify-queue/items - User without family")
        print("=" * 80)
        
        print("\n🧪 Test 2.1: GET /api/verify-queue/items with user without familyId")
        user_no_family = create_test_user_with_session('nofamily@test.local', 'No Family User')
        try:
            cookies = {'eqrel_session': user_no_family['token']}
            response = requests.get(f"{API_URL}/verify-queue/items", cookies=cookies, timeout=10)
            print(f"   Status: {response.status_code}")
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            if response.status_code == 200 and data.get('items') == []:
                record_result("Returns empty items array for user without family", True)
            else:
                record_result("Returns empty items array for user without family", False, f"Got {data}")
        except Exception as e:
            record_result("Returns empty items array for user without family", False, str(e))
        
        # ===== SECTION 3: Setup test data =====
        print("\n" + "=" * 80)
        print("SECTION 3: Setup test data")
        print("=" * 80)
        
        # Create family and users
        family_id, family_code = create_test_family()
        print(f"   Created family: {family_id} (code: {family_code})")
        
        user_a = create_test_user_with_session('usera@test.local', 'User A', family_id, 'ibu')
        print(f"   Created User A: {user_a['email']}")
        
        user_b = create_test_user_with_session('userb@test.local', 'User B', family_id, 'bapa')
        print(f"   Created User B: {user_b['email']}")
        
        # Create children
        child1_id = create_test_child(family_id, 'Ahmad')
        child2_id = create_test_child(family_id, 'Fatimah', 'female')
        print(f"   Created children: Ahmad, Fatimah")
        
        # Create habits
        habit1_id = create_test_habit(family_id, child1_id, 'Solat Subuh', 20)
        habit2_id = create_test_habit(family_id, child1_id, 'Baca Quran', 30)
        habit3_id = create_test_habit(family_id, child2_id, 'Solat Maghrib', 25)
        print(f"   Created 3 habits")
        
        # Create claims for today
        today_str = datetime.utcnow().strftime('%Y-%m-%d')
        yesterday_str = (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d')
        
        claim1_id = create_test_claim(family_id, habit1_id, child1_id, user_a['user_id'], 'claimed', today_str)
        claim2_id = create_test_claim(family_id, habit2_id, child1_id, user_a['user_id'], 'claimed', today_str)
        claim3_id = create_test_claim(family_id, habit3_id, child2_id, user_b['user_id'], 'claimed', today_str)
        
        # Create a claim from yesterday (should not appear)
        claim_yesterday = create_test_claim(family_id, habit1_id, child1_id, user_a['user_id'], 'claimed', yesterday_str)
        
        # Create a verified claim for today (should not appear)
        habit4_id = create_test_habit(family_id, child1_id, 'Already Verified', 15)
        claim_verified = create_test_claim(family_id, habit4_id, child1_id, user_a['user_id'], 'verified', today_str)
        
        print(f"   Created 5 claims (3 pending today, 1 yesterday, 1 verified)")
        
        # ===== SECTION 4: GET /api/verify-queue/items - With data =====
        print("\n" + "=" * 80)
        print("SECTION 4: GET /api/verify-queue/items - With data")
        print("=" * 80)
        
        print("\n🧪 Test 4.1: GET /api/verify-queue/items returns enriched items")
        try:
            cookies = {'eqrel_session': user_a['token']}
            response = requests.get(f"{API_URL}/verify-queue/items", cookies=cookies, timeout=10)
            print(f"   Status: {response.status_code}")
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)[:500]}...")
            
            if response.status_code == 200:
                items = data.get('items', [])
                print(f"   Found {len(items)} items")
                
                # Should have exactly 3 items (today's claimed items only)
                if len(items) == 3:
                    record_result("Returns correct number of items (3)", True)
                else:
                    record_result("Returns correct number of items (3)", False, f"Got {len(items)} items")
                
                # Check item structure
                if len(items) > 0:
                    item = items[0]
                    required_fields = ['claimId', 'habitId', 'childId', 'dateStr', 'status', 'claimedAt', 'claimedBy', 'habit', 'child']
                    has_all_fields = all(field in item for field in required_fields)
                    if has_all_fields:
                        record_result("Items have all required fields", True)
                    else:
                        missing = [f for f in required_fields if f not in item]
                        record_result("Items have all required fields", False, f"Missing: {missing}")
                    
                    # Check claimId format
                    if '__' in item['claimId']:
                        parts = item['claimId'].split('__')
                        if len(parts) == 2 and parts[0] == item['habitId'] and parts[1] == item['dateStr']:
                            record_result("claimId format is correct (habitId__dateStr)", True)
                        else:
                            record_result("claimId format is correct (habitId__dateStr)", False, f"Format mismatch")
                    else:
                        record_result("claimId format is correct (habitId__dateStr)", False, "No __ separator")
                    
                    # Check habit and child are joined
                    if item['habit'] and item['child']:
                        record_result("Items have habit and child joined", True)
                    else:
                        record_result("Items have habit and child joined", False)
                    
                    # Check all items have status='claimed'
                    all_claimed = all(i['status'] == 'claimed' for i in items)
                    if all_claimed:
                        record_result("All items have status='claimed'", True)
                    else:
                        record_result("All items have status='claimed'", False)
                    
                    # Check all items have today's dateStr
                    all_today = all(i['dateStr'] == today_str for i in items)
                    if all_today:
                        record_result("All items have today's dateStr", True)
                    else:
                        record_result("All items have today's dateStr", False)
                else:
                    record_result("Items have all required fields", False, "No items returned")
            else:
                record_result("GET /verify-queue/items returns 200", False, f"Got {response.status_code}")
        except Exception as e:
            record_result("GET /verify-queue/items returns enriched items", False, str(e))
        
        # ===== SECTION 5: POST /api/verify-queue/items/:claimId/verify - Error cases =====
        print("\n" + "=" * 80)
        print("SECTION 5: POST verify - Error cases")
        print("=" * 80)
        
        print("\n🧪 Test 5.1: POST verify without auth")
        try:
            response = requests.post(f"{API_URL}/verify-queue/items/{claim1_id}/verify", 
                                    json={'rubric': 'sah'}, timeout=10)
            print(f"   Status: {response.status_code}")
            if response.status_code == 401:
                record_result("POST verify returns 401 without auth", True)
            else:
                record_result("POST verify returns 401 without auth", False, f"Got {response.status_code}")
        except Exception as e:
            record_result("POST verify returns 401 without auth", False, str(e))
        
        print("\n🧪 Test 5.2: POST verify with invalid rubric")
        try:
            cookies = {'eqrel_session': user_a['token']}
            response = requests.post(f"{API_URL}/verify-queue/items/{claim1_id}/verify", 
                                    json={'rubric': 'invalid'}, cookies=cookies, timeout=10)
            print(f"   Status: {response.status_code}")
            if response.status_code == 400:
                record_result("POST verify returns 400 for invalid rubric", True)
            else:
                record_result("POST verify returns 400 for invalid rubric", False, f"Got {response.status_code}")
        except Exception as e:
            record_result("POST verify returns 400 for invalid rubric", False, str(e))
        
        print("\n🧪 Test 5.3: POST verify with missing rubric")
        try:
            cookies = {'eqrel_session': user_a['token']}
            response = requests.post(f"{API_URL}/verify-queue/items/{claim1_id}/verify", 
                                    json={}, cookies=cookies, timeout=10)
            print(f"   Status: {response.status_code}")
            if response.status_code == 400:
                record_result("POST verify returns 400 for missing rubric", True)
            else:
                record_result("POST verify returns 400 for missing rubric", False, f"Got {response.status_code}")
        except Exception as e:
            record_result("POST verify returns 400 for missing rubric", False, str(e))
        
        print("\n🧪 Test 5.4: POST verify with malformed claimId (no separator)")
        try:
            cookies = {'eqrel_session': user_a['token']}
            response = requests.post(f"{API_URL}/verify-queue/items/malformed-claim-id/verify", 
                                    json={'rubric': 'sah'}, cookies=cookies, timeout=10)
            print(f"   Status: {response.status_code}")
            if response.status_code == 400:
                record_result("POST verify returns 400 for malformed claimId", True)
            else:
                record_result("POST verify returns 400 for malformed claimId", False, f"Got {response.status_code}")
        except Exception as e:
            record_result("POST verify returns 400 for malformed claimId", False, str(e))
        
        print("\n🧪 Test 5.5: POST verify with non-existent claim")
        try:
            cookies = {'eqrel_session': user_a['token']}
            fake_claim_id = f"{str(uuid.uuid4())}__{today_str}"
            response = requests.post(f"{API_URL}/verify-queue/items/{fake_claim_id}/verify", 
                                    json={'rubric': 'sah'}, cookies=cookies, timeout=10)
            print(f"   Status: {response.status_code}")
            if response.status_code == 404:
                record_result("POST verify returns 404 for non-existent claim", True)
            else:
                record_result("POST verify returns 404 for non-existent claim", False, f"Got {response.status_code}")
        except Exception as e:
            record_result("POST verify returns 404 for non-existent claim", False, str(e))
        
        # ===== SECTION 6: POST verify - 'sah' rubric =====
        print("\n" + "=" * 80)
        print("SECTION 6: POST verify - 'sah' rubric")
        print("=" * 80)
        
        print("\n🧪 Test 6.1: POST verify with 'sah' rubric")
        try:
            cookies = {'eqrel_session': user_a['token']}
            response = requests.post(f"{API_URL}/verify-queue/items/{claim1_id}/verify", 
                                    json={'rubric': 'sah', 'note': 'Good job!'}, 
                                    cookies=cookies, timeout=10)
            print(f"   Status: {response.status_code}")
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            
            if response.status_code == 200:
                if data.get('ok') and data.get('rubric') == 'sah':
                    record_result("POST verify 'sah' returns ok:true", True)
                else:
                    record_result("POST verify 'sah' returns ok:true", False, f"Got {data}")
                
                # Check points (should be base points = 20)
                if data.get('points') == 20:
                    record_result("'sah' rubric awards base points (20)", True)
                else:
                    record_result("'sah' rubric awards base points (20)", False, f"Got {data.get('points')}")
                
                # Check excellence is false or not present
                if not data.get('excellence', False):
                    record_result("'sah' rubric has excellence=false", True)
                else:
                    record_result("'sah' rubric has excellence=false", False)
                
                # Verify claim was updated in DB
                claim = db.habit_claims.find_one({'habitId': habit1_id, 'dateStr': today_str})
                if claim:
                    if claim['status'] == 'verified':
                        record_result("Claim status updated to 'verified'", True)
                    else:
                        record_result("Claim status updated to 'verified'", False, f"Got {claim['status']}")
                    
                    if claim.get('pointsAwarded') == 20:
                        record_result("Claim pointsAwarded set correctly", True)
                    else:
                        record_result("Claim pointsAwarded set correctly", False, f"Got {claim.get('pointsAwarded')}")
                    
                    if claim.get('note') == 'Good job!':
                        record_result("Claim note stored correctly", True)
                    else:
                        record_result("Claim note stored correctly", False, f"Got {claim.get('note')}")
                    
                    if claim.get('verifiedBy') == user_a['user_id']:
                        record_result("Claim verifiedBy set correctly", True)
                    else:
                        record_result("Claim verifiedBy set correctly", False)
                    
                    if 'verifiedAt' in claim:
                        record_result("Claim verifiedAt timestamp set", True)
                    else:
                        record_result("Claim verifiedAt timestamp set", False)
                else:
                    record_result("Claim exists in DB after verify", False, "Claim not found")
                
                # Verify log entry created
                log_entry = db.verify_log.find_one({'habitId': habit1_id, 'dateStr': today_str})
                if log_entry:
                    record_result("verify_log entry created", True)
                    if log_entry.get('rubric') == 'sah' and log_entry.get('points') == 20:
                        record_result("verify_log has correct rubric and points", True)
                    else:
                        record_result("verify_log has correct rubric and points", False)
                else:
                    record_result("verify_log entry created", False)
            else:
                record_result("POST verify 'sah' returns 200", False, f"Got {response.status_code}")
        except Exception as e:
            record_result("POST verify 'sah' rubric", False, str(e))
        
        print("\n🧪 Test 6.2: POST verify on already processed claim (409)")
        try:
            cookies = {'eqrel_session': user_a['token']}
            response = requests.post(f"{API_URL}/verify-queue/items/{claim1_id}/verify", 
                                    json={'rubric': 'sah'}, cookies=cookies, timeout=10)
            print(f"   Status: {response.status_code}")
            if response.status_code == 409:
                record_result("POST verify returns 409 for already processed claim", True)
            else:
                record_result("POST verify returns 409 for already processed claim", False, f"Got {response.status_code}")
        except Exception as e:
            record_result("POST verify returns 409 for already processed claim", False, str(e))
        
        # ===== SECTION 7: POST verify - 'ihsan' rubric =====
        print("\n" + "=" * 80)
        print("SECTION 7: POST verify - 'ihsan' rubric")
        print("=" * 80)
        
        print("\n🧪 Test 7.1: POST verify with 'ihsan' rubric")
        try:
            cookies = {'eqrel_session': user_a['token']}
            response = requests.post(f"{API_URL}/verify-queue/items/{claim2_id}/verify", 
                                    json={'rubric': 'ihsan', 'note': 'Excellent work! MashaAllah!'}, 
                                    cookies=cookies, timeout=10)
            print(f"   Status: {response.status_code}")
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            
            if response.status_code == 200:
                if data.get('ok') and data.get('rubric') == 'ihsan':
                    record_result("POST verify 'ihsan' returns ok:true", True)
                else:
                    record_result("POST verify 'ihsan' returns ok:true", False, f"Got {data}")
                
                # Check points (should be base points * 1.5 = 30 * 1.5 = 45)
                expected_points = round(30 * 1.5)  # 45
                if data.get('points') == expected_points:
                    record_result(f"'ihsan' rubric awards 1.5x points ({expected_points})", True)
                else:
                    record_result(f"'ihsan' rubric awards 1.5x points ({expected_points})", False, f"Got {data.get('points')}")
                
                # Check excellence is true
                if data.get('excellence') == True:
                    record_result("'ihsan' rubric has excellence=true", True)
                else:
                    record_result("'ihsan' rubric has excellence=true", False, f"Got {data.get('excellence')}")
                
                # Verify claim was updated in DB
                claim = db.habit_claims.find_one({'habitId': habit2_id, 'dateStr': today_str})
                if claim:
                    if claim['status'] == 'verified' and claim.get('excellence') == True:
                        record_result("Claim has status='verified' and excellence=true", True)
                    else:
                        record_result("Claim has status='verified' and excellence=true", False)
                    
                    if claim.get('pointsAwarded') == expected_points:
                        record_result("Claim pointsAwarded set to 1.5x", True)
                    else:
                        record_result("Claim pointsAwarded set to 1.5x", False, f"Got {claim.get('pointsAwarded')}")
                else:
                    record_result("Claim exists in DB after ihsan verify", False)
                
                # Verify log entry created
                log_entry = db.verify_log.find_one({'habitId': habit2_id, 'dateStr': today_str})
                if log_entry:
                    if log_entry.get('rubric') == 'ihsan' and log_entry.get('points') == expected_points:
                        record_result("verify_log has correct ihsan rubric and points", True)
                    else:
                        record_result("verify_log has correct ihsan rubric and points", False)
                else:
                    record_result("verify_log entry created for ihsan", False)
            else:
                record_result("POST verify 'ihsan' returns 200", False, f"Got {response.status_code}")
        except Exception as e:
            record_result("POST verify 'ihsan' rubric", False, str(e))
        
        # ===== SECTION 8: POST verify - 'belum' rubric =====
        print("\n" + "=" * 80)
        print("SECTION 8: POST verify - 'belum' rubric")
        print("=" * 80)
        
        print("\n🧪 Test 8.1: POST verify with 'belum' rubric")
        try:
            cookies = {'eqrel_session': user_b['token']}
            response = requests.post(f"{API_URL}/verify-queue/items/{claim3_id}/verify", 
                                    json={'rubric': 'belum', 'note': 'Please try again'}, 
                                    cookies=cookies, timeout=10)
            print(f"   Status: {response.status_code}")
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            
            if response.status_code == 200:
                if data.get('ok') and data.get('rubric') == 'belum':
                    record_result("POST verify 'belum' returns ok:true", True)
                else:
                    record_result("POST verify 'belum' returns ok:true", False, f"Got {data}")
                
                # Check points (should be 0)
                if data.get('points') == 0:
                    record_result("'belum' rubric awards 0 points", True)
                else:
                    record_result("'belum' rubric awards 0 points", False, f"Got {data.get('points')}")
                
                # Check removed flag
                if data.get('removed') == True:
                    record_result("'belum' rubric returns removed=true", True)
                else:
                    record_result("'belum' rubric returns removed=true", False)
                
                # Verify claim was DELETED from DB
                claim = db.habit_claims.find_one({'habitId': habit3_id, 'dateStr': today_str})
                if claim is None:
                    record_result("Claim was deleted from DB (belum)", True)
                else:
                    record_result("Claim was deleted from DB (belum)", False, "Claim still exists")
                
                # Verify log entry created with points=0
                log_entry = db.verify_log.find_one({'habitId': habit3_id, 'dateStr': today_str})
                if log_entry:
                    if log_entry.get('rubric') == 'belum' and log_entry.get('points') == 0:
                        record_result("verify_log has correct belum rubric and points=0", True)
                    else:
                        record_result("verify_log has correct belum rubric and points=0", False)
                    
                    if log_entry.get('note') == 'Please try again':
                        record_result("verify_log stores note for belum", True)
                    else:
                        record_result("verify_log stores note for belum", False)
                else:
                    record_result("verify_log entry created for belum", False)
            else:
                record_result("POST verify 'belum' returns 200", False, f"Got {response.status_code}")
        except Exception as e:
            record_result("POST verify 'belum' rubric", False, str(e))
        
        # ===== SECTION 9: Note field handling =====
        print("\n" + "=" * 80)
        print("SECTION 9: Note field handling")
        print("=" * 80)
        
        print("\n🧪 Test 9.1: Note field trimmed and truncated to 200 chars")
        try:
            # Create a new claim for this test
            habit5_id = create_test_habit(family_id, child1_id, 'Test Note Truncation', 10)
            claim5_id = create_test_claim(family_id, habit5_id, child1_id, user_a['user_id'], 'claimed', today_str)
            
            # Create a note longer than 200 chars with leading/trailing spaces
            long_note = "  " + ("A" * 250) + "  "
            
            cookies = {'eqrel_session': user_a['token']}
            response = requests.post(f"{API_URL}/verify-queue/items/{claim5_id}/verify", 
                                    json={'rubric': 'sah', 'note': long_note}, 
                                    cookies=cookies, timeout=10)
            print(f"   Status: {response.status_code}")
            
            if response.status_code == 200:
                # Check in DB
                claim = db.habit_claims.find_one({'habitId': habit5_id, 'dateStr': today_str})
                if claim:
                    stored_note = claim.get('note', '')
                    # Should be trimmed and max 200 chars
                    if len(stored_note) <= 200 and not stored_note.startswith(' ') and not stored_note.endswith(' '):
                        record_result("Note trimmed and truncated to 200 chars", True, f"Length: {len(stored_note)}")
                    else:
                        record_result("Note trimmed and truncated to 200 chars", False, f"Length: {len(stored_note)}, starts/ends with space: {stored_note[0]}/{stored_note[-1]}")
                else:
                    record_result("Note trimmed and truncated to 200 chars", False, "Claim not found")
            else:
                record_result("Note trimmed and truncated to 200 chars", False, f"Got {response.status_code}")
        except Exception as e:
            record_result("Note trimmed and truncated to 200 chars", False, str(e))
        
        # ===== SECTION 10: Data isolation =====
        print("\n" + "=" * 80)
        print("SECTION 10: Data isolation between families")
        print("=" * 80)
        
        print("\n🧪 Test 10.1: User from different family cannot see claims")
        try:
            # Create another family
            family2_id, family2_code = create_test_family()
            user_c = create_test_user_with_session('userc@test.local', 'User C', family2_id, 'ibu')
            
            cookies = {'eqrel_session': user_c['token']}
            response = requests.get(f"{API_URL}/verify-queue/items", cookies=cookies, timeout=10)
            print(f"   Status: {response.status_code}")
            data = response.json()
            
            if response.status_code == 200:
                items = data.get('items', [])
                if len(items) == 0:
                    record_result("Different family sees no claims (data isolation)", True)
                else:
                    record_result("Different family sees no claims (data isolation)", False, f"Got {len(items)} items")
            else:
                record_result("Different family sees no claims (data isolation)", False, f"Got {response.status_code}")
        except Exception as e:
            record_result("Different family sees no claims (data isolation)", False, str(e))
        
        print("\n🧪 Test 10.2: User from different family cannot verify claims")
        try:
            # Try to verify claim1 (which belongs to family_id) using user_c (from family2_id)
            cookies = {'eqrel_session': user_c['token']}
            response = requests.post(f"{API_URL}/verify-queue/items/{claim1_id}/verify", 
                                    json={'rubric': 'sah'}, cookies=cookies, timeout=10)
            print(f"   Status: {response.status_code}")
            
            if response.status_code == 404:
                record_result("Different family cannot verify other family's claims", True)
            else:
                record_result("Different family cannot verify other family's claims", False, f"Got {response.status_code}")
        except Exception as e:
            record_result("Different family cannot verify other family's claims", False, str(e))
        
        # ===== SECTION 11: Verify items are filtered correctly =====
        print("\n" + "=" * 80)
        print("SECTION 11: Verify items filtering")
        print("=" * 80)
        
        print("\n🧪 Test 11.1: Items with deleted habit are filtered out")
        try:
            # Create a habit and claim, then delete the habit
            habit6_id = create_test_habit(family_id, child1_id, 'To Be Deleted', 10)
            claim6_id = create_test_claim(family_id, habit6_id, child1_id, user_a['user_id'], 'claimed', today_str)
            
            # Delete the habit
            db.habits.delete_one({'id': habit6_id})
            
            # Get items - should not include claim6
            cookies = {'eqrel_session': user_a['token']}
            response = requests.get(f"{API_URL}/verify-queue/items", cookies=cookies, timeout=10)
            data = response.json()
            items = data.get('items', [])
            
            # Check if claim6 is in the items
            claim6_in_items = any(i['claimId'] == claim6_id for i in items)
            if not claim6_in_items:
                record_result("Items with deleted habit are filtered out", True)
            else:
                record_result("Items with deleted habit are filtered out", False, "Deleted habit claim still appears")
        except Exception as e:
            record_result("Items with deleted habit are filtered out", False, str(e))
        
        print("\n🧪 Test 11.2: Items with deleted child are filtered out")
        try:
            # Create a child, habit, and claim, then delete the child
            child3_id = create_test_child(family_id, 'To Be Deleted')
            habit7_id = create_test_habit(family_id, child3_id, 'Habit for deleted child', 10)
            claim7_id = create_test_claim(family_id, habit7_id, child3_id, user_a['user_id'], 'claimed', today_str)
            
            # Delete the child
            db.children.delete_one({'id': child3_id})
            
            # Get items - should not include claim7
            cookies = {'eqrel_session': user_a['token']}
            response = requests.get(f"{API_URL}/verify-queue/items", cookies=cookies, timeout=10)
            data = response.json()
            items = data.get('items', [])
            
            # Check if claim7 is in the items
            claim7_in_items = any(i['claimId'] == claim7_id for i in items)
            if not claim7_in_items:
                record_result("Items with deleted child are filtered out", True)
            else:
                record_result("Items with deleted child are filtered out", False, "Deleted child claim still appears")
        except Exception as e:
            record_result("Items with deleted child are filtered out", False, str(e))
        
    except Exception as e:
        print(f"\n❌ Test suite error: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Cleanup
        cleanup_test_data()
    
    # ===== FINAL RESULTS =====
    print("\n" + "=" * 80)
    print("📊 VERIFY QUEUE TEST RESULTS SUMMARY")
    print("=" * 80)
    print(f"Total Tests: {results['total']}")
    print(f"✅ Passed: {results['passed']}")
    print(f"❌ Failed: {results['failed']}")
    if results['total'] > 0:
        print(f"Success Rate: {(results['passed']/results['total']*100):.1f}%")
    print("=" * 80)
    
    if results['failed'] == 0:
        print("🎉 ALL VERIFY QUEUE TESTS PASSED!")
    else:
        print(f"⚠️  {results['failed']} test(s) failed")
        print("\nFailed tests:")
        for test in results['tests']:
            if not test['passed']:
                print(f"  ❌ {test['name']}")
                if test['details']:
                    print(f"     {test['details']}")
    
    return results['failed'] == 0

if __name__ == '__main__':
    import sys
    success = run_verify_queue_tests()
    exit(0 if success else 1)
