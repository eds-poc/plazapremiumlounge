/*
 * API endpoints: the API domains are kept here, in one place (the same for the preview and live
 * sites), and each endpoint is an absolute path on one of them. Blocks call apiUrl('<name>') and
 * add their own query parameters.
 */

const API_DOMAIN = 'https://236246-402whitedonkey-dev.adobeio-static.net';
// the booking system's APIs (they use the live site's property codes, not the ones above)
const BOOKING_API_DOMAIN = 'https://1074235-ppginternal-stage.adobeioruntime.net';

// endpoint paths on the booking API domain
const BOOKING_ENDPOINTS = {
  // the airports and stations (names, time zones, lead times) and the one nearest the visitor,
  // from their position (GET), per language
  geoLocation: '/api/v1/web/ppg-app/getGeoLocation',
  // an airport's featured lounge for a start and guests: its details (name, location line,
  // photos, features) and its products with prices, grouped by service (POST, JSON body)
  bookingWidgetProducts: '/api/v1/web/ppg-app/getbookingwidgetproducts',
  // the cart: POST (JSON: currency, products, pointOfPurchase, channel, isThirdPartyFulfilment)
  // creates a cart with the products and answers its cartId; GET ?cartId=&locale= reads it;
  // DELETE ?cartId= deletes (empties) it
  cart: '/api/v1/web/ppg-app/cart',
  // a promo code for the cart (PUT, JSON: cartId, promocode; an empty code takes it off). Its
  // answers aren't known yet: no valid code to try on stage (see docs/cart.md)
  cartPromo: '/api/v1/web/ppg-app/cart-validate-promocode',
};

// endpoint paths, joined to the API domain
const ENDPOINTS = {
  properties: '/api/v1/web/app_demo/GetAllProperties',
  // countries with their phone codes, for the forms' country and phone fields
  countries: '/api/v1/web/app_demo/GetCountries',
  // the Signup Form submit (account registration)
  signUp: '/api/v1/web/app_demo/Register',
  // the Newsletter submit: a placeholder path until the newsletter API exists
  newsletter: '/api/v1/web/app_demo/Newsletter',
  // the Contact Form submit: a placeholder path until the contact API exists
  contact: '/api/v1/web/app_demo/Contact',
  // the login modal's submit (POST, JSON: username, password); answers with a JWT
  login: '/api/v1/web/app_demo/Login',
  // the forgot password modal's submit (POST, JSON: lastName, email)
  forgotPassword: '/api/v1/web/app_demo/ForgotPassword',
  // a partner page's password (POST, JSON: partnername, password); answers with a token (a JWT),
  // or 400 with a message (blocks/partner-password)
  partnerLogin: '/api/v1/web/app_demo/PartnerLogin',
  // the logged-in member's profile (GET, Authorization: Bearer <jwt>)
  getProfile: '/api/v1/web/app_demo/GetProfile',
  // a booking (order) of the logged-in member (POST, JSON: orderId; Authorization: Bearer <jwt>)
  getOrderDetail: '/api/v1/web/app_demo/GetOrderDetail',
  // the add-ons on sale for a booking's lounge and start time (POST, JSON: orderId, startDateTime,
  // propertyCode, iataCode, currencyCode; Authorization: Bearer <jwt>): a placeholder path until
  // the add-ons API exists (answer: see blocks/edit-booking/README.md)
  getAddOns: '/api/v1/web/app_demo/GetAddOns',
  propertyDetail: '/api/v1/web/app_demo/GetPropertyDetail',
  // a lounge's bookable services and their products for a start time (POST, JSON body)
  propertyServices: '/api/v1/web/app_demo/GetServices',
  // the price of a service's product for a start time and guests (POST, JSON body)
  propertyPrice: '/api/v1/web/app_demo/GetPrice',
  // a pass (product) with its prices, for a product code and currency (GET)
  productPasses: '/api/v1/web/app_demo/GetProductPasses',
  // the logged-in member's bookings (POST, JSON: languageCode, propertyTypeCode, status; the
  // login token as a Bearer token)
  bookingList: '/api/v1/web/app_demo/GetBookingList',
  // resending a booking's confirmation and cancelling it (POST, JSON: orderId): placeholder paths
  // until these APIs exist
  resendBookingConfirmation: '/api/v1/web/app_demo/ResendBookingConfirmation',
  cancelBooking: '/api/v1/web/app_demo/CancelBooking',
};

/**
 * The full address of an API endpoint.
 * @param {string} name An ENDPOINTS or BOOKING_ENDPOINTS key, e.g. 'properties'
 * @returns {URL} a new URL each call, so callers can add search parameters
 */
export default function apiUrl(name) {
  const booking = Object.hasOwn(BOOKING_ENDPOINTS, name);
  const path = booking ? BOOKING_ENDPOINTS[name] : ENDPOINTS[name];
  if (!path?.startsWith('/')) throw new Error(`Unknown endpoint "${name}"`);
  return new URL(path, booking ? BOOKING_API_DOMAIN : API_DOMAIN);
}
