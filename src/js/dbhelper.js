import '@babel/polyfill';
import idb from 'idb';
import IndexController from './indexController';

/*
 Change this to your base url in local env
 that would be 'http://localhost:port'
*/
const BASE_URL = (() => {
  if(location.origin.includes('localhost:')) {
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
    } catch(err) {
      console.log('data wasn\'t fetched');
      return Promise.resolve();
    }
  }

  /**
   * Database URL.
   * Change this to restaurants.json file location on your server.
   */
  static get DATABASE_URL() {
    return 'http://localhost:1337/restaurants';
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
        autoIncrement: true
      });
      // store for neighborhoods
      upgradeDb.createObjectStore('neighborhoods', {
        autoIncrement: true
      });
    });
  }

  /**
   * Fetch all restaurants.
   */
  async fetchRestaurants(callback) {
    try {
      const res = await fetch(DBHelper.DATABASE_URL);
      const restaurants = await res.json();
      callback(null, restaurants);
    } catch(err) {
      let restaurants,
        sentError = `Errors:\n${err.stack || err}`;
      try {
        // fetchRestaurants method is called in the openDatabase
        // method, but since inside openDatabase method
        // this.idbPromise property is yet to be set, there won't be
        // any conflic 'await undefined' yields 'undefined'
        const db = await this.idbPromise;
        if(!db) return;

        const tx = db.transaction('restaurants');
        const store = tx.objectStore('restaurants');
        // get all restaurants
        restaurants = await store.getAll();
      } catch(err) {
        sentError += `\n${err.stack}`;
      } finally {
        if(restaurants && restaurants.length) {
          callback(null, restaurants);
        } else {
          callback(sentError, null);
        }
      }
    }
  }


  /**
   * Fetch a restaurant by its ID.
   */
  async fetchRestaurantById(id, callback) {
    // fetch all restaurants with proper error handling.
    try {
      const res = await fetch(`${DBHelper.DATABASE_URL}?id=${id}`);
      const restaurant = await res.json();
      callback(null, restaurant);

      try {
        // add restaurant to IDB (or update it already exists)
        const db = await this.idbPromise;
        if(!db) return;

        const tx = db.transaction('restaurants', 'readwrite');
        const store = tx.objectStore('restaurants');
        // get restaurant with this 'id'
        await store.put(restaurant);
        return tx.complete;
      } catch(err) {
        // in this catch we don't need to throw, since the
        // restaurant already been sent with in callback()
        console.log(`Restaurant wasn't saved: ${err.stack || err}`);
        return;
      }

    } catch(err) {
      let restaurant,
        sentError = `Errors:\n${err.stack || err}`;
      // if fetch fails, get restaurant from IDB if it exists
      // and if restaurant isn't in IDB send an error with the
      // callback
      try {
        const db = await this.idbPromise;
        if(!db) return;

        const tx = db.transaction('restaurants');
        const store = tx.objectStore('restaurants');
        // get restaurant with this 'id'
        restaurant = await store.get(Number(id));

      } catch(error) {
        sentError += `\n${error.stack}`;
      } finally {
        if(restaurant){
          callback(null, restaurant);
        } else {
          callback(sentError, null);
        }
      }
    }
  }

  /**
   * Fetch restaurants by a cuisine type with proper error handling.
   */
  async fetchRestaurantByCuisine(cuisine, callback) {
    // Fetch all restaurants  with proper error handling
    try {
      const res = await fetch(`${DBHelper.DATABASE_URL}?cuisine_type=${cuisine}`);
      const restaurants = await res.json();
      callback(null, restaurants);
    } catch(err) {
      let restaurants,
        sentError = `Errors:\n${err.stack || err}`;
      try {
        // fetchRestaurants method is called in the openDatabase
        // method, but since inside openDatabase method
        // this.idbPromise property is yet to be set, there won't be
        // any conflic 'await undefined' yields 'undefined'
        const db = await this.idbPromise;
        if(!db) return;

        const tx = db.transaction('restaurants');
        const store = tx.objectStore('restaurants').index('by-cuisine');
        // get all restaurants
        restaurants = await store.getAll(cuisine);
      } catch(error) {
        sentError += `\n${error.stack || error}`;
      } finally {
        if(restaurants && restaurants.length) {
          callback(null, restaurants);
        } else {
          callback(sentError, null);
        }
      }
    }
  }

  /**
   * Fetch restaurants by a neighborhood with proper error handling.
   */
  async fetchRestaurantByNeighborhood(neighborhood, callback) {
    // Fetch all restaurants
    try {
      const res = await fetch(`${DBHelper.DATABASE_URL}?neighborhood=${neighborhood}`);
      const restaurants = await res.json();
      callback(null, restaurants);
    } catch(err) {
      let restaurants,
        sentError = `Errors:\n${err.stack}`;
      try {
        // fetchRestaurants method is called in the openDatabase
        // method, but since inside openDatabase method
        // this.idbPromise property is yet to be set, there won't be
        // any conflic 'await undefined' yields 'undefined'
        const db = await this.idbPromise;
        if(!db) return;

        const tx = db.transaction('restaurants');
        const store = tx.objectStore('restaurants').index('by-neighborhood');
        // get all restaurants
        restaurants = await store.getAll(neighborhood);
      } catch(error) {
        sentError += `\n${error.stack || error}`;
      } finally {
        if(restaurants && restaurants.length) {
          callback(null, restaurants);
        } else {
          callback(sentError, null);
        }
      }
    }
  }

  /**
   * Fetch restaurants by a cuisine and a neighborhood with proper error handling.
   */
  async fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, callback) {
    // Fetch all restaurants
    if(cuisine === 'all' && neighborhood === 'all') {
      this.fetchRestaurants(callback);
      return;
    }
    // fetch by neighborhood
    if(cuisine === 'all') {
      this.fetchRestaurantByNeighborhood(neighborhood, callback);
      return;
    }
    // fetch by cuisine
    if(neighborhood === 'all') {
      this.fetchRestaurantByCuisine(cuisine, callback);
      return;
    }
    // fetch by neighborhood & cuisine
    try {
      const res = await fetch(`${DBHelper.DATABASE_URL}?neighborhood=${neighborhood}&cuisine_type=${cuisine}`);
      const restaurants = await res.json();
      callback(null, restaurants);
    } catch(err) {
      let restaurants,
        sentError = `Errors:\n${err.stack || err}`;
      try {
        // fetchRestaurants method is called in the openDatabase
        // method, but since inside openDatabase method
        // this.idbPromise property is yet to be set, there won't be
        // any conflic 'await undefined' yields 'undefined'
        const db = await this.idbPromise;
        if(!db) return;

        const tx = db.transaction('restaurants');
        const index = tx.objectStore('restaurants').index('by-neighborhood');

        // getting all restaurants with this neighboorhood
        restaurants = await index.getAll(neighborhood);
        // only keeping restaurants with this cuisine_type
        restaurants = restaurants.filter(restaurant => restaurant.cuisine_type === cuisine);
      } catch(error) {
        sentError += `\n${error.stack || error}`;
      } finally {
        if(restaurants && restaurants.length) {
          callback(null, restaurants);
        } else {
          callback(sentError, null);
        }
      }
    }
  }

  /**
   * Fetch all neighborhoods with proper error handling.
   */
  async fetchNeighborhoods(callback) {
    try {
      // fetching neighborhoods from IDB if they exist
      const db = await this.idbPromise;
      if(db) {
        const tx = db.transaction('neighborhoods');
        const store = tx.objectStore('neighborhoods');
        // getting all restaurants with this cuisine_type
        const neighborhoods = await store.getAll();
        if(neighborhoods.length) {
          callback(null, neighborhoods);
          return tx.complete;
        }
      }
    } catch(err) {
      console.log(err);
    }
    // Fetch all restaurants and extract neighborhoods
    this.fetchRestaurants(async (error, restaurants) => {
      if (error) {
        callback(error, null);
        return;
      }
      // Get all neighborhoods from all restaurants
      const neighborhoods = restaurants.map((v, i) => restaurants[i].neighborhood);
      // Remove duplicates from neighborhoods
      const uniqueNeighborhoods = neighborhoods.filter((v, i) => neighborhoods.indexOf(v) == i);
      callback(null, uniqueNeighborhoods);

      // add neighborhoods to IDB
      try {
        const db = await this.idbPromise;
        if(!db) return;
        const tx = db.transaction('neighborhoods', 'readwrite');
        const store = tx.objectStore('neighborhoods');
        for(const neighborhood of uniqueNeighborhoods) {
          store.put(neighborhood);
        }
        return tx.complete;
      } catch(err) {
        console.log('Couldn\'t save neighborhoods to IDB: ', err);
      }
    });
  }

  /**
   * Fetch all cuisines with proper error handling.
   */
  async fetchCuisines(callback) {
    try {
      const db = await this.idbPromise;
      if(db) {
        const tx = db.transaction('cuisines');
        const store = tx.objectStore('cuisines');
        // getting all restaurants with this cuisine_type
        const cuisines = await store.getAll();
        if(cuisines.length) {
          callback(null, cuisines);
          return tx.complete;
        }
      }
    } catch(err) {
      console.log(err);
    }
    // Fetch all restaurants and extract cuisines
    this.fetchRestaurants(async (error, restaurants) => {
      if (error) {
        callback(error, null);
        return;
      }
      // Get all cuisines from all restaurants
      const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type);
      // Remove duplicates from cuisines
      const uniqueCuisines = cuisines.filter((v, i) => cuisines.indexOf(v) == i);
      callback(null, uniqueCuisines);

      try {
        const db = await this.idbPromise;
        if(!db) return;
        const tx = db.transaction('cuisines', 'readwrite');
        const store = tx.objectStore('cuisines');
        for(const cuisine of uniqueCuisines) {
          store.put(cuisine);
        }
        return tx.complete;
      } catch(err) {
        console.log('Couldn\'t save cuisines to IDB:', err);
      }
    });
  }

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

  static imageSrcsetForRestaurant(photograph, sizes=[]){
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