#!/usr/bin/env python3
"""
Additional verification test for PATCH /api/habits/:id
Focus: Verify claim tracking is NOT broken by PATCH operations
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
    
    session = {
        'sid': sid,
        'userId': user_id,
        'email': email,
        'expiresAt': datetime.utcnow() + timedelta(days=30),
        'createdAt': datetime.utcnow()
    }
    db.sessions.insert_one(session)
    test_sessions.append(sid)
    
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
    
    if test_habits:
        db.habit_claims.delete_many({'habitId': {'$in': test_habits}})
        db.habits.delete_many({'id': {'$in': test_habits}})
    
    if test_children:
        db.children.delete_many({'id': {'$in': test_children}})
    
    if test_families:
        db.families.delete_many({'id': {'$in': test_families}})
    
    if test_users:
        db.users.delete_many({'id': {'$in': test_users}})
    
    if test_sessions:
        db.sessions.delete_many({'sid': {'$in': test_sessions}})
    
    print("✅ Cleanup complete\n")

def get_today_datestr():
    """Get today's date in YYYY-MM-DD format"""
    return datetime.utcnow().strftime('%Y-%m-%d')

# ============================================================================
# CLAIM TRACKING VERIFICATION TESTS
# ============================================================================

def run_tests():
    print("=" * 80)
    print("🧪 CLAIM TRACKING VERIFICATION AFTER PATCH")
    print("=" * 80)
    
    total_tests = 0
    passed_tests = 0
    
    try:
        print("\n📦 SETUP: Creating test data...")
        
        user = create_test_user_with_session('test-claim-track@eqrel.test', 'Parent Test')
        cookies = {'eqrel_session': user['token']}
        
        # Create Family
        res = requests.post(f"{API_URL}/family/create-or-join", 
                           json={'role': 'ibu'}, 
                           cookies=cookies)
        family = res.json()['family']
        test_families.append(family['id'])
        print(f"✅ Created Family: {family['id']}")
        
        # Create Child
        res = requests.post(f"{API_URL}/children",
                           json={
                               'nickname': 'Aisyah',
                               'dob': '2018-05-10',
                               'gender': 'female',
                               'avatarId': 'G01'
                           },
                           cookies=cookies)
        child = res.json()['child']
        test_children.append(child['id'])
        print(f"✅ Created Child: {child['nickname']}")
        
        # Create a daily habit
        res = requests.post(f"{API_URL}/children/{child['id']}/habits",
                           json={
                               'title': 'Solat Subuh',
                               'desc': 'Solat Subuh tepat waktu',
                               'category': 'ibadah',
                               'points': 20,
                               'frequency': 'daily',
                               'session': 'subuh',
                               'recurring': 'daily'
                           },
                           cookies=cookies)
        habit = res.json()['habit']
        test_habits.append(habit['id'])
        print(f"✅ Created Habit: {habit['title']}")
        
        print("\n" + "=" * 80)
        print("🧪 STARTING CLAIM TRACKING TESTS")
        print("=" * 80)
        
        # ====================================================================
        # TEST 1: Create claim, verify it shows, then PATCH habit, verify claim still shows
        # ====================================================================
        print("\n📝 TEST 1: Claim tracking after PATCH session field")
        total_tests += 1
        try:
            # Create a claim using the API
            res = requests.post(f"{API_URL}/habits/{habit['id']}/claim",
                               json={'status': 'claimed'},
                               cookies=cookies)
            assert res.status_code == 200, f"Failed to create claim: {res.text}"
            print("   ✓ Created claim via API")
            
            # Verify claim shows in GET
            res = requests.get(f"{API_URL}/children/{child['id']}/habits", cookies=cookies)
            habits = res.json()['habits']
            habit_check = next((h for h in habits if h['id'] == habit['id']), None)
            assert habit_check['todayStatus'] == 'claimed', f"Expected todayStatus='claimed', got {habit_check['todayStatus']}"
            print(f"   ✓ Claim visible: todayStatus={habit_check['todayStatus']}")
            
            # PATCH the habit (change session)
            res = requests.patch(f"{API_URL}/habits/{habit['id']}",
                               json={'session': 'zohor'},
                               cookies=cookies)
            assert res.status_code == 200, f"PATCH failed: {res.text}"
            print("   ✓ PATCH successful (session: subuh → zohor)")
            
            # Verify claim STILL shows after PATCH
            res = requests.get(f"{API_URL}/children/{child['id']}/habits", cookies=cookies)
            habits = res.json()['habits']
            habit_after = next((h for h in habits if h['id'] == habit['id']), None)
            assert habit_after['todayStatus'] == 'claimed', f"Claim lost after PATCH! todayStatus={habit_after['todayStatus']}"
            assert habit_after['session'] == 'zohor', f"Session not updated: {habit_after['session']}"
            print(f"   ✓ Claim preserved after PATCH: todayStatus={habit_after['todayStatus']}")
            
            print("✅ TEST 1 PASSED: Claim tracking intact after PATCH")
            passed_tests += 1
        except AssertionError as e:
            print(f"❌ TEST 1 FAILED: {e}")
        except Exception as e:
            print(f"❌ TEST 1 ERROR: {e}")
        
        # ====================================================================
        # TEST 2: Verify claim, then PATCH recurring field
        # NOTE: When changing daily→perPrayer, old daily claim (session=null) won't show
        # in perPrayer view because perPrayer expects session-specific claims
        # ====================================================================
        print("\n📝 TEST 2: PATCH daily→perPrayer (old claim with session=null not counted)")
        total_tests += 1
        try:
            # Verify the claim (parent-log mode with rubric)
            res = requests.post(f"{API_URL}/habits/{habit['id']}/claim",
                               json={'rubric': 'ihsan', 'note': 'Excellent work!'},
                               cookies=cookies)
            assert res.status_code == 200, f"Failed to verify claim: {res.text}"
            print("   ✓ Verified claim with rubric='ihsan' (1.5x points)")
            
            # Check points awarded (daily mode)
            res = requests.get(f"{API_URL}/children/{child['id']}/habits", cookies=cookies)
            habits = res.json()['habits']
            habit_verified = next((h for h in habits if h['id'] == habit['id']), None)
            expected_points = 30  # 20 * 1.5
            assert habit_verified['pointsAwarded'] == expected_points, f"Expected {expected_points} points, got {habit_verified['pointsAwarded']}"
            print(f"   ✓ Points awarded correctly (daily mode): {habit_verified['pointsAwarded']} (20 * 1.5)")
            
            # PATCH recurring field to perPrayer
            res = requests.patch(f"{API_URL}/habits/{habit['id']}",
                               json={'recurring': 'perPrayer'},
                               cookies=cookies)
            assert res.status_code == 200, f"PATCH failed: {res.text}"
            print("   ✓ PATCH successful (recurring: daily → perPrayer)")
            
            # After PATCH to perPrayer, old daily claim (session=null) won't be counted
            # because perPrayer logic only looks at claims with session field
            res = requests.get(f"{API_URL}/children/{child['id']}/habits", cookies=cookies)
            habits = res.json()['habits']
            habit_after = next((h for h in habits if h['id'] == habit['id']), None)
            
            # Expected behavior: pointsAwarded becomes null because perPrayer expects session-specific claims
            # The old claim still exists in DB but isn't displayed in perPrayer view
            assert habit_after['pointsAwarded'] is None or habit_after['pointsAwarded'] == 0, \
                f"Expected null/0 points (no session-specific claims), got {habit_after['pointsAwarded']}"
            assert habit_after['recurring'] == 'perPrayer', f"Recurring not updated: {habit_after['recurring']}"
            print(f"   ✓ Expected behavior: pointsAwarded={habit_after['pointsAwarded']} (old daily claim not counted in perPrayer view)")
            print(f"   ℹ️  Note: Old claim still exists in DB but perPrayer logic requires session-specific claims")
            
            # Verify the old claim still exists in DB (not deleted)
            old_claim = db.habit_claims.find_one({'habitId': habit['id'], 'session': None})
            assert old_claim is not None, "Old daily claim was deleted (should be preserved)"
            print(f"   ✓ Old daily claim preserved in DB (session=null)")
            
            print("✅ TEST 2 PASSED: PATCH daily→perPrayer behavior correct (old claim preserved but not counted)")
            passed_tests += 1
        except AssertionError as e:
            print(f"❌ TEST 2 FAILED: {e}")
        except Exception as e:
            print(f"❌ TEST 2 ERROR: {e}")
        
        # ====================================================================
        # TEST 3: PATCH perPrayer habit with multiple session claims
        # ====================================================================
        print("\n📝 TEST 3: PerPrayer habit with multiple session claims after PATCH")
        total_tests += 1
        try:
            # Create another habit as perPrayer
            res = requests.post(f"{API_URL}/children/{child['id']}/habits",
                               json={
                                   'title': 'Wudhu',
                                   'desc': 'Wudhu sebelum solat',
                                   'category': 'ibadah',
                                   'points': 10,
                                   'frequency': 'daily',
                                   'session': 'subuh',
                                   'recurring': 'perPrayer'
                               },
                               cookies=cookies)
            habit2 = res.json()['habit']
            test_habits.append(habit2['id'])
            print(f"   ✓ Created perPrayer habit: {habit2['title']}")
            
            # Create claims for 3 different sessions
            for session in ['subuh', 'zohor', 'asar']:
                res = requests.post(f"{API_URL}/habits/{habit2['id']}/claim",
                                   json={'rubric': 'sah', 'session': session},
                                   cookies=cookies)
                assert res.status_code == 200, f"Failed to claim {session}: {res.text}"
                print(f"   ✓ Claimed session: {session}")
            
            # Verify all 3 sessions show
            res = requests.get(f"{API_URL}/children/{child['id']}/habits", cookies=cookies)
            habits = res.json()['habits']
            habit2_check = next((h for h in habits if h['id'] == habit2['id']), None)
            assert 'sessionsClaimed' in habit2_check, "sessionsClaimed field missing"
            assert len(habit2_check['sessionsClaimed']) == 3, f"Expected 3 sessions, got {len(habit2_check['sessionsClaimed'])}"
            assert habit2_check['pointsAwarded'] == 30, f"Expected 30 points (10*3), got {habit2_check['pointsAwarded']}"
            print(f"   ✓ All 3 sessions claimed: {habit2_check['sessionsClaimed']}")
            print(f"   ✓ Total points: {habit2_check['pointsAwarded']}")
            
            # PATCH the habit (change points)
            res = requests.patch(f"{API_URL}/habits/{habit2['id']}",
                               json={'points': 15},
                               cookies=cookies)
            assert res.status_code == 200, f"PATCH failed: {res.text}"
            print("   ✓ PATCH successful (points: 10 → 15)")
            
            # Verify existing claims NOT affected (they keep original points)
            res = requests.get(f"{API_URL}/children/{child['id']}/habits", cookies=cookies)
            habits = res.json()['habits']
            habit2_after = next((h for h in habits if h['id'] == habit2['id']), None)
            assert len(habit2_after['sessionsClaimed']) == 3, f"Sessions lost! Got {len(habit2_after['sessionsClaimed'])}"
            # Existing claims keep their original pointsAwarded (10 each = 30 total)
            assert habit2_after['pointsAwarded'] == 30, f"Points changed! Expected 30, got {habit2_after['pointsAwarded']}"
            print(f"   ✓ Sessions preserved: {habit2_after['sessionsClaimed']}")
            print(f"   ✓ Points unchanged (existing claims): {habit2_after['pointsAwarded']}")
            
            print("✅ TEST 3 PASSED: PerPrayer claims intact after PATCH")
            passed_tests += 1
        except AssertionError as e:
            print(f"❌ TEST 3 FAILED: {e}")
        except Exception as e:
            print(f"❌ TEST 3 ERROR: {e}")
        
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
            print("\n🎉 ALL CLAIM TRACKING TESTS PASSED!")
            print("✅ PATCH operations do NOT break claim tracking")
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
