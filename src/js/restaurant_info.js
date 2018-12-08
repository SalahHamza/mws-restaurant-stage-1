import DBHelper from './dbhelper';

class RestaurantInfo {
  constructor() {
    this.dbHelper = new DBHelper();
  }

  /**
   * Initialize leaflet map
   * @param {string} mapboxToken - mapbox API Token
   */
  initMap(mapboxToken) {
    this.fetchRestaurantFromURL((error, restaurant) => {
      if (error) {
        // Got an error!
        console.error(error);
      } else {
        this.newMap = L.map('map', {
          center: [restaurant.latlng.lat, restaurant.latlng.lng],
          zoom: 16,
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

        DBHelper.mapMarkerForRestaurant(this.restaurant, this.newMap);
      }
    });
  }

  /**
   * Get current restaurant from page URL.
   */
  fetchRestaurantFromURL(callback) {
    const id = this.getParameterByName('id');
    if (!id) {
      // no id found in URL
      const error = 'No restaurant id in URL';
      this.handleRestaurantNotFound();
      callback(error, null);
      return;
    }

    this.dbHelper.fetchRestaurantById(id, (error, restaurant) => {
      if (error) {
        callback(error, null);
        this.handleRestaurantNotFound();
        return;
      }
      this.restaurant = restaurant;
      this.fillBreadcrumb();
      this.fetchReviews();
      this.fillRestaurantHTML();
      callback(null, restaurant);
    });
  }

  /**
   * Shows a message when request restaurant 'id' is not found
   */
  handleRestaurantNotFound() {
    /* selecting all the elements that are not needed anymore */
    const $uselessElems = document.querySelectorAll(
      '.breadcrumb-wrapper, .restaurant-container, .map-container, .reviews-container'
    );
    /* removing all "useless" elements */
    $uselessElems.forEach(elem => {
      elem.remove();
    });

    const $main = document.querySelector('.maincontent');

    const $container = document.createElement('div');
    $container.className = 'rst-not-found';
    $container.innerHTML = `<h2>Restaurant Not found</h2>
    <p>This is not the restaurant you are looking for!</p>`;

    $main.prepend($container);
  }

  /**
   * Create restaurant HTML and add it to the webpage
   */
  fillRestaurantHTML() {
    const name = document.querySelector('.restaurant-name');
    name.innerHTML = this.restaurant.name;

    const address = document.querySelector('.restaurant-address');
    address.innerHTML = this.restaurant.address;

    /* image sizes to use in srcset */
    const imgSizes = ['300', '400', '500', '600', '800', '1000', '1200'];
    /* image size to use as fallback in src */
    const defaultSize = '600';

    const image = document.querySelector('.restaurant-img');
    image.className = 'restaurant-img';
    image.src = DBHelper.imageUrlForRestaurant(
      this.restaurant.photograph || this.restaurant.id,
      defaultSize
    );
    image.srcset = DBHelper.imageSrcsetForRestaurant(
      this.restaurant.photograph || this.restaurant.id,
      imgSizes
    );
    image.sizes = '(min-width: 632px) 600px, 100vw';
    image.alt = `This is an image of the ${this.restaurant.name} restaurant`;

    const cuisine = document.querySelector('.restaurant-cuisine');
    cuisine.innerHTML = this.restaurant.cuisine_type;

    // fill operating hours
    if (this.restaurant.operating_hours) {
      this.fillRestaurantHoursHTML();
    }

    this.configFavoriteButton(this.restaurant.is_favorite, this.restaurant.id);
  }

  /**
   * configurates favorite button's event listeners and status
   * (i.e. favorited or not)
   * @param {boolean|string} isFavorite - restaurant favorite status
   * @param {number} id - restaurant id to create button for
   */
  configFavoriteButton(isFavorite, id) {
    // the reason for this (ternary) is that the dev server
    // contains an issue that sets the 'is_favorite'
    // to string "true"/"false" when you send a put request
    // Note: the initial values were booleans, it only changes
    // when a PUT request is sent to the favorite restaurant endpoint
    isFavorite = isFavorite === 'true' || isFavorite === true ? true : false;
    const btn = document.querySelector('.fav-btn');
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

  async fetchReviews() {
    try {
      const reviews = await this.dbHelper.fetchReviewsForRestaurantId(
        this.restaurant.id
      );
      this.restaurant.reviews = reviews;
      // fill reviews
      this.fillReviewsHTML();
    } catch (err) {
      console.log(err);
    }
  }

  /**
   * Create restaurant operating hours HTML table and add it to the webpage.
   */
  fillRestaurantHoursHTML() {
    const operatingHours = this.restaurant.operating_hours;
    const hours = document.querySelector('.restaurant-hours');

    for (let key in operatingHours) {
      /*
        wrapping the content of the for-in loop
        in a conditional statement to prevent
        it from from iterating over the prototype chain
      */
      if (operatingHours.hasOwnProperty(key)) {
        const row = document.createElement('tr');
        row.setAttribute('tabindex', '0');

        const day = document.createElement('td');
        day.innerHTML = key;
        row.appendChild(day);

        const time = document.createElement('td');
        time.innerHTML = operatingHours[key];
        row.appendChild(time);

        hours.appendChild(row);
      }
    }
  }

  /**
   * Create all reviews HTML and add them to the webpage.
   */
  fillReviewsHTML() {
    const container = document.querySelector('.reviews-container');

    const title = document.createElement('h2');
    title.innerHTML = 'Reviews';
    container.appendChild(title);

    const newReviewButton = document.createElement('button');
    newReviewButton.className = 'new-review btn';
    newReviewButton.innerHTML = 'Add new review';
    newReviewButton.setAttribute('type', 'button');
    newReviewButton.addEventListener(
      'click',
      this.handleNewReviewClick.bind(this)
    );
    container.appendChild(newReviewButton);

    if (!this.restaurant.reviews) {
      const noReviews = document.createElement('p');
      noReviews.innerHTML = 'No reviews yet!';
      container.appendChild(noReviews);
      return;
    }
    const ul = document.querySelector('.reviews-list');
    this.restaurant.reviews.forEach(review => {
      ul.appendChild(this.createReviewHTML(review));
    });
    container.appendChild(ul);
  }

  /**
   * shows review form on 'new review' button click
   */
  handleNewReviewClick() {
    const formContainer = document.querySelector('.review-form-wrapper');
    if (!this.pageHasForm) {
      // maybe I'll need to request an animation frame here
      this.createReviewForm(formContainer);
      this.pageHasForm = true;
    }
    formContainer.classList.add('visible');
    // we focus first tab'able' element in
    // the review form
    if(this._firstTabStop) {
      this._firstTabStop.focus();
    }
  }

  /**
   * Create review form element
   * review form stars concept from Web a11y tutorial for
   * custom controls
   * https://www.w3.org/WAI/tutorials/forms/custom-controls/
   *
   * @param {Object} - DOM Object to append form to
   */
  createReviewForm(parent) {
    const form = document.createElement('form');
    form.className = 'review-form-container';
    form.innerHTML = RestaurantInfo.createReviewFormInnerHTML();
    // appending the review form
    parent.appendChild(form);

    // For the review form the element that was focused
    // before it is opened is always the 'create new review' button
    // so we don't need about not keeping up with it every time
    const toFocusElem = document.activeElement;
    const cancelBtn = form.querySelector('.form-cancel');
    const submitBtn = form.querySelector('.form-submit');

    // closes the form container which contains form
    const closeForm = () => {
      parent.classList.remove('visible');
      toFocusElem.focus();
    };

    // hide review form on cancel button click
    cancelBtn.addEventListener('click', closeForm);

    submitBtn.addEventListener('click', this.handleReviewSubmission.bind(this));

    // close the form on ESC button press
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        closeForm();
      }
    });

    // close form on overlay click
    // Note: form.parentNode is the same as parent,
    // but just for "safety" purposes
    form.parentNode.addEventListener('click', event => {
      // if the target is not the form itself
      // or one if its children (i.e the overlay)
      if (!form.contains(event.target)) {
        closeForm();
      }
    });


    const firstTabStop = form.querySelector('input');

    // we focus the first "tabable" element in the form
    firstTabStop.setAttribute('tabindex', '0');
    this._firstTabStop = firstTabStop;
  }

