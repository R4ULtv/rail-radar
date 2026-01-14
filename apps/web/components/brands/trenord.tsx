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
      d="M51.558 12.437H20.41c-.862 0-1.752.166-2.597.526-2.064.896-3.534 2.682-4.155 4.746l-.036.148c20.405 6.992 26.384 23.075 26.44 27.873v.336c-.017 1.95-1.362 4.319-3.552 5.494h7.033c.885 0 1.77-.173 2.6-.528 2.06-.902 3.539-2.68 4.162-4.753l6.945-25.851a6.8 6.8 0 0 0 .234-1.671c.042-3.47-2.592-6.32-5.927-6.32"
    />
    <path
      fill="#d91920"
      fillRule="nonzero"
      d="M36.583 44.146c.057-5.556-6.684-11.462-10.018-14.517-.607-.482-1.138-.907-1.563-1.195-.722.83-5.453 1.89-14.19.007l-.038.108-4.25 15.856c0 .013-.013.013-.013.013 9.24 5.557 30 8.67 30.072-.272"
    />
  </svg>
);

export default Trenord;
