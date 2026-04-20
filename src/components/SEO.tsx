import { useEffect } from "react";

interface SEOProps {
  title: string;
  description: string;
  path?: string;
  image?: string;
  jsonLd?: Record<string, unknown>;
}

const SITE_URL = "https://cyber-cut-book.lovable.app";
const DEFAULT_IMAGE =
  "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/3c4dd637-99f8-4ecf-ace6-29bda94c51be/id-preview-437ad10c--eafe43fb-1114-4fcf-a6f6-0380afebd518.lovable.app-1775869070807.png";

const setMeta = (selector: string, attr: string, value: string, create?: () => HTMLElement) => {
  let el = document.head.querySelector(selector) as HTMLElement | null;
  if (!el && create) {
    el = create();
    document.head.appendChild(el);
  }
  if (el) el.setAttribute(attr, value);
};

const SEO = ({ title, description, path = "/", image = DEFAULT_IMAGE, jsonLd }: SEOProps) => {
  useEffect(() => {
    const url = `${SITE_URL}${path}`;
    const fullTitle = title.length > 60 ? title.slice(0, 57) + "..." : title;
    const desc = description.length > 160 ? description.slice(0, 157) + "..." : description;

    document.title = fullTitle;

    setMeta('meta[name="description"]', "content", desc, () => {
      const m = document.createElement("meta");
      m.setAttribute("name", "description");
      return m;
    });

    setMeta('link[rel="canonical"]', "href", url, () => {
      const l = document.createElement("link");
      l.setAttribute("rel", "canonical");
      return l;
    });

    const ogTags: Array<[string, string]> = [
      ["og:type", "website"],
      ["og:url", url],
      ["og:title", fullTitle],
      ["og:description", desc],
      ["og:image", image],
    ];
    ogTags.forEach(([prop, val]) => {
      setMeta(`meta[property="${prop}"]`, "content", val, () => {
        const m = document.createElement("meta");
        m.setAttribute("property", prop);
        return m;
      });
    });

    const twTags: Array<[string, string]> = [
      ["twitter:card", "summary_large_image"],
      ["twitter:title", fullTitle],
      ["twitter:description", desc],
      ["twitter:image", image],
    ];
    twTags.forEach(([name, val]) => {
      setMeta(`meta[name="${name}"]`, "content", val, () => {
        const m = document.createElement("meta");
        m.setAttribute("name", name);
        return m;
      });
    });

    // JSON-LD
    const existing = document.head.querySelector('script[data-seo-jsonld="true"]');
    if (existing) existing.remove();
    if (jsonLd) {
      const s = document.createElement("script");
      s.type = "application/ld+json";
      s.dataset.seoJsonld = "true";
      s.text = JSON.stringify(jsonLd);
      document.head.appendChild(s);
    }
  }, [title, description, path, image, jsonLd]);

  return null;
};

export default SEO;
