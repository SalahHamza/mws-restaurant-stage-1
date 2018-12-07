import '@babel/polyfill';
import Snackbars from '@salahhamza/snackbars';
import IndexController from './indexController';
import IDBHelper from './idbHelper';

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
    this.idbHelper = new IDBHelper();

    this.snackbars = new Snackbars(null, true);
    // initilizing indexController (register service worker)
    this.indexController = new IndexController(this.snackbars);
    this.indexController.init();
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
   * Fetch all restaurants.
   */
  async fetchRestaurants(callback) {
    try {
      const res = await fetch(`${DBHelper.DATABASE_URL}/restaurants`);
      const restaurants = await res.json();
      callback(null, restaurants);
    } catch (err) {
      const restaurants = await this.idbHelper.getRestaurants();
      if (restaurants.length) {
        callback(null, restaurants);
        return;
      }
      callback('No restaurants found in idb', null);
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

      this.idbHelper.putItemsToStore([restaurant], 'restaurants');
    } catch (err) {
      const restaurant = await this.idbHelper.getRestaurantById(id);
      if (!restaurant) {
        const sentError = `Errors:\n${err}
        Restaurant not found in IDB`;
        callback(sentError, null);
      } else {
        callback(null, restaurant);
      }
    }
  }

  /**
   * Fetch restaurants by a cuisine type with proper error handling.
   */
  async fetchRestaurantByCuisine(cuisine, callback) {
    // Fetch all restaurants  with proper error handling
    try {
      const res = await fetch(
        `${DBHelper.DATABASE_URL}/restaurants?cuisine_type=${cuisine}`
      );
      const restaurants = await res.json();
      callback(null, restaurants);
    } catch (err) {
      const restaurants = await this.idbHelper.getRestaurantsByCuisines(
        cuisine
      );
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
   * Fetch restaurants by a neighborhood with proper error handling.
   */
  async fetchRestaurantByNeighborhood(neighborhood, callback) {
    // Fetch all restaurants
    try {
      const res = await fetch(
        `${DBHelper.DATABASE_URL}/restaurants?neighborhood=${neighborhood}`
      );
      const restaurants = await res.json();
      callback(null, restaurants);
    } catch (err) {
      const restaurants = await this.idbHelper.getRestaurantsByNeighborhood(
        neighborhood
      );

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
   * Fetch restaurants by a cuisine and a neighborhood with proper error handling.
   */
  async fetchRestaurantByCuisineAndNeighborhood(
    cuisine,
    neighborhood,
    callback
  ) {
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
      const res = await fetch(
        `${
          DBHelper.DATABASE_URL
        }/restaurants?neighborhood=${neighborhood}&cuisine_type=${cuisine}`
      );
      const restaurants = await res.json();
      callback(null, restaurants);
    } catch (err) {
      const restaurants = await this.idbHelper.getRestaurantsByCuisineAndNeighborhood(
        cuisine,
        neighborhood
      );
      if (restaurants.length) {
        callback(null, restaurants);
        return;
      }
      callback(err, null);
    }
  }

  /**
   * Fetch all neighborhoods with proper error handling.
   */
  async fetchNeighborhoods(callback) {
    try {
      const neighborhoods = await this.idbHelper.getNeighborhoods();

      if (!neighborhoods.length) throw new Error('No neighborhoods in IDB');
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
        const neighborhoods = restaurants.map(
          (v, i) => restaurants[i].neighborhood
        );
        // Remove duplicates from neighborhoods
        const uniqueNeighborhoods = neighborhoods.filter(
          (v, i) => neighborhoods.indexOf(v) == i
        );
        callback(null, uniqueNeighborhoods);
        this.idbHelper.putItemsToStore(uniqueNeighborhoods, 'neighborhoods', true);
      });
    }
  }

  /**
   * Fetch all cuisines with proper error handling.
   */
  async fetchCuisines(callback) {
    try {
      const cuisines = await this.idbHelper.getCuisines();

      if (!cuisines.length) throw new Error('No cuisines in IDB');
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
        const uniqueCuisines = cuisines.filter(
          (v, i) => cuisines.indexOf(v) == i
        );
        callback(null, uniqueCuisines);
        this.idbHelper.putItemsToStore(uniqueCuisines, 'cuisines', true);
      });
    }
  }

  /**
   * sends put request to update favorite status of restaurant
   * @param {number} id - restaurant id to update
   * @param {Boolean} newStatus - new status (true/false) to update server with
   */
  async updateRestaurantFavoriteStatus(id, newStatus) {
    try {
      const url = `${
        DBHelper.DATABASE_URL
      }/restaurants/${id}?is_favorite=${newStatus}`;
      const res = await fetch(url, { method: 'PUT' });
      if (res.status !== 200)
        throw new Error('Restaurant favorite status not updated');
      const restaurant = await res.json();

      this.idbHelper.putItemsToStore([restaurant], 'restaurants');
      return restaurant;
    } catch (err) {
      console.log(err);
    }
  }

  /**
   * Fetch all reviews for specific restaurant
   */
  async fetchReviewsForRestaurantId(id) {
    try {
      // we get the pending reviews promise if there are any
      const pendingReviews = this.idbHelper.getReviewsFromOutbox(id);
      const res = await fetch(
        `${DBHelper.DATABASE_URL}/reviews?restaurant_id=${id}`
      );
      const reviews = await res.json();
      // add newly fetched reviews to 'reviews' store
      this.idbHelper.putItemsToStore(reviews, 'reviews');

      // post reviews in outbox store just in case
      // they weren't added in the sync event
      // Note: in practice, there is no need for
      // a sync event, since the reviews
      // are posted the next time the user visits the page
      // with internet (the success of the fetch event gives that out)
      this.postOutbox();

      return DBHelper.sortByDate(reviews.concat(await pendingReviews));
    } catch (err) {
      // falling back to IDB
      // also sending error to see what's the problem
      const reviews = await this.idbHelper.getReviews(id, err);
      return DBHelper.sortByDate(reviews);
    }
  }

  /**
   * Post request to create new review
   */
  /**
   * POSTs a new review to the dev server, adds it
   * to 'reviews' store on success, or to 'reviews-outbox'
   * on fail and sends a sync event to post the review when
   * user's connection is back
   * @param {object} review - review data to send as body of fetch request
   */
  async createNewReview(review) {
    try {
      const url = `${DBHelper.DATABASE_URL}/reviews`;
      const options = {
        method: 'POST',
        cors: 'no-cors',
        body: JSON.stringify(review)
      };

      const res = await fetch(url, options);
      if (res.status !== 201) throw new Error('Review wasn\'t created');

      const createdReview = await res.json();
      this.idbHelper.putItemsToStore([createdReview], 'reviews');
      return createdReview;
    } catch (err) {
      this.idbHelper.putItemsToStore([review], 'reviews-outbox');
      this.snackbars.show({
        name: 'defer-offline',
        message: 'Failed to create review. Don\'t worry, We\'ll try again later!',
        duration: 4500
      });
      // request a background sync to post messages
      // in the outbox store when connection is back
      this.indexController.requestPostOutboxSync();
    }
  }

  /**
   * posts pending reviews in the 'reviews-outbox' store
   */
  async postOutbox() {
    try {
      const pendingReviews = await this.idbHelper.getReviewsFromOutbox();
      for (const pr of pendingReviews) {
        const data = Object.assign({}, pr);
        delete data.id;
        const createdReview = await this.createNewReview(data);
        this.idbHelper.putItemsToStore([createdReview], 'reviews');
        this.idbHelper.deleteReviewFromOutbox(pr.id);
      }
    } catch (err) {
      console.log(`Failed to post reviews in outbox:\n${err}`);
    }
  }

  /* ================== Utils ================== */

  static sortByDate(arr) {
    return arr.slice().sort((a, b) => {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  /**
   * Restaurant page URL.
   */
  static urlForRestaurant(restaurant) {
    return `${BASE_URL}/restaurant.html?id=${restaurant.id}`;
  }

  /**
   * Restaurant image URL.
   */
  static imageUrlForRestaurant(photograph, size) {
    return `${BASE_URL}/assets/img/${photograph}-${size}w.jpg`;
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
    const marker = new L.marker(
      [restaurant.latlng.lat, restaurant.latlng.lng],
      {
        title: restaurant.name,
        alt: restaurant.name,
        url: DBHelper.urlForRestaurant(restaurant)
      }
    );
    marker.addTo(map);
    return marker;
  }
}

export default DBHelper;