  /**
   * Creates the innerHTML of the review form
   */
  static createReviewFormInnerHTML() {
    const nameFieldHTML = `<label class="form-item">
      <span class="form-item-label">Name:</span>
      <input name="name" type="text" placeholder="John"/>
    </label>`;

    const starsHTML = [1, 2, 3, 4, 5]
      .map(
        i => `<input value="${i}" id="star${i}"
        type="radio" name="rating" class="sr-only">
      <label for="star${i}">
        <span class="sr-only">${i} Star rating</span>
        <span class="icon">★</span>
      </label>`
      )
      .join('');

    //html for the star rating fieldset
    const ratingFieldHTML = `<fieldset class="form-item rating">
    <legend class="form-item-label">Rating:</legend>
    <input value="0" id="star0" checked
    type="radio" name="rating" class="sr-only">
    <label for="star0">
      <span class="sr-only">0 Stars rating</span>
    </label>
    ${starsHTML}
    </fieldset>`;

    const commentFieldHTML = `<label class="form-item">
    <span class="form-item-label">Comments:</span>
    <textarea
    placeholder="Your comments (in 20 letters or more)s"
    name="comment" id="review-comment" rows="10"
    ></textarea>
    </label>`;

    const btnFieldHTML = `<span class="btn-container">
    <button
      type="button" class="form-cancel btn"
    >Cancel</button>
    <button
      type="submit" class="form-submit btn"
    >Submit</button>
    </span>`;

    return `<h3>Tell people what you think!</h3>
    ${nameFieldHTML}
    ${ratingFieldHTML}
    ${commentFieldHTML}
    ${btnFieldHTML}`.replace(/  +/g, ' ');
    // removing occurences of 2 spaces or more
  }

