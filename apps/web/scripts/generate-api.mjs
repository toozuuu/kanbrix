import openapiTS,{astToString} from "openapi-typescript";
import {readFile,writeFile} from "node:fs/promises";
const source=process.argv[2]??"http://localhost:8080/api/v1/openapi.json";
const schema=/^https?:/.test(source)?await (async()=>{const r=await fetch(source);if(!r.ok)throw Error("Schema request failed: "+r.status);return r.json()})():JSON.parse(await readFile(source,"utf8"));
const types=astToString(await openapiTS(schema));
await writeFile(new URL("../src/lib/api-schema.d.ts",import.meta.url),"// Generated from the Kanbrix API contract. Run npm run generate:api to refresh.\n"+types);
