import { MongoClient } from 'mongodb'
import { NextResponse } from 'next/server'

// MongoDB connection (lazy init)
let client
let db

async function connectToMongo() {
  if (!client) {
    client = new MongoClient(process.env.MONGO_URL)
    await client.connect()
    db = client.db(process.env.DB_NAME || 'eqrel')
  }
  return db
}

function handleCORS(response) {
  response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }))
}

async function handleRoute(request, { params }) {
  const { path = [] } = await params
  const route = `/${path.join('/')}`
  const method = request.method

  try {
    // Health check
    if (route === '/' && method === 'GET') {
      return handleCORS(NextResponse.json({
        app: 'EQrel',
        version: 'cohort-a-v0.1',
        tagline: 'Build Habits. Grow Iman.',
        status: 'ok'
      }))
    }

    if (route === '/health' && method === 'GET') {
      const db = await connectToMongo()
      const ping = await db.command({ ping: 1 })
      return handleCORS(NextResponse.json({
        status: 'healthy',
        mongo: ping.ok === 1 ? 'connected' : 'error',
        timestamp: new Date().toISOString(),
      }))
    }

    // Placeholder for future endpoints
    return handleCORS(NextResponse.json(
      { error: `Route ${route} not found` },
      { status: 404 }
    ))
  } catch (error) {
    console.error('API Error:', error)
    return handleCORS(NextResponse.json(
      { error: 'Internal server error', detail: error.message },
      { status: 500 }
    ))
  }
}

export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
