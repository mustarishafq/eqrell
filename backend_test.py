#!/usr/bin/env python3
"""
Backend test for Weekly Digest endpoint - Updated fields verification
Tests ONLY the updated weekly digest endpoint as per review request.
"""
import requests
import os
from datetime import datetime, timezone
from pymongo import MongoClient

# Load environment
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'eqrel')
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000')
API_URL = f"{BASE_URL}/api"

# Test credentials from seed script
COOKIE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzaWQiOiJ0ZXN0LXNlc3Npb24tNDQyNmZmMWUiLCJ1c2VySWQiOiJ0ZXN0LXVzZXItNDQyNmZmMWUiLCJlbWFpbCI6InRlc3QtNDQyNmZmMWVAZXFyZWwubG9jYWwiLCJuYW1lIjoiVGVzdCBQYXJlbnQiLCJmYW1pbHlJZCI6InRlc3QtZmFtLTQ0MjZmZjFlIiwicm9sZSI6InBhcmVudCIsImlhdCI6MTc5NDExMjEyMiwiZXhwIjoxNzk2NzA0MTIyfQ.nrcTN2E2GyF4Qsw1I86rONCdaoHeZjGKFWNmqdz98pw"
FAMILY_ID = "test-fam-4426ff1e"
CHILD_ID_1 = "test-child-a-4426ff1e"
CHILD_ID_2 = "test-child-b-4426ff1e"

# MongoDB client
client = MongoClient(MONGO_URL)
db = client[DB_NAME]

# Session for requests
session = requests.Session()
session.cookies.set('eqrel_session', COOKIE)

# Track test data for cleanup
test_claim_ids = []
test_building_ids = []

def cleanup():
    """Clean up test data"""
    print("\n🧹 Cleaning up test data...")
    try:
        # Delete test claims
        if test_claim_ids:
            result = db.habit_claims.delete_many({'_id': {'$in': test_claim_ids}})
            print(f"   Deleted {result.deleted_count} test claims")
        
        # Remove test buildings from family_worlds
        if test_building_ids:
            for child_id in [CHILD_ID_1, CHILD_ID_2]:
                db.family_worlds.update_one(
                    {'childId': child_id},
                    {'$pull': {'buildings': {'id': {'$in': test_building_ids}}}}
                )
            print(f"   Removed {len(test_building_ids)} test buildings")
        
        print("✅ Cleanup complete")
    except Exception as e:
        print(f"❌ Cleanup error: {e}")

