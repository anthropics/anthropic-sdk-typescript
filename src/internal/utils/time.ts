/** Current time as unix epoch seconds. */
export function nowAsSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
