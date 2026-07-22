#!/usr/bin/env python3
"""
Backend API Test Suite for Habit Session Field
Tests the new 'session' field on habit CRUD operations
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
    
    # Delete test habits
    if test_habits:
        result = db.habits.delete_many({'id': {'$in': test_habits}})
        print(f"   Deleted {result.deleted_count} test habits")
    
    # Delete test children
    if test_children:
        result = db.children.delete_many({'id': {'$in': test_children}})
        print(f"   Deleted {result.deleted_count} test children")
    
    # Delete test families
    if test_families:
        result = db.families.delete_many({'id': {'$in': test_families}})
        print(f"   Deleted {result.deleted_count} test families")
    
    # Delete test users
    if test_users:
        result = db.users.delete_many({'id': {'$in': test_users}})
        print(f"   Deleted {result.deleted_count} test users")
    
    # Delete test sessions
    if test_sessions:
        result = db.sessions.delete_many({'sid': {'$in': test_sessions}})
        print(f"   Deleted {result.deleted_count} test sessions")
    
    print("✅ Cleanup complete\n")

def run_tests():
    """Run all habit session field tests"""
    print("=" * 80)
    print("🧪 HABIT SESSION FIELD TEST SUITE")
    print("=" * 80)
    
    try:
        # Setup: Create test users and family
        print("\n📋 SETUP: Creating test users and family...")
        user_a = create_test_user_with_session('test-session-a@eqrel.test', 'Test Parent A')
        user_b = create_test_user_with_session('test-session-b@eqrel.test', 'Test Parent B')
        
        # Create family for user A
        headers_a = {'Cookie': f'eqrel_session={user_a["token"]}'}
        resp = requests.post(f"{API_URL}/family/create-or-join", 
                            json={'role': 'ibu'}, 
                            headers=headers_a)
        assert resp.status_code == 200, f"Failed to create family: {resp.text}"
        family_a = resp.json()['family']
        test_families.append(family_a['id'])
        print(f"   ✅ Created family A: {family_a['code']}")
        
        # Create family for user B (different family for isolation test)
        headers_b = {'Cookie': f'eqrel_session={user_b["token"]}'}
        resp = requests.post(f"{API_URL}/family/create-or-join", 
                            json={'role': 'ibu'}, 
                            headers=headers_b)
        assert resp.status_code == 200, f"Failed to create family B: {resp.text}"
        family_b = resp.json()['family']
        test_families.append(family_b['id'])
        print(f"   ✅ Created family B: {family_b['code']}")
        
        # Create child for family A
        resp = requests.post(f"{API_URL}/children",
                            json={'nickname': 'Ahmad', 'gender': 'male', 'ageBand': '7-9'},
                            headers=headers_a)
        assert resp.status_code == 200, f"Failed to create child A: {resp.text}"
        child_a = resp.json()['child']
        test_children.append(child_a['id'])
        print(f"   ✅ Created child A: {child_a['nickname']}")
        
        # Create child for family B
        resp = requests.post(f"{API_URL}/children",
                            json={'nickname': 'Fatimah', 'gender': 'female', 'ageBand': '7-9'},
                            headers=headers_b)
        assert resp.status_code == 200, f"Failed to create child B: {resp.text}"
        child_b = resp.json()['child']
        test_children.append(child_b['id'])
        print(f"   ✅ Created child B: {child_b['nickname']}")
        
        # TEST 1: Create habit from template with explicit session
        print("\n" + "=" * 80)
        print("TEST 1: Create habit from template with explicit session='subuh'")
        print("=" * 80)
        try:
            resp = requests.post(f"{API_URL}/children/{child_a['id']}/habits",
                                json={
                                    'templateId': 'ib-01',
                                    'category': 'ibadah',
                                    'session': 'subuh',
                                    'title': 'Solat Subuh',
                                    'points': 20,
                                    'frequency': 'daily'
                                },
                                headers=headers_a)
            assert resp.status_code == 200, f"Failed to create habit: {resp.text}"
            habit1 = resp.json()['habit']
            test_habits.append(habit1['id'])
            assert habit1['session'] == 'subuh', f"Expected session='subuh', got {habit1.get('session')}"
            print(f"✅ PASSED - Habit created with session='subuh'")
            print(f"   Habit ID: {habit1['id']}")
            print(f"   Session: {habit1['session']}")
            
            # Verify in GET request
            resp = requests.get(f"{API_URL}/children/{child_a['id']}/habits", headers=headers_a)
            assert resp.status_code == 200, f"Failed to get habits: {resp.text}"
            habits = resp.json()['habits']
            found = next((h for h in habits if h['id'] == habit1['id']), None)
            assert found is not None, "Habit not found in GET response"
            assert found['session'] == 'subuh', f"Expected session='subuh' in GET, got {found.get('session')}"
            print(f"✅ PASSED - GET habits returns session='subuh'")
        except AssertionError as e:
            print(f"❌ FAILED - {str(e)}")
        except Exception as e:
            print(f"❌ ERROR - {str(e)}")
        
        # TEST 2: Create habit without session field (backward compat)
        print("\n" + "=" * 80)
        print("TEST 2: Create habit without session field (should default to 'anytime')")
        print("=" * 80)
        try:
            resp = requests.post(f"{API_URL}/children/{child_a['id']}/habits",
                                json={
                                    'category': 'akhlak',
                                    'title': 'Test habit without session',
                                    'points': 10
                                },
                                headers=headers_a)
            assert resp.status_code == 200, f"Failed to create habit: {resp.text}"
            habit2 = resp.json()['habit']
            test_habits.append(habit2['id'])
            assert habit2['session'] == 'anytime', f"Expected session='anytime', got {habit2.get('session')}"
            print(f"✅ PASSED - Habit created with default session='anytime'")
            print(f"   Habit ID: {habit2['id']}")
            print(f"   Session: {habit2['session']}")
        except AssertionError as e:
            print(f"❌ FAILED - {str(e)}")
        except Exception as e:
            print(f"❌ ERROR - {str(e)}")
        
        # TEST 3: Create habit with all 7 session values
        print("\n" + "=" * 80)
        print("TEST 3: Create habits with all 7 session values")
        print("=" * 80)
        session_values = ['subuh', 'zohor', 'asar', 'maghrib', 'isyak', 'sebelumTidur', 'anytime']
        created_habits = []
        try:
            for session_val in session_values:
                resp = requests.post(f"{API_URL}/children/{child_a['id']}/habits",
                                    json={
                                        'category': 'ibadah',
                                        'session': session_val,
                                        'title': f'Habit for {session_val}',
                                        'points': 15,
                                        'frequency': 'daily'
                                    },
                                    headers=headers_a)
                assert resp.status_code == 200, f"Failed to create habit with session={session_val}: {resp.text}"
                habit = resp.json()['habit']
                test_habits.append(habit['id'])
                created_habits.append(habit)
                assert habit['session'] == session_val, f"Expected session='{session_val}', got {habit.get('session')}"
                print(f"   ✅ Created habit with session='{session_val}'")
            
            # Verify all in GET request
            resp = requests.get(f"{API_URL}/children/{child_a['id']}/habits", headers=headers_a)
            assert resp.status_code == 200, f"Failed to get habits: {resp.text}"
            habits = resp.json()['habits']
            for created in created_habits:
                found = next((h for h in habits if h['id'] == created['id']), None)
                assert found is not None, f"Habit {created['id']} not found in GET response"
                assert found['session'] == created['session'], f"Expected session='{created['session']}', got {found.get('session')}"
            
            print(f"✅ PASSED - All 7 session values persisted correctly and returned in GET")
        except AssertionError as e:
            print(f"❌ FAILED - {str(e)}")
        except Exception as e:
            print(f"❌ ERROR - {str(e)}")
        
        # TEST 4: PATCH /habits/:id to update session
        print("\n" + "=" * 80)
        print("TEST 4: PATCH habit to update session from 'anytime' to 'zohor'")
        print("=" * 80)
        try:
            # Use habit2 from TEST 2 (currently has session='anytime')
            resp = requests.patch(f"{API_URL}/habits/{habit2['id']}",
                                 json={'session': 'zohor'},
                                 headers=headers_a)
            assert resp.status_code == 200, f"Failed to update habit: {resp.text}"
            updated_habit = resp.json()['habit']
            assert updated_habit['session'] == 'zohor', f"Expected session='zohor', got {updated_habit.get('session')}"
            print(f"✅ PASSED - Habit session updated to 'zohor'")
            print(f"   Habit ID: {updated_habit['id']}")
            print(f"   New session: {updated_habit['session']}")
            
            # Verify persistence in GET
            resp = requests.get(f"{API_URL}/children/{child_a['id']}/habits", headers=headers_a)
            assert resp.status_code == 200, f"Failed to get habits: {resp.text}"
            habits = resp.json()['habits']
            found = next((h for h in habits if h['id'] == habit2['id']), None)
            assert found is not None, "Updated habit not found in GET response"
            assert found['session'] == 'zohor', f"Expected session='zohor' in GET, got {found.get('session')}"
            print(f"✅ PASSED - Updated session persisted correctly")
        except AssertionError as e:
            print(f"❌ FAILED - {str(e)}")
        except Exception as e:
            print(f"❌ ERROR - {str(e)}")
        
        # TEST 5: Multi-child isolation
        print("\n" + "=" * 80)
        print("TEST 5: Multi-child isolation (child B should not see child A's habits)")
        print("=" * 80)
        try:
            # Create habit for child A with session='subuh'
            resp = requests.post(f"{API_URL}/children/{child_a['id']}/habits",
                                json={
                                    'category': 'ibadah',
                                    'session': 'subuh',
                                    'title': 'Child A exclusive habit',
                                    'points': 25,
                                    'frequency': 'daily'
                                },
                                headers=headers_a)
            assert resp.status_code == 200, f"Failed to create habit for child A: {resp.text}"
            habit_a_exclusive = resp.json()['habit']
            test_habits.append(habit_a_exclusive['id'])
            print(f"   ✅ Created habit for child A: {habit_a_exclusive['title']}")
            
            # Try to get habits for child B (different family)
            resp = requests.get(f"{API_URL}/children/{child_b['id']}/habits", headers=headers_b)
            assert resp.status_code == 200, f"Failed to get habits for child B: {resp.text}"
            habits_b = resp.json()['habits']
            
            # Verify child A's habit is NOT in child B's list
            found = next((h for h in habits_b if h['id'] == habit_a_exclusive['id']), None)
            assert found is None, "Child A's habit should not appear in child B's habits list"
            print(f"✅ PASSED - Child B cannot see child A's habits (family isolation working)")
        except AssertionError as e:
            print(f"❌ FAILED - {str(e)}")
        except Exception as e:
            print(f"❌ ERROR - {str(e)}")
        
        # TEST 6: Existing habits without session field
        print("\n" + "=" * 80)
        print("TEST 6: Existing habits without session field (manual seed test)")
        print("=" * 80)
        try:
            # Manually insert a habit without session field into MongoDB
            habit_id_no_session = str(uuid.uuid4())
            habit_no_session = {
                'id': habit_id_no_session,
                'familyId': family_a['id'],
                'childId': child_a['id'],
                'templateId': None,
                'category': 'akhlak',
                # NO session field
                'title': 'Old habit without session',
                'desc': 'This habit was created before session field was added',
                'points': 10,
                'frequency': 'daily',
                'active': True,
                'assignedBy': user_a['user_id'],
                'createdAt': datetime.utcnow(),
                'updatedAt': datetime.utcnow()
            }
            db.habits.insert_one(habit_no_session)
            test_habits.append(habit_id_no_session)
            print(f"   ✅ Manually seeded habit without session field")
            
            # GET habits and verify API doesn't crash
            resp = requests.get(f"{API_URL}/children/{child_a['id']}/habits", headers=headers_a)
            assert resp.status_code == 200, f"API crashed when fetching habits with missing session field: {resp.text}"
            habits = resp.json()['habits']
            found = next((h for h in habits if h['id'] == habit_id_no_session), None)
            assert found is not None, "Old habit not found in GET response"
            
            # The habit may or may not have a session field in the response
            # Frontend uses inferSession() to derive it, so it's OK if it's missing
            session_val = found.get('session')
            if session_val is None:
                print(f"   ℹ️  Habit returned without session field (OK - frontend will infer)")
            else:
                print(f"   ℹ️  Habit returned with session='{session_val}'")
            
            print(f"✅ PASSED - API handles habits without session field gracefully (no crash)")
        except AssertionError as e:
            print(f"❌ FAILED - {str(e)}")
        except Exception as e:
            print(f"❌ ERROR - {str(e)}")
        
        # TEST 7: Verify no regression on other habit fields
        print("\n" + "=" * 80)
        print("TEST 7: Verify no regression on other habit fields")
        print("=" * 80)
        try:
            resp = requests.post(f"{API_URL}/children/{child_a['id']}/habits",
                                json={
                                    'templateId': 'ib-02',
                                    'category': 'ibadah',
                                    'session': 'maghrib',
                                    'title': 'Solat Maghrib',
                                    'desc': 'Perform Maghrib prayer on time',
                                    'points': 20,
                                    'frequency': 'daily'
                                },
                                headers=headers_a)
            assert resp.status_code == 200, f"Failed to create habit: {resp.text}"
            habit = resp.json()['habit']
            test_habits.append(habit['id'])
            
            # Verify all fields are present and correct
            assert habit['templateId'] == 'ib-02', f"templateId mismatch"
            assert habit['category'] == 'ibadah', f"category mismatch"
            assert habit['session'] == 'maghrib', f"session mismatch"
            assert habit['title'] == 'Solat Maghrib', f"title mismatch"
            assert habit['desc'] == 'Perform Maghrib prayer on time', f"desc mismatch"
            assert habit['points'] == 20, f"points mismatch"
            assert habit['frequency'] == 'daily', f"frequency mismatch"
            assert habit['active'] == True, f"active mismatch"
            
            print(f"✅ PASSED - All habit fields (title, category, points, frequency, active) working correctly")
            print(f"   templateId: {habit['templateId']}")
            print(f"   category: {habit['category']}")
            print(f"   session: {habit['session']}")
            print(f"   title: {habit['title']}")
            print(f"   points: {habit['points']}")
            print(f"   frequency: {habit['frequency']}")
            print(f"   active: {habit['active']}")
        except AssertionError as e:
            print(f"❌ FAILED - {str(e)}")
        except Exception as e:
            print(f"❌ ERROR - {str(e)}")
        
        # TEST 8: Family isolation still works
        print("\n" + "=" * 80)
        print("TEST 8: Family isolation (habits scoped by familyId)")
        print("=" * 80)
        try:
            # User B (different family) tries to access child A's habits
            resp = requests.get(f"{API_URL}/children/{child_a['id']}/habits", headers=headers_b)
            assert resp.status_code == 404, f"Expected 404 for cross-family access, got {resp.status_code}"
            print(f"✅ PASSED - User from different family cannot access child A's habits (404)")
            
            # User B tries to create habit for child A
            resp = requests.post(f"{API_URL}/children/{child_a['id']}/habits",
                                json={
                                    'category': 'ibadah',
                                    'session': 'asar',
                                    'title': 'Unauthorized habit',
                                    'points': 10
                                },
                                headers=headers_b)
            assert resp.status_code == 404, f"Expected 404 for cross-family habit creation, got {resp.status_code}"
            print(f"✅ PASSED - User from different family cannot create habit for child A (404)")
        except AssertionError as e:
            print(f"❌ FAILED - {str(e)}")
        except Exception as e:
            print(f"❌ ERROR - {str(e)}")
        
        print("\n" + "=" * 80)
        print("🎉 ALL HABIT SESSION FIELD TESTS COMPLETED")
        print("=" * 80)
        
    except Exception as e:
        print(f"\n❌ CRITICAL ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        cleanup_test_data()

if __name__ == '__main__':
    run_tests()
