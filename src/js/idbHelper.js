import idb from 'idb';

export default class IDBHelper {

  constructor() {
    this.idbPromise = this.openDatabase();
  }

  /**
   * Open a IDB database, create an objectStore,
   * fetch restaurants and stores them
   * @return {Promise} - idbPromise to access database
   */
  async openDatabase() {
    // If the browser doesn't support service worker,
    // we don't care about having a database
    if (!navigator.serviceWorker) {
      return Promise.resolve();
    }

    return idb.open('reviews-app', 1, upgradeDb => {
      // restaurants related stores/indexes
      const restaurantsStore = upgradeDb.createObjectStore('restaurants', {
        keyPath: 'id'
      });
      restaurantsStore.createIndex('by-cuisine', 'cuisine_type');
      restaurantsStore.createIndex('by-neighborhood', 'neighborhood');

      // category related stores/indexes
      // store for cuisines
      upgradeDb.createObjectStore('cuisines', {
        autoIncrement: false
      });
      // store for neighborhoods
      upgradeDb.createObjectStore('neighborhoods', {
        autoIncrement: false
      });

      // reviews related stores/indexes
      const reviewsStore = upgradeDb.createObjectStore('reviews', {
        keyPath: 'id'
      });
      reviewsStore.createIndex('by-restaurant-id', 'restaurant_id');
      /* an outbox store to hold (new) deferred reviews */
      const reviewsOutboxStore = upgradeDb.createObjectStore('reviews-outbox', {
        keyPath: 'id',
        autoIncrement: true
      });
      reviewsOutboxStore.createIndex('by-restaurant-id', 'restaurant_id');
    });
  }

  /**
   * Adds or updates items to IDB object store
   * @param {Array} items - The item to update (or insert)
   * @param {String} storeName - The name of the store to open
   * @param {Boolean} withKey - Checks whether or not the item to add/update
   * requires a key in order to be added/updated. If yes, the item itself will be
   * the key as well. Defaults to false.
   */
  async putItemsToStore(items, storeName, withKey=false) {
    try {
      const db = await this.idbPromise;
      if (!db) return;

      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);

      if(withKey) {
        for(const item of items) {
          store.put(item, item);
        }
      } else {
        for(const item of items) {
          store.put(item);
        }
      }

      console.log('added items to ', storeName, ' store');

      return tx.complete;
    } catch (err) {
      console.log(err);
    }
  }

  /**
   *
   * gets one item from a store with given key
   * @param {String} storeName - The name of the store to open
   * @param {*} key - key to get item with
   */
  async getOneItemFromStore(storeName, key) {
    try {
      const db = await this.idbPromise;
      if (!db) return;

      const tx = db.transaction(storeName);
      const store = tx.objectStore(storeName);

      console.log(`Getting one item from store '${storeName}' with key=${key}`);
      return await store.get(key);
    } catch(err) {
      console.log(err);
    }
  }

  /**
   * gets all items from a store with key (if it is given)
   * @param {String} storeName - The name of the store to open
   * @param {*} key - key to get items with (optional)
   */
  async getAllItemsFromStore(storeName, key) {
    try {
      const db = await this.idbPromise;
      if (!db) return;

      const tx = db.transaction(storeName);
      const store = tx.objectStore(storeName);
      console.log(`Getting all items from store '${storeName}' with ${key||'no key'}`);
      if(key) return await store.getAll(key);

      return await store.getAll();
    } catch(err) {
      console.log(err);
    }
  }

  /**
   * gets all items from an index with key (if it is given)
   * @param {String} storeName - The name of the store to open
   * @param {String} indexName - The name of the index to open
   * @param {*} key - key to get items with (optional)
   */
  async getAllItemsFromIndex(storeName, indexName, key) {
    try {
      const db = await this.idbPromise;
      if (!db) return;

      const tx = db.transaction(storeName);
      const index = tx.objectStore(storeName).index(indexName);
      console.log(`Getting all items from store'${storeName}' by index ${indexName} with ${key||'no key'}`);
      if(key) return await index.getAll(key);

      return await index.getAll();
    } catch(err) {
      console.log(err);
    }
  }

  /**
   *
   * @param {number} id - id of the review to delete
   */
  async deleteReviewFromOutbox(id) {
    try {
      const db = await this.idbPromise;
      if (!db) if (!db) return;

      const tx = db.transaction('reviews-outbox', 'readwrite');
      const store = tx.objectStore('reviews-outbox');

      store.delete(id);

      return tx.complete;
    } catch (err) {
      console.log(`Failed to delete review from outbox:\n${err}`);
    }
  }

}