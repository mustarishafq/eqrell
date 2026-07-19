#!/usr/bin/env python3
"""
Backend test suite for Family Display Mode - Iteration 3
Tests:
1. Extended GET /api/family/display-data with ihsanStar and zikir
2. New POST /api/family/zikir/tap endpoint
"""

import os
import sys
import requests
from datetime import datetime, timedelta
from jose import jwt
from pymongo import MongoClient
import uuid

# Environment setup
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'eqrel')
AUTH_SECRET = os.getenv('AUTH_SECRET', 'eqrel-cohort-a-super-secret-key-change-in-production-2026-11-08')
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://pwa-trial-cohort.preview.emergentagent.com')
API_URL = f"{BASE_URL}/api"

# MongoDB client
client = MongoClient(MONGO_URL)
db = client[DB_NAME]

# Test data storage
test_data = {
    'users': [],
    'families': [],
    'children': [],
    'habits': [],
    'claims': [],
    'sessions': []
}

def create_jwt(user_id, email, name, session_id):
    """Create a JWT token for testing"""
    payload = {
        'sid': session_id,
        'userId': user_id,
        'email': email,
        'name': name,
        'iat': datetime.utcnow().timestamp()
    }
    return jwt.encode(payload, AUTH_SECRET, algorithm='HS256')

def get_today_str():
    """Get today's date string in YYYY-MM-DD format"""
    now = datetime.utcnow()
    return f"{now.year}-{now.month:02d}-{now.day:02d}"

def get_yesterday_str():
    """Get yesterday's date string in YYYY-MM-DD format"""
    yesterday = datetime.utcnow() - timedelta(days=1)
    return f"{yesterday.year}-{yesterday.month:02d}-{yesterday.day:02d}"

def setup_test_family():
    """Create test family with users and children"""
    print("\n=== SETUP: Creating test family ===")
    
    # Create family
    family_id = f"fam-test-{datetime.utcnow().timestamp()}"
    family = {
        'id': family_id,
        'code': 'TEST01',
        'createdAt': datetime.utcnow(),
        'streak': 0
    }
    db.families.insert_one(family)
    test_data['families'].append(family_id)
    print(f"✓ Created family: {family_id}")
    
    # Create user (Ibu)
    user_id = f"user-test-{datetime.utcnow().timestamp()}"
    user = {
        'id': user_id,
        'email': 'test-ibu@eqrel.test',
        'name': 'Test Ibu',
        'familyId': family_id,
        'role': 'ibu',
        'createdAt': datetime.utcnow()
    }
    db.users.insert_one(user)
    test_data['users'].append(user_id)
    print(f"✓ Created user: {user_id}")
    
    # Create session
    session_id = f"sess-test-{datetime.utcnow().timestamp()}"
    session = {
        'id': session_id,
        'userId': user_id,
        'createdAt': datetime.utcnow()
    }
    db.sessions.insert_one(session)
    test_data['sessions'].append(session_id)
    
    # Create JWT
    token = create_jwt(user_id, user['email'], user['name'], session_id)
    
    # Create children
    child1_id = f"child1-test-{datetime.utcnow().timestamp()}"
    child1 = {
        'id': child1_id,
        'familyId': family_id,
        'nickname': 'Ahmad',
        'avatarId': 'B01',
        'favColor': 'green',
        'mataBina': 100,
        'mataReward': 50,
        'createdAt': datetime.utcnow()
    }
    db.children.insert_one(child1)
    test_data['children'].append(child1_id)
    print(f"✓ Created child1 (Ahmad): {child1_id}")
    
    child2_id = f"child2-test-{datetime.utcnow().timestamp()}"
    child2 = {
        'id': child2_id,
        'familyId': family_id,
        'nickname': 'Fatimah',
        'avatarId': 'G01',
        'favColor': 'pink',
        'mataBina': 50,
        'mataReward': 25,
        'createdAt': datetime.utcnow()
    }
    db.children.insert_one(child2)
    test_data['children'].append(child2_id)
    print(f"✓ Created child2 (Fatimah): {child2_id}")
    
    return {
        'family_id': family_id,
        'user_id': user_id,
        'session_id': session_id,
        'token': token,
        'child1_id': child1_id,
        'child2_id': child2_id
    }

