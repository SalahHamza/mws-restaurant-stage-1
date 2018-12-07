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
   * get all restaurants
   */
  async getRestaurants() {
    try {

      // fetchRestaurants method is called in the openDatabase
      // method, but since inside openDatabase method
      // this.idbPromise property is yet to be set, there won't be
      // any conflic 'await undefined' yields 'undefined'
      const db = await this.idbPromise;
      if (!db) return;

      const restaurants = [];
      const tx = db.transaction('restaurants');
      const store = tx.objectStore('restaurants');

      // the getAll method sometimes doesn't work in Edge
      // or it takes a lot of time to get the entries
      // since we get cuisines, neighborhoods, and initial
      // restaurants with this method, we use the iterateCursor
      // method to get all restaurants
      store.iterateCursor(cursor => {
        if (!cursor) return;
        restaurants.push(cursor.value);
        cursor.continue();
      });

      // pausing the execution of the async function (with await)
      // until transaction completes & then checking if we got
      // any cuisines
      await tx.complete;
      return restaurants;
    } catch(err) {
      console.log(err);
    }
  }

  /**
   *
   * @param {string|number} id - restaurant id to get
   */
  async getRestaurantById(id) {
    try {

      const db = await this.idbPromise;
      if (!db) return;

      const tx = db.transaction('restaurants');
      const store = tx.objectStore('restaurants');

      // get restaurant with this 'id'
      const restaurant = await store.get(Number(id));
      return restaurant;
    } catch(err) {
      console.log(err);
    }
  }

  /**
   * @param {string} cuisine - cuisine to lookup by
   * @param {string} neighborhood - neighborhood to lookup by
   */
  async getRestaurantsByNeighborhood(neighborhood) {
    try {
      const db = await this.idbPromise;
      if (!db) return;

      const tx = db.transaction('restaurants');
      const store = tx.objectStore('restaurants').index('by-neighborhood');

      return await store.getAll(neighborhood);
    } catch(err) {
      console.log(err);
    }
  }

  /**
   *
   * @param {string} cuisine - cuisine to lookup by
   */
  async getRestaurantsByCuisines(cuisine) {
    try {
      const db = await this.idbPromise;
      if (!db) return;

      const tx = db.transaction('restaurants');
      const store = tx.objectStore('restaurants').index('by-cuisine');

      return await store.getAll(cuisine);
    } catch(err) {
      console.log(err);
    }
  }

  /**
   *
   * @param {string} neighborhood - neighborhood to lookup by
   */
  async getRestaurantsByCuisineAndNeighborhood(cuisine, neighborhood) {
    try {
      const db = await this.idbPromise;
      if (!db) return;

      const tx = db.transaction('restaurants');
      const index = tx.objectStore('restaurants').index('by-neighborhood');

      // get all restaurants with this neighborhood
      const restaurants = await index.getAll(neighborhood);

      // only keeping restaurants with this cuisine_type
      return restaurants.filter(
        restaurant => restaurant.cuisine_type === cuisine
      );
    } catch(err) {
      console.log(err);
    }
  }

  /**
   * get all neighborhoods from neighborhoods store
   */
  async getNeighborhoods() {
    try {
      // fetching neighborhoods from IDB if they exist
      const db = await this.idbPromise;
      if (!db) throw new Error('idbPromise failed to resolve db');

      const neighborhoods = [];
      const tx = db.transaction('neighborhoods');
      const store = tx.objectStore('neighborhoods');

      store.iterateCursor(cursor => {
        if (!cursor) return;
        neighborhoods.push(cursor.value);
        cursor.continue();
      });

      await tx.complete;

      return neighborhoods;
    } catch (err) {
      console.log(err);
    }
  }

  /**
   * get all cuisines from cuisines store
   */
  async getCuisines() {
    try {

      const db = await this.idbPromise;
      if (!db) throw new Error('idbPromise failed to resolve db');

      const cuisines = [];
      const tx = db.transaction('cuisines');
      const store = tx.objectStore('cuisines');

      store.iterateCursor(cursor => {
        if (!cursor) return;
        cuisines.push(cursor.value);
        cursor.continue();
      });

      // pausing the execution of the async function (with await)
      // until transaction completes & then checking if we got
      // any cuisines
      await tx.complete;
      return cuisines;
    } catch (err) {
      console.log(err);
    }
  }

  /**
   * get All reviews for this restaurant id
   * (including the ones in outbox store)
   * @param {number} id - restaurant id to get reviews for
   * @param {*} error - caller's error to log on 'catch'
   */
  async getReviews(id, error) {
    try {
      const db = await this.idbPromise;
      if (!db) throw new Error('idbPromise failed to resolve db');

      const tx = db.transaction('reviews');
      const index = tx.objectStore('reviews').index('by-restaurant-id');
      const reviews = index.getAll(id);

      // getting pending reviews, if there are any
      const pendingReviews = this.getReviewsFromOutbox(id);

      // concatenating and returning both
      // reviews and pending reviews
      return (await pendingReviews).concat(await reviews);
    } catch (err) {
      console.log(`Erros:\n${error}\n${err}`);
    }
  }


  async getReviewsFromOutbox(id) {
    try {
      const db = await this.idbPromise;
      if (!db) throw new Error('idbPromise failed to resolve db');

      const tx = db.transaction('reviews-outbox');
      const store = tx.objectStore('reviews-outbox');

      if (!id) return await store.getAll();

      const index = store.index('by-restaurant-id');
      return await index.getAll(id);
    } catch (err) {
      console.log(`Failed to get reviews from outbox:\n${err}`);
    }
  }

  /**
   * Adds or updates items to IDB object store
   * @param {Array} items - The item to update (or insert).
   * @param {String} storeName - store to update (or insert) items into
   * @param {Boolean} withKey - Checks whether or not the item to add/update
   * requires a key in order to be added/updated. If yes, the item itself will be
   * the key as well. Defaults to false.
   */
  async putItemsToStore(items, storeName, withKey=false) {
    try {
      const db = await this.idbPromise;
      if (!db) throw new Error('idbPromise failed to resolve db');

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
   * @param {number} id - id of the review to delete
   */
  async deleteReviewFromOutbox(id) {
    try {
      const db = await this.idbPromise;
      if (!db) throw new Error('idbPromise failed to resolve db');

      const tx = db.transaction('reviews-outbox', 'readwrite');
      const store = tx.objectStore('reviews-outbox');

      store.delete(id);

      return tx.complete;
    } catch (err) {
      console.log(`Failed to delete review from outbox:\n${err}`);
    }
  }

}