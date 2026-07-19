#!/usr/bin/env python3
"""
Backend test suite for Reward Proposals API endpoints.
Tests the kid → parent proposal flow for custom rewards.
"""

import os
import sys
import json
import time
from datetime import datetime, timedelta
from pymongo import MongoClient
from jose import jwt
import requests

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

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

def log_test(name, passed, detail=''):
    global tests_passed, tests_failed
    if passed:
        tests_passed += 1
        print(f"✅ PASS: {name}")
        if detail:
            print(f"   {detail}")
    else:
        tests_failed += 1
        print(f"❌ FAIL: {name}")
        if detail:
            print(f"   {detail}")

# ═══════════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def create_jwt_session(user_id, email, name='Test User'):
    """Create a JWT session token signed with AUTH_SECRET"""
    import uuid
    sid = str(uuid.uuid4())
    exp = datetime.utcnow() + timedelta(days=30)
    iat = datetime.utcnow()
    
    payload = {
        'sid': sid,
        'userId': user_id,
        'email': email,
        'name': name,
        'exp': int(exp.timestamp()),
        'iat': int(iat.timestamp())
    }
    
    token = jwt.encode(payload, AUTH_SECRET, algorithm='HS256')
    
    # Insert session into DB
    db.sessions.insert_one({
        'sid': sid,
        'userId': user_id,
        'email': email,
        'expiresAt': exp,
        'createdAt': datetime.utcnow()
    })
    
    return token

def cleanup_test_data():
    """Remove all test data from database"""
    db.users.delete_many({'email': {'$regex': '^test-proposals-'}})
    db.families.delete_many({'code': {'$regex': '^TPROP'}})
    db.children.delete_many({'nickname': {'$regex': '^TestProposalChild'}})
    db.sessions.delete_many({'email': {'$regex': '^test-proposals-'}})
    db.reward_proposals.delete_many({'familyId': {'$regex': '^test-fam-prop'}})
    db.rewards_custom.delete_many({'familyId': {'$regex': '^test-fam-prop'}})
    db.reward_requests.delete_many({'familyId': {'$regex': '^test-fam-prop'}})

