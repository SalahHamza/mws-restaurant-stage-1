import '@babel/polyfill';
import idb from 'idb';
import IndexController from './indexController';

/*
 Change this to your base url in local env
 that would be 'http://localhost:port'
*/
const BASE_URL = (() => {
  if (location.origin.includes('localhost:')) {
    return location.origin;
  }
  return `${location.origin}/mws-restaurant-stage-1`;
})();


/**
 * Common database helper functions.
 */
class DBHelper {
  constructor() {
    this.openDatabase();
    // initilizing indexController (register service worker)
    new IndexController().init();
  }
  /**
   * Fetch MAPBOX Token from DB instead of including
   * it in the script
   */
  static async fetchMAPBOXToken() {
    const headers = new Headers({
      'Authorization': `Basic ${btoa('apiKeyId:Mapbox')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    });
    try {
      const res = await fetch('/mapbox_api_key', { headers });
      const key = await res.json();
      return key.MAPBOX_TOKEN;
    } catch (err) {
      console.log('data wasn\'t fetched');
      return Promise.resolve();
    }
  }

  /**
   * Database URL.
   * Change this to restaurants.json file location on your server.
   */
  static get DATABASE_URL() {
    return 'http://localhost:1337';
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

    this.idbPromise = idb.open('reviews-app', 1, upgradeDb => {
      const store = upgradeDb.createObjectStore('restaurants', {
        keyPath: 'id'
      });
      store.createIndex('by-cuisine', 'cuisine_type');
      store.createIndex('by-neighborhood', 'neighborhood');

      // store for cuisines
      upgradeDb.createObjectStore('cuisines', {
        autoIncrement: false
      });
      // store for neighborhoods
      upgradeDb.createObjectStore('neighborhoods', {
        autoIncrement: false
      });
    });
  }

  /**
   * Fetch all restaurants.
   */
  async fetchRestaurants(callback) {
    try {
      const res = await fetch(`${DBHelper.DATABASE_URL}/restaurants`);
      const restaurants = await res.json();
      callback(null, restaurants);
    } catch (err) {

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
      // and since the fetchRestaurants is used to get
      // cuisines, neighborhoods and the first restaurants
      // display, we use the iterateCursor method to get all
      // values of the said store
      store.iterateCursor(cursor => {
        if (!cursor) return;
        restaurants.push(cursor.value);
        cursor.continue();
      });

      // pausing the execution of the async function (with await)
      // until transaction completes & then checking if we got
      // any cuisines
      await tx.complete;

      if (!restaurants.length) {
        const sentError = `Errors:\n${err}
        No restaurant found in IDB`;
        callback(sentError, null);
      } else {
        callback(null, restaurants);
      }
    }
  }


  /**
   * Fetch a restaurant by its ID.
   */
  async fetchRestaurantById(id, callback) {
    // fetch all restaurants with proper error handling.
    try {
      const res = await fetch(`${DBHelper.DATABASE_URL}/restaurants?id=${id}`);
      const restaurant = await res.json();
      callback(null, restaurant);

      const db = await this.idbPromise;
      if (!db) return;

      const tx = db.transaction('restaurants', 'readwrite');
      const store = tx.objectStore('restaurants');
      store.put(restaurant);

      return tx.complete;

    } catch (err) {
      const db = await this.idbPromise;
      if (!db) return;

      const tx = db.transaction('restaurants');
      const store = tx.objectStore('restaurants');

      // get restaurant with this 'id'
      const restaurant = await store.get(Number(id));

      if (!restaurant) {
        const sentError = `Errors:\n${err}
        Restaurant not found in IDB`;
        callback(sentError, null);
      } else {
        callback(null, restaurant);
      }
      return tx.complete;
    }
  }

  /**
   * Fetch restaurants by a cuisine type with proper error handling.
   */
  async fetchRestaurantByCuisine(cuisine, callback) {
    // Fetch all restaurants  with proper error handling
    try {
      const res = await fetch(`${DBHelper.DATABASE_URL}/restaurants?cuisine_type=${cuisine}`);
      const restaurants = await res.json();
      callback(null, restaurants);
    } catch (err) {

      const db = await this.idbPromise;
      if (!db) return;
      // const restaurants = [];
      const tx = db.transaction('restaurants');
      const store = tx.objectStore('restaurants').index('by-cuisine');

      const restaurants = await store.getAll(cuisine);

      if (!restaurants.length) {
        const sentError = `Errors:\n${err}
        No restaurant found in IDB`;
        callback(sentError, null);
      } else {
        callback(null, restaurants);
      }
      return tx.complete;
    }
  }

  /**
   * Fetch restaurants by a neighborhood with proper error handling.
   */
  async fetchRestaurantByNeighborhood(neighborhood, callback) {
    // Fetch all restaurants
    try {
      const res = await fetch(`${DBHelper.DATABASE_URL}/restaurants?neighborhood=${neighborhood}`);
      const restaurants = await res.json();
      callback(null, restaurants);
    } catch (err) {

      const db = await this.idbPromise;
      if (!db) return;

      // const restaurants = [];
      const tx = db.transaction('restaurants');
      const store = tx.objectStore('restaurants').index('by-neighborhood');

      const restaurants = await store.getAll(neighborhood);

      if (!restaurants.length) {
        const sentError = `Errors:\n${err}
        No restaurant found in IDB`;
        callback(sentError, null);
      } else {
        callback(null, restaurants);
      }
      return tx.complete;
    }
  }

  /**
   * Fetch restaurants by a cuisine and a neighborhood with proper error handling.
   */
  async fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, callback) {
    // Fetch all restaurants
    if (cuisine === 'all' && neighborhood === 'all') {
      this.fetchRestaurants(callback);
      return;
    }
    // fetch by neighborhood
    if (cuisine === 'all') {
      this.fetchRestaurantByNeighborhood(neighborhood, callback);
      return;
    }
    // fetch by cuisine
    if (neighborhood === 'all') {
      this.fetchRestaurantByCuisine(cuisine, callback);
      return;
    }
    // fetch by neighborhood & cuisine
    try {
      const res = await fetch(`${DBHelper.DATABASE_URL}/restaurants?neighborhood=${neighborhood}&cuisine_type=${cuisine}`);
      const restaurants = await res.json();
      callback(null, restaurants);
    } catch (err) {

      const db = await this.idbPromise;
      if (!db) return;

      const tx = db.transaction('restaurants');
      const index = tx.objectStore('restaurants').index('by-neighborhood');

      // get all restaurants with this neighborhood
      const restaurants = await index.getAll(neighborhood);

      if (!restaurants.length) {
        const sentError = `Errors:\n${err}
        No restaurant found in IDB`;
        callback(sentError, null);
      } else {
        // only keeping restaurants with this cuisine_type
        const wantedRestaurants = restaurants
          .filter(restaurant => restaurant.cuisine_type === cuisine);
        callback(null, wantedRestaurants);
      }
      return tx.complete;
    }
  }

  /**
   * Fetch all neighborhoods with proper error handling.
   */
  async fetchNeighborhoods(callback) {
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

      if (!neighborhoods.length) throw new Error('No cuisines found in IDB');
      callback(null, neighborhoods);

    } catch (err) {
      // Fetch all restaurants and extract neighborhoods
      this.fetchRestaurants(async (error, restaurants) => {
        if (error) {
          let sentError = `Errors:\n${err}\n${error}`;
          callback(sentError, null);
          return;
        }
        // Get all neighborhoods from all restaurants
        const neighborhoods = restaurants.map((v, i) => restaurants[i].neighborhood);
        // Remove duplicates from neighborhoods
        const uniqueNeighborhoods = neighborhoods.filter((v, i) => neighborhoods.indexOf(v) == i);
        callback(null, uniqueNeighborhoods);

        const db = await this.idbPromise;
        if (!db) return;

        const tx = db.transaction('neighborhoods', 'readwrite');
        const store = tx.objectStore('neighborhoods');
        for (const neighborhood of uniqueNeighborhoods) {
          store.put(neighborhood, neighborhood);
        }
        return tx.complete;
      });
    }
  }

  /**
   * Fetch all cuisines with proper error handling.
   */
  async fetchCuisines(callback) {
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
      if (!cuisines.length) throw new Error('No cuisine found in IDB');
      callback(null, cuisines);

    } catch (err) {
      // Fetch all restaurants and extract cuisines
      this.fetchRestaurants(async (error, restaurants) => {
        if (error) {
          const sentError = `Errors:\n${err}\n${error}`;
          callback(sentError, null);
          return;
        }
        // Get all cuisines from all restaurants
        const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type);
        // Remove duplicates from cuisines
        const uniqueCuisines = cuisines.filter((v, i) => cuisines.indexOf(v) == i);
        callback(null, uniqueCuisines);

        const db = await this.idbPromise;
        if (!db) return;
        const tx = db.transaction('cuisines', 'readwrite');
        const store = tx.objectStore('cuisines');
        for (const cuisine of uniqueCuisines) {
          store.put(cuisine, cuisine);
        }
        return tx.complete;
      });
    }
  }


  /**
   * Fetch all reviews for specific restaurant
   */
  async fetchReviewsForRestaurantId(id) {
    try {
      const res = await fetch(`${DBHelper.DATABASE_URL}/reviews?restaurant_id=${id}`);
      const data = await res.json();
      return data;
    } catch (err) {
      console.log(err);
    }
  }

  /* ================== Utils ================== */

  /**
   * Restaurant page URL.
   */
  static urlForRestaurant(restaurant) {
    return (`${BASE_URL}/restaurant.html?id=${restaurant.id}`);
  }

  /**
   * Restaurant image URL.
   */
  static imageUrlForRestaurant(photograph, size) {
    return (
      `${BASE_URL}/assets/img/${photograph}-${size}w.jpg`
    );
  }

  static imageSrcsetForRestaurant(photograph, sizes = []) {
    return sizes
      .map(size => `${BASE_URL}/assets/img/${photograph}-${size}w.jpg ${size}w`)
      .join(', ');
  }

  /**
   * Map marker for a restaurant.
   */
  static mapMarkerForRestaurant(restaurant, map) {
    // https://leafletjs.com/reference-1.3.0.html#marker
    const marker = new L.marker([restaurant.latlng.lat, restaurant.latlng.lng],
      {
        title: restaurant.name,
        alt: restaurant.name,
        url: DBHelper.urlForRestaurant(restaurant)
      });
    marker.addTo(map);
    return marker;
  }

}

export default DBHelper;