/**
 * Who is paying twice, and — more importantly — who is not.
 *
 * Found four months late: Ruth had three active subscriptions across two
 * accounts, Luis had two, and nothing in the product could notice.
 *
 * The checks that matter most are the NEGATIVE ones. A comped client on a
 * 100% promo code holds a real subscription at zero and is indistinguishable
 * here from a paying one. If this ever reported them, the coach would go
 * cancelling the free access he deliberately gave away.
 */
import { findDuplicates, duplicateHeadline, BILLABLE } from '@/lib/duplicate-subs'

let failed = 0
const ok = (cond: boolean, label: string, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${extra ? '  — ' + extra : ''}`)
}

const user = (id: string, name: string, email: string) => ({ id, name, email })
const sub = (user_id: string, stripe_subscription_id: string, status = 'active') => ({
  user_id,
  status,
  stripe_subscription_id,
})

console.log('THE REAL CASE, AS IT STOOD ON 21 NOVEMBER\n')
/* Ruth signed up twice, three days apart, on two near-identical Gmail
   addresses, and checked out three times in total. */
const users = [
  user('ruth-a', 'Ruth Fleurime', 'rumafle07@gmail.com'),
  user('ruth-b', 'Ruth Fleurime', 'rfleurm07@gmail.com'),
  user('luis', 'luisrobleslopez256', 'luisrobleslopez256@gmail.com'),
  user('jamel', 'Jamel Vivenzio', 'jvivenzio435@gmail.com'),
  user('arun', 'Arun Mathur', 'arun.mathur@gmail.com'),
]
const subs = [
  sub('ruth-a', 'sub_Tx51F'),
  sub('ruth-a', 'sub_TyB8F'),
  sub('ruth-b', 'sub_TyG3F'),
  sub('luis', 'sub_U9b6f'),
  sub('luis', 'sub_UMub0'),
  sub('jamel', 'sub_jamel'),
  sub('arun', 'sub_arun'),
]
const found = findDuplicates(users, subs)
found.forEach((d) =>
  console.log(`        ${d.name}: ${d.subscriptionIds.length} subscriptions, ${d.userIds.length} account(s), ${d.confidence}`)
)
ok(found.length === 2, 'two people, not seven', String(found.length))

const ruth = found.find((d) => d.name === 'Ruth Fleurime')
ok(ruth != null, 'Ruth is found')
ok(ruth?.subscriptionIds.length === 3, 'with all three subscriptions', String(ruth?.subscriptionIds.length))
ok(ruth?.userIds.length === 2, 'and both accounts joined into one row', String(ruth?.userIds.length))
ok(ruth?.emails.length === 2, 'with both emails, so the coach can find them', ruth?.emails.join(' '))

const luis = found.find((d) => d.name.startsWith('luis'))
ok(luis?.subscriptionIds.length === 2, 'Luis has two', String(luis?.subscriptionIds.length))
ok(luis?.confidence === 'same_account', 'and it is certain, not a guess', String(luis?.confidence))

console.log('\nNOBODY WITH ONE SUBSCRIPTION IS EVER REPORTED\n')
/* The check that protects comped clients. A free account on a 100% code is a
   real subscription at zero and looks exactly like a paying one here. It must
   never show up as something to cancel. */
for (const [label, rows] of [
  ['a paying client', [sub('jamel', 'sub_jamel')]],
  ['a comped client on a 100% code', [sub('free1', 'sub_free1')]],
  ['somebody mid-trial', [sub('free2', 'sub_free2', 'trialing')]],
  ['a past-due client', [sub('late', 'sub_late', 'past_due')]],
] as Array<[string, ReturnType<typeof sub>[]]>) {
  const r = findDuplicates([user(rows[0].user_id, 'Someone', 's@example.com')], rows)
  ok(r.length === 0, label, r.length ? 'REPORTED' : '')
}

console.log('\nTWO PEOPLE WHO MERELY SHARE A NAME ARE NOT MERGED\n')
// Flagging them would be bad; silently cancelling one would be worse.
const sameName = findDuplicates(
  [user('a', 'John Smith', 'john@a.com'), user('b', 'John Smith', 'john@b.com')],
  [sub('a', 'sub_a'), sub('b', 'sub_b')]
)
ok(sameName.length === 1, 'they are flagged', String(sameName.length))
ok(sameName[0]?.confidence === 'same_name', 'as a GUESS, not a certainty', String(sameName[0]?.confidence))
ok(sameName[0]?.emails.length === 2, 'with both emails shown so a human can judge', sameName[0]?.emails.join(' '))

console.log('\nA CANCELLED SUBSCRIPTION IS NOT A DUPLICATE\n')
/* Somebody who cancelled and came back later has two rows and is paying once.
   Reporting them would send the coach to cancel the live one. */
ok(
  findDuplicates([user('x', 'Returner', 'r@example.com')], [sub('x', 'sub_old', 'canceled'), sub('x', 'sub_new')])
    .length === 0,
  'cancelled then resubscribed is fine'
)
ok(
  findDuplicates([user('x', 'Returner', 'r@example.com')], [sub('x', 'sub_a', 'incomplete'), sub('x', 'sub_b')])
    .length === 0,
  'an incomplete checkout is not a subscription'
)
ok(BILLABLE.indexOf('canceled') === -1, 'canceled is not billable')
ok(BILLABLE.indexOf('trialing') !== -1, 'but a trial is, because it becomes one')

console.log('\nA ROW WITH NO STRIPE ID IS NOT MONEY\n')
ok(
  findDuplicates([user('x', 'X', 'x@e.com')], [sub('x', 'sub_real'), { user_id: 'x', status: 'active', stripe_subscription_id: null }])
    .length === 0,
  'without a Stripe id nothing is being charged'
)

console.log('\nTHE SAME SUBSCRIPTION TWICE IS ONE SUBSCRIPTION\n')
ok(
  findDuplicates([user('x', 'X', 'x@e.com')], [sub('x', 'sub_same'), sub('x', 'sub_same')]).length === 0,
  'duplicate rows for one Stripe id do not count as two'
)

console.log('\nTHE HEADLINE COUNTS THE EXTRA ONES, NOT THE PEOPLE\n')
console.log(`        -> ${duplicateHeadline(found)}`)
ok(duplicateHeadline([]) === null, 'nothing to say when there is nothing wrong')
ok(/3 extra/.test(String(duplicateHeadline(found))), 'Ruth 2 extra + Luis 1 extra = 3', String(duplicateHeadline(found)))

console.log('\nAND NOTHING EMPTY BREAKS IT\n')
for (const [label, u, s] of [
  ['no users, no subs', [], []],
  ['users with no subs', users, []],
  ['subs with no matching user', [], subs],
] as Array<[string, typeof users, typeof subs]>) {
  let got: string
  try {
    got = `${findDuplicates(u, s).length} rows`
  } catch (e) {
    got = `THREW: ${(e as Error).message}`
  }
  ok(!got.startsWith('THREW'), label, got)
}

console.log(
  failed === 0 ? '\nAll duplicate-subscription checks passed.' : `\n${failed} CHECK${failed === 1 ? '' : 'S'} FAILED`
)
process.exit(failed === 0 ? 0 : 1)
