// DEPRECATED: Ce fichier est remplacé par lib/auth.ts
// Gardé temporairement pour compatibilité

export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message) ||
         error.message.includes('No valid authentication tokens') ||
         error.message.includes('401') ||
         error.message.includes('Unauthorized');
}