import * as Linking from 'expo-linking';

export const TERRALINK_WHATSAPP = process.env.EXPO_PUBLIC_TERRALINK_WHATSAPP ?? '';
export const TERRALINK_EMAIL = process.env.EXPO_PUBLIC_TERRALINK_EMAIL ?? '';

function digits(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

export function openWhatsApp(phone: string = TERRALINK_WHATSAPP, text?: string) {
  const query = text ? `?text=${encodeURIComponent(text)}` : '';
  return Linking.openURL(`https://wa.me/${digits(phone)}${query}`);
}

export function callPhone(phone: string) {
  return Linking.openURL(`tel:${phone.replace(/\s/g, '')}`);
}

export function sendEmail(email: string = TERRALINK_EMAIL, subject?: string) {
  const query = subject ? `?subject=${encodeURIComponent(subject)}` : '';
  return Linking.openURL(`mailto:${email}${query}`);
}
