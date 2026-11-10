import type { APIRoute } from "astro";
import config from "virtual:andesine/config";
import { handleSearch } from "../../search/endpoint";

export const prerender = false;

export const POST: APIRoute = ({ request }) => handleSearch(request, config);