  /**
   * handle review form submit button click
   * @param {Object} event - Event object
   */
  async handleReviewSubmission(event) {
    event.preventDefault();
    const formData = this.getReviewData();
    if (!formData) return;
    // Do something with formData
    formData['restaurant_id'] = this.restaurant.id;
    // setting the 'createdAt' & 'updatedAt' to the currentTime
    // incase we want to defer the request, we need to store the
    // time the review form was submitted
    const currentTime = new Date().getTime();
    formData['createdAt'] = formData['updatedAt'] = currentTime;
    // initiate the post request
    this.dbHelper.createNewReview(formData);
    // handle configuration after the review data has arrived
    this.onReviewData(formData);
  }

  /**
   * create & appends new review element, closes & clears form,
   * and focuses new review element
   * @param {object} review - new review data
   */
  onReviewData(review) {
    // inserting new review at the start of the review list
    const el = this.createReviewHTML(review);
    document
      .querySelector('.reviews-list')
      .insertAdjacentElement('afterbegin', el);

    // closing and clearnig the form
    const formContainer = document.querySelector('.review-form-wrapper');
    formContainer.querySelector('form').reset();
    formContainer.classList.remove('visible');
    // focus the comment
    el.setAttribute('tabindex', '0');
    el.focus();
  }

  /**
   * validate form field and get their values
   * @returns Object with form data
   */
  getReviewData() {
    const formContainer = document.querySelector('.review-form-wrapper');
    const reviewObj = {};

    // validate name input
    const nameElem = formContainer.querySelector('input[name="name"]');
    const nameValue = nameElem.value.trim();
    if (!nameValue) {
      this.handleEmptyFormField(nameElem, 'Oops! Name field is required');
      return;
    }
    reviewObj.name = nameValue;

    // validate star rating input
    const ratingElem = formContainer.querySelector('fieldset');
    const ratingValue = Number(ratingElem.querySelector('input:checked').value);
    if (!ratingValue) {
      const message =
        'Either the restaurant is <em>really</em> bad or you forgot to rate!';
      this.handleEmptyFormField(ratingElem, message);
      return;
    }
    reviewObj.rating = ratingValue;

    // validate comment input
    const commentElem = formContainer.querySelector('textarea');
    const commentString = commentElem.value.trim();
    if (!commentString) {
      const message = 'We really do care about your opinion!';
      this.handleEmptyFormField(commentElem, message);
      return;
    }
    if (commentString.length < 20) {
      const message = 'Please, do write a comment you\'d want to read yourself';
      this.handleEmptyFormField(commentElem, message);
      return;
    }
    reviewObj.comments = commentString;

    return reviewObj;
  }

