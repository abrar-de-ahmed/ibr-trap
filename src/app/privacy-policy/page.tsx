import type { Metadata } from "next";

const SITE_URL = "https://bgremoverdigital.pages.dev";

export const metadata: Metadata = {
  title: "Privacy Policy - BG Remover Digital",
  description: "Privacy Policy for BG Remover Digital. Learn how we handle your data, images, and payments.",
  alternates: { canonical: "/privacy-policy" },
};

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      <main className="flex-1 max-w-3xl mx-auto px-4 py-10 sm:py-16">
        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-700 font-medium mb-8 transition-colors"
        >
          ← Back to BG Remover
        </a>

        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-slate-400 mb-10">
          Last updated: April 24, 2026
        </p>

        <div className="prose prose-slate prose-sm sm:prose-base max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mt-0">1. Introduction</h2>
            <p className="text-slate-600 leading-relaxed">
              BG Remover Digital (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) operates the website bgremoverdigital.pages.dev
              (the &quot;Service&quot;). This Privacy Policy explains how we collect, use, disclose, and safeguard your
              information when you visit our website and use our background removal tool. By accessing or using the
              Service, you agree to the collection and use of information in accordance with this policy. If you do not
              agree with the terms of this Privacy Policy, please do not access the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">2. Information We Collect</h2>

            <h3 className="text-lg font-medium text-slate-800 mt-6">2.1 Images You Upload</h3>
            <p className="text-slate-600 leading-relaxed">
              When you use our background removal tool, your images are processed entirely within your browser using
              client-side technology. Your images are <strong>never uploaded to our servers</strong>. The AI model
              runs locally on your device, and the processed results are generated directly in your browser. We do not
              have access to, store, or transmit your images at any point during the process.
            </p>

            <h3 className="text-lg font-medium text-slate-800 mt-6">2.2 Local Storage Data</h3>
            <p className="text-slate-600 leading-relaxed">
              We use your browser&apos;s local storage to maintain a simple usage counter and track your payment status.
              This data is stored exclusively on your device and includes: the number of images you have processed, your
              payment verification status, a unique client reference identifier, and your Stripe checkout session
              identifier. This data is never transmitted to our servers and is used solely to provide you with the
              correct service limits and unlock features after payment.
            </p>

            <h3 className="text-lg font-medium text-slate-800 mt-6">2.3 Payment Information</h3>
            <p className="text-slate-600 leading-relaxed">
              We process payments through Stripe, Inc. (&quot;Stripe&quot;), a globally trusted payment processor that
              complies with PCI-DSS Level 1 standards. When you make a purchase, your payment details (such as credit
              card number, expiration date, and CVV) are collected and processed directly by Stripe on their secure
              servers. We <strong>do not store, access, or handle your full payment card details</strong>. Stripe
              provides us only with a limited dataset including your email address, transaction amount, and payment
              confirmation status, which we use solely to verify your purchase and unlock your Pro features.
            </p>

            <h3 className="text-lg font-medium text-slate-800 mt-6">2.4 Automatically Collected Information</h3>
            <p className="text-slate-600 leading-relaxed">
              When you visit our website, we automatically collect certain information through Google Analytics, which
              may include your IP address (anonymized), browser type, operating system, referring URL, pages visited,
              time spent on pages, and general geographic location (country or region level only). This data is used
              exclusively to understand how visitors interact with our Service so we can improve the user experience
              and performance of our website.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">3. How We Use Your Information</h2>
            <p className="text-slate-600 leading-relaxed">
              We use the information we collect for the following purposes: to operate and maintain our background
              removal tool and provide you with the features you have purchased; to process your payment transactions
              securely through Stripe and verify your Pro subscription status; to analyze website usage patterns through
              Google Analytics to improve our Service, fix bugs, and optimize performance; to communicate with you
              regarding your account, transactions, or changes to our Service if absolutely necessary; and to detect,
              prevent, and address technical issues, fraud, or abuse of our Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">4. Third-Party Services</h2>
            <p className="text-slate-600 leading-relaxed">
              Our Service integrates with the following third-party providers, each with their own privacy policies:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-600">
              <li>
                <strong>AI Processing Technology:</strong> We utilize a third-party AI integration for the background
                removal functionality. The AI model is loaded and executed entirely within your browser. No image data
                is sent to external servers during processing. The model files are fetched from a third-party content
                delivery network (CDN) to enable client-side processing.
              </li>
              <li>
                <strong>Stripe, Inc.:</strong> Handles all payment processing. Stripe&apos;s Privacy Policy is available
                at{" "}
                <a
                  href="https://stripe.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-600 hover:text-violet-700 underline"
                >
                  stripe.com/privacy
                </a>
                .
              </li>
              <li>
                <strong>Google Analytics:</strong> Used for website usage analytics. Google&apos;s Privacy Policy is
                available at{" "}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-600 hover:text-violet-700 underline"
                >
                  policies.google.com/privacy
                </a>
                . You can opt out of Google Analytics by installing the{" "}
                <a
                  href="https://tools.google.com/dlpage/gaoptout"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-600 hover:text-violet-700 underline"
                >
                  Google Analytics opt-out browser add-on
                </a>
                .
              </li>
              <li>
                <strong>Cloudflare, Inc.:</strong> Provides website hosting and content delivery. Cloudflare&apos;s
                Privacy Policy is available at{" "}
                <a
                  href="https://www.cloudflare.com/privacypolicy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-600 hover:text-violet-700 underline"
                >
                  cloudflare.com/privacypolicy
                </a>
                .
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">5. Cookies and Tracking</h2>
            <p className="text-slate-600 leading-relaxed">
              We use minimal cookies and tracking technologies. Google Analytics sets cookies to analyze website
              traffic and user behavior. These cookies are used to distinguish unique visitors, sessions, and traffic
              sources. Stripe may set cookies during the checkout process to maintain your session and process your
              payment securely. We do not use advertising cookies, remarketing pixels, or social media tracking scripts.
              All cookies used are essential for the functioning of our Service or for analytics purposes only.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">6. Data Security</h2>
            <p className="text-slate-600 leading-relaxed">
              We take the security of your information seriously. Since image processing occurs entirely within your
              browser, your images never leave your device, providing the highest level of data privacy. Our website
              is served over HTTPS with industry-standard encryption (TLS 1.3). Payment processing is handled by
              Stripe, which maintains PCI-DSS Level 1 compliance. We implement security headers (Content Security
              Policy, HSTS, X-Frame-Options, and others) to protect against common web vulnerabilities. Despite our
              best efforts, no method of transmission over the Internet is 100% secure, and we cannot guarantee
              absolute security of information transmitted to us through third-party services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">7. Data Retention</h2>
            <p className="text-slate-600 leading-relaxed">
              We do not store your images or personal data on our servers. The only data retained is your local
              storage data on your device, which you can clear at any time through your browser settings. Payment
              transaction records are maintained by Stripe in accordance with their data retention policies and
              applicable financial regulations. Google Analytics data is retained for a maximum of 14 months in
              accordance with our analytics configuration and Google&apos;s data retention settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">8. Your Rights</h2>
            <p className="text-slate-600 leading-relaxed">
              Depending on your jurisdiction, you may have the following rights regarding your personal data: the right
              to access the personal data we hold about you; the right to request correction of inaccurate data; the
              right to request deletion of your data (note: since most data is stored locally on your device, you can
              delete it directly through your browser settings); the right to object to or restrict processing of your
              data; and the right to data portability. To exercise any of these rights, please contact us at the email
              address provided below. We will respond to your request within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">9. Children&apos;s Privacy</h2>
            <p className="text-slate-600 leading-relaxed">
              Our Service is not intended for children under the age of 13. We do not knowingly collect personal
              information from children under 13. If you are a parent or guardian and believe your child has provided
              us with personal information, please contact us immediately so we can take appropriate action.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">10. Changes to This Policy</h2>
            <p className="text-slate-600 leading-relaxed">
              We may update this Privacy Policy from time to time to reflect changes in our practices, technology, or
              legal requirements. We will notify you of any material changes by updating the &quot;Last updated&quot;
              date at the top of this page. We encourage you to review this Privacy Policy periodically to stay
              informed about how we protect your information. Your continued use of the Service after any changes
              constitutes your acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">11. Contact Us</h2>
            <p className="text-slate-600 leading-relaxed">
              If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices,
              please contact us at:{" "}
              <a
                href="mailto:abrarahmedcoder@gmail.com"
                className="text-violet-600 hover:text-violet-700 font-medium underline"
              >
                abrarahmedcoder@gmail.com
              </a>
            </p>
          </section>
        </div>
      </main>

      <footer className="py-6 text-center text-sm text-slate-400 border-t border-slate-200 bg-white">
        &copy; {new Date().getFullYear()} BG Remover Digital. All rights reserved.
      </footer>
    </div>
  );
}
