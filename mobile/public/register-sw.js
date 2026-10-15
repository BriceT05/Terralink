// Enregistre le service worker (généré par Workbox au build web, voir workbox-config.js)
// et propose de recharger quand une nouvelle version de l'app est prête.
// Fichier séparé plutôt que script en ligne, pour garder une politique de sécurité (CSP) stricte.
(function () {
  if (!('serviceWorker' in navigator)) return;
  // En développement (npx expo start), il n'y a pas de service worker.
  if (location.port === '8081') return;

  function showUpdateBanner(worker) {
    if (document.getElementById('tl-update')) return;
    var bar = document.createElement('div');
    bar.id = 'tl-update';
    bar.setAttribute('role', 'status');
    bar.style.cssText =
      'position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;max-width:480px;margin:0 auto;' +
      'display:flex;gap:12px;align-items:center;padding:12px 16px;border-radius:16px;' +
      'background:#305C41;color:#fff;font:500 15px/1.4 Poppins_500Medium,system-ui,sans-serif;' +
      'box-shadow:0 8px 24px rgba(43,42,40,.25)';
    var text = document.createElement('span');
    text.style.flex = '1';
    text.textContent = 'Une nouvelle version de TerraLink est disponible.';
    var button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Mettre à jour';
    button.style.cssText =
      'min-height:44px;padding:0 16px;border:0;border-radius:8px;background:#B65F2E;color:#fff;font:inherit;cursor:pointer';
    button.onclick = function () {
      button.disabled = true;
      worker.postMessage({ type: 'SKIP_WAITING' });
    };
    bar.appendChild(text);
    bar.appendChild(button);
    document.body.appendChild(bar);
  }

  window.addEventListener('load', function () {
    navigator.serviceWorker
      .register('/sw.js')
      .then(function (registration) {
        if (registration.waiting && navigator.serviceWorker.controller) showUpdateBanner(registration.waiting);
        registration.addEventListener('updatefound', function () {
          var worker = registration.installing;
          if (!worker) return;
          worker.addEventListener('statechange', function () {
            // « installed » avec une page déjà contrôlée = mise à jour (et non première installation).
            if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner(worker);
          });
        });
      })
      .catch(function () {
        // Pas de service worker : l'app fonctionne normalement, sans cache hors connexion.
      });

    var reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (reloading) return;
      reloading = true;
      location.reload();
    });
  });
})();
