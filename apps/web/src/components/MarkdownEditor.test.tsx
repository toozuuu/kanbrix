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
 it("opens an empty rich draft with a ready visual editor",async()=>{
   render(<MarkdownEditor label="Description" value="" onChange={()=>{}} defaultMode="rich"/>);
   expect(await screen.findByRole("textbox",{name:"Description"})).toHaveAttribute("contenteditable","true");
   expect(screen.getByRole("button",{name:"HTML source"})).toBeEnabled();
 });
 it("removes executable markup from stored rich text",()=>{
   const {container}=render(<Markdown text={'<p onclick="unused()">example<script>unused()</script></p>'}/>);
   expect(container.querySelector("script,[onclick]")).toBeNull();
 });
 it("keeps supported HTML formatting and removes page styling from previews",()=>{
   const {container}=render(<Markdown text={'<div class="fixed"><p style="position:fixed"><mark>Ready</mark></p><pre><code class="language-js fixed">const x = 1;</code></pre><table><tr><td colspan="2">Release</td></tr></table></div>'}/>);
   expect(screen.getByText("Ready").tagName).toBe("MARK");
   expect(screen.getByText("Release")).toHaveAttribute("colspan","2");
   expect(container.querySelector("pre code")).toHaveAttribute("class","language-js");
   expect(container.querySelector(".fixed,[style]")).toBeNull();
 });
});
