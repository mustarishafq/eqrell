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
    
    # Delete habits and claims for test families
    if test_families:
        result = db.habits.delete_many({'familyId': {'$in': test_families}})
        print(f"   Deleted {result.deleted_count} test habits")
        result = db.habit_claims.delete_many({'familyId': {'$in': test_families}})
        print(f"   Deleted {result.deleted_count} test habit claims")
    
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
# HABIT TESTS
# ============================================

def test_habits_get_unauthorized(child_id):
    """Test GET /api/children/:id/habits without authentication"""
    print(f"\n🧪 Testing GET /api/children/{child_id}/habits (unauthorized)")
    try:
        response = requests.get(f"{API_URL}/children/{child_id}/habits", timeout=10)
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

def test_habits_get_nonexistent_child(user_data):
    """Test GET /api/children/:id/habits for non-existent child"""
    print(f"\n🧪 Testing GET /api/children/nonexistent/habits")
    try:
        cookies = {'eqrel_session': user_data['token']}
        response = requests.get(f"{API_URL}/children/nonexistent-child-id/habits", cookies=cookies, timeout=10)
        print(f"   Status: {response.status_code}")
        data = response.json()
        print(f"   Response: {json.dumps(data, indent=2)}")
        
        if response.status_code == 404:
            print("   ✅ Correctly returns 404 for non-existent child")
            return True
        else:
            print("   ❌ Should return 404 for non-existent child")
            return False
    except Exception as e:
        print(f"   ❌ Test failed: {e}")
        return False

def test_habit_create_no_title(user_data, child_id):
    """Test POST /api/children/:id/habits without title"""
    print(f"\n🧪 Testing POST /api/children/{child_id}/habits (no title)")
    try:
        cookies = {'eqrel_session': user_data['token']}
        habit_data = {
            'category': 'ibadah',
            'desc': 'Test habit',
            'points': 10
        }
        response = requests.post(
            f"{API_URL}/children/{child_id}/habits",
            json=habit_data,
            cookies=cookies,
            timeout=10
        )
        print(f"   Status: {response.status_code}")
        data = response.json()
        print(f"   Response: {json.dumps(data, indent=2)}")
        
        if response.status_code == 400 and 'Tajuk habit diperlukan' in data.get('error', ''):
            print("   ✅ Correctly returns 400 with proper error message")
            return True
        else:
            print("   ❌ Should return 400 with 'Tajuk habit diperlukan'")
            return False
    except Exception as e:
        print(f"   ❌ Test failed: {e}")
        return False

def test_habit_create(user_data, child_id, title, template_id=None, category='ibadah', desc='', points=10, frequency='daily'):
    """Test POST /api/children/:id/habits to create a habit"""
    print(f"\n🧪 Testing POST /api/children/{child_id}/habits (create '{title}')")
    try:
        cookies = {'eqrel_session': user_data['token']}
        habit_data = {
            'title': title,
            'category': category,
            'desc': desc,
            'points': points,
            'frequency': frequency
        }
        if template_id:
            habit_data['templateId'] = template_id
        
        response = requests.post(
            f"{API_URL}/children/{child_id}/habits",
            json=habit_data,
            cookies=cookies,
            timeout=10
        )
        print(f"   Status: {response.status_code}")
        data = response.json()
        print(f"   Response: {json.dumps(data, indent=2)}")
        
        if response.status_code == 200 and 'habit' in data:
            habit = data['habit']
            habit_id = habit.get('id')
            print(f"   ✅ Habit created successfully")
            print(f"   Habit ID: {habit_id}")
            print(f"   Title: {habit.get('title')}")
            print(f"   Category: {habit.get('category')}")
            print(f"   Points: {habit.get('points')}")
            print(f"   Assigned by: {habit.get('assignedBy')}")
            
            # Verify all required fields
            if all([
                habit.get('id'),
                habit.get('familyId'),
                habit.get('childId') == child_id,
                habit.get('title') == title,
                habit.get('assignedBy'),
                'createdAt' in habit,
                'updatedAt' in habit
            ]):
                print("   ✅ All required fields present")
                return True, habit_id, habit
            else:
                print("   ❌ Missing required fields in habit object")
                return False, None, None
        else:
            print("   ❌ Failed to create habit")
            return False, None, None
    except Exception as e:
        print(f"   ❌ Test failed: {e}")
        return False, None, None

