#!/usr/bin/env python3
"""
Test suite for TV Pair Code endpoints
Tests the 3 new endpoints for Family Display TV pairing feature
"""
import asyncio
import os
import sys
from datetime import datetime, timedelta
from jose import jwt
from pymongo import MongoClient

# Setup
BACKEND_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://pwa-trial-cohort.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"
AUTH_SECRET = os.getenv('AUTH_SECRET', 'eqrel-cohort-a-super-secret-key-change-in-production-2026-11-08')
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'eqrel')

# MongoDB connection
mongo_client = MongoClient(MONGO_URL)
db = mongo_client[DB_NAME]

def create_jwt_token(user_id, email, family_id=None, role='parent'):
    """Create a JWT token for testing"""
    import uuid
    sid = str(uuid.uuid4())
    
    # Insert session into DB
    db.sessions.insert_one({
        'sid': sid,
        'userId': user_id,
        'email': email,
        'expiresAt': datetime.utcnow() + timedelta(days=30),
        'createdAt': datetime.utcnow()
    })
    
    payload = {
        'sid': sid,
        'userId': user_id,
        'email': email,
        'familyId': family_id,
        'role': role,
        'iat': datetime.utcnow().timestamp(),
        'exp': (datetime.utcnow() + timedelta(days=30)).timestamp()
    }
    
    token = jwt.encode(payload, AUTH_SECRET, algorithm='HS256')
    return token

async def make_request(url, method='GET', headers=None, json_data=None):
    """Make HTTP request using curl"""
    import subprocess
    import json as json_lib
    import re
    
    cmd = ['curl', '-s', '-X', method, url, '-w', '\n__STATUS_CODE__:%{http_code}']
    
    if headers:
        for key, value in headers.items():
            cmd.extend(['-H', f'{key}: {value}'])
    
    if json_data:
        cmd.extend(['-H', 'Content-Type: application/json'])
        cmd.extend(['-d', json_lib.dumps(json_data)])
    
    # Add -i to get headers
    cmd.append('-i')
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    output = result.stdout
    
    # Extract status code from our marker
    status_code = 200
    status_match = re.search(r'__STATUS_CODE__:(\d+)', output)
    if status_match:
        status_code = int(status_match.group(1))
        output = output.replace(status_match.group(0), '')
    
    # Split headers and body - handle both HTTP/1.1 and HTTP/2
    # HTTP/2 uses \n\n, HTTP/1.1 uses \r\n\r\n
    if '\r\n\r\n' in output:
        parts = output.split('\r\n\r\n', 1)
    elif '\n\n' in output:
        parts = output.split('\n\n', 1)
    else:
        parts = [output, '']
    
    if len(parts) == 2:
        headers_text, body = parts
    else:
        headers_text = ''
        body = output
    
    # Parse JSON body
    body = body.strip()
    try:
        data = json_lib.loads(body) if body else {}
    except:
        data = {'raw': body}
    
    # Extract Set-Cookie header (look for eqrel_session specifically)
    cookie = None
    for line in headers_text.split('\n'):
        if 'set-cookie:' in line.lower() and 'eqrel_session' in line.lower():
            # Extract just the eqrel_session value
            match = re.search(r'eqrel_session=([^;,\s]+)', line, re.IGNORECASE)
            if match:
                cookie = match.group(1).strip()
                break
    
    return {'status': status_code, 'data': data, 'cookie': cookie}

