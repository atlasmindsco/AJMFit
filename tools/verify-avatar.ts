/**
 * What counts as a usable profile photo, and where it is allowed to land.
 *
 * The path matters more than it looks. The storage policy checks the FIRST
 * path segment against the signed-in user's id, so a path built any other way
 * is rejected by the database rather than by us — which surfaces to a client
 * as a storage error on a photo of their own face.
 */
import {
  avatarPathFor,
  extensionFor,
  reject,
  ALLOWED_TYPES,
  MAX_BYTES,
  AVATAR_BUCKET,
} from '@/lib/avatar-rules'

let failed = 0
const ok = (cond: boolean, label: string, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${extra ? '  — ' + extra : ''}`)
}

const USER = '7f3a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90'

console.log('THE PATH STARTS WITH THE CLIENT, BECAUSE THE POLICY CHECKS THAT\n')
const path = avatarPathFor(USER, 'image/jpeg')
console.log(`        -> ${path}`)
ok(path === `${USER}/avatar.jpg`, 'id, then the file', String(path))
ok(String(path).split('/')[0] === USER, 'the first segment is the user id', String(path).split('/')[0])

console.log('\nONE FILE PER CLIENT, SO UPLOADING AGAIN REPLACES\n')
// Not dated, not random. A folder that fills up with old avatars is a folder
// nobody asked to keep.
ok(
  avatarPathFor(USER, 'image/jpeg') === avatarPathFor(USER, 'image/jpeg'),
  'the same type always lands on the same path'
)
ok(!/\d{4}-\d{2}-\d{2}/.test(String(path)), 'no date in the name', String(path))

console.log('\nEVERY ACCEPTED TYPE HAS AN EXTENSION\n')
for (const type of ALLOWED_TYPES) {
  const ext = extensionFor(type)
  ok(Boolean(ext), `${type} -> .${ext}`, String(ext))
  ok(avatarPathFor(USER, type) !== null, `and builds a path`)
}

console.log('\nHEIC IS REFUSED ON PURPOSE\n')
/* An iPhone photo straight from the library is HEIC. Chrome and Firefox
   cannot draw it, so accepting it means a client uploads successfully and
   then stares at a broken image. iOS converts to JPEG when the input accepts
   only the three above — the narrow list is what makes it work. */
ok(extensionFor('image/heic') === null, 'no extension for HEIC')
ok(avatarPathFor(USER, 'image/heic') === null, 'and no path')
ok(reject({ type: 'image/heic', size: 2_000_000 }) !== null, 'and it is rejected with a reason')
console.log(`        says: "${reject({ type: 'image/heic', size: 2_000_000 })?.reason}"`)

console.log('\nA PATH IS NEVER BUILT FROM SOMETHING THAT IS NOT AN ID\n')
// A path that escapes the client's own folder would be refused by the policy
// anyway. Building one at all is the mistake worth catching here.
for (const [label, id] of [
  ['empty', ''],
  ['whitespace', '   '],
  ['a traversal', '../someone-else'],
  ['a slash', 'a/b'],
] as Array<[string, string]>) {
  ok(avatarPathFor(id, 'image/jpeg') === null, `${label} builds nothing`, String(avatarPathFor(id, 'image/jpeg')))
}

console.log('\nWHAT A CLIENT IS TOLD WHEN A FILE WILL NOT DO\n')
for (const [label, file] of [
  ['nothing chosen', null],
  ['a PDF', { type: 'application/pdf', size: 100_000 }],
  ['an empty file', { type: 'image/jpeg', size: 0 }],
  ['a 20 MB photo', { type: 'image/jpeg', size: 20 * 1024 * 1024 }],
] as Array<[string, { type: string; size: number } | null]>) {
  const r = reject(file)
  ok(r != null, label, r?.reason ?? 'ACCEPTED')
  ok(!/undefined|NaN|null/.test(r?.reason ?? ''), '  and the words make sense', r?.reason ?? '')
}

console.log('\nAND A NORMAL PHONE PHOTO GOES STRAIGHT THROUGH\n')
for (const [label, file] of [
  ['a 3 MB JPG', { type: 'image/jpeg', size: 3 * 1024 * 1024 }],
  ['a PNG screenshot', { type: 'image/png', size: 900_000 }],
  ['a WEBP', { type: 'image/webp', size: 400_000 }],
  ['exactly 8 MB', { type: 'image/jpeg', size: MAX_BYTES }],
] as Array<[string, { type: string; size: number }]>) {
  ok(reject(file) === null, label, reject(file)?.reason ?? '')
}

console.log('\nTHE BUCKET IS THE PRIVATE ONE\n')
/* Not meal-images, which is public because those are photographs of food
   Anthony publishes on purpose. A client's face gets a signed URL. */
ok(AVATAR_BUCKET === 'profile-photos', 'profile-photos', AVATAR_BUCKET)
ok(AVATAR_BUCKET !== 'meal-images', 'and not the public one')

console.log(failed === 0 ? '\nAll avatar checks passed.' : `\n${failed} CHECK${failed === 1 ? '' : 'S'} FAILED`)
process.exit(failed === 0 ? 0 : 1)