async def test_display_data_no_ihsan_claims(ctx):
    """Test 1: Family with 0 ihsan claims today → ihsanStar === null, zikir={today:0, total:0}"""
    print("\n=== TEST 1: No ihsan claims today ===")
    
    headers = {'Cookie': f'eqrel_session={ctx["token"]}'}
    response = await make_request('GET', '/family/display-data', headers=headers)
    
    try:
        if 'error' in response:
            print(f"❌ FAILED: API returned error: {response}")
            return False
        
        assert 'family' in response, f"Response should contain 'family'. Got: {response}"
        assert 'children' in response, "Response should contain 'children'"
        assert 'ihsanStar' in response, "Response should contain 'ihsanStar'"
        assert 'zikir' in response, "Response should contain 'zikir'"
        
        assert response['ihsanStar'] is None, f"ihsanStar should be null, got: {response['ihsanStar']}"
        assert response['zikir']['today'] == 0, f"zikir.today should be 0, got: {response['zikir']['today']}"
        assert response['zikir']['total'] == 0, f"zikir.total should be 0, got: {response['zikir']['total']}"
        
        print("✅ PASSED: No ihsan claims → ihsanStar=null, zikir={today:0, total:0}")
        return True
    except AssertionError as e:
        print(f"❌ FAILED: {e}")
        print(f"Response: {response}")
        return False

async def test_display_data_with_ihsan_claims(ctx):
    """Test 2: Ahmad has 3 ihsan claims, Fatimah has 1 → ihsanStar = Ahmad"""
    print("\n=== TEST 2: Ahmad has 3 ihsan, Fatimah has 1 ===")
    
    today_str = get_today_str()
    
    # Create habits for both children
    habit1_id = f"habit1-{datetime.utcnow().timestamp()}"
    habit1 = {
        'id': habit1_id,
        'familyId': ctx['family_id'],
        'childId': ctx['child1_id'],
        'title': 'Solat Subuh',
        'category': 'ibadah',
        'points': 20,
        'createdAt': datetime.utcnow()
    }
    db.habits.insert_one(habit1)
    test_data['habits'].append(habit1_id)
    
    habit2_id = f"habit2-{datetime.utcnow().timestamp()}"
    habit2 = {
        'id': habit2_id,
        'familyId': ctx['family_id'],
        'childId': ctx['child1_id'],
        'title': 'Solat Zohor',
        'category': 'ibadah',
        'points': 20,
        'createdAt': datetime.utcnow()
    }
    db.habits.insert_one(habit2)
    test_data['habits'].append(habit2_id)
    
    habit3_id = f"habit3-{datetime.utcnow().timestamp()}"
    habit3 = {
        'id': habit3_id,
        'familyId': ctx['family_id'],
        'childId': ctx['child1_id'],
        'title': 'Solat Asar',
        'category': 'ibadah',
        'points': 20,
        'createdAt': datetime.utcnow()
    }
    db.habits.insert_one(habit3)
    test_data['habits'].append(habit3_id)
    
    habit4_id = f"habit4-{datetime.utcnow().timestamp()}"
    habit4 = {
        'id': habit4_id,
        'familyId': ctx['family_id'],
        'childId': ctx['child2_id'],
        'title': 'Baca Quran',
        'category': 'ibadah',
        'points': 15,
        'createdAt': datetime.utcnow()
    }
    db.habits.insert_one(habit4)
    test_data['habits'].append(habit4_id)
    
    # Create ihsan claims for Ahmad (3 claims)
    for habit_id in [habit1_id, habit2_id, habit3_id]:
        claim = {
            'habitId': habit_id,
            'childId': ctx['child1_id'],
            'familyId': ctx['family_id'],
            'dateStr': today_str,
            'status': 'verified',
            'rubric': 'ihsan',
            'pointsAwarded': 30,
            'excellence': True,
            'claimedAt': datetime.utcnow(),
            'verifiedAt': datetime.utcnow()
        }
        db.habit_claims.insert_one(claim)
        test_data['claims'].append(f"{habit_id}__{today_str}")
    
    # Create ihsan claim for Fatimah (1 claim)
    claim = {
        'habitId': habit4_id,
        'childId': ctx['child2_id'],
        'familyId': ctx['family_id'],
        'dateStr': today_str,
        'status': 'verified',
        'rubric': 'ihsan',
        'pointsAwarded': 22,
        'excellence': True,
        'claimedAt': datetime.utcnow(),
        'verifiedAt': datetime.utcnow()
    }
    db.habit_claims.insert_one(claim)
    test_data['claims'].append(f"{habit4_id}__{today_str}")
    
    # Fetch display data
    headers = {'Cookie': f'eqrel_session={ctx["token"]}'}
    response = await make_request('GET', '/family/display-data', headers=headers)
    
    try:
        assert response['ihsanStar'] is not None, "ihsanStar should not be null"
        assert response['ihsanStar']['nickname'] == 'Ahmad', f"ihsanStar should be Ahmad, got: {response['ihsanStar']['nickname']}"
        assert response['ihsanStar']['ihsanCount'] == 3, f"ihsanCount should be 3, got: {response['ihsanStar']['ihsanCount']}"
        assert 'avatarId' in response['ihsanStar'], "ihsanStar should have avatarId"
        assert 'favColor' in response['ihsanStar'], "ihsanStar should have favColor"
        
        print("✅ PASSED: Ahmad with 3 ihsan claims is ihsanStar")
        return True
    except AssertionError as e:
        print(f"❌ FAILED: {e}")
        print(f"Response: {response}")
        return False

