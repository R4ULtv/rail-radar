import * as React from "react";

const InterCityNotte = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    xmlSpace="preserve"
    fillRule="evenodd"
    strokeLinejoin="round"
    strokeMiterlimit="2"
    clipRule="evenodd"
    viewBox="0 0 64 64"
    style={{ backgroundColor: "#1a2a5e" }}
    {...props}
  >
    <path
      fill="#fff"
      d="m35.655 40.736 6.409-10.106.017 10.09 5.098.004L58.31 23.017l-5.34-.008-6.292 9.877.002-9.867-5.244-.005-11.179 17.694z"
    ></path>
    <path
      fill="#fff"
      fillRule="nonzero"
      d="M11.23 40.668H5.84l11.106-17.593h5.39zm8.866 0-2.893-5.39 7.723-12.203H39.16l-2.846 4.48h-8.82l-5.203 8.19h8.843l-3.127 4.923z"
    ></path>
  </svg>
);

export default InterCityNotte;
