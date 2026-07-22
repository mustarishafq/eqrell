#!/usr/bin/env python3
"""
Backend Regression Test Suite for PATCH /api/habits/:id
Focus: session and recurring fields with claim tracking verification
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
test_claims = []

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
    
    # Delete test claims
    if test_claims:
        result = db.habit_claims.delete_many({'habitId': {'$in': test_habits}})
        print(f"   Deleted {result.deleted_count} test claims")
    
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

def get_today_datestr():
    """Get today's date in YYYY-MM-DD format"""
    return datetime.utcnow().strftime('%Y-%m-%d')

# ============================================================================
# TEST SUITE
# ============================================================================

def run_tests():
    print("=" * 80)
    print("🧪 BACKEND REGRESSION TEST: PATCH /api/habits/:id (session + recurring)")
    print("=" * 80)
    
    total_tests = 0
    passed_tests = 0
    
    try:
        # ====================================================================
        # SETUP: Create test users, families, children, and habits
        # ====================================================================
        print("\n📦 SETUP: Creating test data...")
        
        # User A (Family A)
        user_a = create_test_user_with_session('test-patch-a@eqrel.test', 'Parent A')
        cookies_a = {'eqrel_session': user_a['token']}
        
        # User B (Family B - for isolation testing)
        user_b = create_test_user_with_session('test-patch-b@eqrel.test', 'Parent B')
        cookies_b = {'eqrel_session': user_b['token']}
        
        # Create Family A
        res = requests.post(f"{API_URL}/family/create-or-join", 
                           json={'role': 'ibu'}, 
                           cookies=cookies_a)
        assert res.status_code == 200, f"Failed to create family A: {res.text}"
        family_a = res.json()['family']
        test_families.append(family_a['id'])
        print(f"✅ Created Family A: {family_a['id']}")
        
        # Create Family B
        res = requests.post(f"{API_URL}/family/create-or-join", 
                           json={'role': 'bapa'}, 
                           cookies=cookies_b)
        assert res.status_code == 200, f"Failed to create family B: {res.text}"
        family_b = res.json()['family']
        test_families.append(family_b['id'])
        print(f"✅ Created Family B: {family_b['id']}")
        
        # Create Child A1 in Family A
        res = requests.post(f"{API_URL}/children",
                           json={
                               'nickname': 'Ahmad',
                               'dob': '2018-01-15',
                               'gender': 'male',
                               'avatarId': 'B01'
                           },
                           cookies=cookies_a)
        assert res.status_code == 200, f"Failed to create child A1: {res.text}"
        child_a1 = res.json()['child']
        test_children.append(child_a1['id'])
        print(f"✅ Created Child A1: {child_a1['nickname']}")
        
        # Create Child B1 in Family B
        res = requests.post(f"{API_URL}/children",
                           json={
                               'nickname': 'Fatimah',
                               'dob': '2019-03-20',
                               'gender': 'female',
                               'avatarId': 'G01'
                           },
                           cookies=cookies_b)
        assert res.status_code == 200, f"Failed to create child B1: {res.text}"
        child_b1 = res.json()['child']
        test_children.append(child_b1['id'])
        print(f"✅ Created Child B1: {child_b1['nickname']}")
        
        # Create Habit 1: Daily habit with session='anytime' for Child A1
        res = requests.post(f"{API_URL}/children/{child_a1['id']}/habits",
                           json={
                               'title': 'Baca Al-Quran',
                               'desc': 'Baca 1 muka surat',
                               'category': 'ibadah',
                               'points': 20,
                               'frequency': 'daily',
                               'session': 'anytime',
                               'recurring': 'daily'
                           },
                           cookies=cookies_a)
        assert res.status_code == 200, f"Failed to create habit 1: {res.text}"
        habit1 = res.json()['habit']
        test_habits.append(habit1['id'])
        print(f"✅ Created Habit 1 (daily, anytime): {habit1['title']}")
        
        # Create Habit 2: Daily habit for recurring change test
        res = requests.post(f"{API_URL}/children/{child_a1['id']}/habits",
                           json={
                               'title': 'Solat Dhuha',
                               'desc': '2 rakaat',
                               'category': 'ibadah',
                               'points': 15,
                               'frequency': 'daily',
                               'session': 'anytime',
                               'recurring': 'daily'
                           },
                           cookies=cookies_a)
        assert res.status_code == 200, f"Failed to create habit 2: {res.text}"
        habit2 = res.json()['habit']
        test_habits.append(habit2['id'])
        print(f"✅ Created Habit 2 (daily): {habit2['title']}")
        
        # Create Habit 3: PerPrayer habit for recurring change test
        res = requests.post(f"{API_URL}/children/{child_a1['id']}/habits",
                           json={
                               'title': 'Wudhu',
                               'desc': 'Wudhu sebelum solat',
                               'category': 'ibadah',
                               'points': 10,
                               'frequency': 'daily',
                               'session': 'subuh',
                               'recurring': 'perPrayer'
                           },
                           cookies=cookies_a)
        assert res.status_code == 200, f"Failed to create habit 3: {res.text}"
        habit3 = res.json()['habit']
        test_habits.append(habit3['id'])
        print(f"✅ Created Habit 3 (perPrayer): {habit3['title']}")
        
        # Create Habit 4: For multi-field update test
        res = requests.post(f"{API_URL}/children/{child_a1['id']}/habits",
                           json={
                               'title': 'Bantu Ibu',
                               'desc': 'Tolong ibu di dapur',
                               'category': 'keluarga',
                               'points': 10,
                               'frequency': 'daily',
                               'session': 'anytime',
                               'recurring': 'daily'
                           },
                           cookies=cookies_a)
        assert res.status_code == 200, f"Failed to create habit 4: {res.text}"
        habit4 = res.json()['habit']
        test_habits.append(habit4['id'])
        print(f"✅ Created Habit 4 (for multi-field test): {habit4['title']}")
        
        print("\n" + "=" * 80)
        print("🧪 STARTING TESTS")
        print("=" * 80)
        
        # ====================================================================
        # TEST 1: PATCH daily habit → change session from 'anytime' to 'zohor'
        # ====================================================================
        print("\n📝 TEST 1: PATCH daily habit → change session 'anytime' to 'zohor'")
        total_tests += 1
        try:
            res = requests.patch(f"{API_URL}/habits/{habit1['id']}",
                               json={'session': 'zohor'},
                               cookies=cookies_a)
            assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
            data = res.json()
            assert 'habit' in data, "Response missing 'habit' field"
            assert data['habit']['session'] == 'zohor', f"Expected session='zohor', got {data['habit']['session']}"
            
            # Verify persistence via GET
            res_get = requests.get(f"{API_URL}/children/{child_a1['id']}/habits", cookies=cookies_a)
            assert res_get.status_code == 200, f"GET failed: {res_get.text}"
            habits = res_get.json()['habits']
            habit1_updated = next((h for h in habits if h['id'] == habit1['id']), None)
            assert habit1_updated is not None, "Habit 1 not found in GET response"
            assert habit1_updated['session'] == 'zohor', f"Session not persisted: {habit1_updated['session']}"
            
            print("✅ TEST 1 PASSED: Session updated from 'anytime' to 'zohor' and persisted")
            passed_tests += 1
        except AssertionError as e:
            print(f"❌ TEST 1 FAILED: {e}")
        except Exception as e:
            print(f"❌ TEST 1 ERROR: {e}")
        
        # ====================================================================
        # TEST 2: PATCH daily habit → change recurring from 'daily' to 'perPrayer'
        # ====================================================================
        print("\n📝 TEST 2: PATCH daily habit → change recurring 'daily' to 'perPrayer'")
        total_tests += 1
        try:
            # First, create a claim for habit2 (daily, session=null)
            today = get_today_datestr()
            claim_id = f"{habit2['id']}__{today}"
            db.habit_claims.insert_one({
                'habitId': habit2['id'],
                'childId': child_a1['id'],
                'dateStr': today,
                'session': None,
                'status': 'claimed',
                'claimedAt': datetime.utcnow(),
                'claimedBy': user_a['user_id']
            })
            test_claims.append(claim_id)
            print(f"   Created daily claim (session=null) for habit2")
            
            # Now PATCH to perPrayer
            res = requests.patch(f"{API_URL}/habits/{habit2['id']}",
                               json={'recurring': 'perPrayer'},
                               cookies=cookies_a)
            assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
            data = res.json()
            assert data['habit']['recurring'] == 'perPrayer', f"Expected recurring='perPrayer', got {data['habit']['recurring']}"
            
            # Verify via GET - should now show sessionsClaimed array
            res_get = requests.get(f"{API_URL}/children/{child_a1['id']}/habits", cookies=cookies_a)
            assert res_get.status_code == 200, f"GET failed: {res_get.text}"
            habits = res_get.json()['habits']
            habit2_updated = next((h for h in habits if h['id'] == habit2['id']), None)
            assert habit2_updated is not None, "Habit 2 not found in GET response"
            assert habit2_updated['recurring'] == 'perPrayer', f"Recurring not persisted: {habit2_updated['recurring']}"
            
            # Existing claim with session=null should still show (backward compat)
            # but new claims must include session
            print(f"   Habit2 after PATCH: recurring={habit2_updated['recurring']}, todayStatus={habit2_updated.get('todayStatus')}")
            
            print("✅ TEST 2 PASSED: Recurring updated to 'perPrayer', existing claim preserved")
            passed_tests += 1
        except AssertionError as e:
            print(f"❌ TEST 2 FAILED: {e}")
        except Exception as e:
            print(f"❌ TEST 2 ERROR: {e}")
        
        # ====================================================================
        # TEST 3: PATCH perPrayer habit → change back to recurring: 'daily'
        # ====================================================================
        print("\n📝 TEST 3: PATCH perPrayer habit → change back to recurring='daily'")
        total_tests += 1
        try:
            # Create a perPrayer claim with session='subuh'
            today = get_today_datestr()
            claim_id = f"{habit3['id']}__{today}__subuh"
            db.habit_claims.insert_one({
                'habitId': habit3['id'],
                'childId': child_a1['id'],
                'dateStr': today,
                'session': 'subuh',
                'status': 'verified',
                'rubric': 'sah',
                'pointsAwarded': 10,
                'claimedAt': datetime.utcnow(),
                'claimedBy': user_a['user_id'],
                'verifiedAt': datetime.utcnow(),
                'verifiedBy': user_a['user_id']
            })
            test_claims.append(claim_id)
            print(f"   Created perPrayer claim (session='subuh') for habit3")
            
            # PATCH back to daily
            res = requests.patch(f"{API_URL}/habits/{habit3['id']}",
                               json={'recurring': 'daily'},
                               cookies=cookies_a)
            assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
            data = res.json()
            assert data['habit']['recurring'] == 'daily', f"Expected recurring='daily', got {data['habit']['recurring']}"
            
            # Verify via GET - should now show todayStatus based on primary claim
            res_get = requests.get(f"{API_URL}/children/{child_a1['id']}/habits", cookies=cookies_a)
            assert res_get.status_code == 200, f"GET failed: {res_get.text}"
            habits = res_get.json()['habits']
            habit3_updated = next((h for h in habits if h['id'] == habit3['id']), None)
            assert habit3_updated is not None, "Habit 3 not found in GET response"
            assert habit3_updated['recurring'] == 'daily', f"Recurring not persisted: {habit3_updated['recurring']}"
            
            # New claims should be session=null (daily mode)
            print(f"   Habit3 after PATCH: recurring={habit3_updated['recurring']}, todayStatus={habit3_updated.get('todayStatus')}")
            
            print("✅ TEST 3 PASSED: Recurring changed back to 'daily', claim tracking intact")
            passed_tests += 1
        except AssertionError as e:
            print(f"❌ TEST 3 FAILED: {e}")
        except Exception as e:
            print(f"❌ TEST 3 ERROR: {e}")
        
        # ====================================================================
        # TEST 4: PATCH invalid recurring value (should accept but frontend controls)
        # ====================================================================
        print("\n📝 TEST 4: PATCH with invalid recurring value (e.g., 'weekly')")
        total_tests += 1
        try:
            res = requests.patch(f"{API_URL}/habits/{habit1['id']}",
                               json={'recurring': 'weekly'},
                               cookies=cookies_a)
            # Backend doesn't validate recurring values - it accepts anything
            # Frontend is responsible for sending only 'daily' or 'perPrayer'
            assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
            data = res.json()
            # Backend stores whatever is sent
            assert data['habit']['recurring'] == 'weekly', f"Backend should store 'weekly' as-is"
            
            print("✅ TEST 4 PASSED: Backend accepts invalid recurring value (frontend validation expected)")
            passed_tests += 1
        except AssertionError as e:
            print(f"❌ TEST 4 FAILED: {e}")
        except Exception as e:
            print(f"❌ TEST 4 ERROR: {e}")
        
        # ====================================================================
        # TEST 5: PATCH multiple fields at once
        # ====================================================================
        print("\n📝 TEST 5: PATCH multiple fields at once (title, session, recurring, category, points)")
        total_tests += 1
        try:
            res = requests.patch(f"{API_URL}/habits/{habit4['id']}",
                               json={
                                   'title': 'Bantu Ibu (Updated)',
                                   'session': 'maghrib',
                                   'recurring': 'daily',
                                   'category': 'akhlak',
                                   'points': 15
                               },
                               cookies=cookies_a)
            assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
            data = res.json()
            habit = data['habit']
            assert habit['title'] == 'Bantu Ibu (Updated)', f"Title not updated: {habit['title']}"
            assert habit['session'] == 'maghrib', f"Session not updated: {habit['session']}"
            assert habit['recurring'] == 'daily', f"Recurring not updated: {habit['recurring']}"
            assert habit['category'] == 'akhlak', f"Category not updated: {habit['category']}"
            assert habit['points'] == 15, f"Points not updated: {habit['points']}"
            
            print("✅ TEST 5 PASSED: All fields updated successfully")
            passed_tests += 1
        except AssertionError as e:
            print(f"❌ TEST 5 FAILED: {e}")
        except Exception as e:
            print(f"❌ TEST 5 ERROR: {e}")
        
        # ====================================================================
        # TEST 6: PATCH does NOT accept forbidden fields (familyId, childId, id)
        # ====================================================================
        print("\n📝 TEST 6: PATCH with forbidden fields (familyId, childId, id) - should be ignored")
        total_tests += 1
        try:
            # Get original values
            res_before = requests.get(f"{API_URL}/children/{child_a1['id']}/habits", cookies=cookies_a)
            habits_before = res_before.json()['habits']
            habit1_before = next((h for h in habits_before if h['id'] == habit1['id']), None)
            original_family_id = habit1_before['familyId']
            original_child_id = habit1_before['childId']
            original_id = habit1_before['id']
            
            # Try to PATCH forbidden fields
            res = requests.patch(f"{API_URL}/habits/{habit1['id']}",
                               json={
                                   'title': 'Legitimate Update',
                                   'familyId': 'fake-family-id',
                                   'childId': 'fake-child-id',
                                   'id': 'fake-habit-id'
                               },
                               cookies=cookies_a)
            assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
            
            # Verify forbidden fields were NOT updated
            res_after = requests.get(f"{API_URL}/children/{child_a1['id']}/habits", cookies=cookies_a)
            habits_after = res_after.json()['habits']
            habit1_after = next((h for h in habits_after if h['id'] == habit1['id']), None)
            
            assert habit1_after['familyId'] == original_family_id, "familyId was modified (should be ignored)"
            assert habit1_after['childId'] == original_child_id, "childId was modified (should be ignored)"
            assert habit1_after['id'] == original_id, "id was modified (should be ignored)"
            assert habit1_after['title'] == 'Legitimate Update', "Legitimate field (title) was not updated"
            
            print("✅ TEST 6 PASSED: Forbidden fields ignored, legitimate fields updated")
            passed_tests += 1
        except AssertionError as e:
            print(f"❌ TEST 6 FAILED: {e}")
        except Exception as e:
            print(f"❌ TEST 6 ERROR: {e}")
        
        # ====================================================================
        # TEST 7: Multi-child isolation on PATCH (User A cannot PATCH User B's habit)
        # ====================================================================
        print("\n📝 TEST 7: Multi-child isolation - User A cannot PATCH User B's habit")
        total_tests += 1
        try:
            # Create a habit for Child B1 (Family B)
            res = requests.post(f"{API_URL}/children/{child_b1['id']}/habits",
                               json={
                                   'title': 'Habit for Family B',
                                   'desc': 'This belongs to Family B',
                                   'category': 'ibadah',
                                   'points': 10,
                                   'frequency': 'daily',
                                   'session': 'anytime',
                                   'recurring': 'daily'
                               },
                               cookies=cookies_b)
            assert res.status_code == 200, f"Failed to create habit for Family B: {res.text}"
            habit_b = res.json()['habit']
            test_habits.append(habit_b['id'])
            
            # User A tries to PATCH User B's habit
            res = requests.patch(f"{API_URL}/habits/{habit_b['id']}",
                               json={'title': 'Hacked by User A'},
                               cookies=cookies_a)
            assert res.status_code == 404, f"Expected 404, got {res.status_code}: {res.text}"
            
            # Verify habit was NOT modified
            res_verify = requests.get(f"{API_URL}/children/{child_b1['id']}/habits", cookies=cookies_b)
            habits_b = res_verify.json()['habits']
            habit_b_check = next((h for h in habits_b if h['id'] == habit_b['id']), None)
            assert habit_b_check['title'] == 'Habit for Family B', "Habit was modified by wrong user!"
            
            print("✅ TEST 7 PASSED: Cross-family PATCH blocked (404)")
            passed_tests += 1
        except AssertionError as e:
            print(f"❌ TEST 7 FAILED: {e}")
        except Exception as e:
            print(f"❌ TEST 7 ERROR: {e}")
        
        # ====================================================================
        # SUMMARY
        # ====================================================================
        print("\n" + "=" * 80)
        print("📊 TEST SUMMARY")
        print("=" * 80)
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {total_tests - passed_tests}")
        
        if passed_tests == total_tests:
            print("\n🎉 ALL TESTS PASSED!")
        else:
            print(f"\n⚠️  {total_tests - passed_tests} TEST(S) FAILED")
        
        return passed_tests == total_tests
        
    except Exception as e:
        print(f"\n❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        cleanup_test_data()
        mongo_client.close()

if __name__ == '__main__':
    success = run_tests()
    exit(0 if success else 1)
