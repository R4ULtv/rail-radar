/** Map marker icons: a white glyph on a rounded square in the mode's color, with a white border. */

export const RAIL_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="none" viewBox="0 0 512 512">
  <rect width="464" height="464" x="24" y="24" fill="#4b61d1" stroke="#fff" stroke-opacity="100%" stroke-width="48" paint-order="stroke" rx="112"/>
  <svg xmlns="http://www.w3.org/2000/svg" width="352" height="352" x="80" y="80" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" alignment-baseline="middle" viewBox="0 0 24 24">
    <path d="M8 3.1V7a4 4 0 0 0 8 0V3.1M9 15l-1-1m7 1 1-1"/>
    <path d="M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Zm-1 0-2 3m10-3 2 3"/>
  </svg>
</svg>`;

export const METRO_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="none" viewBox="0 0 512 512">
  <rect width="464" height="464" x="24" y="24" fill="#f22a18" stroke="#fff" stroke-opacity="100%" stroke-width="48" paint-order="stroke" rx="112"/>
  <svg xmlns="http://www.w3.org/2000/svg" width="452" height="452" x="30" y="30" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" alignment-baseline="middle" viewBox="0 0 24 24">
    <path d="M8 16V8.5a.5.5 0 0 1 .9-.3l2.7 3.599a.5.5 0 0 0 .8 0l2.7-3.6a.5.5 0 0 1 .9.3V16"/>
  </svg>
</svg>`;

export const LIGHT_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="none" viewBox="0 0 512 512">
  <rect width="464" height="464" x="24" y="24" fill="#14b8a6" stroke="#fff" stroke-opacity="100%" stroke-width="48" paint-order="stroke" rx="112"/>
  <svg xmlns="http://www.w3.org/2000/svg" width="352" height="352" x="80" y="80" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" alignment-baseline="middle" viewBox="0 0 24 24">
  <rect width="16" height="16" x="4" y="3" rx="2"></rect><path d="M4 11h16"></path><path d="M12 3v8"></path><path d="m8 19-2 3"></path><path d="m18 22-2-3"></path><path d="M8 15h.01"></path><path d="M16 15h.01"></path>
  </svg>
</svg>`;

/** No freight stations on the map yet; drawn the same way for the operator directory. */
export const FREIGHT_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="none" viewBox="0 0 512 512">
  <rect width="464" height="464" x="24" y="24" fill="#d97706" stroke="#fff" stroke-opacity="100%" stroke-width="48" paint-order="stroke" rx="112"/>
  <svg xmlns="http://www.w3.org/2000/svg" width="352" height="352" x="80" y="80" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" alignment-baseline="middle" viewBox="0 0 24 24">
    <path d="M22 7.7c0-.6-.4-1.2-.8-1.5l-6.3-3.9a1.72 1.72 0 0 0-1.7 0l-10.3 6c-.5.2-.9.8-.9 1.4v6.6c0 .5.4 1.2.8 1.5l6.3 3.9a1.72 1.72 0 0 0 1.7 0l10.3-6c.5-.3.9-1 .9-1.5Z"/>
    <path d="M10 21.9V14L2.1 9.1"/><path d="m10 14 11.9-6.9"/><path d="M14 19.8v-8.1"/><path d="M18 17.5V9.4"/>
  </svg>
</svg>`;

export function svgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
