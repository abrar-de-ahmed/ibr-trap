import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service - BG Remover Digital",
  description: "Terms of Service for BG Remover Digital. Read our terms and conditions for using our AI background removal tool.",
  alternates: { canonical: "/terms-of-service" },
};

export default function TermsOfService() {
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
          Terms of Service
        </h1>
        <p className="text-sm text-slate-400 mb-10">
          Last updated: April 24, 2026
        </p>

        <div className="prose prose-slate prose-sm sm:prose-base max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mt-0">1. Acceptance of Terms</h2>
            <p className="text-slate-600 leading-relaxed">
              By accessing or using the BG Remover Digital website at bgremoverdigital.pages.dev (the
              &quot;Service&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not
              agree to all of these Terms, do not use the Service. These Terms apply to all visitors, users, and others
              who access or use the Service. We reserve the right to modify or replace these Terms at any time. Material
              changes will be indicated by updating the &quot;Last updated&quot; date at the top of this page. Your
              continued use of the Service after any such changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">2. Description of Service</h2>
            <p className="text-slate-600 leading-relaxed">
              BG Remover Digital provides an AI-powered online tool that removes backgrounds from images. The Service
              offers two usage tiers: a Free tier that allows processing of up to 2 images, and a Pro tier that allows
              processing of up to 500 images with batch upload capability (up to 30 images at a time) for a one-time
              payment of $9.00 USD. All image processing is performed client-side in your web browser using a third-party
              AI integration. No images are uploaded to or stored on our servers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">3. User Accounts and Local Storage</h2>
            <p className="text-slate-600 leading-relaxed">
              The Service does not require you to create an account, provide personal information, or register in any
              way. Usage tracking and payment status are maintained locally in your browser&apos;s storage. This means
              your usage count and Pro status are tied to your specific browser and device. If you clear your browser
              data, use a different browser, or switch devices, your usage count and Pro status may not carry over.
              Contact our support email with proof of purchase if you need your Pro status restored on a different
              browser or device.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">4. Payment Terms</h2>
            <p className="text-slate-600 leading-relaxed">
              The Pro tier is a one-time purchase of $9.00 USD processed through Stripe, Inc. By completing a purchase,
              you agree to Stripe&apos;s terms of service in addition to these Terms. Payment is non-refundable once
              the background removal processing has been unlocked and used. The Pro tier provides a one-time allocation
              of 500 image processing credits. These credits do not expire but are non-renewable. Once all 500 credits
              are used, you will need to make an additional purchase. We reserve the right to change pricing at any
              time, but price changes will not affect existing Pro tier purchases.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">5. Acceptable Use</h2>
            <p className="text-slate-600 leading-relaxed">
              You agree to use the Service only for lawful purposes and in accordance with these Terms. You are
              responsible for ensuring that any images you process using the Service do not infringe on the intellectual
              property rights, privacy rights, or any other rights of any third party. You must not use the Service to
              process images that contain illegal content, explicit material involving minors, or content that violates
              any applicable law or regulation. You must not attempt to reverse-engineer, decompile, disassemble, or
              otherwise attempt to discover the source code of the Service or the underlying AI model. You must not use
              any automated means, bots, or scrapers to access the Service in a manner that could damage, disable,
              overburden, or impair the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">6. Intellectual Property</h2>
            <p className="text-slate-600 leading-relaxed">
              The Service, including its website design, user interface, and underlying technology, is owned by BG
              Remover Digital and is protected by copyright, trademark, and other intellectual property laws. The
              third-party AI integration used for background removal is subject to its own licensing terms. You retain
              full ownership of all images you upload and the processed results you download. We do not claim any
              ownership or rights to your images or the output generated by the Service. You are solely responsible
              for the content of the images you process and any outputs you create.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">7. Disclaimer of Warranties</h2>
            <p className="text-slate-600 leading-relaxed">
              The Service is provided on an &quot;as is&quot; and &quot;as available&quot; basis without any warranties
              of any kind, either express or implied. We do not guarantee that the Service will be uninterrupted,
              timely, secure, or error-free. We do not guarantee that the background removal results will be perfect,
              accurate, or suitable for any particular purpose. The quality of results may vary depending on the input
              image quality, complexity, lighting, and other factors. You acknowledge that the AI-powered background
              removal may not produce perfect results in all cases and that manual editing may be required for optimal
              output.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">8. Limitation of Liability</h2>
            <p className="text-slate-600 leading-relaxed">
              To the fullest extent permitted by applicable law, BG Remover Digital and its operators shall not be
              liable for any indirect, incidental, special, consequential, or punitive damages, including but not
              limited to loss of profits, data, use, goodwill, or other intangible losses, resulting from your access
              to or use of (or inability to access or use) the Service; any conduct or content of any third party on
              the Service; any content obtained from the Service; or unauthorized access, use, or alteration of your
              transmissions or content. In no event shall our total liability to you for all claims arising from or
              related to the Service exceed the amount you paid to us, if any, which in most cases is $0 for free tier
              users or $9.00 for Pro tier users.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">9. Indemnification</h2>
            <p className="text-slate-600 leading-relaxed">
              You agree to defend, indemnify, and hold harmless BG Remover Digital and its operators from and against
              any claims, damages, obligations, losses, liabilities, costs, or debt arising from your use of the
              Service, your violation of these Terms, or your violation of any rights of another party. This includes
              any claims related to images you process using the Service, including but not limited to intellectual
              property infringement, privacy violations, or defamation.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">10. Termination</h2>
            <p className="text-slate-600 leading-relaxed">
              We may terminate or suspend access to our Service immediately, without prior notice or liability, for
              any reason, including without limitation if you breach these Terms. Upon termination, your right to use
              the Service will immediately cease. All provisions of these Terms which by their nature should survive
              termination shall survive, including but not limited to ownership provisions, warranty disclaimers,
              indemnification, and limitations of liability.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">11. Governing Law</h2>
            <p className="text-slate-600 leading-relaxed">
              These Terms shall be governed and construed in accordance with applicable laws, without regard to conflict
              of law provisions. Our failure to enforce any right or provision of these Terms will not be considered a
              waiver of those rights. If any provision of these Terms is held to be invalid or unenforceable by a court,
              the remaining provisions of these Terms will remain in effect.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">12. Contact Us</h2>
            <p className="text-slate-600 leading-relaxed">
              If you have any questions about these Terms of Service, please contact us at:{" "}
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
