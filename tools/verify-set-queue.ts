/**
 * The queue is browser code, so this stubs localStorage before importing it.
 */
const store = new Map<string, string>()
;(globalThis as any).window = {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
}

const { enqueue, flushQueue, queueSize, clearQueue } = await import('../lib/set-queue.ts')

const W = (s: any, n: number) => String(s).padEnd(n)
let fail = 0
const g = (label: string, ok: boolean, detail = '') => {
  if (!ok) fail++
  console.log(W(ok ? '  ok' : '  FAIL', 7), W(label, 50), detail)
}

const set = (slot: string, weight: number) => ({ slot, weight })

console.log('A SET SURVIVES A FAILED WRITE\n')
{
  clearQueue()
  enqueue('ex1-0', set('ex1-0', 135))
  g('held', queueSize() === 1, String(queueSize()))

  const seen: any[] = []
  const r = await flushQueue(async (p) => void seen.push(p))
  g('sent on the next flush', r.sent === 1 && r.remaining === 0)
  g('queue is empty after', queueSize() === 0)
  g('payload survived intact', (seen[0] as any).weight === 135)
}

console.log('\nEDITING A SET WHILE OFFLINE\n')
{
  clearQueue()
  enqueue('ex1-0', set('ex1-0', 135))
  enqueue('ex1-0', set('ex1-0', 145))
  enqueue('ex1-0', set('ex1-0', 155))
  g('one row per slot, not three', queueSize() === 1, String(queueSize()))

  const seen: any[] = []
  await flushQueue(async (p) => void seen.push(p))
  // Replaying 135 then 145 then 155 would be correct in the end but would
  // briefly write back numbers the client had already changed.
  g('only the latest value is sent', seen.length === 1 && (seen[0] as any).weight === 155, String((seen[0] as any)?.weight))
}

console.log('\nSTILL OFFLINE\n')
{
  clearQueue()
  enqueue('a', set('a', 1))
  enqueue('b', set('b', 2))
  enqueue('c', set('c', 3))

  let calls = 0
  const r = await flushQueue(async () => {
    calls++
    throw new Error('offline')
  })
  g('nothing sent', r.sent === 0)
  g('stops at the first failure', calls === 1, `${calls} attempts`)
  g('everything is still queued', r.remaining === 3 && queueSize() === 3, String(queueSize()))
}

console.log('\nCONNECTION COMES BACK MID-FLUSH\n')
{
  clearQueue()
  enqueue('a', set('a', 1))
  enqueue('b', set('b', 2))
  enqueue('c', set('c', 3))

  let n = 0
  const r = await flushQueue(async () => {
    n++
    if (n === 2) throw new Error('dropped again')
  })
  g('the first one lands', r.sent === 1, String(r.sent))
  g('the rest stay queued', r.remaining === 2, String(r.remaining))

  const r2 = await flushQueue(async () => {})
  g('a later flush finishes the job', r2.sent === 2 && queueSize() === 0)
}

console.log('\nORDER AND SAFETY\n')
{
  clearQueue()
  enqueue('a', set('a', 1))
  enqueue('b', set('b', 2))
  const order: string[] = []
  await flushQueue(async (p) => void order.push((p as any).slot))
  g('oldest first', order.join(',') === 'a,b', order.join(','))

  g('flushing an empty queue is a no-op', (await flushQueue(async () => { throw new Error('should not run') })).sent === 0)

  // Unreadable storage must never take the session down with it.
  store.set('ajmfit_pending_sets', '{ this is not json')
  g('corrupt storage reads as empty', queueSize() === 0)
  clearQueue()
  enqueue('a', set('a', 1))
  g('and recovers on the next write', queueSize() === 1)
}

console.log('\n' + (fail === 0 ? 'ALL QUEUE CHECKS PASSED' : `*** ${fail} FAILURES ***`))
if (fail > 0) process.exitCode = 1
