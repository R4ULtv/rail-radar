import { env } from "@/lib/env";

const baseUrl = new URL(env.siteUrl);
export default baseUrl;
