import DBHelper from './dbhelper';
import lazySizes from 'lazysizes';

class MainPage {
  constructor() {
    this.neighborhoods = [];
    this.cuisines = [];
    this.markers = [];
    this.dbHelper = new DBHelper();
    lazySizes.init();
  }

  /**********************
        Data Fetch
  **********************/

  /**
   * Fetch all neighborhoods and set their HTML.
   */
  fetchNeighborhoods() {
    this.dbHelper.fetchNeighborhoods((error, neighborhoods) => {
      if (error) {
        // Got an error
        console.error(error);
      } else {
        this.neighborhoods = neighborhoods;
        this.fillNeighborhoodsHTML();
      }
    });
  }

  /**
   * Fetch all cuisines and set their HTML.
   */
  fetchCuisines() {
    this.dbHelper.fetchCuisines((error, cuisines) => {
      if (error) {
        // Got an error!
        console.error(error);
      } else {
        this.cuisines = cuisines;
        this.fillCuisinesHTML();
      }
    });
  }

  /**********************
        Data in UI
  **********************/

  /**
   * Set neighborhoods HTML.
   */
  fillNeighborhoodsHTML() {
    const select = document.getElementById('neighborhoods-select');
    this.neighborhoods.forEach(neighborhood => {
      const option = document.createElement('option');
      option.innerHTML = neighborhood;
      option.value = neighborhood;
      select.append(option);
    });
  }

  /**
   * Set cuisines HTML.
   */
  fillCuisinesHTML() {
    const select = document.getElementById('cuisines-select');

    this.cuisines.forEach(cuisine => {
      const option = document.createElement('option');
      option.innerHTML = cuisine;
      option.value = cuisine;
      select.append(option);
    });
  }

  /**
   * Update page and map for current restaurants.
   */
  updateRestaurants() {
    const cSelect = document.getElementById('cuisines-select');
    const nSelect = document.getElementById('neighborhoods-select');

    const cIndex = cSelect.selectedIndex;
    const nIndex = nSelect.selectedIndex;

    const cuisine = cSelect[cIndex].value;
    const neighborhood = nSelect[nIndex].value;

    this.dbHelper.fetchRestaurantByCuisineAndNeighborhood(
      cuisine,
      neighborhood,
      (error, restaurants) => {
        if (error) {
          // Got an error!
          console.error(error);
        } else {
          this.resetRestaurants(restaurants);
          this.fillRestaurantsHTML();
        }
      }
    );
  }

  /**
   * Clear current restaurants, their HTML and remove their map markers.
   */
  resetRestaurants(restaurants) {
    // Remove all restaurants
    this.restaurants = [];
    const ul = document.getElementById('restaurants-list');
    ul.innerHTML = '';

    // Remove all map markers
    if (this.markers) {
      this.markers.forEach(marker => marker.remove());
    }
    this.markers = [];
    this.restaurants = restaurants;
  }

  /**
  /**
   * Create all restaurants HTML and add them to the webpage.
   */
  fillRestaurantsHTML() {
    const ul = document.getElementById('restaurants-list');
    this.restaurants.forEach(restaurant => {
      ul.append(this.createRestaurantHTML(restaurant));
    });
    this.addMarkersToMap();
  }

  /**
   * Create restaurant HTML.
   */
  createRestaurantHTML(restaurant) {
    const li = document.createElement('li');
    li.className = 'restaurant-item';

    /* image sizes to use in srcset */
    const imgSizes = ['300', '400', '600', '800'];
    /* image size to use as fallback in src */
    const defaultSize = '400';
    const image = document.createElement('img');
    image.className = 'restaurant-img lazyload';
    const dataSrc = DBHelper.imageUrlForRestaurant(
      // since 'photograph' is the same as 'id'
      // we fallback to the 'id'
      restaurant.photograph || restaurant.id,
      defaultSize
    );
    const dataSrcset = DBHelper.imageSrcsetForRestaurant(
      restaurant.photograph || restaurant.id,
      imgSizes
    );
    image.setAttribute('data-src', dataSrc);
    image.setAttribute('data-srcset', dataSrcset);
    image.setAttribute('data-sizes', 'auto');

    image.alt = `This is an image of the ${restaurant.name} restaurant`;
    li.append(image);

    const favBtn = this.createFavoriteButton(
      restaurant.is_favorite,
      restaurant.id
    );
    li.append(favBtn);

    const info = document.createElement('div');
    info.className = 'restaurant-info';
    li.append(info);

    const name = document.createElement('h1');
    name.innerHTML = restaurant.name;
    info.append(name);

    const neighborhood = document.createElement('p');
    neighborhood.innerHTML = restaurant.neighborhood;
    info.append(neighborhood);

    const address = document.createElement('p');
    address.innerHTML = restaurant.address;
    info.append(address);

    const more = document.createElement('a');
    more.innerHTML = 'View Details';
    more.href = DBHelper.urlForRestaurant(restaurant);
    more.setAttribute('aria-label', restaurant.name);
    info.append(more);

    return li;
  }

