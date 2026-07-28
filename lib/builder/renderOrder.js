// Server-only. Orchestrates the "authoritative print file" render for a paid order.
//
// GOALS (from user's Step 3 spec):
//   - Sharp-rendered PNG is authoritative (replaces any client-emergency render)
//   - Payment / order integrity NEVER depends on this succeeding
//   - Idempotent: safe to call more than once per order
//   - Records status + attempts + error on the order doc; audit trail in `render_failures`
//   - Preserves the ORIGINAL layout so re-render is always possible from Mongo alone

import { renderCompositeServer } from '@/lib/builder/serverComposite'
import { storeUploadBuffer } from '@/lib/api/uploads'
import { connectToMongo } from '@/lib/api/mongo'
import { v4 as uuidv4 } from 'uuid'

/**
 * Render every item that has a `layout` payload with sharp, upload to Blob (or disk fallback),
 * then swap the `compositeUrl` on that item and update render status atomically.
 *
 * Params:
 *   internalOrderId - UUID of the order doc (order.id)
 *   origin          - base URL to resolve any relative artwork paths (usually request.url origin)
 *   force           - if true, re-renders even if renderStatus is already 'succeeded'
 *
 * Return:
 *   { ok, renderedCount, totalItems, attempt, error? }
 */
export async function renderOrder(internalOrderId, { origin, force = false } = {}) {
  const database = await connectToMongo()
  const orders = database.collection('orders')

  const order = await orders.findOne({ id: internalOrderId })
  if (!order) return { ok: false, error: 'Order not found', totalItems: 0, renderedCount: 0, attempt: 0 }
  if (order.renderStatus === 'succeeded' && !force) {
    return { ok: true, alreadySucceeded: true, totalItems: order.items?.length || 0, renderedCount: 0, attempt: order.renderAttempts || 1 }
  }

  const attempt = (order.renderAttempts || 0) + 1
  const startedAt = new Date()

  // Mark as in-progress (idempotency guard for parallel invocations — soft only)
  await orders.updateOne(
    { id: internalOrderId },
    { $set: { renderStatus: 'rendering', renderStartedAt: startedAt, updatedAt: startedAt }, $inc: { renderAttempts: 1 } }
  )

  const items = Array.isArray(order.items) ? order.items : []
  const newItems = []
  let renderedCount = 0
  const perItemErrors = []

  for (const it of items) {
    // Only re-render items that have a captured layout. Static / imported items pass through.
    if (!it?.layout || typeof it.layout !== 'object') {
      newItems.push({ ...it, printFileSource: it.printFileSource || 'pass-through' })
      continue
    }

    // Guard: layout MUST carry a sheetSizeId + items[] for sharp to work
    const layout = it.layout
    if (!layout.sheetSizeId || !Array.isArray(layout.items)) {
      newItems.push({ ...it, printFileSource: 'pass-through-invalid-layout' })
      continue
    }

    try {
      const buf = await renderCompositeServer(layout, { origin })
      if (!buf || buf.length < 100) throw new Error('Empty PNG buffer from sharp')

      const filename = `${uuidv4()}.png`
      const stored = await storeUploadBuffer(buf, 'image/png', { filename })

      newItems.push({
        ...it,
        compositeUrl: stored.artworkUrl,
        compositeSize: buf.length,
        compositeStorage: stored.storage,
        printFileSource: 'sharp-authoritative',
        printFileRenderedAt: new Date(),
      })
      renderedCount++
    } catch (e) {
      const errMsg = e?.message || 'render failed'
      perItemErrors.push({ itemId: it.id, error: errMsg })
      // Keep the original client-emergency composite — DO NOT NULL IT OUT.
      newItems.push({
        ...it,
        printFileSource: it.printFileSource || 'client-emergency',
        printFileError: errMsg,
      })
    }
  }

  const completedAt = new Date()
  const anyFailure = perItemErrors.length > 0
  const finalStatus = anyFailure
    ? (attempt >= 3 ? 'failed' : 'pending_retry')
    : 'succeeded'

  await orders.updateOne(
    { id: internalOrderId },
    {
      $set: {
        items: newItems,
        renderStatus: finalStatus,
        renderCompletedAt: completedAt,
        renderError: anyFailure ? JSON.stringify(perItemErrors).slice(0, 2000) : null,
        updatedAt: completedAt,
      },
    }
  )

  // Audit log for any failure
  if (anyFailure) {
    try {
      await database.collection('render_failures').insertOne({
        id: uuidv4(),
        orderId: internalOrderId,
        orderNumber: order.orderNumber,
        attempt,
        errors: perItemErrors,
        createdAt: completedAt,
      })
    } catch (e) {
      // audit log failure is non-fatal
      console.error('[renderOrder] failed to write audit log:', e?.message)
    }
  }

  return {
    ok: !anyFailure,
    renderedCount,
    totalItems: items.length,
    attempt,
    status: finalStatus,
    error: anyFailure ? JSON.stringify(perItemErrors) : undefined,
  }
}
