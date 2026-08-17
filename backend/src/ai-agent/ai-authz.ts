// Sumber tunggal cek role manajerial ada di auth/manager.guard.ts.
// Di-re-export agar gating konteks AI tak pernah divergen dari guard endpoint.
export { isManagerRole as isManagerRoleName } from '../auth/manager.guard';
