import { useEffect } from "react";

// Canonical URLs always point at the production domain, even when this page is
// viewed from a preview/staging host — so search engines never index a preview
// URL as a separate/duplicate site. Update this if the production domain changes.
const PRODUCTION_ORIGIN = "https://yukticart.com";

export function useMeta(title, description, path) {
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

    const canonicalPath = path ?? window.location.pathname;
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) { link = document.createElement("link"); link.setAttribute("rel", "canonical"); document.head.appendChild(link); }
    link.setAttribute("href", `${PRODUCTION_ORIGIN}${canonicalPath}`);
  }, [title, description, path]);
}