def test_weekly_digest_basic():
    """Test 1: GET /api/digest/weekly returns 200 with new fields"""
    print("\n" + "="*70)
    print("TEST 1: GET /api/digest/weekly - Basic structure and new fields")
    print("="*70)
    
    try:
        # Test without lang parameter
        print("\n📍 Testing GET /api/digest/weekly (default lang)")
        resp = session.get(f"{API_URL}/digest/weekly")
        print(f"   Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {resp.status_code}")
            print(f"   Response: {resp.text[:200]}")
            return False
        
        data = resp.json()
        print(f"✅ Status 200 OK")
        
        # Verify response structure
        if 'kids' not in data:
            print("❌ FAILED: Response missing 'kids' array")
            return False
        
        print(f"   Found {len(data['kids'])} children in response")
        
        # Check each kid for new fields
        for i, kid in enumerate(data['kids']):
            print(f"\n   Child {i+1}: {kid.get('nickname', 'Unknown')}")
            
            # Check 'days' field
            if 'days' not in kid:
                print(f"   ❌ FAILED: Missing 'days' field")
                return False
            if not isinstance(kid['days'], list):
                print(f"   ❌ FAILED: 'days' is not an array")
                return False
            if len(kid['days']) != 7:
                print(f"   ❌ FAILED: 'days' array length is {len(kid['days'])}, expected 7")
                return False
            # Check all values are numbers in [0,1]
            for j, val in enumerate(kid['days']):
                if not isinstance(val, (int, float)) or val < 0 or val > 1:
                    print(f"   ❌ FAILED: days[{j}] = {val}, expected number in [0,1]")
                    return False
            print(f"   ✅ days: {kid['days']} (7 values in [0,1])")
            
            # Check 'habitsCount' field
            if 'habitsCount' not in kid:
                print(f"   ❌ FAILED: Missing 'habitsCount' field")
                return False
            if not isinstance(kid['habitsCount'], int):
                print(f"   ❌ FAILED: 'habitsCount' is not a number")
                return False
            print(f"   ✅ habitsCount: {kid['habitsCount']}")
            
            # Check 'bestHabit' field
            if 'bestHabit' not in kid:
                print(f"   ❌ FAILED: Missing 'bestHabit' field")
                return False
            if kid['bestHabit'] is not None:
                if not isinstance(kid['bestHabit'], dict):
                    print(f"   ❌ FAILED: 'bestHabit' is not null or object")
                    return False
                required_fields = ['title', 'icon', 'category', 'days']
                for field in required_fields:
                    if field not in kid['bestHabit']:
                        print(f"   ❌ FAILED: bestHabit missing '{field}' field")
                        return False
                print(f"   ✅ bestHabit: {kid['bestHabit']['title']} ({kid['bestHabit']['days']} days)")
            else:
                print(f"   ✅ bestHabit: null (no habits completed)")
            
            # Check 'village' field
            if 'village' not in kid:
                print(f"   ❌ FAILED: Missing 'village' field")
                return False
            if not isinstance(kid['village'], dict):
                print(f"   ❌ FAILED: 'village' is not an object")
                return False
            required_village_fields = ['total', 'newThisWeek', 'musallaLevel', 'recent']
            for field in required_village_fields:
                if field not in kid['village']:
                    print(f"   ❌ FAILED: village missing '{field}' field")
                    return False
            if not isinstance(kid['village']['total'], int):
                print(f"   ❌ FAILED: village.total is not a number")
                return False
            if not isinstance(kid['village']['newThisWeek'], int):
                print(f"   ❌ FAILED: village.newThisWeek is not a number")
                return False
            if not isinstance(kid['village']['musallaLevel'], int):
                print(f"   ❌ FAILED: village.musallaLevel is not a number")
                return False
            if not isinstance(kid['village']['recent'], list):
                print(f"   ❌ FAILED: village.recent is not an array")
                return False
            # Check recent array doesn't contain 'musalla' or 'tasik'
            for templateId in kid['village']['recent']:
                if templateId in ['musalla', 'tasik']:
                    print(f"   ❌ FAILED: village.recent contains '{templateId}' (should be excluded)")
                    return False
            print(f"   ✅ village: total={kid['village']['total']}, newThisWeek={kid['village']['newThisWeek']}, musallaLevel={kid['village']['musallaLevel']}, recent={kid['village']['recent']}")
        
        print("\n✅ TEST 1 PASSED: All new fields present and valid")
        return True
        
    except Exception as e:
        print(f"❌ TEST 1 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_weekly_digest_with_lang():
    """Test 2: GET /api/digest/weekly?lang=ms returns 200"""
    print("\n" + "="*70)
    print("TEST 2: GET /api/digest/weekly?lang=ms - Malay language")
    print("="*70)
    
    try:
        print("\n📍 Testing GET /api/digest/weekly?lang=ms")
        resp = session.get(f"{API_URL}/digest/weekly?lang=ms")
        print(f"   Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        print(f"✅ Status 200 OK")
        print(f"   Found {len(data.get('kids', []))} children in response")
        
        # Verify new fields still present with lang parameter
        if 'kids' in data and len(data['kids']) > 0:
            kid = data['kids'][0]
            has_all = all(field in kid for field in ['days', 'habitsCount', 'bestHabit', 'village'])
            if has_all:
                print(f"   ✅ All new fields present with lang=ms")
            else:
                print(f"   ❌ FAILED: Some fields missing with lang=ms")
                return False
        
        print("\n✅ TEST 2 PASSED: Language parameter works correctly")
        return True
        
    except Exception as e:
        print(f"❌ TEST 2 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_verified_claims_update_days():
    """Test 3: Create verified habit claims and verify days array updates"""
    print("\n" + "="*70)
    print("TEST 3: Verified claims update days array and bestHabit")
    print("="*70)
    
    try:
        # Get child's habits
        print(f"\n📍 Getting habits for child {CHILD_ID_1}")
        habits_resp = session.get(f"{API_URL}/children/{CHILD_ID_1}/habits")
        if habits_resp.status_code != 200:
            print(f"❌ FAILED: Could not get habits, status {habits_resp.status_code}")
            return False
        
        habits = habits_resp.json().get('habits', [])
        if not habits:
            print(f"❌ FAILED: No habits found for child")
            return False
        
        habit = habits[0]
        print(f"   Found habit: {habit['title']} (id: {habit['id']})")
        
        # Create verified claim for today
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        print(f"\n📍 Creating verified claim for today ({today})")
        
        claim_data = {
            'rubric': 'sah',
            'note': 'TEST_CLAIM'
        }
        claim_resp = session.post(f"{API_URL}/habits/{habit['id']}/claim", json=claim_data)
        print(f"   Status: {claim_resp.status_code}")
        
        if claim_resp.status_code != 200:
            print(f"❌ FAILED: Could not create claim, status {claim_resp.status_code}")
            print(f"   Response: {claim_resp.text[:200]}")
            return False
        
        print(f"✅ Claim created successfully")
        
        # Track for cleanup
        claim_doc = db.habit_claims.find_one({'habitId': habit['id'], 'dateStr': today})
        if claim_doc:
            test_claim_ids.append(claim_doc['_id'])
        
        # Get weekly digest again
        print(f"\n📍 Fetching weekly digest after claim")
        digest_resp = session.get(f"{API_URL}/digest/weekly")
        if digest_resp.status_code != 200:
            print(f"❌ FAILED: Could not get digest, status {digest_resp.status_code}")
            return False
        
        data = digest_resp.json()
        kid = next((k for k in data['kids'] if k['id'] == CHILD_ID_1), None)
        
        if not kid:
            print(f"❌ FAILED: Child not found in digest")
            return False
        
        print(f"\n   Checking updated fields for {kid['nickname']}:")
        
        # Check last element of days array (today) should be > 0
        if kid['days'][-1] <= 0:
            print(f"   ❌ FAILED: days[-1] = {kid['days'][-1]}, expected > 0 after claim")
            return False
        print(f"   ✅ days[-1] = {kid['days'][-1]} (> 0 after today's claim)")
        
        # Check bestHabit should be non-null now
        if kid['bestHabit'] is None:
            print(f"   ❌ FAILED: bestHabit is null, expected non-null after claim")
            return False
        print(f"   ✅ bestHabit: {kid['bestHabit']['title']} ({kid['bestHabit']['days']} days)")
        
        print("\n✅ TEST 3 PASSED: Claims correctly update days and bestHabit")
        return True
        
    except Exception as e:
        print(f"❌ TEST 3 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_village_with_buildings():
    """Test 4: Insert buildings and verify village fields"""
    print("\n" + "="*70)
    print("TEST 4: Village fields with buildings")
    print("="*70)
    
    try:
        # Check if child has family_worlds doc
        print(f"\n📍 Checking family_worlds for child {CHILD_ID_2}")
        world = db.family_worlds.find_one({'childId': CHILD_ID_2})
        
        if not world:
            print(f"   Creating family_worlds doc for child")
            world_doc = {
                'childId': CHILD_ID_2,
                'familyId': FAMILY_ID,
                'buildings': []
            }
            db.family_worlds.insert_one(world_doc)
            world = world_doc
        
        # Insert test buildings
        print(f"\n📍 Inserting test buildings")
        test_buildings = [
            {
                'id': 'TEST_m',
                'templateId': 'musalla',
                'level': 2,
                'x': 17,
                'y': 17,
                'placedAt': datetime.now(timezone.utc)
            },
            {
                'id': 'TEST_r1',
                'templateId': 'banglo',
                'x': 14,
                'y': 14,
                'level': 1,
                'placedAt': datetime.now(timezone.utc)
            }
        ]
        
        test_building_ids.extend(['TEST_m', 'TEST_r1'])
        
        db.family_worlds.update_one(
            {'childId': CHILD_ID_2},
            {'$push': {'buildings': {'$each': test_buildings}}}
        )
        print(f"   ✅ Inserted 2 test buildings (musalla level 2, banglo)")
        
        # Get weekly digest
        print(f"\n📍 Fetching weekly digest")
        digest_resp = session.get(f"{API_URL}/digest/weekly")
        if digest_resp.status_code != 200:
            print(f"❌ FAILED: Could not get digest, status {digest_resp.status_code}")
            return False
        
        data = digest_resp.json()
        kid = next((k for k in data['kids'] if k['id'] == CHILD_ID_2), None)
        
        if not kid:
            print(f"❌ FAILED: Child not found in digest")
            return False
        
        print(f"\n   Checking village fields for {kid['nickname']}:")
        village = kid['village']
        
        # Check total (should be 1, excluding musalla and tasik)
        if village['total'] != 1:
            print(f"   ❌ FAILED: village.total = {village['total']}, expected 1 (banglo only)")
            return False
        print(f"   ✅ village.total = 1 (banglo, excluding musalla/tasik)")
        
        # Check newThisWeek (should be 1, banglo placed just now)
        if village['newThisWeek'] != 1:
            print(f"   ❌ FAILED: village.newThisWeek = {village['newThisWeek']}, expected 1")
            return False
        print(f"   ✅ village.newThisWeek = 1")
        
        # Check musallaLevel (should be 2)
        if village['musallaLevel'] != 2:
            print(f"   ❌ FAILED: village.musallaLevel = {village['musallaLevel']}, expected 2")
            return False
        print(f"   ✅ village.musallaLevel = 2")
        
        # Check recent array contains 'banglo' but not 'musalla' or 'tasik'
        if 'banglo' not in village['recent']:
            print(f"   ❌ FAILED: village.recent does not contain 'banglo'")
            return False
        if 'musalla' in village['recent'] or 'tasik' in village['recent']:
            print(f"   ❌ FAILED: village.recent contains 'musalla' or 'tasik' (should be excluded)")
            return False
        print(f"   ✅ village.recent = {village['recent']} (contains 'banglo', excludes musalla/tasik)")
        
        print("\n✅ TEST 4 PASSED: Village fields correctly reflect buildings")
        return True
        
    except Exception as e:
        print(f"❌ TEST 4 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_weekly_digest_ai():
    """Test 5: GET /api/digest/weekly/ai returns 200"""
    print("\n" + "="*70)
    print("TEST 5: GET /api/digest/weekly/ai - AI endpoint still works")
    print("="*70)
    
    try:
        print("\n📍 Testing GET /api/digest/weekly/ai")
        resp = session.get(f"{API_URL}/digest/weekly/ai")
        print(f"   Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {resp.status_code}")
            print(f"   Response: {resp.text[:200]}")
            return False
        
        data = resp.json()
        print(f"✅ Status 200 OK")
        
        # AI can be pending, null, or have text
        if 'ai' in data:
            ai = data['ai']
            if ai is None:
                print(f"   ℹ️  ai: null (not generated yet)")
            elif isinstance(ai, dict) and 'pending' in ai:
                print(f"   ℹ️  ai: pending")
            elif isinstance(ai, dict) and 'text' in ai:
                print(f"   ℹ️  ai: text generated ({len(ai['text'])} chars)")
            else:
                print(f"   ℹ️  ai: {type(ai)}")
        
        print("\n✅ TEST 5 PASSED: AI endpoint returns 200")
        return True
        
    except Exception as e:
        print(f"❌ TEST 5 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests"""
    print("\n" + "="*70)
    print("WEEKLY DIGEST ENDPOINT - UPDATED FIELDS TEST")
    print("="*70)
    print(f"Base URL: {API_URL}")
    print(f"Family ID: {FAMILY_ID}")
    print(f"Child 1: {CHILD_ID_1}")
    print(f"Child 2: {CHILD_ID_2}")
    
    results = []
    
    try:
        # Run tests
        results.append(("Basic structure and new fields", test_weekly_digest_basic()))
        results.append(("Language parameter (lang=ms)", test_weekly_digest_with_lang()))
        results.append(("Verified claims update days/bestHabit", test_verified_claims_update_days()))
        results.append(("Village fields with buildings", test_village_with_buildings()))
        results.append(("AI endpoint still works", test_weekly_digest_ai()))
        
    finally:
        # Always cleanup
        cleanup()
    
    # Summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\n{'='*70}")
    print(f"TOTAL: {passed}/{total} tests passed")
    print(f"{'='*70}\n")
    
    return passed == total

if __name__ == '__main__':
    success = main()
    exit(0 if success else 1)
