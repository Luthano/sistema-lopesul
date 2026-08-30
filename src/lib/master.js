export const MASTER_EMAIL = 'luthanogomes@gmail.com'

export const MASTER_EMAILS = [MASTER_EMAIL, 'michael@lopesul.com']

export function isMasterEmail(email) {
  return MASTER_EMAILS.includes(String(email || '').trim().toLowerCase())
}