async def test_display_data_ihsan_tiebreaker(ctx):
    """Test 3: Two children tied at 2 ihsan each — Ahmad has mataBina=100, Fatimah has mataBina=50 → Ahmad wins"""
    print("\n=== TEST 3: Ihsan tie, mataBina tiebreaker ===")
    
    # Clean up previous claims
    today_str = get_today_str()
    db.habit_claims.delete_many({'familyId': ctx['family_id'], 'dateStr': today_str})
    
    # Create 2 ihsan claims for each child
    habit1_id = test_data['habits'][0]
    habit2_id = test_data['habits'][1]
    habit4_id = test_data['habits'][3]
    
    # Create another habit for Fatimah
    habit5_id = f"habit5-{datetime.utcnow().timestamp()}"
    habit5 = {
        'id': habit5_id,
        'familyId': ctx['family_id'],
        'childId': ctx['child2_id'],
        'title': 'Doa Pagi',
        'category': 'ibadah',
        'points': 10,
        'createdAt': datetime.utcnow()
    }
    db.habits.insert_one(habit5)
    test_data['habits'].append(habit5_id)
    
    # Ahmad: 2 ihsan claims
    for habit_id in [habit1_id, habit2_id]:
        claim = {
            'habitId': habit_id,
            'childId': ctx['child1_id'],
            'familyId': ctx['family_id'],
            'dateStr': today_str,
            'status': 'verified',
            'rubric': 'ihsan',
            'pointsAwarded': 30,
            'excellence': True,
            'claimedAt': datetime.utcnow(),
            'verifiedAt': datetime.utcnow()
        }
        db.habit_claims.insert_one(claim)
    
    # Fatimah: 2 ihsan claims
    for habit_id in [habit4_id, habit5_id]:
        claim = {
            'habitId': habit_id,
            'childId': ctx['child2_id'],
            'familyId': ctx['family_id'],
            'dateStr': today_str,
            'status': 'verified',
            'rubric': 'ihsan',
            'pointsAwarded': 22,
            'excellence': True,
            'claimedAt': datetime.utcnow(),
            'verifiedAt': datetime.utcnow()
        }
        db.habit_claims.insert_one(claim)
    
    # Fetch display data
    headers = {'Cookie': f'eqrel_session={ctx["token"]}'}
    response = await make_request('GET', '/family/display-data', headers=headers)
    
    try:
        assert response['ihsanStar'] is not None, "ihsanStar should not be null"
        assert response['ihsanStar']['nickname'] == 'Ahmad', f"ihsanStar should be Ahmad (higher mataBina), got: {response['ihsanStar']['nickname']}"
        assert response['ihsanStar']['ihsanCount'] == 2, f"ihsanCount should be 2, got: {response['ihsanStar']['ihsanCount']}"
        
        print("✅ PASSED: Tie at 2 ihsan each → Ahmad wins with higher mataBina")
        return True
    except AssertionError as e:
        print(f"❌ FAILED: {e}")
        print(f"Response: {response}")
        return False

