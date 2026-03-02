const baseUrl =
  process.env.VERCEL_TARGET_ENV === "production"
    ? new URL("https://www.railradar24.com")
    : new URL("http://localhost:3000");
export default baseUrl;
