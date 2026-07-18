import { MongoClient, ServerApiVersion } from 'mongodb'

const uri = process.env.MONGO_URL
if (!uri) throw new Error('MONGO_URL missing in .env')

const dbName = process.env.DB_NAME || 'eqrel'

let clientPromise

if (!global._mongoClientPromise) {
  const client = new MongoClient(uri)
  global._mongoClientPromise = client.connect()
}
clientPromise = global._mongoClientPromise

export async function getDb() {
  const client = await clientPromise
  return client.db(dbName)
}

export default clientPromise
