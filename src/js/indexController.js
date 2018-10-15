import Snackbars from '@salahhamza/snackbars';

class IndexController {
  constructor(container) {
    this.snackbars = new Snackbars(container);
  }

  init() {
    window.addEventListener('load', () => {
      this._registerServiceWorker();
    });
  }

  _registerServiceWorker() {
    if(!navigator.serviceWorker) return;

    navigator.serviceWorker.register('./sw.js')
      .then((reg) => {
        if (!navigator.serviceWorker.controller) {
          this.snackbars.show({
            name: 'swRegistered',
            message: 'Service Worker installed! Pages you view are cached for offline use.',
            duration: 4500
          });
          return;
        }

        if (reg.waiting) {
          this._updateReady(reg.waiting);
          return;
        }

        if (reg.installing) {
          this._trackInstalling(reg.installing);
          return;
        }

        reg.addEventListener('updatefound', () => {
          this._trackInstalling(reg.installing);
        });

      }).catch(() => {
        console.log('Sw registeration failed');
        /* setting a retry function to retry sw registration */
        let attempts = 1;
        (function retry() {
          attempts *= 2;
          setTimeout(this._registerServiceWorker, attempts * 60 * 1000);
        }());
      });

    // Ensure refresh is only called once.
    // This works around a bug in "force update on reload".
    let refreshing;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      window.location.reload();
      refreshing = true;
    });
  }

  _trackInstalling (worker) {
    worker.addEventListener('statechange', ()  => {
      if (worker.state == 'installed') {
        this._updateReady(worker);
      }
    });
  }

  _updateReady(worker) {
    this.snackbars.show({
      message: 'New version available! Refresh to update.',
      name: 'update',
      actions: [{
        name: 'refresh',
        handler() {
          worker.postMessage({action: 'skipWaiting'});
        }
      }, {
        name: 'dismiss'
      }]
    });
  }
}

export default IndexController;