async def test_tv_pair_endpoints():
    """Test all TV Pair Code endpoints"""
    print("=" * 80)
    print("TV PAIR CODE ENDPOINTS TEST SUITE")
    print("=" * 80)
    
    test_count = 0
    passed_count = 0
    
    # Cleanup test data
    print("\n🧹 Cleaning up test data...")
    db.users.delete_many({'email': {'$regex': 'tvpair-test'}})
    db.families.delete_many({'id': {'$regex': 'tvpair-fam'}})
    db.sessions.delete_many({'email': {'$regex': 'tvpair-test'}})
    db.tv_pair_codes.delete_many({'familyId': {'$regex': 'tvpair-fam'}})
    
    # ═══════════════════════════════════════════════════════════════════════════════
    # SECTION 1: Auth Guards
    # ═══════════════════════════════════════════════════════════════════════════════
    print("\n" + "=" * 80)
    print("SECTION 1: Auth Guards")
    print("=" * 80)
    
    # TEST 1: POST /generate without session → 401
    test_count += 1
    print(f"\n[TEST {test_count}] POST /api/family/tv-pair/generate without session → 401")
    try:
        resp = await make_request(f"{API_BASE}/family/tv-pair/generate", method='POST')
        assert resp['status'] == 401, f"Expected 401, got {resp['status']}"
        print("✅ PASS: Returns 401 without session")
        passed_count += 1
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # TEST 2: GET /current without session → 401
    test_count += 1
    print(f"\n[TEST {test_count}] GET /api/family/tv-pair/current without session → 401")
    try:
        resp = await make_request(f"{API_BASE}/family/tv-pair/current", method='GET')
        assert resp['status'] == 401, f"Expected 401, got {resp['status']}"
        print("✅ PASS: Returns 401 without session")
        passed_count += 1
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # TEST 3: POST /redeem does NOT require auth (public endpoint)
    test_count += 1
    print(f"\n[TEST {test_count}] POST /api/tv-pair/redeem without session → should work (public endpoint)")
    try:
        resp = await make_request(f"{API_BASE}/tv-pair/redeem", method='POST', json_data={'code': '999999'})
        # Should return 400 (invalid code) not 401 (unauthorized)
        assert resp['status'] == 400, f"Expected 400 (invalid code), got {resp['status']}"
        assert 'invalid' in resp['data'].get('error', '').lower() or 'expired' in resp['data'].get('error', '').lower()
        print("✅ PASS: Public endpoint (no auth required, returns 400 for invalid code)")
        passed_count += 1
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # ═══════════════════════════════════════════════════════════════════════════════
    # SECTION 2: Setup Test Data
    # ═══════════════════════════════════════════════════════════════════════════════
    print("\n" + "=" * 80)
    print("SECTION 2: Setup Test Data")
    print("=" * 80)
    
    # Create Family A with Parent A
    family_a_id = 'tvpair-fam-a'
    user_a_id = 'tvpair-user-a'
    user_a_email = 'tvpair-test-a@example.com'
    
    db.families.insert_one({
        'id': family_a_id,
        'code': 'TVPAIR',
        'createdAt': datetime.utcnow()
    })
    
    db.users.insert_one({
        'id': user_a_id,
        'email': user_a_email,
        'name': 'Parent A',
        'familyId': family_a_id,
        'role': 'ibu'
    })
    
    token_a = create_jwt_token(user_a_id, user_a_email, family_a_id)
    print(f"✅ Created Family A ({family_a_id}) with Parent A ({user_a_id})")
    
    # Create Family B with Parent B
    family_b_id = 'tvpair-fam-b'
    user_b_id = 'tvpair-user-b'
    user_b_email = 'tvpair-test-b@example.com'
    
    db.families.insert_one({
        'id': family_b_id,
        'code': 'TVPAI2',
        'createdAt': datetime.utcnow()
    })
    
    db.users.insert_one({
        'id': user_b_id,
        'email': user_b_email,
        'name': 'Parent B',
        'familyId': family_b_id,
        'role': 'ibu'
    })
    
    token_b = create_jwt_token(user_b_id, user_b_email, family_b_id)
    print(f"✅ Created Family B ({family_b_id}) with Parent B ({user_b_id})")
    
    # Create User C without family
    user_c_id = 'tvpair-user-c'
    user_c_email = 'tvpair-test-c@example.com'
    
    db.users.insert_one({
        'id': user_c_id,
        'email': user_c_email,
        'name': 'User C No Family',
        'familyId': None,
        'role': None
    })
    
    token_c = create_jwt_token(user_c_id, user_c_email, None)
    print(f"✅ Created User C ({user_c_id}) without family")
    
    # ═══════════════════════════════════════════════════════════════════════════════
    # SECTION 3: User Without Family
    # ═══════════════════════════════════════════════════════════════════════════════
    print("\n" + "=" * 80)
    print("SECTION 3: User Without Family")
    print("=" * 80)
    
    # TEST 4: POST /generate without familyId → 400
    test_count += 1
    print(f"\n[TEST {test_count}] POST /api/family/tv-pair/generate without familyId → 400")
    try:
        resp = await make_request(
            f"{API_BASE}/family/tv-pair/generate",
            method='POST',
            headers={'Cookie': f'eqrel_session={token_c}'}
        )
        assert resp['status'] == 400, f"Expected 400, got {resp['status']}"
        assert 'family' in resp['data'].get('error', '').lower()
        print("✅ PASS: Returns 400 'No family' for user without familyId")
        passed_count += 1
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # TEST 5: GET /current without familyId → 400
    test_count += 1
    print(f"\n[TEST {test_count}] GET /api/family/tv-pair/current without familyId → 400")
    try:
        resp = await make_request(
            f"{API_BASE}/family/tv-pair/current",
            method='GET',
            headers={'Cookie': f'eqrel_session={token_c}'}
        )
        assert resp['status'] == 400, f"Expected 400, got {resp['status']}"
        assert 'family' in resp['data'].get('error', '').lower()
        print("✅ PASS: Returns 400 'No family' for user without familyId")
        passed_count += 1
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # ═══════════════════════════════════════════════════════════════════════════════
    # SECTION 4: Full Lifecycle Happy Path
    # ═══════════════════════════════════════════════════════════════════════════════
    print("\n" + "=" * 80)
    print("SECTION 4: Full Lifecycle Happy Path")
    print("=" * 80)
    
    # TEST 6: Parent A generates code
    test_count += 1
    print(f"\n[TEST {test_count}] Parent A generates TV pair code")
    code_a = None
    try:
        resp = await make_request(
            f"{API_BASE}/family/tv-pair/generate",
            method='POST',
            headers={'Cookie': f'eqrel_session={token_a}'}
        )
        assert resp['status'] == 200, f"Expected 200, got {resp['status']}"
        assert resp['data'].get('ok') == True
        assert 'code' in resp['data']
        assert 'expiresAt' in resp['data']
        code_a = resp['data']['code']
        assert len(code_a) == 6, f"Code should be 6 digits, got {len(code_a)}"
        assert code_a.isdigit(), f"Code should be numeric, got {code_a}"
        print(f"✅ PASS: Generated code {code_a}, expires at {resp['data']['expiresAt']}")
        passed_count += 1
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # TEST 7: Parent A gets current code
    test_count += 1
    print(f"\n[TEST {test_count}] Parent A gets current active code")
    try:
        resp = await make_request(
            f"{API_BASE}/family/tv-pair/current",
            method='GET',
            headers={'Cookie': f'eqrel_session={token_a}'}
        )
        assert resp['status'] == 200, f"Expected 200, got {resp['status']}"
        assert resp['data'].get('code') == code_a, f"Expected code {code_a}, got {resp['data'].get('code')}"
        assert 'expiresAt' in resp['data']
        print(f"✅ PASS: Current code is {resp['data']['code']}")
        passed_count += 1
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # TEST 8: TV redeems code (no auth)
    test_count += 1
    print(f"\n[TEST {test_count}] TV redeems code {code_a} (no auth required)")
    tv_cookie = None
    try:
        resp = await make_request(
            f"{API_BASE}/tv-pair/redeem",
            method='POST',
            json_data={'code': code_a}
        )
        assert resp['status'] == 200, f"Expected 200, got {resp['status']}"
        assert resp['data'].get('ok') == True
        assert resp['data'].get('familyId') == family_a_id
        assert resp['cookie'] is not None, "Should set eqrel_session cookie"
        tv_cookie = resp['cookie']  # Already extracted as just the token value
        print(f"✅ PASS: Code redeemed successfully, familyId={family_a_id}, session cookie set")
        passed_count += 1
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # TEST 9: Verify TV session works (can access display-data)
    test_count += 1
    print(f"\n[TEST {test_count}] TV session can access /api/family/display-data")
    try:
        resp = await make_request(
            f"{API_BASE}/family/display-data",
            method='GET',
            headers={'Cookie': f'eqrel_session={tv_cookie}'}
        )
        assert resp['status'] == 200, f"Expected 200, got {resp['status']}"
        assert 'family' in resp['data']
        assert resp['data']['family']['id'] == family_a_id
        print(f"✅ PASS: TV session works, can access family data")
        passed_count += 1
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # TEST 10: Code marked as used in DB
    test_count += 1
    print(f"\n[TEST {test_count}] Code marked as used in database")
    try:
        code_doc = db.tv_pair_codes.find_one({'code': code_a})
        assert code_doc is not None, "Code should exist in DB"
        assert code_doc['usedAt'] is not None, "usedAt should be set"
        assert code_doc['familyId'] == family_a_id
        assert code_doc['createdBy'] == user_a_id
        print(f"✅ PASS: Code marked as used at {code_doc['usedAt']}")
        passed_count += 1
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # TEST 11: TV tries to redeem same code again → 400
    test_count += 1
    print(f"\n[TEST {test_count}] TV tries to redeem already-used code → 400")
    try:
        resp = await make_request(
            f"{API_BASE}/tv-pair/redeem",
            method='POST',
            json_data={'code': code_a}
        )
        assert resp['status'] == 400, f"Expected 400, got {resp['status']}"
        assert 'invalid' in resp['data'].get('error', '').lower() or 'expired' in resp['data'].get('error', '').lower()
        print("✅ PASS: Already-used code rejected with 400")
        passed_count += 1
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # ═══════════════════════════════════════════════════════════════════════════════
    # SECTION 5: Regenerate Invalidates Old Code
    # ═══════════════════════════════════════════════════════════════════════════════
    print("\n" + "=" * 80)
    print("SECTION 5: Regenerate Invalidates Old Code")
    print("=" * 80)
    
    # TEST 12: Parent A generates new code C2
    test_count += 1
    print(f"\n[TEST {test_count}] Parent A generates new code (should invalidate old unused codes)")
    code_a2 = None
    try:
        resp = await make_request(
            f"{API_BASE}/family/tv-pair/generate",
            method='POST',
            headers={'Cookie': f'eqrel_session={token_a}'}
        )
        assert resp['status'] == 200, f"Expected 200, got {resp['status']}"
        code_a2 = resp['data']['code']
        assert code_a2 != code_a, "New code should be different"
        print(f"✅ PASS: Generated new code {code_a2}")
        passed_count += 1
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # TEST 13: Old code C1 should be deleted from DB (was already used, but let's verify cleanup)
    test_count += 1
    print(f"\n[TEST {test_count}] Verify old unused codes are deleted on regenerate")
    try:
        # Create a fresh unused code first
        db.tv_pair_codes.insert_one({
            'code': '111111',
            'familyId': family_a_id,
            'createdBy': user_a_id,
            'createdAt': datetime.utcnow(),
            'expiresAt': datetime.utcnow() + timedelta(minutes=15),
            'usedAt': None
        })
        
        # Generate new code (should delete unused ones)
        resp = await make_request(
            f"{API_BASE}/family/tv-pair/generate",
            method='POST',
            headers={'Cookie': f'eqrel_session={token_a}'}
        )
        code_a3 = resp['data']['code']
        
        # Check that 111111 is deleted
        old_code = db.tv_pair_codes.find_one({'code': '111111'})
        assert old_code is None, "Old unused code should be deleted"
        print(f"✅ PASS: Old unused codes deleted on regenerate, new code is {code_a3}")
        passed_count += 1
        
        # Store code_a3 for next test
        code_a2 = code_a3
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # TEST 14: TV redeems new code C2 → 200
    test_count += 1
    print(f"\n[TEST {test_count}] TV redeems new code {code_a2}")
    try:
        resp = await make_request(
            f"{API_BASE}/tv-pair/redeem",
            method='POST',
            json_data={'code': code_a2}
        )
        assert resp['status'] == 200, f"Expected 200, got {resp['status']}"
        assert resp['data'].get('ok') == True
        print(f"✅ PASS: New code redeemed successfully")
        passed_count += 1
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # ═══════════════════════════════════════════════════════════════════════════════
    # SECTION 6: Expiry
    # ═══════════════════════════════════════════════════════════════════════════════
    print("\n" + "=" * 80)
    print("SECTION 6: Expiry")
    print("=" * 80)
    
    # TEST 15: Create expired code manually, try to redeem → 400
    test_count += 1
    print(f"\n[TEST {test_count}] TV tries to redeem expired code → 400")
    expired_code = '888888'
    try:
        db.tv_pair_codes.insert_one({
            'code': expired_code,
            'familyId': family_a_id,
            'createdBy': user_a_id,
            'createdAt': datetime.utcnow() - timedelta(minutes=20),
            'expiresAt': datetime.utcnow() - timedelta(minutes=5),  # Expired 5 min ago
            'usedAt': None
        })
        
        resp = await make_request(
            f"{API_BASE}/tv-pair/redeem",
            method='POST',
            json_data={'code': expired_code}
        )
        assert resp['status'] == 400, f"Expected 400, got {resp['status']}"
        assert 'invalid' in resp['data'].get('error', '').lower() or 'expired' in resp['data'].get('error', '').lower()
        print("✅ PASS: Expired code rejected with 400")
        passed_count += 1
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # TEST 16: GET /current should not return expired code
    test_count += 1
    print(f"\n[TEST {test_count}] GET /current should not return expired code")
    try:
        # Clean up any active codes for family A first
        db.tv_pair_codes.delete_many({'familyId': family_a_id, 'usedAt': None})
        
        # All codes for family A are now used or expired, should return null
        resp = await make_request(
            f"{API_BASE}/family/tv-pair/current",
            method='GET',
            headers={'Cookie': f'eqrel_session={token_a}'}
        )
        assert resp['status'] == 200, f"Expected 200, got {resp['status']}"
        assert resp['data'].get('code') is None, f"Should return null, got {resp['data'].get('code')}"
        print("✅ PASS: GET /current returns null when no active code")
        passed_count += 1
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # ═══════════════════════════════════════════════════════════════════════════════
    # SECTION 7: Invalid Code Format
    # ═══════════════════════════════════════════════════════════════════════════════
    print("\n" + "=" * 80)
    print("SECTION 7: Invalid Code Format")
    print("=" * 80)
    
    # TEST 17: 5 digits → 400
    test_count += 1
    print(f"\n[TEST {test_count}] POST /redeem with 5-digit code → 400")
    try:
        resp = await make_request(
            f"{API_BASE}/tv-pair/redeem",
            method='POST',
            json_data={'code': '12345'}
        )
        assert resp['status'] == 400, f"Expected 400, got {resp['status']}"
        assert 'format' in resp['data'].get('error', '').lower() or 'invalid' in resp['data'].get('error', '').lower()
        print("✅ PASS: 5-digit code rejected with 400")
        passed_count += 1
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # TEST 18: 7 digits → 400
    test_count += 1
    print(f"\n[TEST {test_count}] POST /redeem with 7-digit code → 400")
    try:
        resp = await make_request(
            f"{API_BASE}/tv-pair/redeem",
            method='POST',
            json_data={'code': '1234567'}
        )
        assert resp['status'] == 400, f"Expected 400, got {resp['status']}"
        assert 'format' in resp['data'].get('error', '').lower() or 'invalid' in resp['data'].get('error', '').lower()
        print("✅ PASS: 7-digit code rejected with 400")
        passed_count += 1
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # TEST 19: Letters → 400
    test_count += 1
    print(f"\n[TEST {test_count}] POST /redeem with letters → 400")
    try:
        resp = await make_request(
            f"{API_BASE}/tv-pair/redeem",
            method='POST',
            json_data={'code': 'ABCDEF'}
        )
        assert resp['status'] == 400, f"Expected 400, got {resp['status']}"
        assert 'format' in resp['data'].get('error', '').lower() or 'invalid' in resp['data'].get('error', '').lower()
        print("✅ PASS: Letter code rejected with 400")
        passed_count += 1
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # TEST 20: Empty string → 400
    test_count += 1
    print(f"\n[TEST {test_count}] POST /redeem with empty code → 400")
    try:
        resp = await make_request(
            f"{API_BASE}/tv-pair/redeem",
            method='POST',
            json_data={'code': ''}
        )
        assert resp['status'] == 400, f"Expected 400, got {resp['status']}"
        assert 'format' in resp['data'].get('error', '').lower() or 'invalid' in resp['data'].get('error', '').lower()
        print("✅ PASS: Empty code rejected with 400")
        passed_count += 1
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # TEST 21: Missing code field → 400
    test_count += 1
    print(f"\n[TEST {test_count}] POST /redeem without code field → 400")
    try:
        resp = await make_request(
            f"{API_BASE}/tv-pair/redeem",
            method='POST',
            json_data={}
        )
        assert resp['status'] == 400, f"Expected 400, got {resp['status']}"
        assert 'format' in resp['data'].get('error', '').lower() or 'invalid' in resp['data'].get('error', '').lower()
        print("✅ PASS: Missing code field rejected with 400")
        passed_count += 1
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # ═══════════════════════════════════════════════════════════════════════════════
    # SECTION 8: Cross-Family Isolation
    # ═══════════════════════════════════════════════════════════════════════════════
    print("\n" + "=" * 80)
    print("SECTION 8: Cross-Family Isolation")
    print("=" * 80)
    
    # TEST 22: Family A generates code CA
    test_count += 1
    print(f"\n[TEST {test_count}] Family A generates code CA")
    code_ca = None
    try:
        resp = await make_request(
            f"{API_BASE}/family/tv-pair/generate",
            method='POST',
            headers={'Cookie': f'eqrel_session={token_a}'}
        )
        code_ca = resp['data']['code']
        print(f"✅ PASS: Family A generated code {code_ca}")
        passed_count += 1
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # TEST 23: Family B generates code CB
    test_count += 1
    print(f"\n[TEST {test_count}] Family B generates code CB")
    code_cb = None
    try:
        resp = await make_request(
            f"{API_BASE}/family/tv-pair/generate",
            method='POST',
            headers={'Cookie': f'eqrel_session={token_b}'}
        )
        code_cb = resp['data']['code']
        assert code_cb != code_ca, "Codes should be different"
        print(f"✅ PASS: Family B generated code {code_cb}")
        passed_count += 1
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # TEST 24: Parent B GET /current → returns CB only (not CA)
    test_count += 1
    print(f"\n[TEST {test_count}] Parent B GET /current → returns CB only")
    try:
        resp = await make_request(
            f"{API_BASE}/family/tv-pair/current",
            method='GET',
            headers={'Cookie': f'eqrel_session={token_b}'}
        )
        assert resp['status'] == 200
        assert resp['data'].get('code') == code_cb, f"Expected {code_cb}, got {resp['data'].get('code')}"
        print(f"✅ PASS: Parent B sees only their family's code {code_cb}")
        passed_count += 1
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # TEST 25: TV redeems CA → session is for Family A (not B)
    test_count += 1
    print(f"\n[TEST {test_count}] TV redeems CA → session is for Family A")
    try:
        resp = await make_request(
            f"{API_BASE}/tv-pair/redeem",
            method='POST',
            json_data={'code': code_ca}
        )
        assert resp['status'] == 200
        assert resp['data'].get('familyId') == family_a_id, f"Expected {family_a_id}, got {resp['data'].get('familyId')}"
        print(f"✅ PASS: TV session is for Family A (not B)")
        passed_count += 1
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # ═══════════════════════════════════════════════════════════════════════════════
    # SECTION 9: Session Role Verification
    # ═══════════════════════════════════════════════════════════════════════════════
    print("\n" + "=" * 80)
    print("SECTION 9: Session Role Verification")
    print("=" * 80)
    
    # TEST 26: Verify TV session has role='tv'
    test_count += 1
    print(f"\n[TEST {test_count}] Verify TV session has role='tv' in JWT")
    try:
        # Generate a fresh code and redeem it
        resp = await make_request(
            f"{API_BASE}/family/tv-pair/generate",
            method='POST',
            headers={'Cookie': f'eqrel_session={token_a}'}
        )
        fresh_code = resp['data']['code']
        
        resp = await make_request(
            f"{API_BASE}/tv-pair/redeem",
            method='POST',
            json_data={'code': fresh_code}
        )
        tv_token = resp['cookie']  # Already extracted as just the token value
        
        # Decode JWT to check role
        decoded = jwt.decode(tv_token, AUTH_SECRET, algorithms=['HS256'])
        assert decoded.get('role') == 'tv', f"Expected role='tv', got {decoded.get('role')}"
        assert decoded.get('userId') == user_a_id, "Should use creator's userId"
        assert decoded.get('familyId') == family_a_id, "Should have creator's familyId"
        print(f"✅ PASS: TV session has role='tv', userId={user_a_id}, familyId={family_a_id}")
        passed_count += 1
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # ═══════════════════════════════════════════════════════════════════════════════
    # SECTION 10: Edge Cases
    # ═══════════════════════════════════════════════════════════════════════════════
    print("\n" + "=" * 80)
    print("SECTION 10: Edge Cases")
    print("=" * 80)
    
    # TEST 27: Code with leading/trailing spaces should be trimmed
    test_count += 1
    print(f"\n[TEST {test_count}] Code with spaces should be trimmed and work")
    try:
        resp = await make_request(
            f"{API_BASE}/family/tv-pair/generate",
            method='POST',
            headers={'Cookie': f'eqrel_session={token_a}'}
        )
        code_with_spaces = '  ' + resp['data']['code'] + '  '
        
        resp = await make_request(
            f"{API_BASE}/tv-pair/redeem",
            method='POST',
            json_data={'code': code_with_spaces}
        )
        assert resp['status'] == 200, f"Expected 200, got {resp['status']}"
        print("✅ PASS: Code with spaces trimmed and accepted")
        passed_count += 1
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # TEST 28: Lowercase code should be converted to uppercase (based on code line 931)
    test_count += 1
    print(f"\n[TEST {test_count}] Lowercase code should be converted to uppercase")
    try:
        resp = await make_request(
            f"{API_BASE}/family/tv-pair/generate",
            method='POST',
            headers={'Cookie': f'eqrel_session={token_a}'}
        )
        code_upper = resp['data']['code']
        code_lower = code_upper.lower()
        
        resp = await make_request(
            f"{API_BASE}/tv-pair/redeem",
            method='POST',
            json_data={'code': code_lower}
        )
        assert resp['status'] == 200, f"Expected 200, got {resp['status']}"
        print("✅ PASS: Lowercase code converted to uppercase and accepted")
        passed_count += 1
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # TEST 29: Non-existent code → 400
    test_count += 1
    print(f"\n[TEST {test_count}] Non-existent code → 400")
    try:
        resp = await make_request(
            f"{API_BASE}/tv-pair/redeem",
            method='POST',
            json_data={'code': '000000'}
        )
        assert resp['status'] == 400, f"Expected 400, got {resp['status']}"
        assert 'invalid' in resp['data'].get('error', '').lower() or 'expired' in resp['data'].get('error', '').lower()
        print("✅ PASS: Non-existent code rejected with 400")
        passed_count += 1
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # ═══════════════════════════════════════════════════════════════════════════════
    # CLEANUP
    # ═══════════════════════════════════════════════════════════════════════════════
    print("\n" + "=" * 80)
    print("CLEANUP")
    print("=" * 80)
    
    print("\n🧹 Cleaning up test data...")
    db.users.delete_many({'email': {'$regex': 'tvpair-test'}})
    db.families.delete_many({'id': {'$regex': 'tvpair-fam'}})
    db.sessions.delete_many({'email': {'$regex': 'tvpair-test'}})
    db.tv_pair_codes.delete_many({'familyId': {'$regex': 'tvpair-fam'}})
    print("✅ Cleanup complete")
    
    # ═══════════════════════════════════════════════════════════════════════════════
    # SUMMARY
    # ═══════════════════════════════════════════════════════════════════════════════
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print(f"\nTotal Tests: {test_count}")
    print(f"Passed: {passed_count}")
    print(f"Failed: {test_count - passed_count}")
    
    if passed_count == test_count:
        print("\n🎉 ALL TESTS PASSED!")
        return 0
    else:
        print(f"\n❌ {test_count - passed_count} TEST(S) FAILED")
        return 1

if __name__ == '__main__':
    exit_code = asyncio.run(test_tv_pair_endpoints())
    sys.exit(exit_code)
