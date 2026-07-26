#!/usr/bin/env python3
"""
Test POST /api/world/:childId/demerit endpoint with mata reward deduction feature.

Tests:
1. Login/seed setup with mataReward=50, mataBina=30
2. Positive delta case: delta=3 → demeritCount=3, mataReward=47, mataBina=30 (unchanged)
3. Clamp at zero (mataReward floor): mataReward=2, delta=5 → mataReward=0
4. Negative delta case (istighfar): delta=-1 → demeritCount decrements, mataReward stays same
5. mataBina protection: verify mataBina unchanged after multiple demerits
6. Negative clamp on demeritCount: demeritCount=0, delta=-5 → demeritCount=0
"""
import os
import sys
import requests
import subprocess
from pymongo import MongoClient

# Config
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://pwa-trial-cohort.preview.emergentagent.com')
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'eqrel')

def run_seed_script():
    """Run seed script and parse output"""
    result = subprocess.run(['python', '/app/scripts/seed_test_family.py'], capture_output=True, text=True)
    if result.returncode != 0:
        print(f"❌ Seed script failed: {result.stderr}")
        sys.exit(1)
    
    data = {}
    for line in result.stdout.strip().split('\n'):
        if '=' in line:
            key, val = line.split('=', 1)
            data[key] = val
    return data

def cleanup_test_data(family_id, user_id, child_id_1, child_id_2, session_id):
    """Clean up test data from database"""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    db.families.delete_many({'id': family_id})
    db.users.delete_many({'id': user_id})
    db.children.delete_many({'id': {'$in': [child_id_1, child_id_2]}})
    db.sessions.delete_many({'sid': session_id})
    db.habits.delete_many({'familyId': family_id})
    db.family_worlds.delete_many({'childId': {'$in': [child_id_1, child_id_2]}})
    
    client.close()

