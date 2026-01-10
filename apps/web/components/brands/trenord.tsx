import * as React from "react";

const Trenord = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    xmlSpace="preserve"
    fillRule="evenodd"
    strokeLinejoin="round"
    strokeMiterlimit="2"
    clipRule="evenodd"
    viewBox="0 0 64 64"
    style={{ backgroundColor: "#fff" }}
    {...props}
  >
    <path
      fill="#006b3b"
      fillRule="nonzero"
      d="M50.407 13.586H21.093c-.811 0-1.649.156-2.444.495-1.943.843-3.327 2.524-3.91 4.466l-.035.14c19.205 6.58 24.832 21.717 24.884 26.234v.316c-.015 1.835-1.281 4.065-3.343 5.17h6.62c.833 0 1.666-.162 2.447-.497 1.94-.848 3.33-2.52 3.917-4.473l6.536-24.33a6.4 6.4 0 0 0 .221-1.573c.04-3.266-2.44-5.948-5.579-5.948"
    ></path>
    <path
      fill="#d91920"
      fillRule="nonzero"
      d="M36.313 43.43c.054-5.23-6.29-10.788-9.429-13.663-.57-.454-1.07-.854-1.47-1.125-.68.78-5.132 1.78-13.356.006l-.035.102-4 14.924c0 .012-.012.012-.012.012 8.695 5.23 28.234 8.16 28.302-.256"
    ></path>
  </svg>
);

export default Trenord;
