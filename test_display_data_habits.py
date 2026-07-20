#!/usr/bin/env python3
"""
Backend Test Suite for GET /api/family/display-data with habits[] array
Tests the new per-child habits array with status determination logic
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
        'family_id': family_id
    }

def create_test_family(family_name="Test Family"):
    """Create a test family in MongoDB"""
    family_id = str(uuid.uuid4())
    family_code = ''.join([chr(ord('A') + (i % 26)) for i in range(6)])
    
    family = {
        'id': family_id,
        'familyName': family_name,
        'familyCode': family_code,
        'createdAt': datetime.utcnow()
    }
    db.families.insert_one(family)
    test_families.append(family_id)
    
    return family_id, family_code

def create_test_child(family_id, nickname, avatar_id="B01", fav_color="blue"):
    """Create a test child in MongoDB"""
    child_id = str(uuid.uuid4())
    
    child = {
        'id': child_id,
        'familyId': family_id,
        'nickname': nickname,
        'avatarId': avatar_id,
        'favColor': fav_color,
        'mataBina': 0,
        'mataReward': 0,
        'createdAt': datetime.utcnow()
    }
    db.children.insert_one(child)
    test_children.append(child_id)
    
    return child_id

def create_test_habit(child_id, title, category="ibadah", icon="🕌", points=10):
    """Create a test habit in MongoDB"""
    habit_id = str(uuid.uuid4())
    
    habit = {
        'id': habit_id,
        'childId': child_id,
        'title': title,
        'category': category,
        'icon': icon,
        'points': points,
        'i18n': {'ms': title, 'en': title, 'id': title, 'ar': title},
        'createdAt': datetime.utcnow()
    }
    db.habits.insert_one(habit)
    test_habits.append(habit_id)
    
    return habit_id

def create_test_claim(habit_id, child_id, date_str, status='verified', rubric='sah', points=10):
    """Create a test habit claim in MongoDB"""
    claim = {
        'habitId': habit_id,
        'childId': child_id,
        'dateStr': date_str,
        'status': status,
        'rubric': rubric,
        'pointsAwarded': points,
        'claimedAt': datetime.utcnow(),
        'claimedBy': 'test-user',
        'verifiedAt': datetime.utcnow() if status == 'verified' else None,
        'verifiedBy': 'test-parent' if status == 'verified' else None
    }
    db.habit_claims.insert_one(claim)
    test_claims.append(f"{habit_id}__{date_str}")
    
    return claim

def get_today_date_str():
    """Get today's date in YYYY-MM-DD format"""
    now = datetime.utcnow()
    return f"{now.year}-{str(now.month).zfill(2)}-{str(now.day).zfill(2)}"

def get_yesterday_date_str():
    """Get yesterday's date in YYYY-MM-DD format"""
    yesterday = datetime.utcnow() - timedelta(days=1)
    return f"{yesterday.year}-{str(yesterday.month).zfill(2)}-{str(yesterday.day).zfill(2)}"

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
    
    # Delete test claims
    if test_claims:
        # Claims use composite key, so we need to delete by habitId
        result = db.habit_claims.delete_many({'habitId': {'$in': test_habits}})
        print(f"   Deleted {result.deleted_count} test claims")
    
    print("✅ Cleanup complete\n")

