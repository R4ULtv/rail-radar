/**
 * `@view-transition { navigation: auto }` in styles.css makes the browser create a ViewTransition
 * for each cross-document navigation. Nothing in the app owns it, so when the browser skips it
 * (another navigation starts while it is still preparing, for instance) its promises reject with
 * an AbortError that surfaces as an unhandled rejection. Observing them on both sides of the
 * navigation keeps a skipped fade from being reported as an error. Runs inline in the document
 * head so the listeners exist before `pagereveal` fires on first render.
 */
export const viewTransitionSkipScript = `(function(){function o(e){var t=e.viewTransition;if(t){var n=function(){};t.ready.catch(n);t.finished.catch(n);t.updateCallbackDone.catch(n)}}addEventListener("pageswap",o);addEventListener("pagereveal",o)})()`;
