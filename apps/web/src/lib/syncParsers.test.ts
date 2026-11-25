import { expect, it } from "vitest";
import { parseImportFile } from "./syncParsers";

it("reads Jira export keys, repeated label columns and multiline descriptions", () => {
  const preview = parseImportFile("jira-export.csv",
    'Issue key,Issue Type,Summary,Status,Priority,Labels,Labels,Description\r\nENG-12,Bug,"Fix login, mobile",In Review,High,web,login,"First line\nSecond line"');
  expect(preview.issues[0]).toMatchObject({external_id:"ENG-12", title:"Fix login, mobile",
    labels:["web","login"], description:"First line\nSecond line", status:"In Review"});
});