def test_habits_get(user_data, child_id):
    """Test GET /api/children/:id/habits"""
    print(f"\n🧪 Testing GET /api/children/{child_id}/habits")
    try:
        cookies = {'eqrel_session': user_data['token']}
        response = requests.get(f"{API_URL}/children/{child_id}/habits", cookies=cookies, timeout=10)
        print(f"   Status: {response.status_code}")
        data = response.json()
        print(f"   Response: {json.dumps(data, indent=2)}")
        
        if response.status_code == 200 and 'habits' in data:
            habits = data['habits']
            print(f"   ✅ Retrieved {len(habits)} habits")
            
            # Verify each habit has todayStatus field
            all_have_status = all('todayStatus' in h for h in habits)
            if all_have_status:
                print("   ✅ All habits have todayStatus field")
            else:
                print("   ❌ Some habits missing todayStatus field")
            
            return all_have_status, habits
        else:
            print("   ❌ Failed to retrieve habits")
            return False, []
    except Exception as e:
        print(f"   ❌ Test failed: {e}")
        return False, []

def test_habit_update(user_data, habit_id, updates):
    """Test PATCH /api/habits/:id"""
    print(f"\n🧪 Testing PATCH /api/habits/{habit_id}")
    try:
        cookies = {'eqrel_session': user_data['token']}
        response = requests.patch(
            f"{API_URL}/habits/{habit_id}",
            json=updates,
            cookies=cookies,
            timeout=10
        )
        print(f"   Status: {response.status_code}")
        data = response.json()
        print(f"   Response: {json.dumps(data, indent=2)}")
        
        if response.status_code == 200 and 'habit' in data:
            habit = data['habit']
            print(f"   ✅ Habit updated successfully")
            
            # Verify updates were applied
            all_updated = all(habit.get(k) == v for k, v in updates.items())
            if all_updated:
                print("   ✅ All updates applied correctly")
            else:
                print("   ❌ Some updates not applied")
            
            return all_updated, habit
        else:
            print("   ❌ Failed to update habit")
            return False, None
    except Exception as e:
        print(f"   ❌ Test failed: {e}")
        return False, None

def test_habit_update_nonexistent(user_data):
    """Test PATCH /api/habits/:id for non-existent habit"""
    print(f"\n🧪 Testing PATCH /api/habits/nonexistent")
    try:
        cookies = {'eqrel_session': user_data['token']}
        response = requests.patch(
            f"{API_URL}/habits/nonexistent-habit-id",
            json={'title': 'Updated'},
            cookies=cookies,
            timeout=10
        )
        print(f"   Status: {response.status_code}")
        data = response.json()
        print(f"   Response: {json.dumps(data, indent=2)}")
        
        if response.status_code == 404:
            print("   ✅ Correctly returns 404 for non-existent habit")
            return True
        else:
            print("   ❌ Should return 404 for non-existent habit")
            return False
    except Exception as e:
        print(f"   ❌ Test failed: {e}")
        return False

def test_habit_delete(user_data, habit_id):
    """Test DELETE /api/habits/:id"""
    print(f"\n🧪 Testing DELETE /api/habits/{habit_id}")
    try:
        cookies = {'eqrel_session': user_data['token']}
        response = requests.delete(
            f"{API_URL}/habits/{habit_id}",
            cookies=cookies,
            timeout=10
        )
        print(f"   Status: {response.status_code}")
        data = response.json()
        print(f"   Response: {json.dumps(data, indent=2)}")
        
        if response.status_code == 200 and data.get('ok') == True:
            print(f"   ✅ Habit deleted successfully")
            return True
        else:
            print("   ❌ Failed to delete habit")
            return False
    except Exception as e:
        print(f"   ❌ Test failed: {e}")
        return False