  /**
   * creates favorite restaurant button
   * @param {boolean|string} isFavorite - restaurant favorite status
   * @param {number} id - restaurant id to create button for
   */
  createFavoriteButton(isFavorite, id) {
    // the reason for this (ternary) is that the dev server
    // contains an issue that sets the 'is_favorite'
    // to string "true"/"false" when you send a put request
    // Note: the initial values were booleans, it only changes
    // when a PUT request is sent to the favorite restaurant endpoint
    isFavorite = isFavorite === 'true' || isFavorite === true ? true : false;
    const btn = document.createElement('button');
    btn.className = 'fav-btn';
    btn.setAttribute('tabindex', '0');
    btn.setAttribute('aria-label', 'favorite restaurant');
    // since the favorite button is two state button
    // we set the role to 'switch'
    btn.setAttribute('role', 'switch');
    btn.setAttribute('aria-checked', isFavorite);

    const filledHeart = 'icon-heart';
    const hollowHeart = 'icon-heart-light';
    if (isFavorite) {
      btn.classList.add(filledHeart);
    } else {
      btn.classList.add(hollowHeart);
    }
    const setHeart = isFav => {
      if (isFav) {
        btn.classList.add(hollowHeart);
        btn.classList.remove(filledHeart);
      } else {
        btn.classList.remove(hollowHeart);
        btn.classList.add(filledHeart);
      }
    };
    btn.onmouseover = btn.onfocus = setHeart.bind(null, isFavorite);
    btn.onmouseout = btn.onblur = setHeart.bind(null, !isFavorite);
    btn.onclick = this.handleFavoriteButtonClick.bind(
      this,
      id,
      isFavorite,
      setHeart
    );
    return btn;
  }

  /**
   * update restaurant favorite state and button style
   * @param {number} id - restaurant id to favorite/unfavorite
   * @param {Boolean} isFavorite - respresents whether button is favorited or not
   * @param {function} setHeart - util function to update button (heart) state
   * @param {Object} event - event object
   */
  async handleFavoriteButtonClick(id, isFavorite, setHeart, event) {
    try {
      const newStatus = !isFavorite;
      const restaurant = await this.dbHelper.updateRestaurantFavoriteStatus(
        id,
        newStatus
      );
      if (!restaurant) return;
      const message = newStatus
        ? 'You favorited restaurant'
        : 'You unfavorited restaurant';

      this.dbHelper.snackbars.show({
        name: 'fav-restaurant',
        message,
        duration: 3500
      });
      // since now the restaurant state changed
      // all the events that were set in 'createFavoriteButton()'
      // are wrong and should be updated
      const btn = event.target;
      btn.onmouseover = btn.onfocus = setHeart.bind(null, newStatus);
      btn.onmouseout = btn.onblur = setHeart.bind(null, !newStatus);
      btn.onclick = this.handleFavoriteButtonClick.bind(
        this,
        id,
        newStatus,
        setHeart
      );
    } catch (err) {
      console.log(err);
    }
  }

  /**********************
          MAP
  **********************/
  /**
   * Initialize leaflet map, called from HTML.
   */
  initMap(mapboxToken) {
    this.newMap = L.map('map', {
      center: [40.722216, -73.987501],
      zoom: 12,
      scrollWheelZoom: false
    });
    L.tileLayer(
      'https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.jpg70?access_token={mapboxToken}',
      {
        mapboxToken,
        maxZoom: 18,
        attribution:
          'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' +
          '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
          'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        id: 'mapbox.streets'
      }
    ).addTo(this.newMap);
  }

  /**
   * Add markers for current restaurants to the map.
   */
  addMarkersToMap() {
    this.restaurants.forEach(restaurant => {
      // Add marker to the map
      const marker = DBHelper.mapMarkerForRestaurant(restaurant, this.newMap);
      marker.on('click', onClick);
      function onClick() {
        window.location.href = marker.options.url;
      }
      this.markers.push(marker);
    });
  }

  /**********************
      Initialization
  **********************/

  init() {
    /**
     * Fetch neighborhoods and cuisines as soon as the page is loaded.
     */
    window.addEventListener('DOMContentLoaded', () => {
      DBHelper.fetchMAPBOXToken().then(mapboxToken => {
        this.initMap(mapboxToken); // added
      });
      this.fetchNeighborhoods();
      this.fetchCuisines();
      this.updateRestaurants();

      /* listen for select elements and update Restaurants */
      document
        .querySelector('.filter-options')
        .addEventListener('change', e => {
          if (e.target.id.includes('-select')) {
            this.updateRestaurants();
            e.stopPropagation();
          }
        });
    });
  }
}

(() => {
  const main = new MainPage();
  // initializing main page
  main.init();
})();