  /**
   * displays warning message after empty field
   *
   * @param {object} fieldNode - Form field node to check
   * @param {string} message - message to display if field is empty
   */
  handleEmptyFormField(fieldNode, message) {
    // we check if concerned field already has a warning
    if (fieldNode.hasWarning) return;

    const warning = document.createElement('span');
    warning.className = 'empty-field-warning';
    warning.innerHTML = `*${message}`;
    fieldNode.insertAdjacentElement('afterend', warning);

    // we state that concerned field have a warning now
    fieldNode.hasWarning = true;
    const hideWarning = () => {
      warning.remove();
      // we state that concerned field doesn't have a warning
      fieldNode.hasWarning = false;
    };

    // adding multiple handlers to also handle the fieldset
    // since fieldset can't be focused
    fieldNode.addEventListener('focus', hideWarning);
    fieldNode.addEventListener('click', hideWarning);
  }

  /**
   * Create review HTML and add it to the webpage.
   */
  createReviewHTML(review) {
    const li = document.createElement('li');

    const name = document.createElement('p');
    name.setAttribute('tabindex', '0');
    name.className = 'review-name';
    name.innerHTML = review.name;
    li.appendChild(name);

    const date = document.createElement('p');
    date.innerHTML = new Date(review.createdAt).toDateString();
    date.className = 'review-date';
    li.appendChild(date);

    const rating = this.createRatingElement(review.rating);
    li.appendChild(rating);

    const comments = document.createElement('p');
    comments.innerHTML = review.comments;
    li.appendChild(comments);

    return li;
  }

  /**
   * Create rating element as stars
   */
  createRatingElement(reviewRating) {
    const $rating = document.createElement('p');
    $rating.className = 'review-rating';

    const hollowStars = 5 - reviewRating;

    for (let i = 0; i < reviewRating; i++) {
      const $star = document.createElement('span');
      $star.innerHTML = '★';
      $rating.appendChild($star);
    }

    for (let i = 0; i < hollowStars; i++) {
      const $star = document.createElement('span');
      $star.innerHTML = '☆';
      $rating.appendChild($star);
    }

    return $rating;
  }

  /**
   * Add restaurant name to the breadcrumb navigation menu
   */
  fillBreadcrumb() {
    const breadcrumb = document.querySelector('.breadcrumb');
    const li = document.createElement('li');
    li.innerHTML = this.restaurant.name;
    breadcrumb.appendChild(li);
  }

  /**
   * Get a parameter by name from page URL.
   */
  getParameterByName(name, url) {
    if (!url) {
      url = window.location.href;
    }
    const sanitizePattern = new RegExp('[\\[\\]]', 'g');
    // name = name.replace(/[\[\]]/g, '\\$&');
    name = name.replace(sanitizePattern, '\\$&');
    const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`);
    const results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
  }

  init() {
    /**
     * Initialize map as soon as the page is loaded.
     */
    document.addEventListener('DOMContentLoaded', () => {
      DBHelper.fetchMAPBOXToken().then(mapboxToken => {
        this.initMap(mapboxToken); // added
      });
    });
  }
}

(() => {
  const inside = new RestaurantInfo();
  // initializing restaurant_info page
  inside.init();
})();
