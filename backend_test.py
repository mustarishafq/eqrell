#!/usr/bin/env python3
"""
Backend API Test Suite for EQrel Islamic Habit App
Tests all backend endpoints including auth, family, and children CRUD
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
test_users = []
test_sessions = []
test_families = []
test_children = []

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

def create_test_user_with_session(email, name):
    """Create a test user and session in MongoDB, return JWT token"""
    user_id = str(uuid.uuid4())
    sid = str(uuid.uuid4())
    
    # Insert user
    user = {
        'id': user_id,
        'email': email,
        'name': name,
        'familyId': None,
        'role': None,
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
        'sid': sid
    }

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
    
    # Also clean up any users with @eqrel.local email
    result = db.users.delete_many({'email': {'$regex': '@eqrel\\.local$'}})
    if result.deleted_count > 0:
        print(f"   Deleted {result.deleted_count} additional @eqrel.local users")
    
    print("✅ Cleanup complete\n")

# ============================================
# TEST FUNCTIONS
# ============================================

def test_health_endpoint():
    """Test GET /api/health"""
    print("\n🧪 Testing GET /api/health")
    try:
        response = requests.get(f"{API_URL}/health", timeout=10)
        print(f"   Status: {response.status_code}")
        data = response.json()
        print(f"   Response: {json.dumps(data, indent=2)}")
        
        if response.status_code == 200 and data.get('status') == 'healthy' and data.get('mongo') == 'connected':
            print("   ✅ Health check passed")
            return True
        else:
            print("   ❌ Health check failed - unexpected response")
            return False
    except Exception as e:
        print(f"   ❌ Health check failed: {e}")
        return False

def test_root_endpoint():
    """Test GET /api/"""
    print("\n🧪 Testing GET /api/")
    try:
        response = requests.get(f"{API_URL}/", timeout=10)
        print(f"   Status: {response.status_code}")
        data = response.json()
        print(f"   Response: {json.dumps(data, indent=2)}")
        
        if response.status_code == 200 and data.get('app') == 'EQrel':
            print("   ✅ Root endpoint passed")
            return True
        else:
            print("   ❌ Root endpoint failed")
            return False
    except Exception as e:
        print(f"   ❌ Root endpoint failed: {e}")
        return False

def test_auth_callback_missing_session_id():
    """Test POST /api/auth/callback with missing session_id"""
    print("\n🧪 Testing POST /api/auth/callback (missing session_id)")
    try:
        response = requests.post(f"{API_URL}/auth/callback", json={}, timeout=10)
        print(f"   Status: {response.status_code}")
        data = response.json()
        print(f"   Response: {json.dumps(data, indent=2)}")
        
        if response.status_code == 400 and 'error' in data:
            print("   ✅ Correctly returns 400 for missing session_id")
            return True
        else:
            print("   ❌ Should return 400 for missing session_id")
            return False
    except Exception as e:
        print(f"   ❌ Test failed: {e}")
        return False

def test_auth_callback_invalid_session_id():
    """Test POST /api/auth/callback with invalid session_id"""
    print("\n🧪 Testing POST /api/auth/callback (invalid session_id)")
    try:
        response = requests.post(
            f"{API_URL}/auth/callback",
            json={'session_id': 'invalid-session-id-12345'},
            timeout=10
        )
        print(f"   Status: {response.status_code}")
        data = response.json()
        print(f"   Response: {json.dumps(data, indent=2)}")
        
        # Should return 401 or 500 with error message (not crash)
        if response.status_code in [401, 500] and 'error' in data:
            print("   ✅ Correctly handles invalid session_id with error response")
            return True
        else:
            print(f"   ❌ Should return 401/500 with error for invalid session_id")
            return False
    except Exception as e:
        print(f"   ❌ Test failed: {e}")
        return False

def test_auth_me_unauthorized():
    """Test GET /api/auth/me without authentication"""
    print("\n🧪 Testing GET /api/auth/me (unauthorized)")
    try:
        response = requests.get(f"{API_URL}/auth/me", timeout=10)
        print(f"   Status: {response.status_code}")
        data = response.json()
        print(f"   Response: {json.dumps(data, indent=2)}")
        
        if response.status_code == 401:
            print("   ✅ Correctly returns 401 for unauthorized request")
            return True
        else:
            print("   ❌ Should return 401 for unauthorized request")
            return False
    except Exception as e:
        print(f"   ❌ Test failed: {e}")
        return False

def test_auth_me_with_session(user_data):
    """Test GET /api/auth/me with valid session"""
    print(f"\n🧪 Testing GET /api/auth/me (authenticated as {user_data['name']})")
    try:
        cookies = {'eqrel_session': user_data['token']}
        response = requests.get(f"{API_URL}/auth/me", cookies=cookies, timeout=10)
        print(f"   Status: {response.status_code}")
        data = response.json()
        print(f"   Response: {json.dumps(data, indent=2)}")
        
        if response.status_code == 200 and data.get('user', {}).get('id') == user_data['user_id']:
            print(f"   ✅ Successfully retrieved user data")
            print(f"   needsFamilySetup: {data.get('needsFamilySetup')}")
            return True, data
        else:
            print("   ❌ Failed to retrieve user data")
            return False, None
    except Exception as e:
        print(f"   ❌ Test failed: {e}")
        return False, None

def test_logout(user_data):
    """Test POST /api/auth/logout"""
    print(f"\n🧪 Testing POST /api/auth/logout")
    try:
        cookies = {'eqrel_session': user_data['token']}
        response = requests.post(f"{API_URL}/auth/logout", cookies=cookies, timeout=10)
        print(f"   Status: {response.status_code}")
        data = response.json()
        print(f"   Response: {json.dumps(data, indent=2)}")
        
        if response.status_code == 200 and data.get('ok') == True:
            print("   ✅ Logout successful")
            return True
        else:
            print("   ❌ Logout failed")
            return False
    except Exception as e:
        print(f"   ❌ Test failed: {e}")
        return False

def test_family_create_unauthorized():
    """Test POST /api/family/create-or-join without authentication"""
    print("\n🧪 Testing POST /api/family/create-or-join (unauthorized)")
    try:
        response = requests.post(
            f"{API_URL}/family/create-or-join",
            json={'role': 'ibu'},
            timeout=10
        )
        print(f"   Status: {response.status_code}")
        data = response.json()
        print(f"   Response: {json.dumps(data, indent=2)}")
        
        if response.status_code == 401:
            print("   ✅ Correctly returns 401 for unauthorized request")
            return True
        else:
            print("   ❌ Should return 401 for unauthorized request")
            return False
    except Exception as e:
        print(f"   ❌ Test failed: {e}")
        return False

def test_family_create_invalid_role(user_data):
    """Test POST /api/family/create-or-join with invalid role"""
    print("\n🧪 Testing POST /api/family/create-or-join (invalid role)")
    try:
        cookies = {'eqrel_session': user_data['token']}
        response = requests.post(
            f"{API_URL}/family/create-or-join",
            json={'role': 'invalid'},
            cookies=cookies,
            timeout=10
        )
        print(f"   Status: {response.status_code}")
        data = response.json()
        print(f"   Response: {json.dumps(data, indent=2)}")
        
        if response.status_code == 400:
            print("   ✅ Correctly returns 400 for invalid role")
            return True
        else:
            print("   ❌ Should return 400 for invalid role")
            return False
    except Exception as e:
        print(f"   ❌ Test failed: {e}")
        return False

def test_family_create_new(user_data, role):
    """Test POST /api/family/create-or-join to create new family"""
    print(f"\n🧪 Testing POST /api/family/create-or-join (create new family as {role})")
    try:
        cookies = {'eqrel_session': user_data['token']}
        response = requests.post(
            f"{API_URL}/family/create-or-join",
            json={'role': role},
            cookies=cookies,
            timeout=10
        )
        print(f"   Status: {response.status_code}")
        data = response.json()
        print(f"   Response: {json.dumps(data, indent=2)}")
        
        if response.status_code == 200 and 'family' in data:
            family_code = data['family'].get('code')
            family_id = data['family'].get('id')
            print(f"   ✅ Family created successfully")
            print(f"   Family Code: {family_code}")
            print(f"   Family ID: {family_id}")
            test_families.append(family_id)
            return True, family_code, family_id
        else:
            print("   ❌ Failed to create family")
            return False, None, None
    except Exception as e:
        print(f"   ❌ Test failed: {e}")
        return False, None, None

def test_family_join(user_data, family_code, role):
    """Test POST /api/family/create-or-join to join existing family"""
    print(f"\n🧪 Testing POST /api/family/create-or-join (join family {family_code} as {role})")
    try:
        cookies = {'eqrel_session': user_data['token']}
        response = requests.post(
            f"{API_URL}/family/create-or-join",
            json={'role': role, 'familyCode': family_code},
            cookies=cookies,
            timeout=10
        )
        print(f"   Status: {response.status_code}")
        data = response.json()
        print(f"   Response: {json.dumps(data, indent=2)}")
        
        if response.status_code == 200:
            print(f"   ✅ Successfully joined family as {role}")
            return True
        else:
            print(f"   ❌ Failed to join family")
            return False
    except Exception as e:
        print(f"   ❌ Test failed: {e}")
        return False

def test_family_join_invalid_code(user_data):
    """Test POST /api/family/create-or-join with invalid family code"""
    print("\n🧪 Testing POST /api/family/create-or-join (invalid family code)")
    try:
        cookies = {'eqrel_session': user_data['token']}
        response = requests.post(
            f"{API_URL}/family/create-or-join",
            json={'role': 'ibu', 'familyCode': 'INVALID123'},
            cookies=cookies,
            timeout=10
        )
        print(f"   Status: {response.status_code}")
        data = response.json()
        print(f"   Response: {json.dumps(data, indent=2)}")
        
        if response.status_code == 404:
            print("   ✅ Correctly returns 404 for invalid family code")
            return True
        else:
            print("   ❌ Should return 404 for invalid family code")
            return False
    except Exception as e:
        print(f"   ❌ Test failed: {e}")
        return False

def test_family_join_role_taken(user_data, family_code, role):
    """Test POST /api/family/create-or-join when role is already taken"""
    print(f"\n🧪 Testing POST /api/family/create-or-join (role {role} already taken)")
    try:
        cookies = {'eqrel_session': user_data['token']}
        response = requests.post(
            f"{API_URL}/family/create-or-join",
            json={'role': role, 'familyCode': family_code},
            cookies=cookies,
            timeout=10
        )
        print(f"   Status: {response.status_code}")
        data = response.json()
        print(f"   Response: {json.dumps(data, indent=2)}")
        
        if response.status_code == 409:
            print(f"   ✅ Correctly returns 409 when role is taken")
            return True
        else:
            print(f"   ❌ Should return 409 when role is taken")
            return False
    except Exception as e:
        print(f"   ❌ Test failed: {e}")
        return False

def test_children_get_unauthorized():
    """Test GET /api/children without authentication"""
    print("\n🧪 Testing GET /api/children (unauthorized)")
    try:
        response = requests.get(f"{API_URL}/children", timeout=10)
        print(f"   Status: {response.status_code}")
        data = response.json()
        print(f"   Response: {json.dumps(data, indent=2)}")
        
        if response.status_code == 401:
            print("   ✅ Correctly returns 401 for unauthorized request")
            return True
        else:
            print("   ❌ Should return 401 for unauthorized request")
            return False
    except Exception as e:
        print(f"   ❌ Test failed: {e}")
        return False

def test_children_get_no_family(user_data):
    """Test GET /api/children when user has no family"""
    print("\n🧪 Testing GET /api/children (no family)")
    try:
        cookies = {'eqrel_session': user_data['token']}
        response = requests.get(f"{API_URL}/children", cookies=cookies, timeout=10)
        print(f"   Status: {response.status_code}")
        data = response.json()
        print(f"   Response: {json.dumps(data, indent=2)}")
        
        if response.status_code == 200 and data.get('children') == []:
            print("   ✅ Correctly returns empty array for user without family")
            return True
        else:
            print("   ❌ Should return empty array for user without family")
            return False
    except Exception as e:
        print(f"   ❌ Test failed: {e}")
        return False

def test_children_create(user_data, nickname, dob='2020-01-01', gender='male', avatar_id='B01'):
    """Test POST /api/children to create a child"""
    print(f"\n🧪 Testing POST /api/children (create {nickname})")
    try:
        cookies = {'eqrel_session': user_data['token']}
        child_data = {
            'nickname': nickname,
            'dob': dob,
            'gender': gender,
            'avatarId': avatar_id,
            'ageBand': '5-6',
            'favColor': 'green',
            'preferredLang': 'ms'
        }
        response = requests.post(
            f"{API_URL}/children",
            json=child_data,
            cookies=cookies,
            timeout=10
        )
        print(f"   Status: {response.status_code}")
        data = response.json()
        print(f"   Response: {json.dumps(data, indent=2)}")
        
        if response.status_code == 200 and 'child' in data:
            child_id = data['child'].get('id')
            print(f"   ✅ Child created successfully")
            print(f"   Child ID: {child_id}")
            test_children.append(child_id)
            return True, child_id
        else:
            print("   ❌ Failed to create child")
            return False, None
    except Exception as e:
        print(f"   ❌ Test failed: {e}")
        return False, None

def test_children_get(user_data):
    """Test GET /api/children"""
    print(f"\n🧪 Testing GET /api/children (as {user_data['name']})")
    try:
        cookies = {'eqrel_session': user_data['token']}
        response = requests.get(f"{API_URL}/children", cookies=cookies, timeout=10)
        print(f"   Status: {response.status_code}")
        data = response.json()
        print(f"   Response: {json.dumps(data, indent=2)}")
        
        if response.status_code == 200 and 'children' in data:
            print(f"   ✅ Retrieved {len(data['children'])} children")
            return True, data['children']
        else:
            print("   ❌ Failed to retrieve children")
            return False, []
    except Exception as e:
        print(f"   ❌ Test failed: {e}")
        return False, []

def test_children_update(user_data, child_id, updates):
    """Test PATCH /api/children/:id"""
    print(f"\n🧪 Testing PATCH /api/children/{child_id}")
    try:
        cookies = {'eqrel_session': user_data['token']}
        response = requests.patch(
            f"{API_URL}/children/{child_id}",
            json=updates,
            cookies=cookies,
            timeout=10
        )
        print(f"   Status: {response.status_code}")
        data = response.json()
        print(f"   Response: {json.dumps(data, indent=2)}")
        
        if response.status_code == 200 and 'child' in data:
            print(f"   ✅ Child updated successfully")
            return True
        else:
            print("   ❌ Failed to update child")
            return False
    except Exception as e:
        print(f"   ❌ Test failed: {e}")
        return False

def test_children_delete(user_data, child_id):
    """Test DELETE /api/children/:id"""
    print(f"\n🧪 Testing DELETE /api/children/{child_id}")
    try:
        cookies = {'eqrel_session': user_data['token']}
        response = requests.delete(
            f"{API_URL}/children/{child_id}",
            cookies=cookies,
            timeout=10
        )
        print(f"   Status: {response.status_code}")
        data = response.json()
        print(f"   Response: {json.dumps(data, indent=2)}")
        
        if response.status_code == 200 and data.get('ok') == True:
            print(f"   ✅ Child deleted successfully")
            return True
        else:
            print("   ❌ Failed to delete child")
            return False
    except Exception as e:
        print(f"   ❌ Test failed: {e}")
        return False

def test_children_isolation(user_data, child_id):
    """Test that user from different family cannot access child"""
    print(f"\n🧪 Testing data isolation (user {user_data['name']} accessing child {child_id})")
    try:
        cookies = {'eqrel_session': user_data['token']}
        
        # Try to update
        response = requests.patch(
            f"{API_URL}/children/{child_id}",
            json={'nickname': 'Hacked'},
            cookies=cookies,
            timeout=10
        )
        print(f"   PATCH Status: {response.status_code}")
        
        if response.status_code == 404:
            print("   ✅ PATCH correctly returns 404 (isolation working)")
            patch_ok = True
        else:
            print("   ❌ PATCH should return 404 for child from different family")
            patch_ok = False
        
        # Try to delete
        response = requests.delete(
            f"{API_URL}/children/{child_id}",
            cookies=cookies,
            timeout=10
        )
        print(f"   DELETE Status: {response.status_code}")
        
        if response.status_code == 404:
            print("   ✅ DELETE correctly returns 404 (isolation working)")
            delete_ok = True
        else:
            print("   ❌ DELETE should return 404 for child from different family")
            delete_ok = False
        
        return patch_ok and delete_ok
    except Exception as e:
        print(f"   ❌ Test failed: {e}")
        return False

# ============================================
# MAIN TEST RUNNER
# ============================================

def run_all_tests():
    """Run all backend tests"""
    print("=" * 80)
    print("🚀 EQrel Backend API Test Suite")
    print("=" * 80)
    print(f"API URL: {API_URL}")
    print(f"MongoDB: {MONGO_URL}/{DB_NAME}")
    print("=" * 80)
    
    results = {
        'passed': 0,
        'failed': 0,
        'total': 0
    }
    
    def record_result(test_name, passed):
        results['total'] += 1
        if passed:
            results['passed'] += 1
        else:
            results['failed'] += 1
    
    try:
        # ===== UNAUTHENTICATED TESTS =====
        print("\n" + "=" * 80)
        print("📋 SECTION 1: Unauthenticated Endpoints")
        print("=" * 80)
        
        record_result("Health Check", test_health_endpoint())
        record_result("Root Endpoint", test_root_endpoint())
        record_result("Auth Callback - Missing session_id", test_auth_callback_missing_session_id())
        record_result("Auth Callback - Invalid session_id", test_auth_callback_invalid_session_id())
        record_result("Auth Me - Unauthorized", test_auth_me_unauthorized())
        record_result("Family Create - Unauthorized", test_family_create_unauthorized())
        record_result("Children Get - Unauthorized", test_children_get_unauthorized())
        
        # ===== AUTHENTICATED TESTS - USER WITHOUT FAMILY =====
        print("\n" + "=" * 80)
        print("📋 SECTION 2: Authenticated User Without Family")
        print("=" * 80)
        
        user_no_family = create_test_user_with_session('nofamily@eqrel.local', 'User No Family')
        print(f"✅ Created test user: {user_no_family['name']} ({user_no_family['email']})")
        
        passed, me_data = test_auth_me_with_session(user_no_family)
        record_result("Auth Me - With Session (No Family)", passed)
        
        record_result("Children Get - No Family", test_children_get_no_family(user_no_family))
        
        # ===== FAMILY CREATION & CO-PARENTING =====
        print("\n" + "=" * 80)
        print("📋 SECTION 3: Family Creation & Co-Parenting")
        print("=" * 80)
        
        # Create User A (Ibu)
        user_a = create_test_user_with_session('ibu@eqrel.local', 'Ibu Aminah')
        print(f"✅ Created test user A: {user_a['name']} ({user_a['email']})")
        
        # Test invalid role
        record_result("Family Create - Invalid Role", test_family_create_invalid_role(user_a))
        
        # User A creates family as Ibu
        passed, family_code, family_id = test_family_create_new(user_a, 'ibu')
        record_result("Family Create - New Family (Ibu)", passed)
        
        if not passed:
            print("❌ Cannot continue co-parenting tests without family")
            return
        
        # Create User B (Bapa)
        user_b = create_test_user_with_session('bapa@eqrel.local', 'Bapa Ahmad')
        print(f"✅ Created test user B: {user_b['name']} ({user_b['email']})")
        
        # User B joins as Bapa
        record_result("Family Join - Valid Code (Bapa)", test_family_join(user_b, family_code, 'bapa'))
        
        # Verify both parents see each other
        passed, me_data = test_auth_me_with_session(user_a)
        if passed and len(me_data.get('parents', [])) == 2:
            print("   ✅ User A sees 2 parents in family")
            record_result("Family - Co-parenting visibility (User A)", True)
        else:
            print("   ❌ User A should see 2 parents")
            record_result("Family - Co-parenting visibility (User A)", False)
        
        passed, me_data = test_auth_me_with_session(user_b)
        if passed and len(me_data.get('parents', [])) == 2:
            print("   ✅ User B sees 2 parents in family")
            record_result("Family - Co-parenting visibility (User B)", True)
        else:
            print("   ❌ User B should see 2 parents")
            record_result("Family - Co-parenting visibility (User B)", False)
        
        # Create User C to test role conflict
        user_c = create_test_user_with_session('ibu2@eqrel.local', 'Ibu Fatimah')
        print(f"✅ Created test user C: {user_c['name']} ({user_c['email']})")
        
        # User C tries to join as Ibu (should fail - role taken)
        record_result("Family Join - Role Taken (409)", test_family_join_role_taken(user_c, family_code, 'ibu'))
        
        # Test invalid family code
        record_result("Family Join - Invalid Code (404)", test_family_join_invalid_code(user_c))
        
        # ===== CHILDREN CRUD =====
        print("\n" + "=" * 80)
        print("📋 SECTION 4: Children CRUD Operations")
        print("=" * 80)
        
        # User A creates a child
        passed, child_id_1 = test_children_create(user_a, 'Adam', '2020-01-15', 'male', 'B01')
        record_result("Children Create - User A", passed)
        
        # User B should see the child
        passed, children = test_children_get(user_b)
        if passed and len(children) == 1 and children[0]['nickname'] == 'Adam':
            print("   ✅ User B can see child created by User A")
            record_result("Children Get - Co-parent visibility", True)
        else:
            print("   ❌ User B should see child created by User A")
            record_result("Children Get - Co-parent visibility", False)
        
        # User B updates the child
        record_result("Children Update - User B", test_children_update(user_b, child_id_1, {'nickname': 'Adam Updated'}))
        
        # User A should see the update
        passed, children = test_children_get(user_a)
        if passed and len(children) == 1 and children[0]['nickname'] == 'Adam Updated':
            print("   ✅ User A sees update made by User B")
            record_result("Children Update - Co-parent sees changes", True)
        else:
            print("   ❌ User A should see update made by User B")
            record_result("Children Update - Co-parent sees changes", False)
        
        # User B creates another child
        passed, child_id_2 = test_children_create(user_b, 'Fatimah', '2018-05-20', 'female', 'G01')
        record_result("Children Create - User B", passed)
        
        # Both should see 2 children
        passed, children = test_children_get(user_a)
        if passed and len(children) == 2:
            print("   ✅ User A sees 2 children")
            record_result("Children Get - Multiple children (User A)", True)
        else:
            print(f"   ❌ User A should see 2 children, got {len(children) if passed else 0}")
            record_result("Children Get - Multiple children (User A)", False)
        
        # ===== DATA ISOLATION =====
        print("\n" + "=" * 80)
        print("📋 SECTION 5: Data Isolation Between Families")
        print("=" * 80)
        
        # User C creates their own family
        passed, family_code_c, family_id_c = test_family_create_new(user_c, 'ibu')
        record_result("Family Create - Different Family (User C)", passed)
        
        # User C should not see children from Family A-B
        passed, children = test_children_get(user_c)
        if passed and len(children) == 0:
            print("   ✅ User C (different family) sees no children")
            record_result("Children Get - Isolation (empty list)", True)
        else:
            print(f"   ❌ User C should see 0 children, got {len(children) if passed else 'error'}")
            record_result("Children Get - Isolation (empty list)", False)
        
        # User C tries to access/modify children from Family A-B
        record_result("Children Isolation - PATCH/DELETE", test_children_isolation(user_c, child_id_1))
        
        # ===== CLEANUP & DELETION =====
        print("\n" + "=" * 80)
        print("📋 SECTION 6: Deletion & Cleanup")
        print("=" * 80)
        
        # User A deletes first child
        record_result("Children Delete - User A", test_children_delete(user_a, child_id_1))
        
        # Verify only 1 child remains
        passed, children = test_children_get(user_a)
        if passed and len(children) == 1:
            print("   ✅ Only 1 child remains after deletion")
            record_result("Children Delete - Verification", True)
        else:
            print(f"   ❌ Should have 1 child after deletion, got {len(children) if passed else 'error'}")
            record_result("Children Delete - Verification", False)
        
        # Test logout
        record_result("Auth Logout", test_logout(user_a))
        
    except Exception as e:
        print(f"\n❌ Test suite error: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Cleanup
        cleanup_test_data()
    
    # ===== FINAL RESULTS =====
    print("\n" + "=" * 80)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 80)
    print(f"Total Tests: {results['total']}")
    print(f"✅ Passed: {results['passed']}")
    print(f"❌ Failed: {results['failed']}")
    print(f"Success Rate: {(results['passed']/results['total']*100):.1f}%")
    print("=" * 80)
    
    if results['failed'] == 0:
        print("🎉 ALL TESTS PASSED!")
    else:
        print(f"⚠️  {results['failed']} test(s) failed")
    
    return results['failed'] == 0

if __name__ == '__main__':
    success = run_all_tests()
    exit(0 if success else 1)
