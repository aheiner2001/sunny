export function humanizeTimesheetError(error: unknown, action: string): string {
  const code =
    typeof error === 'object' && error && 'code' in error
      ? String((error as { code?: string }).code || '')
      : '';
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String((error as { message?: string }).message || '')
        : typeof error === 'string'
          ? error
          : '';

  if (/NO_ACTIVE_SHIFT/i.test(raw)) {
    return 'No active shift to clock out. Clock in first, then try again.';
  }
  if (/authentication unavailable|not authenticated|auth\/|signed out/i.test(raw) || /unauthenticated/i.test(code)) {
    return `Could not ${action}: you may need to sign in again, then retry.`;
  }
  if (/permission/i.test(raw) || /permission-denied/i.test(code)) {
    return `Could not ${action}: cloud permission was denied. Ask a manager to check Firebase timesheet rules, then retry.`;
  }
  if (
    /\bnetwork\b|offline|Failed to fetch|network-request-failed/i.test(raw) ||
    /unavailable|network-request-failed/i.test(code)
  ) {
    return `Could not ${action}: connection problem. Check the network, then retry.`;
  }
  if (raw.trim()) return raw.replace(/permission-denied/gi, 'permission denied');
  return `Could not ${action}. Please retry.`;
}