def run_tests():
    """Run all test scenarios"""
    print("=" * 80)
    print("🧪 Testing GET /api/family/display-data with habits[] array")
    print("=" * 80)
    
    test_count = 0
    passed_count = 0
    
    try:
        today = get_today_date_str()
        yesterday = get_yesterday_date_str()
        
        # ============================================================
        # TEST 1: Auth guard - 401 without session
        # ============================================================
        test_count += 1
        print(f"\n[TEST {test_count}] Auth guard - GET without session should return 401")
        try:
            response = requests.get(f"{API_URL}/family/display-data")
            assert response.status_code == 401, f"Expected 401, got {response.status_code}"
            print("✅ PASSED - Returns 401 without session")
            passed_count += 1
        except AssertionError as e:
            print(f"❌ FAILED - {e}")
        except Exception as e:
            print(f"❌ ERROR - {e}")
        
        # ============================================================
        # SETUP: Create Family A with 2 children
        # ============================================================
        print("\n" + "=" * 80)
        print("📦 SETUP: Creating Family A with 2 children and varied habits")
        print("=" * 80)
        
        family_a_id, family_a_code = create_test_family("Family A")
        print(f"✓ Created Family A: {family_a_id}")
        
        user_a = create_test_user_with_session("parent-a@test.com", "Parent A", family_a_id, "ibu")
        print(f"✓ Created Parent A: {user_a['user_id']}")
        
        # Child A1: 3 habits (1 ihsan, 1 sah, 1 no claim)
        child_a1_id = create_test_child(family_a_id, "Adam", "B01", "blue")
        print(f"✓ Created Child A1 (Adam): {child_a1_id}")
        
        habit_a1_1 = create_test_habit(child_a1_id, "Solat Subuh", "ibadah", "🕌", 20)
        habit_a1_2 = create_test_habit(child_a1_id, "Baca Quran", "ibadah", "📖", 15)
        habit_a1_3 = create_test_habit(child_a1_id, "Tolong Ibu", "akhlak", "🤝", 10)
        print(f"✓ Created 3 habits for Adam")
        
        # Create claims: ihsan for habit 1, sah for habit 2, no claim for habit 3
        create_test_claim(habit_a1_1, child_a1_id, today, 'verified', 'ihsan', 30)
        create_test_claim(habit_a1_2, child_a1_id, today, 'verified', 'sah', 15)
        print(f"✓ Created claims: 1 ihsan, 1 sah, 1 pending")
        
        # Child A2: 0 habits
        child_a2_id = create_test_child(family_a_id, "Sarah", "G01", "pink")
        print(f"✓ Created Child A2 (Sarah): {child_a2_id} with 0 habits")
        
        # ============================================================
        # SETUP: Create Family B with 2 children (for isolation test)
        # ============================================================
        print("\n" + "=" * 80)
        print("📦 SETUP: Creating Family B with 2 children (isolation test)")
        print("=" * 80)
        
        family_b_id, family_b_code = create_test_family("Family B")
        print(f"✓ Created Family B: {family_b_id}")
        
        user_b = create_test_user_with_session("parent-b@test.com", "Parent B", family_b_id, "bapa")
        print(f"✓ Created Parent B: {user_b['user_id']}")
        
        # Child B1: 3 habits (all with claims)
        child_b1_id = create_test_child(family_b_id, "Bilal", "B02", "green")
        print(f"✓ Created Child B1 (Bilal): {child_b1_id}")
        
        habit_b1_1 = create_test_habit(child_b1_id, "Solat Zohor", "ibadah", "🕌", 20)
        habit_b1_2 = create_test_habit(child_b1_id, "Makan Sayur", "kesihatan", "🥗", 10)
        habit_b1_3 = create_test_habit(child_b1_id, "Belajar", "pembelajaran", "📚", 15)
        print(f"✓ Created 3 habits for Bilal")
        
        create_test_claim(habit_b1_1, child_b1_id, today, 'verified', 'sah', 20)
        create_test_claim(habit_b1_2, child_b1_id, today, 'verified', 'ihsan', 15)
        create_test_claim(habit_b1_3, child_b1_id, today, 'verified', 'sah', 15)
        print(f"✓ Created claims for Bilal: 2 sah, 1 ihsan")
        
        # Child B2: 2 habits (no claims today, but has yesterday's claim)
        child_b2_id = create_test_child(family_b_id, "Fatimah", "G02", "purple")
        print(f"✓ Created Child B2 (Fatimah): {child_b2_id}")
        
        habit_b2_1 = create_test_habit(child_b2_id, "Solat Asar", "ibadah", "🕌", 20)
        habit_b2_2 = create_test_habit(child_b2_id, "Sikat Gigi", "kesihatan", "🪥", 5)
        print(f"✓ Created 2 habits for Fatimah")
        
        # Create yesterday's claim (should not affect today's status)
        create_test_claim(habit_b2_1, child_b2_id, yesterday, 'verified', 'ihsan', 30)
        print(f"✓ Created yesterday's claim for Fatimah (should not affect today)")
        
        # ============================================================
        # TEST 2: Child with 3 habits (1 ihsan, 1 sah, 1 pending)
        # ============================================================
        test_count += 1
        print(f"\n[TEST {test_count}] Child with 3 habits: 1 ihsan + 1 sah + 1 pending")
        try:
            headers = {'Cookie': f'eqrel_session={user_a["token"]}'}
            response = requests.get(f"{API_URL}/family/display-data", headers=headers)
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"
            
            data = response.json()
            assert 'children' in data, "Response missing 'children' field"
            
            # Find Adam (child_a1)
            adam = next((c for c in data['children'] if c['id'] == child_a1_id), None)
            assert adam is not None, "Adam not found in children array"
            
            # Check habits array exists
            assert 'habits' in adam, "Adam missing 'habits' field"
            assert isinstance(adam['habits'], list), "habits should be an array"
            assert len(adam['habits']) == 3, f"Expected 3 habits, got {len(adam['habits'])}"
            
            # Check each habit has required fields
            for habit in adam['habits']:
                assert 'id' in habit, "Habit missing 'id' field"
                assert 'title' in habit, "Habit missing 'title' field"
                assert 'icon' in habit, "Habit missing 'icon' field"
                assert 'category' in habit, "Habit missing 'category' field"
                assert 'i18n' in habit, "Habit missing 'i18n' field"
                assert 'status' in habit, "Habit missing 'status' field"
                assert habit['status'] in ['ihsan', 'done', 'pending'], f"Invalid status: {habit['status']}"
            
            # Check sorting: ihsan first (order 0), pending (order 1), done (order 2)
            statuses = [h['status'] for h in adam['habits']]
            print(f"   Habit statuses: {statuses}")
            
            # Count each status
            ihsan_count = statuses.count('ihsan')
            done_count = statuses.count('done')
            pending_count = statuses.count('pending')
            
            assert ihsan_count == 1, f"Expected 1 ihsan habit, got {ihsan_count}"
            assert done_count == 1, f"Expected 1 done habit, got {done_count}"
            assert pending_count == 1, f"Expected 1 pending habit, got {pending_count}"
            
            # Verify sorting order
            assert statuses[0] == 'ihsan', f"First habit should be ihsan, got {statuses[0]}"
            assert statuses[1] == 'pending', f"Second habit should be pending, got {statuses[1]}"
            assert statuses[2] == 'done', f"Third habit should be done, got {statuses[2]}"
            
            print("✅ PASSED - Adam has 3 habits with correct statuses and sorting")
            passed_count += 1
        except AssertionError as e:
            print(f"❌ FAILED - {e}")
        except Exception as e:
            print(f"❌ ERROR - {e}")
        
        # ============================================================
        # TEST 3: Child with 0 habits
        # ============================================================
        test_count += 1
        print(f"\n[TEST {test_count}] Child with 0 habits - habits array should be empty []")
        try:
            headers = {'Cookie': f'eqrel_session={user_a["token"]}'}
            response = requests.get(f"{API_URL}/family/display-data", headers=headers)
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"
            
            data = response.json()
            
            # Find Sarah (child_a2)
            sarah = next((c for c in data['children'] if c['id'] == child_a2_id), None)
            assert sarah is not None, "Sarah not found in children array"
            
            # Check habits array exists and is empty
            assert 'habits' in sarah, "Sarah missing 'habits' field"
            assert isinstance(sarah['habits'], list), "habits should be an array"
            assert len(sarah['habits']) == 0, f"Expected empty habits array, got {len(sarah['habits'])} habits"
            assert sarah['habits'] == [], "habits should be empty array [], not null or undefined"
            
            print("✅ PASSED - Sarah has empty habits array []")
            passed_count += 1
        except AssertionError as e:
            print(f"❌ FAILED - {e}")
        except Exception as e:
            print(f"❌ ERROR - {e}")
        
        # ============================================================
        # TEST 4: Child with habits but no claims today
        # ============================================================
        test_count += 1
        print(f"\n[TEST {test_count}] Child with habits but no claims today - all status='pending'")
        try:
            headers = {'Cookie': f'eqrel_session={user_b["token"]}'}
            response = requests.get(f"{API_URL}/family/display-data", headers=headers)
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"
            
            data = response.json()
            
            # Find Fatimah (child_b2)
            fatimah = next((c for c in data['children'] if c['id'] == child_b2_id), None)
            assert fatimah is not None, "Fatimah not found in children array"
            
            # Check habits array
            assert 'habits' in fatimah, "Fatimah missing 'habits' field"
            assert len(fatimah['habits']) == 2, f"Expected 2 habits, got {len(fatimah['habits'])}"
            
            # All habits should have status='pending' (yesterday's claim should not affect today)
            for habit in fatimah['habits']:
                assert habit['status'] == 'pending', f"Expected status='pending', got '{habit['status']}'"
            
            print("✅ PASSED - Fatimah has 2 habits, all with status='pending'")
            passed_count += 1
        except AssertionError as e:
            print(f"❌ FAILED - {e}")
        except Exception as e:
            print(f"❌ ERROR - {e}")
        
        # ============================================================
        # TEST 5: Multiple children - no cross-contamination
        # ============================================================
        test_count += 1
        print(f"\n[TEST {test_count}] Multiple children - each has their own habits[] correctly")
        try:
            headers = {'Cookie': f'eqrel_session={user_b["token"]}'}
            response = requests.get(f"{API_URL}/family/display-data", headers=headers)
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"
            
            data = response.json()
            assert len(data['children']) == 2, f"Expected 2 children, got {len(data['children'])}"
            
            # Find Bilal and Fatimah
            bilal = next((c for c in data['children'] if c['id'] == child_b1_id), None)
            fatimah = next((c for c in data['children'] if c['id'] == child_b2_id), None)
            
            assert bilal is not None, "Bilal not found"
            assert fatimah is not None, "Fatimah not found"
            
            # Bilal should have 3 habits
            assert len(bilal['habits']) == 3, f"Bilal should have 3 habits, got {len(bilal['habits'])}"
            
            # Fatimah should have 2 habits
            assert len(fatimah['habits']) == 2, f"Fatimah should have 2 habits, got {len(fatimah['habits'])}"
            
            # Verify no habit IDs overlap
            bilal_habit_ids = set(h['id'] for h in bilal['habits'])
            fatimah_habit_ids = set(h['id'] for h in fatimah['habits'])
            
            assert len(bilal_habit_ids.intersection(fatimah_habit_ids)) == 0, "Habits cross-contaminated between children"
            
            # Verify Bilal's habits have correct statuses (2 done, 1 ihsan)
            bilal_statuses = [h['status'] for h in bilal['habits']]
            assert bilal_statuses.count('ihsan') == 1, f"Bilal should have 1 ihsan, got {bilal_statuses.count('ihsan')}"
            assert bilal_statuses.count('done') == 2, f"Bilal should have 2 done, got {bilal_statuses.count('done')}"
            
            # Verify Fatimah's habits all pending
            fatimah_statuses = [h['status'] for h in fatimah['habits']]
            assert all(s == 'pending' for s in fatimah_statuses), "Fatimah's habits should all be pending"
            
            print("✅ PASSED - Multiple children have their own habits[] with no cross-contamination")
            passed_count += 1
        except AssertionError as e:
            print(f"❌ FAILED - {e}")
        except Exception as e:
            print(f"❌ ERROR - {e}")
        
        # ============================================================
        # TEST 6: Existing fields still present
        # ============================================================
        test_count += 1
        print(f"\n[TEST {test_count}] Existing fields still present in response")
        try:
            headers = {'Cookie': f'eqrel_session={user_a["token"]}'}
            response = requests.get(f"{API_URL}/family/display-data", headers=headers)
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"
            
            data = response.json()
            
            # Check top-level fields
            assert 'family' in data, "Missing 'family' field"
            assert 'children' in data, "Missing 'children' field"
            assert 'undoneHabits' in data, "Missing 'undoneHabits' field (backward compat)"
            assert 'ihsanStar' in data, "Missing 'ihsanStar' field"
            assert 'zikir' in data, "Missing 'zikir' field"
            
            # Check children fields
            for child in data['children']:
                assert 'id' in child, "Child missing 'id'"
                assert 'nickname' in child, "Child missing 'nickname'"
                assert 'avatarId' in child, "Child missing 'avatarId'"
                assert 'favColor' in child, "Child missing 'favColor'"
                assert 'mataBina' in child, "Child missing 'mataBina'"
                assert 'mataReward' in child, "Child missing 'mataReward'"
                assert 'habitsTotal' in child, "Child missing 'habitsTotal'"
                assert 'habitsDone' in child, "Child missing 'habitsDone'"
                assert 'habits' in child, "Child missing 'habits' (new field)"
            
            # Check undoneHabits is an array
            assert isinstance(data['undoneHabits'], list), "undoneHabits should be an array"
            
            # Check zikir structure
            assert 'today' in data['zikir'], "zikir missing 'today'"
            assert 'total' in data['zikir'], "zikir missing 'total'"
            
            print("✅ PASSED - All existing fields present (backward compatible)")
            passed_count += 1
        except AssertionError as e:
            print(f"❌ FAILED - {e}")
        except Exception as e:
            print(f"❌ ERROR - {e}")
        
        # ============================================================
        # TEST 7: Cross-family isolation
        # ============================================================
        test_count += 1
        print(f"\n[TEST {test_count}] Cross-family isolation - Family A habits don't appear in Family B")
        try:
            # Family A should only see their children
            headers_a = {'Cookie': f'eqrel_session={user_a["token"]}'}
            response_a = requests.get(f"{API_URL}/family/display-data", headers=headers_a)
            assert response_a.status_code == 200, f"Expected 200, got {response_a.status_code}"
            data_a = response_a.json()
            
            # Family B should only see their children
            headers_b = {'Cookie': f'eqrel_session={user_b["token"]}'}
            response_b = requests.get(f"{API_URL}/family/display-data", headers=headers_b)
            assert response_b.status_code == 200, f"Expected 200, got {response_b.status_code}"
            data_b = response_b.json()
            
            # Family A should have 2 children (Adam, Sarah)
            assert len(data_a['children']) == 2, f"Family A should have 2 children, got {len(data_a['children'])}"
            family_a_child_ids = set(c['id'] for c in data_a['children'])
            assert child_a1_id in family_a_child_ids, "Adam not in Family A"
            assert child_a2_id in family_a_child_ids, "Sarah not in Family A"
            
            # Family B should have 2 children (Bilal, Fatimah)
            assert len(data_b['children']) == 2, f"Family B should have 2 children, got {len(data_b['children'])}"
            family_b_child_ids = set(c['id'] for c in data_b['children'])
            assert child_b1_id in family_b_child_ids, "Bilal not in Family B"
            assert child_b2_id in family_b_child_ids, "Fatimah not in Family B"
            
            # Verify no overlap
            assert len(family_a_child_ids.intersection(family_b_child_ids)) == 0, "Children cross-contaminated between families"
            
            # Verify habits don't cross families
            all_habit_ids_a = set()
            for child in data_a['children']:
                for habit in child['habits']:
                    all_habit_ids_a.add(habit['id'])
            
            all_habit_ids_b = set()
            for child in data_b['children']:
                for habit in child['habits']:
                    all_habit_ids_b.add(habit['id'])
            
            assert len(all_habit_ids_a.intersection(all_habit_ids_b)) == 0, "Habits cross-contaminated between families"
            
            print("✅ PASSED - Cross-family isolation working correctly")
            passed_count += 1
        except AssertionError as e:
            print(f"❌ FAILED - {e}")
        except Exception as e:
            print(f"❌ ERROR - {e}")
        
        # ============================================================
        # TEST 8: Verify sorting order is correct (ihsan → pending → done)
        # ============================================================
        test_count += 1
        print(f"\n[TEST {test_count}] Verify sorting order: ihsan (0) → pending (1) → done (2)")
        try:
            headers = {'Cookie': f'eqrel_session={user_b["token"]}'}
            response = requests.get(f"{API_URL}/family/display-data", headers=headers)
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"
            
            data = response.json()
            
            # Find Bilal (has 1 ihsan, 2 done)
            bilal = next((c for c in data['children'] if c['id'] == child_b1_id), None)
            assert bilal is not None, "Bilal not found"
            
            statuses = [h['status'] for h in bilal['habits']]
            print(f"   Bilal's habit order: {statuses}")
            
            # First habit should be ihsan
            assert statuses[0] == 'ihsan', f"First habit should be ihsan, got {statuses[0]}"
            
            # Remaining should be done
            assert statuses[1] == 'done', f"Second habit should be done, got {statuses[1]}"
            assert statuses[2] == 'done', f"Third habit should be done, got {statuses[2]}"
            
            print("✅ PASSED - Sorting order correct: ihsan first, then done")
            passed_count += 1
        except AssertionError as e:
            print(f"❌ FAILED - {e}")
        except Exception as e:
            print(f"❌ ERROR - {e}")
        
        # ============================================================
        # SUMMARY
        # ============================================================
        print("\n" + "=" * 80)
        print(f"📊 TEST SUMMARY: {passed_count}/{test_count} tests passed")
        print("=" * 80)
        
        if passed_count == test_count:
            print("🎉 ALL TESTS PASSED!")
            return True
        else:
            print(f"⚠️  {test_count - passed_count} test(s) failed")
            return False
        
    except Exception as e:
        print(f"\n❌ CRITICAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        cleanup_test_data()

if __name__ == "__main__":
    success = run_tests()
    exit(0 if success else 1)
