import type { MetadataRoute } from 'next';
import keywordsData from '../../data/keywords.json';

export const dynamic = 'force-static';

const SITE_URL = 'https://bgremoverdigital.pages.dev';

type KeywordEntry = {
  slug: string;
  keyword: string;
};

const keywords: KeywordEntry[] = keywordsData as KeywordEntry[];

export default function sitemap(): MetadataRoute.Sitemap {
  const today = new Date().toISOString().split('T')[0];

  // Homepage
  const homePage: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: today,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
  ];

  // Keyword pages
  const keywordPages: MetadataRoute.Sitemap = keywords.map((entry) => ({
    url: `${SITE_URL}/remove-background/${entry.slug}`,
    lastModified: today,
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/privacy-policy`,
      lastModified: today,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terms-of-service`,
      lastModified: today,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];

  return [...homePage, ...keywordPages, ...staticPages];
}
