/*
 * Netcore Smartech: its client script, set up with the page metadata `smartech-create-id` (e.g.
 * ADGMOT35CHFLVDHBJNIG50K96ARDDLT3SQCIL9T9UKBRRJD76TK0) and `smartech-register-id` (e.g.
 * b96294d911b5e972f2910aec3759942d), set for every page in the metadata sheet. This does what the
 * provider's snippet does, without an inline script (the page's Content Security Policy only runs
 * scripts added by its own scripts): smartechclient.js, then smartech('create', …) and
 * smartech('register', …).
 */
import { getMetadata, loadScript } from './aem.js';

const SRC = 'https://cdnt.netcoresmartech.com/smartechclient.js';
// an ID: letters and digits
const ID = /^[A-Za-z0-9]+$/;

/**
 * Starts Smartech on a page, when the metadata `smartech-create-id` and `smartech-register-id`
 * are both IDs.
 */
export default async function initSmartech() {
  const createId = getMetadata('smartech-create-id').trim();
  const registerId = getMetadata('smartech-register-id').trim();
  if (!ID.test(createId) || !ID.test(registerId)) return;
  try {
    await loadScript(SRC);
    window.smartech('create', createId);
    window.smartech('register', registerId);
  } catch {
    // eslint-disable-next-line no-console
    console.warn('Smartech failed to load', createId);
  }
}
