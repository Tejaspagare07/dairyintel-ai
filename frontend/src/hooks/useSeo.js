import { useEffect } from "react";

const SITE = "DairyIntel AI";

// Sets <title>, meta description, canonical and robots for the current page.
export default function useSeo({ title, description, noindex = false, path }) {
  useEffect(() => {
    document.title = title ? `${title} | ${SITE}` : `${SITE} — Milk Quality Testing & Mastitis Screening for Indian Dairy Farms`;
    const set = (sel, attr, key, val) => {
      let el = document.head.querySelector(sel);
      if (!el) { el = document.createElement(sel.startsWith("link") ? "link" : "meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
      el.setAttribute(sel.startsWith("link") ? "href" : "content", val);
    };
    if (description) {
      set('meta[name="description"]', "name", "description", description);
      set('meta[property="og:description"]', "property", "og:description", description);
    }
    set('meta[property="og:title"]', "property", "og:title", document.title);
    set('meta[name="robots"]', "name", "robots", noindex ? "noindex, nofollow" : "index, follow");
    if (path !== undefined) set('link[rel="canonical"]', "rel", "canonical", window.location.origin + path);
  }, [title, description, noindex, path]);
}