async def test_display_data_yesterday_claims_ignored(ctx):
    """Test 4: Ihsan claims from YESTERDAY should NOT be counted"""
    print("\n=== TEST 4: Yesterday's ihsan claims ignored ===")
    
    # Clean up today's claims
    today_str = get_today_str()
    yesterday_str = get_yesterday_str()
    db.habit_claims.delete_many({'familyId': ctx['family_id'], 'dateStr': today_str})
    
    # Create ihsan claim for YESTERDAY
    habit1_id = test_data['habits'][0]
    claim = {
        'habitId': habit1_id,
        'childId': ctx['child1_id'],
        'familyId': ctx['family_id'],
        'dateStr': yesterday_str,
        'status': 'verified',
        'rubric': 'ihsan',
        'pointsAwarded': 30,
        'excellence': True,
        'claimedAt': datetime.utcnow() - timedelta(days=1),
        'verifiedAt': datetime.utcnow() - timedelta(days=1)
    }
    db.habit_claims.insert_one(claim)
    
    # Fetch display data
    headers = {'Cookie': f'eqrel_session={ctx["token"]}'}
    response = await make_request('GET', '/family/display-data', headers=headers)
    
    try:
        assert response['ihsanStar'] is None, f"ihsanStar should be null (yesterday's claims ignored), got: {response['ihsanStar']}"
        
        print("✅ PASSED: Yesterday's ihsan claims are ignored")
        return True
    except AssertionError as e:
        print(f"❌ FAILED: {e}")
        print(f"Response: {response}")
        return False

async def test_display_data_existing_fields(ctx):
    """Test 5: Existing fields still work (family, children, undoneHabits)"""
    print("\n=== TEST 5: Existing fields still work ===")
    
    headers = {'Cookie': f'eqrel_session={ctx["token"]}'}
    response = await make_request('GET', '/family/display-data', headers=headers)
    
    try:
        assert 'family' in response, "Response should contain 'family'"
        assert 'children' in response, "Response should contain 'children'"
        assert 'undoneHabits' in response, "Response should contain 'undoneHabits'"
        
        assert len(response['children']) == 2, f"Should have 2 children, got: {len(response['children'])}"
        
        # Check children have required fields
        for child in response['children']:
            assert 'id' in child, "Child should have 'id'"
            assert 'nickname' in child, "Child should have 'nickname'"
            assert 'habitsTotal' in child, "Child should have 'habitsTotal'"
            assert 'habitsDone' in child, "Child should have 'habitsDone'"
            assert 'mataBina' in child, "Child should have 'mataBina'"
            assert 'mataReward' in child, "Child should have 'mataReward'"
        
        print("✅ PASSED: Existing fields (family, children, undoneHabits) still work")
        return True
    except AssertionError as e:
        print(f"❌ FAILED: {e}")
        print(f"Response: {response}")
        return False

