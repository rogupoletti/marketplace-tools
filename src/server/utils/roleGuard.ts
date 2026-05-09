export function userHasRoles(userRoles: string[], allowedRoles: string[]): boolean {
  return allowedRoles.some(role => userRoles.includes(role));
}
