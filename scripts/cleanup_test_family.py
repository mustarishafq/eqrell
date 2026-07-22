#!/usr/bin/env python3
"""Cleanup script — removes all test entities created by seed_test_family.py."""
import os
from pymongo import MongoClient

MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'eqrel')

client = MongoClient(MONGO_URL)
db = client[DB_NAME]

# Remove by test-* prefix
result = {
    'families': db.families.delete_many({'id': {'$regex': '^test-fam-'}}).deleted_count,
    'users': db.users.delete_many({'id': {'$regex': '^test-user-'}}).deleted_count,
    'sessions': db.sessions.delete_many({'sid': {'$regex': '^test-session-'}}).deleted_count,
    'children': db.children.delete_many({'id': {'$regex': '^test-child-'}}).deleted_count,
    'habits': db.habits.delete_many({'id': {'$regex': '^test-habit-'}}).deleted_count,
    'habit_claims': db.habit_claims.delete_many({'habitId': {'$regex': '^test-habit-'}}).deleted_count,
    'verify_log': db.verify_log.delete_many({'habitId': {'$regex': '^test-habit-'}}).deleted_count,
}
print('Cleanup done:', result)
client.close()
