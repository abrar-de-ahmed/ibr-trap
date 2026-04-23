import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://bgremoverdigital.pages.dev";
const SITE_NAME = "BG Remover Digital";
const SITE_TITLE = "BG Remover — Remove Image Backgrounds Free | AI-Powered";
const SITE_DESCRIPTION =
  "Remove image backgrounds instantly with AI. 2 free images, then get 500 images for just $9. No signup required. Supports PNG, JPG, WEBP up to 20MB.";

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  keywords: [
    "background remover",
    "remove background",
    "free background remover",
    "AI background removal",
    "remove image background online",
    "transparent background maker",
    "background eraser",
    "bulk background remover",
    "batch background removal",
    "AI background eraser",
  ],
  authors: [{ name: "BG Remover Digital" }],
  creator: "BG Remover Digital",
  publisher: "BG Remover Digital",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "BG Remover Digital - AI Background Removal Tool",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [`${SITE_URL}/og-image.png`],
  },
};

// JSON-LD Structured Data: SoftwareApplication schema
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "BG Remover Digital",
  description: SITE_DESCRIPTION,
  url: SITE_URL,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "AggregateOffer",
    lowPrice: "0",
    highPrice: "9.00",
    priceCurrency: "USD",
    offerCount: 2,
    offers: [
      {
        "@type": "Offer",
        name: "Free Plan",
        price: "0",
        priceCurrency: "USD",
        description: "2 free background removals per user",
      },
      {
        "@type": "Offer",
        name: "Pro Plan",
        price: "9.00",
        priceCurrency: "USD",
        description: "500 background removals, batch processing up to 30 images",
      },
    ],
  },
  featureList: [
    "AI-powered background removal",
    "Free tier with 2 images",
    "Bulk processing up to 30 images",
    "Supports PNG, JPG, WEBP",
    "No signup required",
    "Client-side processing for privacy",
  ],
};

// GSC verified via HTML file: public/googlec9fe8dd65678b590.html

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        {/* Google Analytics */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-K1QRPR8ZL9"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-K1QRPR8ZL9');
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
