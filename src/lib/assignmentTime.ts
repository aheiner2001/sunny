/** Format a local datetime input without discarding seconds from the actual checkout time. */
export function toLocalAssignmentTime(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 19);
}