# ═══════════════════════════════════════════════════════════════════════════════
# TEST SUITE
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    print("\n" + "="*80)
    print("REWARD PROPOSALS API TEST SUITE")
    print("="*80 + "\n")
    
    # Cleanup before starting
    print("🧹 Cleaning up any existing test data...")
    cleanup_test_data()
    
    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 1: Setup test data
    # ═══════════════════════════════════════════════════════════════════════════
    print("\n📦 SECTION 1: Setting up test data")
    print("-" * 80)
    
    import uuid
    
    # Create test family A
    family_a_id = f"test-fam-prop-a-{int(time.time())}"
    family_a_code = f"TPROPA"
    db.families.insert_one({
        'id': family_a_id,
        'code': family_a_code,
        'createdAt': datetime.utcnow(),
        'streak': 0
    })
    print(f"✓ Created test family A: {family_a_id} (code: {family_a_code})")
    
    # Create test user A (parent in family A)
    user_a_id = str(uuid.uuid4())
    user_a_email = f"test-proposals-parent-a@eqrel.test"
    db.users.insert_one({
        'id': user_a_id,
        'email': user_a_email,
        'name': 'Test Parent A',
        'familyId': family_a_id,
        'role': 'ibu',
        'createdAt': datetime.utcnow()
    })
    token_a = create_jwt_session(user_a_id, user_a_email, 'Test Parent A')
    print(f"✓ Created test user A: {user_a_email}")
    
    # Create test child in family A
    child_a_id = str(uuid.uuid4())
    db.children.insert_one({
        'id': child_a_id,
        'familyId': family_a_id,
        'nickname': 'TestProposalChildA',
        'dob': '2018-01-01',
        'gender': 'male',
        'ageBand': '5-6',
        'avatarId': 'B01',
        'favColor': 'green',
        'preferredLang': 'ms',
        'mataBina': 100,
        'mataReward': 50,
        'createdAt': datetime.utcnow()
    })
    print(f"✓ Created test child A: {child_a_id}")
    
    # Create test family B (for isolation tests)
    family_b_id = f"test-fam-prop-b-{int(time.time())}"
    family_b_code = f"TPROPB"
    db.families.insert_one({
        'id': family_b_id,
        'code': family_b_code,
        'createdAt': datetime.utcnow(),
        'streak': 0
    })
    print(f"✓ Created test family B: {family_b_id} (code: {family_b_code})")
    
    # Create test user B (parent in family B)
    user_b_id = str(uuid.uuid4())
    user_b_email = f"test-proposals-parent-b@eqrel.test"
    db.users.insert_one({
        'id': user_b_id,
        'email': user_b_email,
        'name': 'Test Parent B',
        'familyId': family_b_id,
        'role': 'bapa',
        'createdAt': datetime.utcnow()
    })
    token_b = create_jwt_session(user_b_id, user_b_email, 'Test Parent B')
    print(f"✓ Created test user B: {user_b_email}")
    
    # Create test child in family B
    child_b_id = str(uuid.uuid4())
    db.children.insert_one({
        'id': child_b_id,
        'familyId': family_b_id,
        'nickname': 'TestProposalChildB',
        'dob': '2019-01-01',
        'gender': 'female',
        'ageBand': '3-4',
        'avatarId': 'G01',
        'favColor': 'purple',
        'preferredLang': 'en',
        'mataBina': 50,
        'mataReward': 25,
        'createdAt': datetime.utcnow()
    })
    print(f"✓ Created test child B: {child_b_id}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 2: POST /api/rewards/proposals - Validation tests
    # ═══════════════════════════════════════════════════════════════════════════
    print("\n📝 SECTION 2: POST /api/rewards/proposals - Validation")
    print("-" * 80)
    
    # Test: Missing childId
    try:
        r = requests.post(f"{API_BASE}/rewards/proposals",
            json={'title': 'Test Reward', 'cost': 50},
            cookies={'eqrel_session': token_a})
        log_test("POST proposals - missing childId returns 400",
                 r.status_code == 400,
                 f"Status: {r.status_code}, Body: {r.text[:100]}")
    except Exception as e:
        log_test("POST proposals - missing childId returns 400", False, str(e))
    
    # Test: Empty title
    try:
        r = requests.post(f"{API_BASE}/rewards/proposals",
            json={'childId': child_a_id, 'title': '', 'cost': 50},
            cookies={'eqrel_session': token_a})
        log_test("POST proposals - empty title returns 400",
                 r.status_code == 400,
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("POST proposals - empty title returns 400", False, str(e))
    
    # Test: cost = 0
    try:
        r = requests.post(f"{API_BASE}/rewards/proposals",
            json={'childId': child_a_id, 'title': 'Test', 'cost': 0},
            cookies={'eqrel_session': token_a})
        log_test("POST proposals - cost=0 returns 400",
                 r.status_code == 400,
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("POST proposals - cost=0 returns 400", False, str(e))
    
    # Test: cost = 1000 (out of range)
    try:
        r = requests.post(f"{API_BASE}/rewards/proposals",
            json={'childId': child_a_id, 'title': 'Test', 'cost': 1000},
            cookies={'eqrel_session': token_a})
        log_test("POST proposals - cost=1000 returns 400",
                 r.status_code == 400,
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("POST proposals - cost=1000 returns 400", False, str(e))
    
    # Test: cost = 'abc' (non-integer)
    try:
        r = requests.post(f"{API_BASE}/rewards/proposals",
            json={'childId': child_a_id, 'title': 'Test', 'cost': 'abc'},
            cookies={'eqrel_session': token_a})
        log_test("POST proposals - cost='abc' returns 400",
                 r.status_code == 400,
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("POST proposals - cost='abc' returns 400", False, str(e))
    
    # Test: cost = undefined (missing)
    try:
        r = requests.post(f"{API_BASE}/rewards/proposals",
            json={'childId': child_a_id, 'title': 'Test'},
            cookies={'eqrel_session': token_a})
        log_test("POST proposals - missing cost returns 400",
                 r.status_code == 400,
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("POST proposals - missing cost returns 400", False, str(e))
    
    # Test: childId from different family
    try:
        r = requests.post(f"{API_BASE}/rewards/proposals",
            json={'childId': child_b_id, 'title': 'Test', 'cost': 50},
            cookies={'eqrel_session': token_a})
        log_test("POST proposals - childId from different family returns 404",
                 r.status_code == 404 and 'not found' in r.text.lower(),
                 f"Status: {r.status_code}, Body: {r.text[:100]}")
    except Exception as e:
        log_test("POST proposals - childId from different family returns 404", False, str(e))
    
    # Test: invalid category defaults to 'activity'
    try:
        r = requests.post(f"{API_BASE}/rewards/proposals",
            json={'childId': child_a_id, 'title': 'Test Invalid Cat', 'cost': 30, 'category': 'invalid'},
            cookies={'eqrel_session': token_a})
        passed = r.status_code == 200
        if passed:
            data = r.json()
            passed = data.get('proposal', {}).get('category') == 'activity'
        log_test("POST proposals - invalid category defaults to 'activity'",
                 passed,
                 f"Status: {r.status_code}, Category: {data.get('proposal', {}).get('category') if r.status_code == 200 else 'N/A'}")
    except Exception as e:
        log_test("POST proposals - invalid category defaults to 'activity'", False, str(e))
    
    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 3: POST /api/rewards/proposals - Happy path
    # ═══════════════════════════════════════════════════════════════════════════
    print("\n✨ SECTION 3: POST /api/rewards/proposals - Happy path")
    print("-" * 80)
    
    proposal_1_id = None
    proposal_2_id = None
    proposal_3_id = None
    
    # Test: Create valid proposal with all fields
    try:
        r = requests.post(f"{API_BASE}/rewards/proposals",
            json={
                'childId': child_a_id,
                'title': 'Extra Screen Time',
                'desc': 'Can I have 30 more minutes?',
                'cost': 25,
                'icon': '📱',
                'category': 'screen'
            },
            cookies={'eqrel_session': token_a})
        passed = r.status_code == 200
        if passed:
            data = r.json()
            prop = data.get('proposal', {})
            proposal_1_id = prop.get('id')
            passed = (
                prop.get('id', '').startswith('rp-') and
                prop.get('familyId') == family_a_id and
                prop.get('childId') == child_a_id and
                prop.get('title') == 'Extra Screen Time' and
                prop.get('desc') == 'Can I have 30 more minutes?' and
                prop.get('cost') == 25 and
                prop.get('icon') == '📱' and
                prop.get('category') == 'screen' and
                prop.get('status') == 'pending' and
                'proposedAt' in prop and
                'proposedBy' in prop
            )
        log_test("POST proposals - valid proposal with all fields",
                 passed,
                 f"Status: {r.status_code}, ID: {proposal_1_id if passed else 'N/A'}")
    except Exception as e:
        log_test("POST proposals - valid proposal with all fields", False, str(e))
    
    # Test: Create proposal with minimal fields (defaults apply)
    try:
        r = requests.post(f"{API_BASE}/rewards/proposals",
            json={
                'childId': child_a_id,
                'title': 'Ice Cream Trip',
                'cost': 15
            },
            cookies={'eqrel_session': token_a})
        passed = r.status_code == 200
        if passed:
            data = r.json()
            prop = data.get('proposal', {})
            proposal_2_id = prop.get('id')
            passed = (
                prop.get('icon') == '🎁' and  # default icon
                prop.get('category') == 'activity' and  # default category
                prop.get('status') == 'pending'
            )
        log_test("POST proposals - minimal fields with defaults",
                 passed,
                 f"Status: {r.status_code}, Icon: {prop.get('icon') if r.status_code == 200 else 'N/A'}, Category: {prop.get('category') if r.status_code == 200 else 'N/A'}")
    except Exception as e:
        log_test("POST proposals - minimal fields with defaults", False, str(e))
    
    # Test: Create another proposal for filtering tests
    try:
        r = requests.post(f"{API_BASE}/rewards/proposals",
            json={
                'childId': child_a_id,
                'title': 'New Toy Car',
                'cost': 40,
                'category': 'activity'
            },
            cookies={'eqrel_session': token_a})
        passed = r.status_code == 200
        if passed:
            data = r.json()
            proposal_3_id = data.get('proposal', {}).get('id')
        log_test("POST proposals - third proposal created",
                 passed,
                 f"Status: {r.status_code}, ID: {proposal_3_id if passed else 'N/A'}")
    except Exception as e:
        log_test("POST proposals - third proposal created", False, str(e))
    
    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 4: GET /api/rewards/proposals - List and filter
    # ═══════════════════════════════════════════════════════════════════════════
    print("\n📋 SECTION 4: GET /api/rewards/proposals - List and filter")
    print("-" * 80)
    
    # Test: Get all proposals (no filter)
    try:
        r = requests.get(f"{API_BASE}/rewards/proposals",
            cookies={'eqrel_session': token_a})
        passed = r.status_code == 200
        if passed:
            data = r.json()
            proposals = data.get('proposals', [])
            passed = len(proposals) >= 3  # We created 3 proposals
        log_test("GET proposals - returns all proposals",
                 passed,
                 f"Status: {r.status_code}, Count: {len(proposals) if r.status_code == 200 else 0}")
    except Exception as e:
        log_test("GET proposals - returns all proposals", False, str(e))
    
    # Test: Filter by childId
    try:
        r = requests.get(f"{API_BASE}/rewards/proposals?childId={child_a_id}",
            cookies={'eqrel_session': token_a})
        passed = r.status_code == 200
        if passed:
            data = r.json()
            proposals = data.get('proposals', [])
            passed = len(proposals) >= 3 and all(p.get('childId') == child_a_id for p in proposals)
        log_test("GET proposals - filter by childId works",
                 passed,
                 f"Status: {r.status_code}, Count: {len(proposals) if r.status_code == 200 else 0}")
    except Exception as e:
        log_test("GET proposals - filter by childId works", False, str(e))
    
    # Test: Filter by status=pending
    try:
        r = requests.get(f"{API_BASE}/rewards/proposals?status=pending",
            cookies={'eqrel_session': token_a})
        passed = r.status_code == 200
        if passed:
            data = r.json()
            proposals = data.get('proposals', [])
            passed = len(proposals) >= 3 and all(p.get('status') == 'pending' for p in proposals)
        log_test("GET proposals - filter by status=pending works",
                 passed,
                 f"Status: {r.status_code}, Count: {len(proposals) if r.status_code == 200 else 0}")
    except Exception as e:
        log_test("GET proposals - filter by status=pending works", False, str(e))
    
    # Test: Cross-family isolation
    try:
        r = requests.get(f"{API_BASE}/rewards/proposals",
            cookies={'eqrel_session': token_b})
        passed = r.status_code == 200
        if passed:
            data = r.json()
            proposals = data.get('proposals', [])
            # User B should not see any proposals from family A
            passed = all(p.get('familyId') != family_a_id for p in proposals)
        log_test("GET proposals - cross-family isolation",
                 passed,
                 f"Status: {r.status_code}, Family A proposals visible to B: {not passed if r.status_code == 200 else 'N/A'}")
    except Exception as e:
        log_test("GET proposals - cross-family isolation", False, str(e))
    
    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 5: PATCH /api/rewards/proposals/:id - Approve with NO overrides
    # ═══════════════════════════════════════════════════════════════════════════
    print("\n✅ SECTION 5: PATCH /api/rewards/proposals/:id - Approve (no overrides)")
    print("-" * 80)
    
    if not proposal_1_id:
        print("⚠️  Skipping section 5 - proposal_1_id not available")
    else:
        # Test: Approve proposal without modifications
        try:
            r = requests.patch(f"{API_BASE}/rewards/proposals/{proposal_1_id}",
                json={'decision': 'approved'},
                cookies={'eqrel_session': token_a})
            passed = r.status_code == 200
            resulting_reward_id = None
            if passed:
                data = r.json()
                prop = data.get('proposal', {})
                passed = (
                    prop.get('status') == 'approved' and
                    'decidedAt' in prop and
                    'decidedBy' in prop and
                    'resultingRewardId' in prop and
                    'finalTitle' in prop and
                    'finalCost' in prop
                )
                resulting_reward_id = prop.get('resultingRewardId')
            log_test("PATCH proposals - approve without overrides",
                     passed,
                     f"Status: {r.status_code}, Resulting reward ID: {resulting_reward_id if passed else 'N/A'}")
        except Exception as e:
            log_test("PATCH proposals - approve without overrides", False, str(e))
        
        # Test: Verify custom reward was created
        if resulting_reward_id:
            try:
                custom_reward = db.rewards_custom.find_one({'id': resulting_reward_id})
                passed = (
                    custom_reward is not None and
                    custom_reward.get('title') == 'Extra Screen Time' and
                    custom_reward.get('cost') == 25 and
                    custom_reward.get('icon') == '📱' and
                    custom_reward.get('category') == 'screen' and
                    custom_reward.get('fromProposalId') == proposal_1_id and
                    custom_reward.get('fromChildId') == child_a_id
                )
                log_test("PATCH proposals - custom reward created in DB",
                         passed,
                         f"Found: {custom_reward is not None}, Title: {custom_reward.get('title') if custom_reward else 'N/A'}")
            except Exception as e:
                log_test("PATCH proposals - custom reward created in DB", False, str(e))
        
        # Test: Verify proposal has correct final values
        try:
            prop_db = db.reward_proposals.find_one({'id': proposal_1_id})
            passed = (
                prop_db.get('finalTitle') == 'Extra Screen Time' and
                prop_db.get('finalCost') == 25
            )
            log_test("PATCH proposals - finalTitle and finalCost set correctly",
                     passed,
                     f"finalTitle: {prop_db.get('finalTitle')}, finalCost: {prop_db.get('finalCost')}")
        except Exception as e:
            log_test("PATCH proposals - finalTitle and finalCost set correctly", False, str(e))
    
    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 6: PATCH /api/rewards/proposals/:id - Approve WITH overrides
    # ═══════════════════════════════════════════════════════════════════════════
    print("\n✏️  SECTION 6: PATCH /api/rewards/proposals/:id - Approve (with overrides)")
    print("-" * 80)
    
    if not proposal_2_id:
        print("⚠️  Skipping section 6 - proposal_2_id not available")
    else:
        # Test: Approve with parent modifications
        try:
            r = requests.patch(f"{API_BASE}/rewards/proposals/{proposal_2_id}",
                json={
                    'decision': 'approved',
                    'title': 'Ice Cream Trip (Modified)',
                    'cost': 20,  # Parent reduced cost
                    'desc': 'Parent added description',
                    'icon': '🍦',
                    'category': 'food'
                },
                cookies={'eqrel_session': token_a})
            passed = r.status_code == 200
            resulting_reward_id_2 = None
            if passed:
                data = r.json()
                prop = data.get('proposal', {})
                passed = (
                    prop.get('status') == 'approved' and
                    prop.get('finalTitle') == 'Ice Cream Trip (Modified)' and
                    prop.get('finalCost') == 20
                )
                resulting_reward_id_2 = prop.get('resultingRewardId')
            log_test("PATCH proposals - approve with overrides",
                     passed,
                     f"Status: {r.status_code}, Final title: {prop.get('finalTitle') if r.status_code == 200 else 'N/A'}, Final cost: {prop.get('finalCost') if r.status_code == 200 else 'N/A'}")
        except Exception as e:
            log_test("PATCH proposals - approve with overrides", False, str(e))
        
        # Test: Verify custom reward uses parent's overrides
        if resulting_reward_id_2:
            try:
                custom_reward = db.rewards_custom.find_one({'id': resulting_reward_id_2})
                passed = (
                    custom_reward is not None and
                    custom_reward.get('title') == 'Ice Cream Trip (Modified)' and
                    custom_reward.get('cost') == 20 and
                    custom_reward.get('desc') == 'Parent added description' and
                    custom_reward.get('icon') == '🍦' and
                    custom_reward.get('category') == 'food'
                )
                log_test("PATCH proposals - custom reward uses parent overrides",
                         passed,
                         f"Title: {custom_reward.get('title') if custom_reward else 'N/A'}, Cost: {custom_reward.get('cost') if custom_reward else 'N/A'}")
            except Exception as e:
                log_test("PATCH proposals - custom reward uses parent overrides", False, str(e))
    
    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 7: PATCH /api/rewards/proposals/:id - Validation on approve
    # ═══════════════════════════════════════════════════════════════════════════
    print("\n🔍 SECTION 7: PATCH /api/rewards/proposals/:id - Approve validation")
    print("-" * 80)
    
    # Create a new proposal for validation tests
    proposal_val_id = None
    try:
        r = requests.post(f"{API_BASE}/rewards/proposals",
            json={'childId': child_a_id, 'title': 'Validation Test', 'cost': 30},
            cookies={'eqrel_session': token_a})
        if r.status_code == 200:
            proposal_val_id = r.json().get('proposal', {}).get('id')
            print(f"✓ Created validation test proposal: {proposal_val_id}")
    except Exception as e:
        print(f"⚠️  Failed to create validation test proposal: {e}")
    
    if proposal_val_id:
        # Test: Override cost = 0
        try:
            r = requests.patch(f"{API_BASE}/rewards/proposals/{proposal_val_id}",
                json={'decision': 'approved', 'cost': 0},
                cookies={'eqrel_session': token_a})
            log_test("PATCH proposals - override cost=0 returns 400",
                     r.status_code == 400,
                     f"Status: {r.status_code}")
        except Exception as e:
            log_test("PATCH proposals - override cost=0 returns 400", False, str(e))
        
        # Test: Override cost = 1000
        try:
            r = requests.patch(f"{API_BASE}/rewards/proposals/{proposal_val_id}",
                json={'decision': 'approved', 'cost': 1000},
                cookies={'eqrel_session': token_a})
            log_test("PATCH proposals - override cost=1000 returns 400",
                     r.status_code == 400,
                     f"Status: {r.status_code}")
        except Exception as e:
            log_test("PATCH proposals - override cost=1000 returns 400", False, str(e))
        
        # Test: Override cost = non-integer
        try:
            r = requests.patch(f"{API_BASE}/rewards/proposals/{proposal_val_id}",
                json={'decision': 'approved', 'cost': 'invalid'},
                cookies={'eqrel_session': token_a})
            log_test("PATCH proposals - override cost=non-integer returns 400",
                     r.status_code == 400,
                     f"Status: {r.status_code}")
        except Exception as e:
            log_test("PATCH proposals - override cost=non-integer returns 400", False, str(e))
        
        # Test: Empty override title (if provided as empty, should reject)
        try:
            r = requests.patch(f"{API_BASE}/rewards/proposals/{proposal_val_id}",
                json={'decision': 'approved', 'title': ''},
                cookies={'eqrel_session': token_a})
            log_test("PATCH proposals - empty override title returns 400",
                     r.status_code == 400,
                     f"Status: {r.status_code}")
        except Exception as e:
            log_test("PATCH proposals - empty override title returns 400", False, str(e))
    
    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 8: PATCH /api/rewards/proposals/:id - Reject
    # ═══════════════════════════════════════════════════════════════════════════
    print("\n❌ SECTION 8: PATCH /api/rewards/proposals/:id - Reject")
    print("-" * 80)
    
    if not proposal_3_id:
        print("⚠️  Skipping section 8 - proposal_3_id not available")
    else:
        # Test: Reject proposal
        try:
            r = requests.patch(f"{API_BASE}/rewards/proposals/{proposal_3_id}",
                json={'decision': 'rejected', 'note': 'Too expensive for now'},
                cookies={'eqrel_session': token_a})
            passed = r.status_code == 200
            if passed:
                data = r.json()
                prop = data.get('proposal', {})
                passed = (
                    prop.get('status') == 'rejected' and
                    'decidedAt' in prop and
                    'decidedBy' in prop
                )
            log_test("PATCH proposals - reject proposal",
                     passed,
                     f"Status: {r.status_code}")
        except Exception as e:
            log_test("PATCH proposals - reject proposal", False, str(e))
        
        # Test: Verify NO custom reward was created
        try:
            prop_db = db.reward_proposals.find_one({'id': proposal_3_id})
            passed = 'resultingRewardId' not in prop_db or prop_db.get('resultingRewardId') is None
            log_test("PATCH proposals - no custom reward created on reject",
                     passed,
                     f"resultingRewardId present: {not passed}")
        except Exception as e:
            log_test("PATCH proposals - no custom reward created on reject", False, str(e))
        
        # Test: Verify decidedAt is set
        try:
            prop_db = db.reward_proposals.find_one({'id': proposal_3_id})
            passed = 'decidedAt' in prop_db and prop_db.get('decidedAt') is not None
            log_test("PATCH proposals - decidedAt set on reject",
                     passed,
                     f"decidedAt: {prop_db.get('decidedAt') if prop_db else 'N/A'}")
        except Exception as e:
            log_test("PATCH proposals - decidedAt set on reject", False, str(e))
    
    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 9: PATCH /api/rewards/proposals/:id - Idempotency & errors
    # ═══════════════════════════════════════════════════════════════════════════
    print("\n🔒 SECTION 9: PATCH /api/rewards/proposals/:id - Idempotency & errors")
    print("-" * 80)
    
    if proposal_1_id:
        # Test: PATCH twice (already decided) returns 409
        try:
            r = requests.patch(f"{API_BASE}/rewards/proposals/{proposal_1_id}",
                json={'decision': 'approved'},
                cookies={'eqrel_session': token_a})
            log_test("PATCH proposals - second PATCH returns 409",
                     r.status_code == 409 and 'already' in r.text.lower(),
                     f"Status: {r.status_code}, Body: {r.text[:100]}")
        except Exception as e:
            log_test("PATCH proposals - second PATCH returns 409", False, str(e))
    
    # Test: Invalid decision
    if proposal_val_id:
        try:
            r = requests.patch(f"{API_BASE}/rewards/proposals/{proposal_val_id}",
                json={'decision': 'invalid'},
                cookies={'eqrel_session': token_a})
            log_test("PATCH proposals - invalid decision returns 400",
                     r.status_code == 400,
                     f"Status: {r.status_code}")
        except Exception as e:
            log_test("PATCH proposals - invalid decision returns 400", False, str(e))
    
    # Test: Not found id
    try:
        r = requests.patch(f"{API_BASE}/rewards/proposals/nonexistent-id",
            json={'decision': 'approved'},
            cookies={'eqrel_session': token_a})
        log_test("PATCH proposals - not found id returns 404",
                 r.status_code == 404,
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("PATCH proposals - not found id returns 404", False, str(e))
    
    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 10: DELETE /api/rewards/proposals/:id
    # ═══════════════════════════════════════════════════════════════════════════
    print("\n🗑️  SECTION 10: DELETE /api/rewards/proposals/:id")
    print("-" * 80)
    
    # Create a new proposal for delete tests
    proposal_del_id = None
    try:
        r = requests.post(f"{API_BASE}/rewards/proposals",
            json={'childId': child_a_id, 'title': 'Delete Test', 'cost': 10},
            cookies={'eqrel_session': token_a})
        if r.status_code == 200:
            proposal_del_id = r.json().get('proposal', {}).get('id')
            print(f"✓ Created delete test proposal: {proposal_del_id}")
    except Exception as e:
        print(f"⚠️  Failed to create delete test proposal: {e}")
    
    if proposal_del_id:
        # Test: Delete own pending proposal
        try:
            r = requests.delete(f"{API_BASE}/rewards/proposals/{proposal_del_id}",
                cookies={'eqrel_session': token_a})
            passed = r.status_code == 200
            if passed:
                # Verify it's deleted from DB
                prop_db = db.reward_proposals.find_one({'id': proposal_del_id})
                passed = prop_db is None
            log_test("DELETE proposals - delete pending proposal",
                     passed,
                     f"Status: {r.status_code}, Still in DB: {not passed if r.status_code == 200 else 'N/A'}")
        except Exception as e:
            log_test("DELETE proposals - delete pending proposal", False, str(e))
    
    # Test: Delete already-decided proposal returns 404
    if proposal_1_id:
        try:
            r = requests.delete(f"{API_BASE}/rewards/proposals/{proposal_1_id}",
                cookies={'eqrel_session': token_a})
            log_test("DELETE proposals - delete decided proposal returns 404",
                     r.status_code == 404,
                     f"Status: {r.status_code}")
        except Exception as e:
            log_test("DELETE proposals - delete decided proposal returns 404", False, str(e))
    
    # Test: Cross-family delete attempt
    # Create a proposal in family B
    proposal_b_id = None
    try:
        r = requests.post(f"{API_BASE}/rewards/proposals",
            json={'childId': child_b_id, 'title': 'Family B Proposal', 'cost': 20},
            cookies={'eqrel_session': token_b})
        if r.status_code == 200:
            proposal_b_id = r.json().get('proposal', {}).get('id')
    except Exception as e:
        pass
    
    if proposal_b_id:
        try:
            # User A tries to delete User B's proposal
            r = requests.delete(f"{API_BASE}/rewards/proposals/{proposal_b_id}",
                cookies={'eqrel_session': token_a})
            log_test("DELETE proposals - cross-family delete returns 404",
                     r.status_code == 404,
                     f"Status: {r.status_code}")
        except Exception as e:
            log_test("DELETE proposals - cross-family delete returns 404", False, str(e))
    
    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 11: REGRESSION - GET /api/rewards/catalog
    # ═══════════════════════════════════════════════════════════════════════════
    print("\n🔄 SECTION 11: REGRESSION - GET /api/rewards/catalog")
    print("-" * 80)
    
    # Test: GET catalog returns custom rewards
    try:
        r = requests.get(f"{API_BASE}/rewards/catalog",
            cookies={'eqrel_session': token_a})
        passed = r.status_code == 200
        if passed:
            data = r.json()
            custom = data.get('custom', [])
            # Should include the 2 custom rewards we created from approved proposals
            passed = len(custom) >= 2
            # Verify they're sorted by createdAt DESC (newest first)
            if len(custom) >= 2:
                dates = [c.get('createdAt') for c in custom if 'createdAt' in c]
                if len(dates) >= 2:
                    passed = passed and dates[0] >= dates[1]
        log_test("REGRESSION - GET catalog returns custom rewards",
                 passed,
                 f"Status: {r.status_code}, Custom count: {len(custom) if r.status_code == 200 else 0}")
    except Exception as e:
        log_test("REGRESSION - GET catalog returns custom rewards", False, str(e))
    
    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 12: REGRESSION - POST /api/rewards/catalog (manual add)
    # ═══════════════════════════════════════════════════════════════════════════
    print("\n🔄 SECTION 12: REGRESSION - POST /api/rewards/catalog")
    print("-" * 80)
    
    manual_reward_id = None
    # Test: Manually add custom reward
    try:
        r = requests.post(f"{API_BASE}/rewards/catalog",
            json={
                'title': 'Manual Custom Reward',
                'desc': 'Added by parent directly',
                'cost': 35,
                'icon': '🎨',
                'category': 'activity'
            },
            cookies={'eqrel_session': token_a})
        passed = r.status_code == 200
        if passed:
            data = r.json()
            reward = data.get('reward', {})
            manual_reward_id = reward.get('id')
            passed = (
                reward.get('title') == 'Manual Custom Reward' and
                reward.get('cost') == 35 and
                reward.get('familyId') == family_a_id
            )
        log_test("REGRESSION - POST catalog manual add works",
                 passed,
                 f"Status: {r.status_code}, ID: {manual_reward_id if passed else 'N/A'}")
    except Exception as e:
        log_test("REGRESSION - POST catalog manual add works", False, str(e))
    
    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 13: REGRESSION - Reward request/decide/fulfill flow
    # ═══════════════════════════════════════════════════════════════════════════
    print("\n🔄 SECTION 13: REGRESSION - Reward request/decide/fulfill flow")
    print("-" * 80)
    
    request_id = None
    # Test: Create reward request
    if manual_reward_id:
        try:
            r = requests.post(f"{API_BASE}/rewards/request",
                json={
                    'childId': child_a_id,
                    'rewardId': manual_reward_id,
                    'isTemplate': False,
                    'snapshot': {
                        'title': 'Manual Custom Reward',
                        'desc': 'Added by parent directly',
                        'cost': 35,
                        'icon': '🎨',
                        'category': 'activity'
                    }
                },
                cookies={'eqrel_session': token_a})
            passed = r.status_code == 200
            if passed:
                data = r.json()
                request_id = data.get('request', {}).get('id')
            log_test("REGRESSION - POST reward request works",
                     passed,
                     f"Status: {r.status_code}, Request ID: {request_id if passed else 'N/A'}")
        except Exception as e:
            log_test("REGRESSION - POST reward request works", False, str(e))
    
    # Test: Approve reward request
    if request_id:
        try:
            r = requests.post(f"{API_BASE}/rewards/requests/{request_id}/decide",
                json={'decision': 'approved'},
                cookies={'eqrel_session': token_a})
            passed = r.status_code == 200
            log_test("REGRESSION - POST decide (approve) works",
                     passed,
                     f"Status: {r.status_code}")
        except Exception as e:
            log_test("REGRESSION - POST decide (approve) works", False, str(e))
        
        # Test: Fulfill reward request
        try:
            r = requests.post(f"{API_BASE}/rewards/requests/{request_id}/fulfill",
                cookies={'eqrel_session': token_a})
            passed = r.status_code == 200
            log_test("REGRESSION - POST fulfill works",
                     passed,
                     f"Status: {r.status_code}")
        except Exception as e:
            log_test("REGRESSION - POST fulfill works", False, str(e))
    
    # ═══════════════════════════════════════════════════════════════════════════
    # CLEANUP
    # ═══════════════════════════════════════════════════════════════════════════
    print("\n🧹 Cleaning up test data...")
    cleanup_test_data()
    print("✓ Cleanup complete")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # SUMMARY
    # ═══════════════════════════════════════════════════════════════════════════
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print(f"✅ PASSED: {tests_passed}")
    print(f"❌ FAILED: {tests_failed}")
    print(f"📊 TOTAL:  {tests_passed + tests_failed}")
    print("="*80 + "\n")
    
    if tests_failed == 0:
        print("🎉 ALL TESTS PASSED!")
        return 0
    else:
        print(f"⚠️  {tests_failed} test(s) failed")
        return 1

if __name__ == '__main__':
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n\n⚠️  Tests interrupted by user")
        print("🧹 Cleaning up...")
        cleanup_test_data()
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        print("🧹 Cleaning up...")
        cleanup_test_data()
        sys.exit(1)
