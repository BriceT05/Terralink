// Service worker de la PWA, généré après `expo export -p web` (voir le script build:web).
//
// Mis en cache : uniquement l'application elle-même (code, page, polices et images utilisées),
// pour qu'elle s'ouvre sans réseau. Aucune réponse d'API n'est mise en cache : les appels à Supabase
// (données privées, jetons de session, liens signés des photos) passent toujours par le réseau.
module.exports = {
  globDirectory: 'dist/',
  globPatterns: [
    '*.{html,js,json,ico}',
    '_expo/static/**/*.{js,css}',
    '**/*.png',
    // Seules les polices réellement chargées par l'app (voir src/app/_layout.tsx et les icônes Ionicons).
    '**/Ionicons.*.ttf',
    '**/Lora_600SemiBold.*.ttf',
    '**/Lora_700Bold.*.ttf',
    '**/Poppins_400Regular.*.ttf',
    '**/Poppins_500Medium.*.ttf',
    '**/Poppins_600SemiBold.*.ttf',
  ],
  // Par défaut, Workbox ignore « node_modules », or les polices exportées par Expo s'y trouvent.
  globIgnores: [],
  swDest: 'dist/sw.js',
  // Le code de l'app dépasse la limite par défaut de 2 Mo.
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  // Les fichiers de _expo/static ont déjà une empreinte dans leur nom.
  dontCacheBustURLsMatching: /\/_expo\/static\/|\.[0-9a-f]{32}\./,
  // Toutes les adresses de l'app (/accueil, /visit/…) s'ouvrent avec la même page, y compris hors connexion.
  navigateFallback: '/index.html',
  navigateFallbackDenylist: [/^\/sw\.js$/, /^\/manifest\.json$/],
  cleanupOutdatedCaches: true,
  // La nouvelle version attend l'accord de l'utilisateur (bandeau « Mettre à jour », voir public/register-sw.js).
  skipWaiting: false,
  clientsClaim: false,
};
