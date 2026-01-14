import * as React from "react";

const Sad = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    xmlSpace="preserve"
    fillRule="evenodd"
    strokeLinejoin="round"
    strokeMiterlimit="2"
    clipRule="evenodd"
    viewBox="0 0 64 64"
    style={{ backgroundColor: "#82B229" }}
    {...props}
  >
    <path
      fill="#fff"
      d="M10.616 38.29 7.02 33.143l-.03-.042V33.1l-.079-.114-.03-.046.044-.029 27.46-18.34-14.177.615-.029.001-.016-.024-4.41-6.28-.058-.084h.103l25.858-.007h.028l.015.023 3.618 5.127.015.024-.009.026-8.811 23.913L53.29 25.589l.045-.032.032.045.07.1V25.7l.04.056 3.61 5.14.031.044-.046.03-27.359 18.425 14.174-.668h.03l.016.022 4.433 6.263.059.084-.102.002-25.933.11h-.028l-.017-.022-3.584-5.152-.015-.022.01-.027 8.69-23.88-16.754 12.198-.044.033zm25.532-.119-4.135-5.965-5.341 12.922zm-4.183-6.38 5.391-12.903-9.55 6.953z"
    />
  </svg>
);

export default Sad;