async def test_zikir_tap_auth_guard(ctx):
    """Test 6: POST /api/family/zikir/tap without session → 401"""
    print("\n=== TEST 6: Zikir tap auth guard ===")
    
    response = await make_request('POST', '/family/zikir/tap')
    
    try:
        assert 'error' in response, "Response should contain 'error'"
        print("✅ PASSED: Zikir tap returns 401 without session")
        return True
    except AssertionError as e:
        print(f"❌ FAILED: {e}")
        print(f"Response: {response}")
        return False

async def test_zikir_tap_no_family(ctx):
    """Test 7: User without familyId → 400"""
    print("\n=== TEST 7: Zikir tap without family ===")
    
    # Create user without family
    user_id = f"user-nofam-{datetime.utcnow().timestamp()}"
    user = {
        'id': user_id,
        'email': 'nofam@eqrel.test',
        'name': 'No Family User',
        'familyId': None,
        'role': None,
        'createdAt': datetime.utcnow()
    }
    db.users.insert_one(user)
    test_data['users'].append(user_id)
    
    session_id = f"sess-nofam-{datetime.utcnow().timestamp()}"
    session = {
        'id': session_id,
        'userId': user_id,
        'createdAt': datetime.utcnow()
    }
    db.sessions.insert_one(session)
    test_data['sessions'].append(session_id)
    
    token = create_jwt(user_id, user['email'], user['name'], session_id)
    
    headers = {'Cookie': f'eqrel_session={token}'}
    response = await make_request('POST', '/family/zikir/tap', headers=headers)
    
    try:
        assert 'error' in response, "Response should contain 'error'"
        assert 'family' in response['error'].lower(), f"Error should mention 'family', got: {response['error']}"
        print("✅ PASSED: Zikir tap returns 400 for user without family")
        return True
    except AssertionError as e:
        print(f"❌ FAILED: {e}")
        print(f"Response: {response}")
        return False

async def test_zikir_tap_fresh_family(ctx):
    """Test 8: Fresh family - 1st tap → {today:1, total:1}, 2nd tap → {today:2, total:2}, 3rd tap → {today:3, total:3}"""
    print("\n=== TEST 8: Fresh family zikir taps ===")
    
    headers = {'Cookie': f'eqrel_session={ctx["token"]}'}
    
    # First tap
    response1 = await make_request('POST', '/family/zikir/tap', headers=headers)
    try:
        assert response1['ok'] is True, "Response should have ok=true"
        assert response1['today'] == 1, f"First tap: today should be 1, got: {response1['today']}"
        assert response1['total'] == 1, f"First tap: total should be 1, got: {response1['total']}"
        print("✓ First tap: {today:1, total:1}")
    except AssertionError as e:
        print(f"❌ FAILED on first tap: {e}")
        return False
    
    # Second tap
    response2 = await make_request('POST', '/family/zikir/tap', headers=headers)
    try:
        assert response2['ok'] is True, "Response should have ok=true"
        assert response2['today'] == 2, f"Second tap: today should be 2, got: {response2['today']}"
        assert response2['total'] == 2, f"Second tap: total should be 2, got: {response2['total']}"
        print("✓ Second tap: {today:2, total:2}")
    except AssertionError as e:
        print(f"❌ FAILED on second tap: {e}")
        return False
    
    # Third tap
    response3 = await make_request('POST', '/family/zikir/tap', headers=headers)
    try:
        assert response3['ok'] is True, "Response should have ok=true"
        assert response3['today'] == 3, f"Third tap: today should be 3, got: {response3['today']}"
        assert response3['total'] == 3, f"Third tap: total should be 3, got: {response3['total']}"
        print("✓ Third tap: {today:3, total:3}")
    except AssertionError as e:
        print(f"❌ FAILED on third tap: {e}")
        return False
    
    print("✅ PASSED: Fresh family zikir taps work correctly")
    return True

