/*
 * API endpoints: the API domains are kept here, in one place (the same for the preview and live
 * sites), and each endpoint is an absolute path on one of them. Blocks call apiUrl('<name>') and
 * add their own query parameters.
 *
 * The standard base URL is API_DOMAIN. The endpoints still on OLD_API_DOMAIN haven't been verified
 * on it yet (missing there, or answering differently: see the note on each); they move once their
 * address on the standard base URL is confirmed, and OLD_API_DOMAIN goes when none is left.
 */

// the standard base URL (the ppg-app package; the live site's property codes)
const API_DOMAIN = 'https://1074235-ppginternal-stage.adobeioruntime.net';
// the previous base URL (the app_demo package), for the endpoints not moved yet
const OLD_API_DOMAIN = 'https://236246-402whitedonkey-dev.adobeio-static.net';

// endpoint paths on the standard base URL
const ENDPOINTS = {
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
  // countries with their phone codes, for the forms' country and phone fields
  countries: '/api/v1/web/ppg-app/GetCountries',
  // a lounge's bookable services and their products for a start time (POST, JSON body)
  propertyServices: '/api/v1/web/ppg-app/GetServices',
  // the price of a service's product for a start time and guests (POST, JSON body)
  propertyPrice: '/api/v1/web/ppg-app/GetPrice',
};

// endpoint paths on the previous base URL (not moved yet)
const OLD_ENDPOINTS = {
  // on the standard base URL it doesn't filter by cityCode (every lounge, ~500, for any city)
  properties: '/api/v1/web/app_demo/GetAllProperties',
  // the Signup Form submit (account registration). On the standard base URL it asks for a
  // different body (a userName field), so the form's fields need mapping first
  signUp: '/api/v1/web/app_demo/Register',
  // the Newsletter submit: a placeholder path until the newsletter API exists
  newsletter: '/api/v1/web/app_demo/Newsletter',
  // the Contact Form submit: a placeholder path until the contact API exists
  contact: '/api/v1/web/app_demo/Contact',
  // the Booking Form (group-form) submit, and the areas of service of a location (POST, JSON:
  // locationOfService, languageCode; answer: { items: [{ value, text }] }): placeholder paths until
  // the group booking APIs exist
  groupBooking: '/api/v1/web/app_demo/GroupBooking',
  // the lounge booking request (the Booking Form): a placeholder path
  // until its API exists; its areas come from groupBookingAreas with form: 'bookingRequest'
  bookingRequest: '/api/v1/web/app_demo/BookingRequest',
  groupBookingAreas: '/api/v1/web/app_demo/GetGroupBookingAreas',
  // the login modal's submit (POST, JSON: username, password); answers with a JWT. On the
  // standard base URL a refusal is a 502 with a nested error object
  login: '/api/v1/web/app_demo/Login',
  // the forgot password modal's submit (POST, JSON: lastName, email). On the standard base URL it
  // currently fails (502, its downstream service)
  forgotPassword: '/api/v1/web/app_demo/ForgotPassword',
  // a partner page's password (POST, JSON: partnername, password); answers with a token (a JWT),
  // or 400 with a message (blocks/partner-password). Not on the standard base URL yet
  partnerLogin: '/api/v1/web/app_demo/PartnerLogin',
  // the logged-in member's profile (GET, Authorization: Bearer <jwt>). Not on the standard base
  // URL yet
  getProfile: '/api/v1/web/app_demo/GetProfile',
  // a booking (order) of the logged-in member (POST, JSON: orderId; Authorization: Bearer <jwt>).
  // On the standard base URL it answers without checking the member's token
  getOrderDetail: '/api/v1/web/app_demo/GetOrderDetail',
  // the add-ons on sale for a booking's lounge and start time (POST, JSON: orderId, startDateTime,
  // propertyCode, iataCode, currencyCode; Authorization: Bearer <jwt>): a placeholder path until
  // the add-ons API exists (answer: see blocks/edit-booking/README.md)
  getAddOns: '/api/v1/web/app_demo/GetAddOns',
  // a lounge's details. Not on the standard base URL yet
  propertyDetail: '/api/v1/web/app_demo/GetPropertyDetail',
  // a pass (product) with its prices, for a product code and currency (GET). On the standard base
  // URL it answers "Missing mandatory inputs" to this request
  productPasses: '/api/v1/web/app_demo/GetProductPasses',
  // the logged-in member's bookings (POST, JSON: languageCode, propertyTypeCode, status; the
  // login token as a Bearer token). On the standard base URL it checks a different token
  bookingList: '/api/v1/web/app_demo/GetBookingList',
  // resending a booking's confirmation and cancelling it (POST, JSON: orderId): placeholder paths
  // until these APIs exist
  resendBookingConfirmation: '/api/v1/web/app_demo/ResendBookingConfirmation',
  cancelBooking: '/api/v1/web/app_demo/CancelBooking',
};

/**
 * The full address of an API endpoint.
 * @param {string} name An ENDPOINTS or OLD_ENDPOINTS key, e.g. 'properties'
 * @returns {URL} a new URL each call, so callers can add search parameters
 */
export default function apiUrl(name) {
  const standard = Object.hasOwn(ENDPOINTS, name);
  const path = standard ? ENDPOINTS[name] : OLD_ENDPOINTS[name];
  if (!path?.startsWith('/')) throw new Error(`Unknown endpoint "${name}"`);
  return new URL(path, standard ? API_DOMAIN : OLD_API_DOMAIN);
}
