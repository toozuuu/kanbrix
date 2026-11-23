// @vitest-environment jsdom
import {useState} from "react";
import {describe,it,expect,afterEach} from "vitest";
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import "../i18n";
import {MarkdownEditor,Markdown} from "./MarkdownEditor";
afterEach(cleanup);
describe("issue Markdown",()=>{
 it("renders existing plain text, bold, lists and fenced code",()=>{
   const {container}=render(<Markdown text={"A **release**\n\n- item\n\n```js\nconst x = 1;\n```"}/>);
   expect(container.querySelector("strong")?.textContent).toBe("release");
   expect(screen.getByRole("listitem").textContent).toBe("item");
   expect(container.querySelector("pre code")?.textContent).toContain("const x");
 });
 it("previews the current draft and preserves it when returning to write mode",()=>{
   function Editor(){const [v,set]=useState("");return <MarkdownEditor label="Description" value={v} onChange={set}/>;}
   render(<Editor/>);fireEvent.change(screen.getByRole("textbox"),{target:{value:"**Ready**"}});
   fireEvent.click(screen.getByRole("button",{name:"Preview"}));expect(screen.getByText("Ready").tagName).toBe("STRONG");
   fireEvent.click(screen.getByRole("button",{name:"Write"}));expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("**Ready**");
 });
 it("removes executable markup from stored rich text",()=>{
   const {container}=render(<Markdown text={'<p onclick="unused()">example<script>unused()</script></p>'}/>);
   expect(container.querySelector("script,[onclick]")).toBeNull();
 });
});