def test_habit_claim(user_data, habit_id, status='claimed', date_str=None):
    """Test POST /api/habits/:id/claim"""
    print(f"\n🧪 Testing POST /api/habits/{habit_id}/claim (status: {status})")
    try:
        cookies = {'eqrel_session': user_data['token']}
        claim_data = {'status': status}
        if date_str:
            claim_data['dateStr'] = date_str
        
        response = requests.post(
            f"{API_URL}/habits/{habit_id}/claim",
            json=claim_data,
            cookies=cookies,
            timeout=10
        )
        print(f"   Status: {response.status_code}")
        data = response.json()
        print(f"   Response: {json.dumps(data, indent=2)}")
        
        if response.status_code == 200 and data.get('ok') == True and 'claim' in data:
            claim = data['claim']
            print(f"   ✅ Claim recorded successfully")
            print(f"   Status: {claim.get('status')}")
            print(f"   Date: {claim.get('dateStr')}")
            return True, claim
        else:
            print("   ❌ Failed to record claim")
            return False, None
    except Exception as e:
        print(f"   ❌ Test failed: {e}")
        return False, None

def test_habit_claim_nonexistent(user_data):
    """Test POST /api/habits/:id/claim for non-existent habit"""
    print(f"\n🧪 Testing POST /api/habits/nonexistent/claim")
    try:
        cookies = {'eqrel_session': user_data['token']}
        response = requests.post(
            f"{API_URL}/habits/nonexistent-habit-id/claim",
            json={'status': 'claimed'},
            cookies=cookies,
            timeout=10
        )
        print(f"   Status: {response.status_code}")
        data = response.json()
        print(f"   Response: {json.dumps(data, indent=2)}")
        
        if response.status_code == 404:
            print("   ✅ Correctly returns 404 for non-existent habit")
            return True
        else:
            print("   ❌ Should return 404 for non-existent habit")
            return False
    except Exception as e:
        print(f"   ❌ Test failed: {e}")
        return False

def test_verify_queue_get(user_data):
    """Test GET /api/verify-queue"""
    print(f"\n🧪 Testing GET /api/verify-queue")
    try:
        cookies = {'eqrel_session': user_data['token']}
        response = requests.get(f"{API_URL}/verify-queue", cookies=cookies, timeout=10)
        print(f"   Status: {response.status_code}")
        data = response.json()
        print(f"   Response: {json.dumps(data, indent=2)}")
        
        if response.status_code == 200 and 'claims' in data:
            claims = data['claims']
            print(f"   ✅ Retrieved {len(claims)} pending claims")
            
            # Verify all claims have status='claimed'
            all_claimed = all(c.get('status') == 'claimed' for c in claims)
            if all_claimed or len(claims) == 0:
                print("   ✅ All claims have status='claimed' (or empty)")
            else:
                print("   ❌ Some claims don't have status='claimed'")
            
            return all_claimed or len(claims) == 0, claims
        else:
            print("   ❌ Failed to retrieve verify queue")
            return False, []
    except Exception as e:
        print(f"   ❌ Test failed: {e}")
        return False, []

def test_verify_queue_unauthorized():
    """Test GET /api/verify-queue without authentication"""
    print(f"\n🧪 Testing GET /api/verify-queue (unauthorized)")
    try:
        response = requests.get(f"{API_URL}/verify-queue", timeout=10)
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

