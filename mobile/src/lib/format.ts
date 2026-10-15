import type { FarmType, Level, RecoStatus, RequestStatus, UserRole } from './types';

export function formatDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function daysAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  return `il y a ${days} jours`;
}

export function formatCoords(lat: number | null, lng: number | null): string | null {
  if (lat == null || lng == null) return null;
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export const roleLabel: Record<UserRole, string> = {
  owner: 'Propriétaire',
  agent: 'Agent de terrain',
  admin: 'Équipe TerraLink',
};

export const farmTypeLabel: Record<FarmType, string> = {
  agriculture: 'Agriculture',
  elevage: 'Élevage',
  mixte: 'Agriculture et élevage',
  autre: 'Autre',
};

export const overallLabel: Record<Level, string> = {
  normal: 'Situation normale',
  attention: 'Points à surveiller',
  urgent: 'Intervention urgente',
};

export const levelLabel: Record<Level, string> = {
  normal: 'Normal',
  attention: 'À surveiller',
  urgent: 'Urgent',
};

export const recoStatusLabel: Record<RecoStatus, string> = {
  proposed: 'Proposée',
  accepted: 'Acceptée',
  in_progress: 'En cours',
  done: 'Réalisée',
  declined: 'Non retenue',
};

export const requestStatusLabel: Record<RequestStatus, string> = {
  new: 'Reçue',
  contacted: 'Prise en charge',
  converted: 'Suivi démarré',
  closed: 'Clôturée',
};

export const observationCategories = [
  'Cultures',
  'Élevage',
  'Irrigation',
  'Infrastructures',
  'Personnel',
  'Stocks et intrants',
  'Autre',
] as const;

export function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message: unknown }).message);
    if (message.includes('Invalid login credentials')) return 'Adresse e-mail ou mot de passe incorrect.';
    if (message.includes('User already registered')) return 'Un compte existe déjà avec cette adresse e-mail.';
    if (message.includes('Email not confirmed')) return 'Confirmez votre adresse e-mail via le lien reçu, puis reconnectez-vous.';
    if (message.includes('Network request failed') || message.includes('Failed to fetch'))
      return 'Connexion impossible. Vérifiez votre réseau et réessayez.';
    return message;
  }
  return 'Une erreur inattendue est survenue.';
}
