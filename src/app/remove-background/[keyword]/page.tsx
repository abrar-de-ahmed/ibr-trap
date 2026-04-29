import type { Metadata } from 'next';
import BackgroundRemover from '@/components/BackgroundRemover';
import keywordsData from '../../../../data/keywords.json';

const SITE_URL = 'https://bgremoverdigital.pages.dev';

type KeywordEntry = {
  slug: string;
  keyword: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  why_matters: string[];
  how_to_steps: { title: string; description: string }[];
  faqs: { question: string; answer: string }[];
  related_slugs: string[];
};

const keywords: KeywordEntry[] = keywordsData as KeywordEntry[];

export function generateStaticParams() {
  return keywords.map((entry) => ({
    keyword: entry.slug,
  }));
}

type PageProps = {
  params: Promise<{ keyword: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { keyword } = await params;
  const entry = keywords.find((k) => k.slug === keyword);

  if (!entry) {
    return { title: 'Not Found' };
  }

  return {
    title: entry.title,
    description: entry.description,
    alternates: {
      canonical: `/remove-background/${entry.slug}`,
    },
    openGraph: {
      title: entry.title,
      description: entry.description,
      url: `${SITE_URL}/remove-background/${entry.slug}`,
      siteName: 'BG Remover Digital',
      type: 'website',
      images: [
        {
          url: `${SITE_URL}/og-image.png`,
          width: 1200,
          height: 630,
          alt: entry.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: entry.title,
      description: entry.description,
      images: [`${SITE_URL}/og-image.png`],
    },
  };
}

export default async function KeywordPage({ params }: PageProps) {
  const { keyword } = await params;
  const entry = keywords.find((k) => k.slug === keyword);

  if (!entry) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Page not found.</p>
      </div>
    );
  }

  // Build FAQ JSON-LD
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entry.faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  // Build related links
  const relatedEntries = entry.related_slugs
    .map((slug) => keywords.find((k) => k.slug === slug))
    .filter(Boolean) as KeywordEntry[];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      {/* FAQ Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* SEO Content */}
      <section className="max-w-3xl mx-auto px-4 pt-10 sm:pt-14 pb-8">
        {/* H1 */}
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight text-center mb-6">
          {entry.h1}
        </h1>

        {/* Intro */}
        <div className="prose prose-slate prose-lg max-w-none mb-10">
          <p className="text-slate-600 leading-relaxed">{entry.intro}</p>
        </div>

        {/* Why It Matters */}
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            Why This Matters
          </h2>
          <div className="space-y-4">
            {entry.why_matters.map((paragraph, i) => (
              <p key={i} className="text-slate-600 leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        {/* How To Steps */}
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">
            How to Do This in 3 Steps
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {entry.how_to_steps.map((step, i) => (
              <div
                key={i}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-violet-100 text-violet-700 font-bold text-sm">
                    {i + 1}
                  </span>
                  <h3 className="font-semibold text-slate-900">{step.title}</h3>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {entry.faqs.map((faq, i) => (
              <div
                key={i}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <h3 className="font-semibold text-slate-900 mb-2">
                  {faq.question}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center py-8">
          <p className="text-xl font-bold text-slate-900 mb-3">
            Remove backgrounds now — free
          </p>
          <p className="text-slate-500 text-sm mb-4">
            Try it below. 2 free images, no signup required.
          </p>
          <a
            href="#tool"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-md hover:shadow-lg text-sm sm:text-base"
          >
            Try the Tool
          </a>
        </div>
      </section>

      {/* Background Remover Tool */}
      <div id="tool">
        <BackgroundRemover />
      </div>

      {/* Related Pages */}
      <section className="max-w-3xl mx-auto px-4 py-10">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Related Pages</h2>
        <div className="flex flex-wrap gap-3">
          <a
            href="/"
            className="inline-flex items-center px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-700 hover:border-violet-400 hover:text-violet-700 transition-colors shadow-sm"
          >
            Home
          </a>
          {relatedEntries.map((related) => (
            <a
              key={related.slug}
              href={`/remove-background/${related.slug}`}
              className="inline-flex items-center px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-700 hover:border-violet-400 hover:text-violet-700 transition-colors shadow-sm"
            >
              {related.keyword}
            </a>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 text-center text-sm text-slate-400 border-t border-slate-200 bg-white mt-auto">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
          <span>&copy; {new Date().getFullYear()} BG Remover Digital. All rights reserved.</span>
          <span className="hidden sm:inline text-slate-300">|</span>
          <div className="flex items-center gap-4">
            <a href="/privacy-policy" className="hover:text-violet-600 transition-colors">Privacy Policy</a>
            <a href="/terms-of-service" className="hover:text-violet-600 transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
