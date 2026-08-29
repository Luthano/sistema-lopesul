export const BRAND = {
  name: 'Lopesul',
  tagline: 'A logística acelerada que faz acontecer.',
  siteUrl: 'https://lopesul.com',
  siteLabel: 'lopesul.com',
  emailComercial: 'comercial@lopesul.com',
  emailOperacional: 'operacional@lopesul.com',
  logo: '/home/logo-lopesul.png',
  icon: '/home/logo-lopesul.png',
}

export function mailtoComercial(subject) {
  const base = `mailto:${BRAND.emailComercial}`
  return subject ? `${base}?subject=${encodeURIComponent(subject)}` : base
}

export function mailtoOperacional() {
  return `mailto:${BRAND.emailOperacional}`
}