def test_habit_isolation(user_data, habit_id):
    """Test that user from different family cannot access habit"""
    print(f"\n🧪 Testing habit isolation (user {user_data['name']} accessing habit {habit_id})")
    try:
        cookies = {'eqrel_session': user_data['token']}
        
        # Try to update
        response = requests.patch(
            f"{API_URL}/habits/{habit_id}",
            json={'title': 'Hacked'},
            cookies=cookies,
            timeout=10
        )
        print(f"   PATCH Status: {response.status_code}")
        
        if response.status_code == 404:
            print("   ✅ PATCH correctly returns 404 (isolation working)")
            patch_ok = True
        else:
            print("   ❌ PATCH should return 404 for habit from different family")
            patch_ok = False
        
        # Try to delete
        response = requests.delete(
            f"{API_URL}/habits/{habit_id}",
            cookies=cookies,
            timeout=10
        )
        print(f"   DELETE Status: {response.status_code}")
        
        if response.status_code == 404:
            print("   ✅ DELETE correctly returns 404 (isolation working)")
            delete_ok = True
        else:
            print("   ❌ DELETE should return 404 for habit from different family")
            delete_ok = False
        
        # Try to claim
        response = requests.post(
            f"{API_URL}/habits/{habit_id}/claim",
            json={'status': 'claimed'},
            cookies=cookies,
            timeout=10
        )
        print(f"   CLAIM Status: {response.status_code}")
        
        if response.status_code == 404:
            print("   ✅ CLAIM correctly returns 404 (isolation working)")
            claim_ok = True
        else:
            print("   ❌ CLAIM should return 404 for habit from different family")
            claim_ok = False
        
        return patch_ok and delete_ok and claim_ok
    except Exception as e:
        print(f"   ❌ Test failed: {e}")
        return False

def test_cascade_delete_child_with_habits(user_data, child_id):
    """Test that deleting a child cascades to habits and claims"""
    print(f"\n🧪 Testing cascade delete (child {child_id} with habits)")
    try:
        cookies = {'eqrel_session': user_data['token']}
        
        # Delete the child
        response = requests.delete(
            f"{API_URL}/children/{child_id}",
            cookies=cookies,
            timeout=10
        )
        print(f"   DELETE child status: {response.status_code}")
        
        if response.status_code != 200:
            print("   ❌ Failed to delete child")
            return False
        
        # Verify child is gone
        response = requests.get(f"{API_URL}/children", cookies=cookies, timeout=10)
        if response.status_code == 200:
            children = response.json().get('children', [])
            child_exists = any(c['id'] == child_id for c in children)
            if child_exists:
                print("   ❌ Child still exists after deletion")
                return False
            else:
                print("   ✅ Child deleted from children collection")
        
        # Verify habits are gone (check MongoDB directly)
        habits_count = db.habits.count_documents({'childId': child_id})
        claims_count = db.habit_claims.count_documents({'childId': child_id})
        
        print(f"   Remaining habits for child: {habits_count}")
        print(f"   Remaining claims for child: {claims_count}")
        
        if habits_count == 0 and claims_count == 0:
            print("   ✅ Cascade delete working - habits and claims removed")
            return True
        else:
            print("   ❌ Cascade delete failed - habits or claims still exist")
            return False
        
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