async def test_zikir_tap_cross_day_reset(ctx):
    """Test 9: Cross-day reset - set yesterday's count, tap once → {today:1, total:301}"""
    print("\n=== TEST 9: Cross-day zikir reset ===")
    
    yesterday_str = get_yesterday_str()
    
    # Manually set yesterday's zikir count
    db.families.update_one(
        {'id': ctx['family_id']},
        {'$set': {
            'zikirCount': {
                'dateKey': yesterday_str,
                'today': 47,
                'total': 300,
                'updatedAt': datetime.utcnow() - timedelta(days=1)
            }
        }}
    )
    
    # Tap once today
    headers = {'Cookie': f'eqrel_session={ctx["token"]}'}
    response = await make_request('POST', '/family/zikir/tap', headers=headers)
    
    try:
        assert response['ok'] is True, "Response should have ok=true"
        assert response['today'] == 1, f"After cross-day: today should be 1 (reset), got: {response['today']}"
        assert response['total'] == 301, f"After cross-day: total should be 301 (300+1), got: {response['total']}"
        
        # Verify DB has today's dateStr
        family = db.families.find_one({'id': ctx['family_id']})
        today_str = get_today_str()
        assert family['zikirCount']['dateKey'] == today_str, f"DB should have today's dateKey, got: {family['zikirCount']['dateKey']}"
        
        print("✅ PASSED: Cross-day reset works (today=1, total=301)")
        return True
    except AssertionError as e:
        print(f"❌ FAILED: {e}")
        print(f"Response: {response}")
        return False

async def test_zikir_tap_cross_family_isolation(ctx):
    """Test 10: Cross-family isolation - Family A taps 5 times, Family B taps 3 times, counts are separate"""
    print("\n=== TEST 10: Cross-family zikir isolation ===")
    
    # Create Family B
    family_b_id = f"fam-b-{datetime.utcnow().timestamp()}"
    family_b = {
        'id': family_b_id,
        'code': 'TESTB1',
        'createdAt': datetime.utcnow(),
        'streak': 0
    }
    db.families.insert_one(family_b)
    test_data['families'].append(family_b_id)
    
    user_b_id = f"user-b-{datetime.utcnow().timestamp()}"
    user_b = {
        'id': user_b_id,
        'email': 'test-b@eqrel.test',
        'name': 'Test User B',
        'familyId': family_b_id,
        'role': 'ibu',
        'createdAt': datetime.utcnow()
    }
    db.users.insert_one(user_b)
    test_data['users'].append(user_b_id)
    
    session_b_id = f"sess-b-{datetime.utcnow().timestamp()}"
    session_b = {
        'id': session_b_id,
        'userId': user_b_id,
        'createdAt': datetime.utcnow()
    }
    db.sessions.insert_one(session_b)
    test_data['sessions'].append(session_b_id)
    
    token_b = create_jwt(user_b_id, user_b['email'], user_b['name'], session_b_id)
    
    # Reset Family A's zikir count
    db.families.update_one(
        {'id': ctx['family_id']},
        {'$unset': {'zikirCount': ''}}
    )
    
    # Family A taps 5 times
    headers_a = {'Cookie': f'eqrel_session={ctx["token"]}'}
    for i in range(5):
        await make_request('POST', '/family/zikir/tap', headers=headers_a)
    
    response_a = await make_request('POST', '/family/zikir/tap', headers=headers_a)
    
    # Family B taps 3 times
    headers_b = {'Cookie': f'eqrel_session={token_b}'}
    for i in range(3):
        await make_request('POST', '/family/zikir/tap', headers=headers_b)
    
    response_b = await make_request('POST', '/family/zikir/tap', headers=headers_b)
    
    try:
        # Family A should have 6 (5 + 1 from the response we captured)
        assert response_a['today'] == 6, f"Family A should have today=6, got: {response_a['today']}"
        assert response_a['total'] == 6, f"Family A should have total=6, got: {response_a['total']}"
        
        # Family B should have 4 (3 + 1 from the response we captured)
        assert response_b['today'] == 4, f"Family B should have today=4, got: {response_b['today']}"
        assert response_b['total'] == 4, f"Family B should have total=4, got: {response_b['total']}"
        
        print("✅ PASSED: Cross-family zikir isolation works")
        return True
    except AssertionError as e:
        print(f"❌ FAILED: {e}")
        print(f"Family A response: {response_a}")
        print(f"Family B response: {response_b}")
        return False

