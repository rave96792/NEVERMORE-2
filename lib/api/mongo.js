import { MongoClient } from 'mongodb'

let client
let db

export async function connectToMongo() {
  if (client && db) return db
  try {
    client = new MongoClient(process.env.MONGO_URL)
    await client.connect()
    db = client.db(process.env.DB_NAME)
    return db
  } catch (e) {
    try { if (client) await client.close() } catch {}
    client = null
    db = null
    throw e
  }
}
