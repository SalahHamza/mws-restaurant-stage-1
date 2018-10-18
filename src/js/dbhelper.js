import '@babel/polyfill';

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
   * Fetch all restaurants.
   */
  async fetchRestaurants(callback) {
    try {
      const res = await fetch(DBHelper.DATABASE_URL);
      const restaurants = await res.json();
      callback(null, restaurants);
    } catch(err) {
      callback(`Request failed. ${err}`, null);
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
      callback('Restaurant does not exist', null);
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