import { Helmet } from "react-helmet-async";

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

const SEO = ({ title, description, path = "/", image = DEFAULT_IMAGE, jsonLd }: SEOProps) => {
  const url = `${SITE_URL}${path}`;
  const fullTitle = title.length > 60 ? title.slice(0, 57) + "..." : title;
  const desc = description.length > 160 ? description.slice(0, 157) + "..." : description;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <link rel="canonical" href={url} />

      <meta property="og:type" content="website" />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:image" content={image} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={image} />

      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
};

export default SEO;