def run_habit_tests():
    """Run habit-specific backend tests"""
    print("=" * 80)
    print("🚀 EQrel Habit Backend API Test Suite")
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
    
    # Store habit IDs for testing
    habit_ids = []
    
    try:
        # ===== SETUP: Create test users and family =====
        print("\n" + "=" * 80)
        print("📋 SETUP: Creating test users and family")
        print("=" * 80)
        
        # Create User A (Ibu)
        user_a = create_test_user_with_session('ibu@eqrel.local', 'Ibu Aminah')
        print(f"✅ Created test user A: {user_a['name']} ({user_a['email']})")
        
        # User A creates family as Ibu
        cookies_a = {'eqrel_session': user_a['token']}
        response = requests.post(
            f"{API_URL}/family/create-or-join",
            json={'role': 'ibu'},
            cookies=cookies_a,
            timeout=10
        )
        family_data = response.json()
        family_code = family_data['family']['code']
        family_id = family_data['family']['id']
        test_families.append(family_id)
        print(f"✅ Created family: {family_code}")
        
        # Create User B (Bapa)
        user_b = create_test_user_with_session('bapa@eqrel.local', 'Bapa Ahmad')
        print(f"✅ Created test user B: {user_b['name']} ({user_b['email']})")
        
        # User B joins family
        cookies_b = {'eqrel_session': user_b['token']}
        response = requests.post(
            f"{API_URL}/family/create-or-join",
            json={'role': 'bapa', 'familyCode': family_code},
            cookies=cookies_b,
            timeout=10
        )
        print(f"✅ User B joined family")
        
        # Create children
        response = requests.post(
            f"{API_URL}/children",
            json={'nickname': 'Aisyah', 'dob': '2018-05-15', 'gender': 'female', 'avatarId': 'G01', 'ageBand': '5-6'},
            cookies=cookies_a,
            timeout=10
        )
        child_1_id = response.json()['child']['id']
        test_children.append(child_1_id)
        print(f"✅ Created child 1: Aisyah ({child_1_id})")
        
        response = requests.post(
            f"{API_URL}/children",
            json={'nickname': 'Yusuf', 'dob': '2020-01-10', 'gender': 'male', 'avatarId': 'B01', 'ageBand': '3-4'},
            cookies=cookies_a,
            timeout=10
        )
        child_2_id = response.json()['child']['id']
        test_children.append(child_2_id)
        print(f"✅ Created child 2: Yusuf ({child_2_id})")
        
        # Create User C (different family for isolation tests)
        user_c = create_test_user_with_session('ibu2@eqrel.local', 'Ibu Fatimah')
        print(f"✅ Created test user C: {user_c['name']} ({user_c['email']})")
        
        cookies_c = {'eqrel_session': user_c['token']}
        response = requests.post(
            f"{API_URL}/family/create-or-join",
            json={'role': 'ibu'},
            cookies=cookies_c,
            timeout=10
        )
        family_c_id = response.json()['family']['id']
        test_families.append(family_c_id)
        print(f"✅ User C created separate family")
        
        # ===== SECTION A: BASIC CRUD =====
        print("\n" + "=" * 80)
        print("📋 SECTION A: Basic CRUD Operations")
        print("=" * 80)
        
        # A1: Unauthenticated call
        record_result("Habits Get - Unauthorized", test_habits_get_unauthorized(child_1_id))
        
        # A2: Non-existent child
        record_result("Habits Get - Non-existent child (404)", test_habits_get_nonexistent_child(user_a))
        
        # A3: Create habit without title
        record_result("Habit Create - No title (400)", test_habit_create_no_title(user_a, child_1_id))
        
        # A4: Create habit with valid template payload
        passed, habit_1_id, habit_1 = test_habit_create(
            user_a, child_1_id,
            title='Solat Subuh',
            template_id='ib-01',
            category='ibadah',
            desc='Solat Subuh berjemaah atau sendiri',
            points=20,
            frequency='daily'
        )
        record_result("Habit Create - Valid template", passed)
        if passed:
            habit_ids.append(habit_1_id)
        
        # A5: GET habits - should return array with todayStatus
        passed, habits = test_habits_get(user_a, child_1_id)
        record_result("Habits Get - Returns array with todayStatus", passed)
        
        # A6: PATCH habit - update whitelisted fields
        if habit_1_id:
            passed, updated_habit = test_habit_update(
                user_a, habit_1_id,
                {'title': 'Solat Subuh Updated', 'points': 25, 'desc': 'Updated description'}
            )
            record_result("Habit Update - PATCH whitelisted fields", passed)
        
        # A7: PATCH non-existent habit
        record_result("Habit Update - Non-existent (404)", test_habit_update_nonexistent(user_a))
        
        # A8: Create another habit for testing
        passed, habit_2_id, habit_2 = test_habit_create(
            user_a, child_1_id,
            title='Berus gigi 2x',
            category='kesihatan',
            desc='Berus gigi pagi dan malam',
            points=10,
            frequency='daily'
        )
        record_result("Habit Create - Second habit", passed)
        if passed:
            habit_ids.append(habit_2_id)
        
        # A9: DELETE habit
        if habit_2_id:
            record_result("Habit Delete - DELETE habit", test_habit_delete(user_a, habit_2_id))
            
            # A10: Verify habit is gone
            passed, habits = test_habits_get(user_a, child_1_id)
            if passed:
                habit_exists = any(h['id'] == habit_2_id for h in habits)
                if not habit_exists:
                    print("   ✅ Deleted habit not in list")
                    record_result("Habit Delete - Verification", True)
                else:
                    print("   ❌ Deleted habit still in list")
                    record_result("Habit Delete - Verification", False)
            else:
                record_result("Habit Delete - Verification", False)
        
        # ===== SECTION B: CLAIMS =====
        print("\n" + "=" * 80)
        print("📋 SECTION B: Claims")
        print("=" * 80)
        
        # B1: Verify queue unauthorized
        record_result("Verify Queue - Unauthorized", test_verify_queue_unauthorized())
        
        # B2: Claim on non-existent habit
        record_result("Habit Claim - Non-existent (404)", test_habit_claim_nonexistent(user_a))
        
        # B3: Create a new habit for claim testing
        passed, habit_3_id, habit_3 = test_habit_create(
            user_a, child_1_id,
            title='Doa sebelum tidur',
            category='ibadah',
            desc='Baca doa tidur dan 3 Qul',
            points=10,
            frequency='daily'
        )
        record_result("Habit Create - For claim testing", passed)
        if passed:
            habit_ids.append(habit_3_id)
        
        # B4: POST claim with status='claimed'
        if habit_3_id:
            passed, claim = test_habit_claim(user_a, habit_3_id, status='claimed')
            record_result("Habit Claim - Status 'claimed'", passed)
            
            # B5: Verify todayStatus updated
            passed, habits = test_habits_get(user_a, child_1_id)
            if passed:
                habit = next((h for h in habits if h['id'] == habit_3_id), None)
                if habit and habit.get('todayStatus') == 'claimed':
                    print("   ✅ todayStatus updated to 'claimed'")
                    record_result("Habit Claim - todayStatus updated", True)
                else:
                    print(f"   ❌ todayStatus not updated (got: {habit.get('todayStatus') if habit else 'not found'})")
                    record_result("Habit Claim - todayStatus updated", False)
            else:
                record_result("Habit Claim - todayStatus updated", False)
            
            # B6: GET verify-queue - should include this claim
            passed, claims = test_verify_queue_get(user_a)
            if passed:
                claim_exists = any(c['habitId'] == habit_3_id for c in claims)
                if claim_exists:
                    print("   ✅ Claim appears in verify-queue")
                    record_result("Verify Queue - Contains 'claimed' status", True)
                else:
                    print("   ❌ Claim not in verify-queue")
                    record_result("Verify Queue - Contains 'claimed' status", False)
            else:
                record_result("Verify Queue - Contains 'claimed' status", False)
            
            # B7: POST claim same day with status='skipped' (should REPLACE)
            passed, claim = test_habit_claim(user_a, habit_3_id, status='skipped')
            record_result("Habit Claim - Upsert (replace with 'skipped')", passed)
            
            # B8: Verify verify-queue no longer includes it
            passed, claims = test_verify_queue_get(user_a)
            if passed:
                claim_exists = any(c['habitId'] == habit_3_id for c in claims)
                if not claim_exists:
                    print("   ✅ 'skipped' claim not in verify-queue")
                    record_result("Verify Queue - 'skipped' not shown", True)
                else:
                    print("   ❌ 'skipped' claim should not be in verify-queue")
                    record_result("Verify Queue - 'skipped' not shown", False)
            else:
                record_result("Verify Queue - 'skipped' not shown", False)
            
            # B9: Set status to 'verified'
            passed, claim = test_habit_claim(user_a, habit_3_id, status='verified')
            record_result("Habit Claim - Status 'verified'", passed)
            
            # B10: Verify verify-queue still doesn't include it
            passed, claims = test_verify_queue_get(user_a)
            if passed:
                claim_exists = any(c['habitId'] == habit_3_id for c in claims)
                if not claim_exists:
                    print("   ✅ 'verified' claim not in verify-queue")
                    record_result("Verify Queue - 'verified' not shown", True)
                else:
                    print("   ❌ 'verified' claim should not be in verify-queue")
                    record_result("Verify Queue - 'verified' not shown", False)
            else:
                record_result("Verify Queue - 'verified' not shown", False)
        
        # ===== SECTION C: CO-PARENTING =====
        print("\n" + "=" * 80)
        print("📋 SECTION C: Co-Parenting")
        print("=" * 80)
        
        # C1: User B can see habits added by User A
        passed, habits_b = test_habits_get(user_b, child_1_id)
        if passed and len(habits_b) > 0:
            print(f"   ✅ User B sees {len(habits_b)} habits added by User A")
            record_result("Co-parenting - User B sees User A's habits", True)
        else:
            print("   ❌ User B should see habits added by User A")
            record_result("Co-parenting - User B sees User A's habits", False)
        
        # C2: User B can PATCH habit
        if habit_1_id:
            passed, updated = test_habit_update(user_b, habit_1_id, {'desc': 'Updated by Bapa'})
            record_result("Co-parenting - User B can PATCH", passed)
        
        # C3: User A sees User B's update
        if habit_1_id:
            passed, habits_a = test_habits_get(user_a, child_1_id)
            if passed:
                habit = next((h for h in habits_a if h['id'] == habit_1_id), None)
                if habit and habit.get('desc') == 'Updated by Bapa':
                    print("   ✅ User A sees User B's update")
                    record_result("Co-parenting - User A sees User B's update", True)
                else:
                    print("   ❌ User A should see User B's update")
                    record_result("Co-parenting - User A sees User B's update", False)
            else:
                record_result("Co-parenting - User A sees User B's update", False)
        
        # C4: User B claims habit
        if habit_1_id:
            passed, claim = test_habit_claim(user_b, habit_1_id, status='claimed')
            record_result("Co-parenting - User B can claim", passed)
            
            # C5: User A sees updated todayStatus
            passed, habits_a = test_habits_get(user_a, child_1_id)
            if passed:
                habit = next((h for h in habits_a if h['id'] == habit_1_id), None)
                if habit and habit.get('todayStatus') == 'claimed':
                    print("   ✅ User A sees User B's claim")
                    record_result("Co-parenting - User A sees User B's claim", True)
                else:
                    print(f"   ❌ User A should see User B's claim (got: {habit.get('todayStatus') if habit else 'not found'})")
                    record_result("Co-parenting - User A sees User B's claim", False)
            else:
                record_result("Co-parenting - User A sees User B's claim", False)
            
            # C6: User A's verify-queue shows User B's claim
            passed, claims_a = test_verify_queue_get(user_a)
            if passed:
                claim_exists = any(c['habitId'] == habit_1_id for c in claims_a)
                if claim_exists:
                    print("   ✅ User A's verify-queue shows User B's claim")
                    record_result("Co-parenting - Verify-queue shows co-parent's claim", True)
                else:
                    print("   ❌ User A's verify-queue should show User B's claim")
                    record_result("Co-parenting - Verify-queue shows co-parent's claim", False)
            else:
                record_result("Co-parenting - Verify-queue shows co-parent's claim", False)
        
        # ===== SECTION D: ISOLATION =====
        print("\n" + "=" * 80)
        print("📋 SECTION D: Data Isolation Between Families")
        print("=" * 80)
        
        # D1: User C gets 404 on child from different family
        print(f"\n🧪 Testing GET /api/children/{child_1_id}/habits (User C - different family)")
        response = requests.get(f"{API_URL}/children/{child_1_id}/habits", cookies=cookies_c, timeout=10)
        print(f"   Status: {response.status_code}")
        if response.status_code == 404:
            print("   ✅ User C gets 404 for child from different family")
            record_result("Isolation - GET habits on other family's child (404)", True)
        else:
            print("   ❌ User C should get 404 for child from different family")
            record_result("Isolation - GET habits on other family's child (404)", False)
        
        # D2: User C cannot PATCH/DELETE/claim habits from Family A-B
        if habit_1_id:
            record_result("Isolation - PATCH/DELETE/CLAIM (404)", test_habit_isolation(user_c, habit_1_id))
        
        # D3: User C's verify-queue is empty
        passed, claims_c = test_verify_queue_get(user_c)
        if passed and len(claims_c) == 0:
            print("   ✅ User C's verify-queue is empty (no cross-family leaks)")
            record_result("Isolation - Verify-queue empty for different family", True)
        else:
            print(f"   ❌ User C's verify-queue should be empty (got {len(claims_c) if passed else 'error'})")
            record_result("Isolation - Verify-queue empty for different family", False)
        
        # ===== SECTION E: CASCADE DELETE =====
        print("\n" + "=" * 80)
        print("📋 SECTION E: Cascade Delete")
        print("=" * 80)
        
        # E1: Create habits for child 2
        passed, habit_4_id, _ = test_habit_create(
            user_a, child_2_id,
            title='Cuci tangan',
            category='kesihatan',
            desc='Cuci tangan dengan sabun',
            points=5,
            frequency='daily'
        )
        record_result("Cascade - Create habit 1 for child 2", passed)
        if passed:
            habit_ids.append(habit_4_id)
        
        passed, habit_5_id, _ = test_habit_create(
            user_a, child_2_id,
            title='Beri salam',
            category='akhlak',
            desc='Ucap Assalamualaikum',
            points=5,
            frequency='daily'
        )
        record_result("Cascade - Create habit 2 for child 2", passed)
        if passed:
            habit_ids.append(habit_5_id)
        
        # E2: Add claims for both habits
        if habit_4_id:
            test_habit_claim(user_a, habit_4_id, status='claimed')
        if habit_5_id:
            test_habit_claim(user_a, habit_5_id, status='verified')
        
        # E3: Delete child 2 and verify cascade
        record_result("Cascade - Delete child with habits", test_cascade_delete_child_with_habits(user_a, child_2_id))
        
        # ===== SECTION F: EDGE CASES =====
        print("\n" + "=" * 80)
        print("📋 SECTION F: Edge Cases")
        print("=" * 80)
        
        # F1: POST habit with non-number points (should handle gracefully)
        print(f"\n🧪 Testing POST /api/children/{child_1_id}/habits (points as string)")
        response = requests.post(
            f"{API_URL}/children/{child_1_id}/habits",
            json={'title': 'Test Habit', 'category': 'ibadah', 'points': 'not-a-number'},
            cookies=cookies_a,
            timeout=10
        )
        print(f"   Status: {response.status_code}")
        if response.status_code in [200, 400]:
            print("   ✅ Handles non-number points gracefully (doesn't crash)")
            record_result("Edge - Non-number points", True)
        else:
            print("   ❌ Should handle non-number points gracefully")
            record_result("Edge - Non-number points", False)
        
        # F2: GET verify-queue with no family (already tested with user_no_family scenario)
        # Create user without family
        user_no_family = create_test_user_with_session('nofamily@eqrel.local', 'User No Family')
        cookies_no_family = {'eqrel_session': user_no_family['token']}
        print(f"\n🧪 Testing GET /api/verify-queue (user with no family)")
        response = requests.get(f"{API_URL}/verify-queue", cookies=cookies_no_family, timeout=10)
        print(f"   Status: {response.status_code}")
        data = response.json()
        if response.status_code == 200 and data.get('claims') == []:
            print("   ✅ Returns empty array for user without family")
            record_result("Edge - Verify-queue with no family", True)
        else:
            print("   ❌ Should return empty array for user without family")
            record_result("Edge - Verify-queue with no family", False)
        
    except Exception as e:
        print(f"\n❌ Test suite error: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Cleanup
        cleanup_test_data()
    
    # ===== FINAL RESULTS =====
    print("\n" + "=" * 80)
    print("📊 HABIT TEST RESULTS SUMMARY")
    print("=" * 80)
    print(f"Total Tests: {results['total']}")
    print(f"✅ Passed: {results['passed']}")
    print(f"❌ Failed: {results['failed']}")
    print(f"Success Rate: {(results['passed']/results['total']*100):.1f}%")
    print("=" * 80)
    
    if results['failed'] == 0:
        print("🎉 ALL HABIT TESTS PASSED!")
    else:
        print(f"⚠️  {results['failed']} test(s) failed")
    
    return results['failed'] == 0

if __name__ == '__main__':
    import sys
    
    # Check if we should run habit tests or all tests
    if len(sys.argv) > 1 and sys.argv[1] == '--habits':
        success = run_habit_tests()
    else:
        success = run_all_tests()
    
    exit(0 if success else 1)