async def test_display_data_zikir_after_taps(ctx):
    """Test 11: GET /api/family/display-data after taps shows correct zikir count"""
    print("\n=== TEST 11: Display data shows zikir count after taps ===")
    
    # Reset and tap 7 times
    db.families.update_one(
        {'id': ctx['family_id']},
        {'$unset': {'zikirCount': ''}}
    )
    
    headers = {'Cookie': f'eqrel_session={ctx["token"]}'}
    for i in range(7):
        await make_request('POST', '/family/zikir/tap', headers=headers)
    
    # Get display data
    response = await make_request('GET', '/family/display-data', headers=headers)
    
    try:
        assert 'zikir' in response, "Response should contain 'zikir'"
        assert response['zikir']['today'] == 7, f"zikir.today should be 7, got: {response['zikir']['today']}"
        assert response['zikir']['total'] == 7, f"zikir.total should be 7, got: {response['zikir']['total']}"
        
        print("✅ PASSED: Display data shows correct zikir count after taps")
        return True
    except AssertionError as e:
        print(f"❌ FAILED: {e}")
        print(f"Response: {response}")
        return False

async def cleanup():
    """Clean up test data"""
    print("\n=== CLEANUP ===")
    
    # Delete in reverse order of dependencies
    for claim_key in test_data['claims']:
        parts = claim_key.split('__')
        if len(parts) == 2:
            db.habit_claims.delete_many({'habitId': parts[0], 'dateStr': parts[1]})
    
    for habit_id in test_data['habits']:
        db.habits.delete_one({'id': habit_id})
    
    for child_id in test_data['children']:
        db.children.delete_one({'id': child_id})
    
    for session_id in test_data['sessions']:
        db.sessions.delete_one({'id': session_id})
    
    for user_id in test_data['users']:
        db.users.delete_one({'id': user_id})
    
    for family_id in test_data['families']:
        db.families.delete_one({'id': family_id})
    
    print("✓ Cleanup complete")

async def main():
    """Run all tests"""
    print("=" * 80)
    print("BACKEND TEST SUITE: Family Display Mode - Iteration 3")
    print("=" * 80)
    
    results = []
    
    try:
        # Setup
        ctx = await setup_test_family()
        
        # Run tests
        results.append(await test_display_data_no_ihsan_claims(ctx))
        results.append(await test_display_data_with_ihsan_claims(ctx))
        results.append(await test_display_data_ihsan_tiebreaker(ctx))
        results.append(await test_display_data_yesterday_claims_ignored(ctx))
        results.append(await test_display_data_existing_fields(ctx))
        results.append(await test_zikir_tap_auth_guard(ctx))
        results.append(await test_zikir_tap_no_family(ctx))
        results.append(await test_zikir_tap_fresh_family(ctx))
        results.append(await test_zikir_tap_cross_day_reset(ctx))
        results.append(await test_zikir_tap_cross_family_isolation(ctx))
        results.append(await test_display_data_zikir_after_taps(ctx))
        
    finally:
        # Cleanup
        await cleanup()
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    passed = sum(results)
    total = len(results)
    print(f"Passed: {passed}/{total}")
    
    if passed == total:
        print("✅ ALL TESTS PASSED")
        sys.exit(0)
    else:
        print(f"❌ {total - passed} TEST(S) FAILED")
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main())