def main():
    print("=" * 80)
    print("DEMERIT ENDPOINT MATA REWARD DEDUCTION TESTING")
    print("=" * 80)
    
    # Setup
    print("\n📦 Setting up test data...")
    seed_data = run_seed_script()
    cookie = seed_data['COOKIE']
    family_id = seed_data['FAMILY_ID']
    user_id = seed_data['USER_ID']
    child_id_1 = seed_data['CHILD_ID_1']
    child_id_2 = seed_data['CHILD_ID_2']
    session_id = seed_data['SESSION_ID']
    
    headers = {'Cookie': f'eqrel_session={cookie}', 'Content-Type': 'application/json'}
    
    # Connect to DB for direct updates
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    test_count = 0
    passed_count = 0
    
    try:
        # TEST 1: Setup - Set mataReward=50, mataBina=30 for child_id_1
        test_count += 1
        print(f"\n✅ TEST {test_count}: Setup - Set mataReward=50, mataBina=30 for test child")
        db.children.update_one(
            {'id': child_id_1},
            {'$set': {'mataReward': 50, 'mataBina': 30}}
        )
        child = db.children.find_one({'id': child_id_1}, {'mataReward': 1, 'mataBina': 1})
        assert child['mataReward'] == 50, f"Expected mataReward=50, got {child['mataReward']}"
        assert child['mataBina'] == 30, f"Expected mataBina=30, got {child['mataBina']}"
        print(f"   ✓ Child setup: mataReward={child['mataReward']}, mataBina={child['mataBina']}")
        passed_count += 1
        
        # TEST 2: Positive delta case - delta=3
        test_count += 1
        print(f"\n✅ TEST {test_count}: Positive delta=3 → demeritCount=3, mataReward=47, mataBina=30")
        resp = requests.post(
            f"{BASE_URL}/api/world/{child_id_1}/demerit",
            headers=headers,
            json={'delta': 3}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data['ok'] == True, f"Expected ok=true, got {data}"
        assert data['demeritCount'] == 3, f"Expected demeritCount=3, got {data['demeritCount']}"
        assert 'mataReward' in data, f"Expected mataReward in response, got {data}"
        assert data['mataReward'] == 47, f"Expected mataReward=47, got {data['mataReward']}"
        print(f"   ✓ Response: demeritCount={data['demeritCount']}, mataReward={data['mataReward']}")
        
        # Verify DB
        child = db.children.find_one({'id': child_id_1}, {'mataReward': 1, 'mataBina': 1})
        assert child['mataReward'] == 47, f"DB: Expected mataReward=47, got {child['mataReward']}"
        assert child['mataBina'] == 30, f"DB: Expected mataBina=30 (unchanged), got {child['mataBina']}"
        world = db.family_worlds.find_one({'childId': child_id_1}, {'demeritCount': 1})
        assert world['demeritCount'] == 3, f"DB: Expected demeritCount=3, got {world['demeritCount']}"
        print(f"   ✓ DB verified: mataReward=47, mataBina=30 (unchanged), demeritCount=3")
        passed_count += 1
        
        # TEST 3: Clamp at zero (mataReward floor) - Set mataReward=2, delta=5
        test_count += 1
        print(f"\n✅ TEST {test_count}: Clamp at zero - mataReward=2, delta=5 → mataReward=0")
        db.children.update_one({'id': child_id_1}, {'$set': {'mataReward': 2}})
        resp = requests.post(
            f"{BASE_URL}/api/world/{child_id_1}/demerit",
            headers=headers,
            json={'delta': 5}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data['mataReward'] == 0, f"Expected mataReward=0 (clamped), got {data['mataReward']}"
        print(f"   ✓ Response: mataReward={data['mataReward']} (clamped at 0)")
        
        # Verify DB
        child = db.children.find_one({'id': child_id_1}, {'mataReward': 1})
        assert child['mataReward'] == 0, f"DB: Expected mataReward=0, got {child['mataReward']}"
        print(f"   ✓ DB verified: mataReward=0 (not negative)")
        passed_count += 1
        
        # TEST 4: Negative delta case (istighfar) - delta=-1
        test_count += 1
        print(f"\n✅ TEST {test_count}: Negative delta=-1 (istighfar) → demeritCount decrements, mataReward stays same")
        # Reset to known state: demeritCount=3, mataReward=47
        db.family_worlds.update_one({'childId': child_id_1}, {'$set': {'demeritCount': 3}})
        db.children.update_one({'id': child_id_1}, {'$set': {'mataReward': 47}})
        
        resp = requests.post(
            f"{BASE_URL}/api/world/{child_id_1}/demerit",
            headers=headers,
            json={'delta': -1}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data['demeritCount'] == 2, f"Expected demeritCount=2 (3-1), got {data['demeritCount']}"
        assert 'mataReward' not in data, f"Expected NO mataReward in response for negative delta, got {data}"
        print(f"   ✓ Response: demeritCount={data['demeritCount']}, mataReward NOT in response (correct)")
        
        # Verify DB - mataReward should stay at 47 (istighfar does NOT refund)
        child = db.children.find_one({'id': child_id_1}, {'mataReward': 1})
        assert child['mataReward'] == 47, f"DB: Expected mataReward=47 (unchanged), got {child['mataReward']}"
        print(f"   ✓ DB verified: mataReward=47 (unchanged - istighfar does NOT refund)")
        passed_count += 1
        
        # TEST 5: mataBina protection - verify mataBina unchanged after multiple demerits
        test_count += 1
        print(f"\n✅ TEST {test_count}: mataBina protection - verify mataBina unchanged after multiple demerits")
        db.children.update_one({'id': child_id_1}, {'$set': {'mataReward': 100, 'mataBina': 50}})
        initial_mataBina = 50
        
        # Apply 3 demerits
        for i in range(3):
            resp = requests.post(
                f"{BASE_URL}/api/world/{child_id_1}/demerit",
                headers=headers,
                json={'delta': 2}
            )
            assert resp.status_code == 200, f"Demerit {i+1} failed: {resp.status_code}"
        
        # Verify mataBina unchanged
        child = db.children.find_one({'id': child_id_1}, {'mataReward': 1, 'mataBina': 1})
        assert child['mataBina'] == initial_mataBina, f"Expected mataBina={initial_mataBina} (unchanged), got {child['mataBina']}"
        assert child['mataReward'] == 94, f"Expected mataReward=94 (100-6), got {child['mataReward']}"
        print(f"   ✓ After 3 demerits (delta=2 each): mataBina={child['mataBina']} (unchanged), mataReward={child['mataReward']}")
        passed_count += 1
        
        # TEST 6: Negative clamp on demeritCount - demeritCount=0, delta=-5
        test_count += 1
        print(f"\n✅ TEST {test_count}: Negative clamp on demeritCount - demeritCount=0, delta=-5 → demeritCount=0")
        db.family_worlds.update_one({'childId': child_id_1}, {'$set': {'demeritCount': 0}})
        
        resp = requests.post(
            f"{BASE_URL}/api/world/{child_id_1}/demerit",
            headers=headers,
            json={'delta': -5}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data['demeritCount'] == 0, f"Expected demeritCount=0 (clamped), got {data['demeritCount']}"
        print(f"   ✓ Response: demeritCount={data['demeritCount']} (clamped at 0, not negative)")
        
        # Verify DB
        world = db.family_worlds.find_one({'childId': child_id_1}, {'demeritCount': 1})
        assert world['demeritCount'] == 0, f"DB: Expected demeritCount=0, got {world['demeritCount']}"
        print(f"   ✓ DB verified: demeritCount=0 (not negative)")
        passed_count += 1
        
        print("\n" + "=" * 80)
        print(f"✅ ALL TESTS PASSED ({passed_count}/{test_count})")
        print("=" * 80)
        
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        print(f"\n📊 RESULTS: {passed_count}/{test_count} tests passed")
        return 1
    except Exception as e:
        print(f"\n❌ UNEXPECTED ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        # Cleanup
        print("\n🧹 Cleaning up test data...")
        cleanup_test_data(family_id, user_id, child_id_1, child_id_2, session_id)
        client.close()
        print("✓ Cleanup complete")
    
    return 0

if __name__ == '__main__':
    sys.exit(main())
