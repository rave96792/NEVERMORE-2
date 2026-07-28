// One-time cleanup: remove test orders (default #100 and #101) from the orders collection.
// Prints what will be removed BEFORE deleting so the operation is auditable.
// Usage:  node scripts/purge_test_orders.mjs                # deletes 100 and 101
//         node scripts/purge_test_orders.mjs 100 101 102    # explicit list

import { readFileSync } from 'fs'
import { MongoClient } from 'mongodb'

// Small .env loader — avoids adding a dotenv dep just for this one-off.
for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}

const args = process.argv.slice(2).map((s) => parseInt(s, 10)).filter((n) => Number.isFinite(n))
const nums = args.length ? args : [100, 101]

if (!process.env.MONGO_URL || !process.env.DB_NAME) {
  console.error('MONGO_URL or DB_NAME missing from environment')
  process.exit(1)
}

const client = new MongoClient(process.env.MONGO_URL)
try {
  await client.connect()
  const db = client.db(process.env.DB_NAME)
  const orders = db.collection('orders')

  const toDelete = await orders.find({ orderNumber: { $in: nums } }, {
    projection: { _id: 0, id: 1, orderNumber: 1, status: 1, paypalOrderId: 1, total: 1, deliveryMethod: 1, createdAt: 1 },
  }).toArray()

  if (toDelete.length === 0) {
    console.log(`No orders found with orderNumber in [${nums.join(', ')}]. Nothing to do.`)
  } else {
    console.log(`About to delete ${toDelete.length} order(s):`)
    for (const o of toDelete) {
      console.log(' ', JSON.stringify(o))
    }
    const res = await orders.deleteMany({ orderNumber: { $in: nums } })
    console.log(`Deleted ${res.deletedCount} document(s).`)
  }

  // Show remaining count as a sanity check
  const remaining = await orders.countDocuments({})
  const highest = await orders.find({}, { projection: { orderNumber: 1, _id: 0 } }).sort({ orderNumber: -1 }).limit(1).toArray()
  console.log(`Orders remaining: ${remaining}. Highest orderNumber: ${highest[0]?.orderNumber ?? '(none)'}.`)
} catch (e) {
  console.error('Fatal:', e?.message || e)
  process.exit(1)
} finally {
  await client.close()
}
