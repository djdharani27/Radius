/**
 * Returns a stable chat ID for two users — always sorted so both sides get the same ID.
 */
export function getChatId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}