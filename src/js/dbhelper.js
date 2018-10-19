import '@babel/polyfill';
import idb from 'idb';

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
    this.idbPromise = this.openDatabase();
  }
  /**
   * Fetch MAPBOX Token from DB instead of including
   * it in the script
   */
  static fetchMAPBOXToken() {
    return fetch(`${BASE_URL}/assets/data/restaurants.json`)
      .then(res => res.json())
      .then(data => data.MAPBOX_TOKEN)
      .catch(err => {
        console.log(err);
      });
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

    const idbPromise = idb.open('reviews-app', 1, upgradeDb => {
      const store = upgradeDb.createObjectStore('restaurants', {
        keyPath: 'id'
      });
      store.createIndex('by-cuisine', 'cuisine_type');
      store.createIndex('by-neighborhood', 'neighborhood');
    });

    // fetch and store restaurants right after
    // creating the IDB
    const db = await idbPromise;
    this.fetchRestaurants((error, restaurants) => {
      if (error) return;
      const tx = db.transaction('restaurants', 'readwrite');
      const store = tx.objectStore('restaurants');
      for (const restaurant of restaurants) {
        store.put(restaurant);
      }
    });
    return idbPromise;
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
      // fetchRestaurants method is called in the openDatabase
      // method, but since inside openDatabase method
      // this.idbPromise property is yet to be set, there won't be
      // any conflic 'await undefined' yields 'undefined'
      const db = await this.idbPromise;
      if(!db) return;

      const tx = db.transaction('restaurants');
      const store = tx.objectStore('restaurants');
      // get all restaurants
      const restaurants = await store.getAll();

      if(restaurants.length) {
        callback(null, restaurants);
        return tx.complete;
      }

      callback(`Request failed. ${err}`, null);
      return tx.complete;
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
    } catch(err) {
      const db = await this.idbPromise;
      if(!db) return;

      const tx = db.transaction('restaurants');
      const store = tx.objectStore('restaurants');
      // get restaurant with this 'id'
      const restaurant = await store.get(Number(id));

      if(restaurant) {
        callback(null, restaurant);
        return tx.complete;
      }
      callback('Restaurant does not exist', null);
      return tx.complete;
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
      const db = await this.idbPromise;
      if(!db) return;

      const tx = db.transaction('restaurants');
      const index = tx.objectStore('restaurants').index('by-cuisine');
      // getting all restaurants with this cuisine_type
      const restaurants = await index.getAll(cuisine);

      if(restaurants) {
        callback(null, restaurants);
        return tx.complete;
      }
      callback(err, null);
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
      callback(err, null);
    }
  }

  /**
   * Fetch restaurants by a cuisine and a neighborhood with proper error handling.
   */
  async fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, callback) {
    // Fetch all restaurants
    if(cuisine === 'all' && neighborhood === 'all') {
      await this.fetchRestaurants(callback);
      return;
    }
    // fetch by neighborhood
    if(cuisine === 'all') {
      await this.fetchRestaurantByNeighborhood(neighborhood, callback);
      return;
    }
    // fetch by cuisine
    if(neighborhood === 'all') {
      console.log('cuisine');
      await this.fetchRestaurantByCuisine(cuisine, callback);
      return;
    }
    // fetch by neighborhood & cuisine
    try {
      const res = await fetch(`${DBHelper.DATABASE_URL}?neighborhood=${neighborhood}&cuisine_type=${cuisine}`);
      const restaurants = await res.json();
      console.log(restaurants);
      callback(null, restaurants);
    } catch(err) {
      callback(err, null);
    }
  }

  /**
   * Fetch all neighborhoods with proper error handling.
   */
  async fetchNeighborhoods(callback) {
    // Fetch all restaurants
    await this.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all neighborhoods from all restaurants
        const neighborhoods = restaurants.map((v, i) => restaurants[i].neighborhood);
        // Remove duplicates from neighborhoods
        const uniqueNeighborhoods = neighborhoods.filter((v, i) => neighborhoods.indexOf(v) == i);
        callback(null, uniqueNeighborhoods);
      }
    });
  }

  /**
   * Fetch all cuisines with proper error handling.
   */
  async fetchCuisines(callback) {
    // Fetch all restaurants
    await this.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all cuisines from all restaurants
        const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type);
        // Remove duplicates from cuisines
        const uniqueCuisines = cuisines.filter((v, i) => cuisines.indexOf(v) == i);
        callback(null, uniqueCuisines);
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