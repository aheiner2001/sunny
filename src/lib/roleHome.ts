export function getHomePath(role: 'employee' | 'manager'): '/home' | '/dashboard' {
  return role === 'manager' ? '/dashboard' : '/home';
}
