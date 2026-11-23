import createClient from "openapi-fetch";
import createQueryClient from "openapi-react-query";
import type {paths} from "./api-schema";
export const typedFetch=createClient<paths>({credentials:"include"});
export const apiHooks=createQueryClient(typedFetch);
