import DOMPurify from "dompurify";

export function sanitizeRichText(content: string) {
  const fragment = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [
      "div", "p", "br", "strong", "b", "em", "i", "u", "s", "strike",
      "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote",
      "code", "pre", "a", "img", "table", "thead", "tbody", "tr", "th", "td",
      "del", "ins", "mark", "hr",
    ],
    ALLOWED_ATTR: ["href", "src", "alt", "title", "class", "align", "colspan", "rowspan", "start"],
    ALLOW_DATA_ATTR: false,
    RETURN_DOM_FRAGMENT: true,
  });

  // Code-language classes are part of the editor's storage format.
  fragment.querySelectorAll("[class]").forEach(node => {
    const language = node.tagName === "CODE" &&
      [...node.classList].find(token => /^language-[a-z0-9_-]+$/i.test(token));
    if (language) node.className = language;
    else node.removeAttribute("class");
  });
  const wrapper = document.createElement("div");
  wrapper.append(fragment);
  return wrapper.innerHTML;
}
