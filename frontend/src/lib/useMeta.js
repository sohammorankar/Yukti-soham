import { useEffect } from "react";

export function useMeta(title, description) {
  useEffect(() => {
    document.title = title;
    const set = (name, content, attr = "name") => {
      let el = document.querySelector(`meta[${attr}="${name}"]`);
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, name); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };
    if (description) set("description", description);
    set("og:title", title, "property");
    if (description) set("og:description", description, "property");
    set("twitter:card", "summary_large_image");
    set("twitter:title", title);
  }, [title, description]);
}
