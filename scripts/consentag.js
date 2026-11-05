/*
 * consenTag: the container whose ID is the page metadata `consentag-id` (e.g. 67407556, set for
 * every page in the metadata sheet). This does what the provider's snippet does, without an
 * inline script (the page's Content Security Policy only runs scripts added by its own scripts):
 * consenTag.js in the <head>, then consenTag.init() with the container, in silent mode.
 */
import { getMetadata, loadScript } from './aem.js';

const SRC = 'https://consentag.eu/public/3.0.1/consenTag.js';
// a container ID: digits
const ID = /^\d+$/;

/**
 * Starts consenTag on a page, when the metadata `consentag-id` is a container ID.
 */
export default async function initConsenTag() {
  const containerId = getMetadata('consentag-id').trim();
  if (!ID.test(containerId)) return;
  try {
    // data-cfasync: as the provider's snippet (keeps Cloudflare Rocket Loader from deferring it)
    await loadScript(SRC, { 'data-cfasync': 'false' });
    window.consenTag.init({ containerId, silentMode: true }, true);
  } catch {
    // eslint-disable-next-line no-console
    console.warn('consenTag failed to load', containerId);
  }
}
