#!/usr/bin/env node
/**
 * BG Remover Digital - Content Agent
 * Blog Article Generator with Title A/B Testing
 * Runs Mon, Wed, Fri at 9:00 UTC via GitHub Actions
 *
 * Reads: brain.json, config.json, blog.json
 * Writes: brain.json, blog.json
 * Commits + pushes, sends email report
 */

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SITE_URL = 'https://bgremoverdigital.craftedmindss.com';
const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data');
const TODAY = new Date().toISOString().split('T')[0];
const NOW = new Date();
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function log(msg) {
  console.log(`[Content Agent ${new Date().toISOString()}] ${msg}`);
}

// ═══════════════════════════════════════════════════════
// DATA I/O
// ═══════════════════════════════════════════════════════
function readJSON(file) {
  try {
    const p = path.join(DATA_DIR, file);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) { log(`Read error ${file}: ${e.message}`); }
  return null;
}

function writeJSON(file, data) {
  try {
    fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
    return true;
  } catch (e) { log(`Write error ${file}: ${e.message}`); return false; }
}

// ═══════════════════════════════════════════════════════
// GIT
// ═══════════════════════════════════════════════════════
function gitCommitAndPush() {
  try {
    execSync('git config user.name "Content Agent"');
    execSync('git config user.email "content-agent[bot]@users.noreply.github.com"');
    execSync('git add data/');
    const diff = execSync('git diff --cached --stat').toString().trim();
    if (diff) {
      execSync(`git commit -m "content-agent: blog article - ${TODAY}"`);
      execSync('git push');
      log('Changes committed and pushed.');
      return true;
    }
    log('No changes to commit.');
    return false;
  } catch (e) { log(`Git error: ${e.message}`); return false; }
}

// ═══════════════════════════════════════════════════════
// EMAIL
// ═══════════════════════════════════════════════════════
async function sendEmail(subject, html) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASS },
  });
  await transporter.sendMail({
    from: `"Content Agent" <${process.env.GMAIL_USER}>`,
    to: process.env.ALERT_EMAIL,
    subject, html,
  });
}

// ═══════════════════════════════════════════════════════
// BLOG TOPICS & CONTENT GENERATION
// ═══════════════════════════════════════════════════════
const BLOG_TOPICS = [
  {
    topic: 'How to Remove Image Backgrounds Without Photoshop',
    slug: 'remove-backgrounds-without-photoshop',
    keywords: ['background removal', 'no photoshop', 'free alternative'],
    sections: [
      { heading: 'Why People Avoid Photoshop for Background Removal', points: ['Photoshop is expensive ($20+/month subscription)', 'Steep learning curve for simple tasks', 'Time-consuming manual process with magic wand and pen tools', 'Overkill for sellers who just need clean product photos'] },
      { heading: 'The Modern Alternative: AI-Powered Background Removal', points: ['Browser-based tools that run entirely on your device', 'AI detects the subject automatically in seconds', 'No downloads, installations, or accounts required', 'Results that rival professional editing at zero cost'] },
      { heading: 'Step-by-Step: Remove a Background in Under 30 Seconds', points: ['Upload your image to the tool', 'Wait for the AI to process (typically 2-5 seconds)', 'Download your transparent PNG cutout', 'Place it on any background you want'] },
      { heading: 'When AI Background Removal Works Best', points: ['Product photography with clear subject-background separation', 'Portrait photos with solid or gradient backgrounds', 'Logo and icon processing for web and print', 'Batch processing for ecommerce catalogs'] }
    ],
    benefits: 'The biggest advantage of skipping Photoshop is the time saved. What takes 15-20 minutes in Photoshop takes under 10 seconds with AI. For ecommerce sellers processing dozens of product photos per week, this adds up to hours of reclaimed time. The quality is comparable to manual editing for most use cases, and the cost difference is dramatic: $0 versus $240+ per year for Photoshop.',
    cta: 'Ready to try it yourself? Visit BG Remover Digital and remove your first background for free. No signup, no download, no credit card. Just upload an image and see the results instantly.'
  },
  {
    topic: 'Best Free Background Removers in 2026 Compared',
    slug: 'best-free-background-removers-2026',
    keywords: ['free background remover', 'comparison', '2026'],
    sections: [
      { heading: 'What Makes a Great Free Background Remover', points: ['Accuracy of cutout edges and fine detail preservation', 'Speed of processing from upload to download', 'Privacy - does the tool upload your images to a server', 'Ease of use and learning curve', 'Output quality and supported formats'] },
      { heading: 'Top Free Background Removal Tools in 2026', points: ['BG Remover Digital - client-side AI, no signup, 2 free images', 'remove.bg - cloud-based, good accuracy, 1 free credit', 'Adobe Express - free tier available, requires Adobe account', 'Canva - built-in background remover, requires account', 'PhotoRoom - mobile-focused, limited free tier'] },
      { heading: 'Privacy Comparison: Where Do Your Images Go', points: ['Tools that process locally keep your images private', 'Cloud-based tools upload your images to their servers', 'For sensitive photos (documents, personal), local processing is essential', 'Client-side AI is the most secure option available'] },
      { heading: 'Which Tool Should You Choose', points: ['For privacy: browser-based AI tools that process locally', 'For speed: AI-powered tools with no account required', 'For ecommerce: tools that support batch processing', 'For occasional use: any free tier with at least 1-2 free images'] }
    ],
    benefits: 'Choosing the right background remover depends on your priorities. If privacy is paramount, browser-based AI tools that process everything locally are the clear winner. They never upload your images, which matters for product prototypes, client photos, or personal images. If you process large volumes, look for batch processing support. And if you want to test quality before committing, always start with a tool that offers free images without requiring an account.',
    cta: 'BG Remover Digital checks all the boxes: free, private, fast, and no signup required. Try removing your first background right now and see why thousands of sellers trust it for their product photos.'
  },
  {
    topic: 'AI Background Removal: How It Works Under the Hood',
    slug: 'ai-background-removal-how-it-works',
    keywords: ['AI background removal', 'technology', 'how it works'],
    sections: [
      { heading: 'The Core Technology: Semantic Segmentation', points: ['AI models trained on millions of images learn to distinguish foreground from background', 'Semantic segmentation classifies every pixel as subject or background', 'Modern models use neural networks with attention mechanisms for precision', 'The technology evolved from research at MIT, Stanford, and major tech companies'] },
      { heading: 'Client-Side vs Cloud Processing', points: ['Client-side: AI model runs in your browser using WebAssembly', 'Cloud: images uploaded to a server, processed remotely, returned', 'Client-side is slower for first use (model download) but faster afterward', 'Client-side guarantees privacy - images never leave your device'] },
      { heading: 'How BG Remover Digital Processes Your Images', points: ['Model downloads once (about 40MB) and caches in your browser', 'ONNX Runtime WebAssembly executes the AI model locally', 'No image data is sent to any server during processing', 'Results are generated in 2-10 seconds depending on image complexity'] },
      { heading: 'Why This Technology Matters for Your Business', points: ['Professional-quality results without hiring a designer', 'Consistent output quality across hundreds of images', 'Scales from 1 image to 30 images without quality loss', 'Costs a fraction of traditional photo editing services'] }
    ],
    benefits: 'Understanding how AI background removal works helps you choose the right tool and set realistic expectations. The technology is mature enough that most everyday images are processed with near-perfect accuracy. Complex cases like transparent objects, fine hair, or low-contrast boundaries may need minor touch-up, but for the vast majority of product photos, portraits, and graphics, the results are ready to use immediately.',
    cta: 'Experience AI background removal firsthand. Upload any image to BG Remover Digital and watch the AI separate your subject from the background in seconds. Free, private, and no signup required.'
  },
  {
    topic: 'How to Make Product Photos with Transparent Backgrounds',
    slug: 'product-photos-transparent-backgrounds',
    keywords: ['product photography', 'transparent background', 'ecommerce'],
    sections: [
      { heading: 'Why Transparent Backgrounds Matter for Product Photos', points: ['Allows placing products on any color or lifestyle background', 'Required by many marketplaces (Amazon, eBay, stock photo sites)', 'Creates a professional, consistent look across your catalog', 'Makes composites and marketing materials easy to create'] },
      { heading: 'Photography Tips for Best AI Background Removal Results', points: ['Use a contrasting background (light product on dark surface or vice versa)', 'Ensure even lighting to avoid harsh shadows', 'Photograph products from a straight-on angle when possible', 'Leave some space around the product for clean edge detection'] },
      { heading: 'The Workflow: From Photo to Transparent Cutout', points: ['Take your product photo against any background', 'Upload to BG Remover Digital', 'Download the transparent PNG', 'Place on white, colored, or lifestyle background as needed'] },
      { heading: 'Advanced Tips for Challenging Products', points: ['Jewelry: use a lightbox with diffused lighting for best edge detection', 'Clothing: photograph on a contrasting solid color', 'Glass items: use a darker background so reflections do not confuse the AI', 'Shoes: photograph from a 45-degree angle for the most natural cutout'] }
    ],
    benefits: 'Transparent background product photos are the foundation of professional ecommerce imagery. They give you maximum flexibility for marketing materials, marketplace listings, social media posts, and advertisements. With AI-powered background removal, creating these images takes seconds instead of minutes, and the quality is high enough for even the most demanding marketplaces.',
    cta: 'Start creating professional product photos today. BG Remover Digital gives you 2 free transparent background removals. Upload your first product photo and see the difference a clean cutout makes.'
  },
  {
    topic: 'Background Removal for E-commerce: Complete Guide',
    slug: 'ecommerce-background-removal-guide',
    keywords: ['ecommerce', 'background removal', 'online store'],
    sections: [
      { heading: 'The Impact of Image Quality on E-commerce Sales', points: ['75% of online shoppers say product photos are the most important factor', 'High-quality images can increase conversion rates by 30% or more', 'Consistent image styling builds brand trust and professionalism', 'Poor images are the #1 reason shoppers abandon product pages'] },
      { heading: 'Background Requirements by Platform', points: ['Amazon: pure white (RGB 255,255,255) for main images', 'eBay: no strict requirement but clean backgrounds perform best', 'Etsy: any style but consistency across your shop matters most', 'Shopify: your choice, but clean cutouts give maximum flexibility', 'Instagram: lifestyle backgrounds work well, clean cutouts for product-only posts'] },
      { heading: 'Scaling Background Removal for Large Catalogs', points: ['Use batch processing to handle 30 images at once', 'Maintain consistent lighting and photography setup', 'Create a template workflow for each product category', 'Use AI tools that preserve quality across batch processing'] },
      { heading: 'Measuring the ROI of Professional Product Images', points: ['Track click-through rate changes before and after image improvements', 'Monitor conversion rate on product pages with clean vs cluttered images', 'A/B test white vs lifestyle backgrounds for your top products', 'Calculate time saved per image when switching from manual to AI editing'] }
    ],
    benefits: 'Every ecommerce platform rewards clean product imagery. Whether you sell on Amazon with strict white-background requirements, on Etsy where visual consistency builds trust, or on your own Shopify store where branding matters most, removing backgrounds from product photos is the single highest-ROI improvement you can make. It costs nothing with free AI tools and the impact on sales is measurable.',
    cta: 'Transform your product photos in seconds. BG Remover Digital removes backgrounds automatically with AI, giving you the clean, professional images that drive ecommerce sales. Try it free with 2 images, no signup needed.'
  },
  {
    topic: 'Remove Background from Jewelry Photos: Tips and Tools',
    slug: 'jewelry-background-removal-tips',
    keywords: ['jewelry', 'background removal', 'product photography tips'],
    sections: [
      { heading: 'Why Jewelry is the Hardest Category for Background Removal', points: ['Reflective surfaces pick up background colors', 'Thin chains, prongs, and settings create complex edges', 'Transparent gemstones confuse basic editing tools', 'Small size means every pixel matters for quality'] },
      { heading: 'Photography Setup for Jewelry Background Removal', points: ['Use a light tent or lightbox for even, diffused lighting', 'Photograph on a matte white or light gray surface', 'Use a macro lens or close-up mode for maximum detail', 'Clean the jewelry thoroughly before photographing'] },
      { heading: 'Getting the Best Results with AI Tools', points: ['Upload the highest resolution image available', 'Ensure the jewelry contrasts with the background', 'For rings, photograph from directly above', 'For necklaces, lay flat or use a display stand'] },
      { heading: 'After Removal: Enhancing Your Jewelry Cutouts', points: ['Place on pure white for marketplace compliance', 'Use subtle shadows for a natural, 3D look on lifestyle shots', 'Ensure the cutout preserves all fine details at zoom level', 'Save as PNG to maintain transparency for maximum flexibility'] }
    ],
    benefits: 'Jewelry photography demands the highest image quality because buyers zoom in to examine every detail. A clean background ensures that when a customer inspects your ring, necklace, or bracelet at full zoom, they see only the piece itself. AI background removal tools like BG Remover Digital handle the intricate edges of jewelry automatically, saving you from tedious manual editing while delivering professional results.',
    cta: 'Get perfect jewelry cutouts in seconds. BG Remover Digital handles chains, prongs, gemstones, and reflective surfaces with precision. Upload your first jewelry photo free and see the quality for yourself.'
  },
  {
    topic: 'Amazon Product Image Requirements: Background Removal Guide',
    slug: 'amazon-image-requirements-guide',
    keywords: ['Amazon', 'product images', 'white background'],
    sections: [
      { heading: 'Amazon Image Requirements Explained', points: ['Main image: pure white background (RGB 255,255,255)', 'Product must fill at least 85% of the image frame', 'No text, watermarks, logos, or graphic elements on main image', 'Minimum 1000x1000 pixels, recommended 1600x1600 for zoom', 'JPEG, TIFF, or GIF format, RGB color mode'] },
      { heading: 'Common Mistakes That Get Listings Suppressed', points: ['Off-white or grayish backgrounds instead of pure white', 'Product too small in the frame', 'Including props, text, or additional elements', 'Using PNG with transparency (use white-filled JPEG instead)', 'Inconsistent backgrounds across variant images'] },
      { heading: 'How to Meet Amazon Requirements with BG Remover Digital', points: ['Remove the background to get a transparent PNG cutout', 'Place the cutout on a pure white canvas (RGB 255,255,255)', 'Ensure the product fills at least 85% of the frame', 'Export as JPEG for Amazon compatibility', 'Batch process up to 30 images with the Pro plan'] },
      { heading: 'Secondary Images: What Else Amazon Sellers Need', points: ['Lifestyle images showing the product in use', 'Infographics highlighting key features and dimensions', 'Size comparison charts', 'Detail close-up shots of materials, textures, and craftsmanship'] }
    ],
    benefits: 'Meeting Amazon image requirements is not optional. Non-compliant images can lead to listing suppression, which means your product becomes invisible in search results. Using an AI background remover is the fastest way to ensure every main product image meets Amazon standards. The process takes seconds per image and eliminates the risk of manual editing errors that could cost you sales.',
    cta: 'Get Amazon-compliant product images in seconds. BG Remover Digital creates clean cutouts you can place on a pure white background. Start with 2 free images and see how easy it is to meet Amazon standards.'
  },
  {
    topic: 'Etsy Shop Success: How Clean Backgrounds Boost Sales',
    slug: 'etsy-shop-clean-backgrounds',
    keywords: ['Etsy', 'background removal', 'shop success'],
    sections: [
      { heading: 'How Etsy Shoppers Browse and Choose Products', points: ['Shoppers discover products through thumbnail grids in search results', 'The first image is the most important factor in click-through rate', 'Consistent styling across your shop builds trust and brand recognition', 'Professional-looking images signal quality craftsmanship'] },
      { heading: 'Background Strategies for Different Etsy Niches', points: ['Handmade goods: light, neutral backgrounds that do not compete with the product', 'Vintage items: slightly textured or warm backgrounds for authenticity', 'Digital products: clean mockups on laptops, phones, or frames', 'Craft supplies: organized layouts with clean, simple backgrounds'] },
      { heading: 'Creating a Cohesive Etsy Shop Aesthetic', points: ['Choose 2-3 background styles and use them consistently', 'Use the same lighting and angle for all product photos', 'Remove backgrounds for maximum flexibility in styling', 'Create templates for your most common product types'] },
      { heading: 'Measuring the Impact on Your Etsy Sales', points: ['Compare click-through rates before and after image improvements', 'Track favorite-to-sale conversion rate', 'Monitor average order value as your shop aesthetic improves', 'Use Etsy Stats to identify which image styles perform best'] }
    ],
    benefits: 'On Etsy, your product images are your storefront. Shoppers scrolling through search results make split-second decisions based on thumbnail quality. Clean, consistent backgrounds make your listings stand out from the competition and signal to buyers that you are a professional, trustworthy seller. The investment in image quality pays for itself many times over in increased sales.',
    cta: 'Give your Etsy shop the upgrade it deserves. BG Remover Digital helps you create clean, professional product images that attract clicks and drive sales. Try it free with your first 2 images.'
  },
  {
    topic: 'Free vs Paid Background Removers: What You Actually Get',
    slug: 'free-vs-paid-background-removers',
    keywords: ['free vs paid', 'background remover comparison', 'pricing'],
    sections: [
      { heading: 'What Free Background Removers Offer', points: ['1-5 free images typically (enough for testing quality)', 'Basic cutout quality suitable for social media and casual use', 'May require account creation or watermarked results', 'Cloud processing means your images are uploaded to servers', 'Good enough for occasional personal use'] },
      { heading: 'What Paid Plans Unlock', points: ['Higher volume processing (hundreds or thousands of images)', 'Batch processing for efficiency', 'Faster processing speeds', 'Higher resolution output', 'Priority support and additional features'] },
      { heading: 'The Hidden Cost of "Free" Tools', points: ['Your images may be stored, analyzed, or used for AI training', 'Account requirements mean giving up your email and data', 'Watermarked results look unprofessional', 'Limited free images force you to switch tools mid-project', 'Cloud processing adds latency and privacy concerns'] },
      { heading: 'The Smart Middle Ground: One-Time Payment', points: ['BG Remover Digital offers 500 images for a one-time $9 payment', 'No subscription, no recurring charges, no hidden fees', 'Client-side processing means total privacy', 'Batch upload up to 30 images at once', 'Results comparable to tools charging $20+/month'] }
    ],
    benefits: 'The background removal tool market is divided between limited free tiers and expensive subscriptions. For most users, the sweet spot is a one-time payment that gives you enough images to last months or years. At $9 for 500 images, tools like BG Remover Digital offer the best value proposition, especially when you factor in privacy benefits of client-side processing.',
    cta: 'Stop overpaying for background removal. Get 500 images for $9 with BG Remover Digital. One-time payment, no subscription, total privacy. Start with 2 free images to test the quality.'
  },
  {
    topic: '10 Creative Uses for Transparent Background Images',
    slug: 'creative-uses-transparent-images',
    keywords: ['transparent images', 'creative uses', 'design tips'],
    sections: [
      { heading: 'Marketing and Advertising Materials', points: ['Place products on branded backgrounds for ads', 'Create composite images for social media campaigns', 'Design email headers with product overlays', 'Build promotional banners and flyers'] },
      { heading: 'Social Media Content Creation', points: ['Create consistent product grids on Instagram', 'Design Pinterest pins with lifestyle backgrounds', 'Make YouTube thumbnails with clean subject placement', 'Build Facebook ad creatives with flexible backgrounds'] },
      { heading: 'Website and E-commerce Applications', points: ['Hero banners with products on custom backgrounds', 'Category page headers with seasonal themes', 'About page team photos on branded backgrounds', 'Testimonial cards with consistent styling'] },
      { heading: 'Print and Physical Materials', points: ['Business cards with logos on custom backgrounds', 'Brochures and catalogs with flexible product placement', 'Packaging design with product mockups', 'Trade show banners and displays'] }
    ],
    benefits: 'A transparent background image is the most versatile format in digital design. Once you have a clean cutout, you can use it across virtually every marketing channel without re-shooting or re-editing. This multiplies the value of every photo you take and dramatically reduces your content production costs. With AI background removal, creating these versatile assets takes seconds.',
    cta: 'Unlock the full potential of your images. BG Remover Digital creates transparent cutouts you can use everywhere. Try your first 2 images free and discover how versatile transparent backgrounds can be.'
  },
  {
    topic: 'Background Removal for Social Media: Instagram, Pinterest, Twitter',
    slug: 'social-media-background-removal',
    keywords: ['social media', 'Instagram', 'Pinterest', 'Twitter'],
    sections: [
      { heading: 'Why Background Removal Boosts Social Media Engagement', points: ['Clean images stand out in crowded social media feeds', 'Consistent visual style builds brand recognition across platforms', 'Flexible backgrounds let you adapt content for different platforms', 'Professional-looking images get more shares and saves'] },
      { heading: 'Platform-Specific Image Best Practices', points: ['Instagram: square or vertical format, lifestyle or clean backgrounds', 'Pinterest: vertical pins (2:3 ratio), text overlays on clean backgrounds', 'Twitter/X: landscape or square, bold visuals that stop the scroll', 'Facebook/LinkedIn: professional backgrounds for business content'] },
      { heading: 'Creating a Social Media Content Pipeline', points: ['Photograph products once, create content for all platforms', 'Use transparent cutouts as your base asset', 'Create platform-specific versions with different backgrounds', 'Batch process to maintain consistent quality across all content'] },
      { heading: 'Measuring Social Media ROI from Better Images', points: ['Track engagement rate changes after switching to clean backgrounds', 'Monitor click-through rate on product pins and posts', 'Compare save and share rates across different image styles', 'A/B test lifestyle vs clean backgrounds for your audience'] }
    ],
    benefits: 'Social media is a visual medium, and the quality of your images directly impacts engagement. Clean, professional-looking images with flexible backgrounds let you create platform-optimized content at scale. Instead of photographing the same product on different backgrounds for each platform, remove the background once and create unlimited variations.',
    cta: 'Level up your social media game. BG Remover Digital gives you clean cutouts you can use across every platform. Free to try, no signup, instant results. Start creating scroll-stopping content today.'
  },
  {
    topic: 'Background Removal for Real Estate Photography',
    slug: 'real-estate-background-removal',
    keywords: ['real estate', 'property photos', 'background removal'],
    sections: [
      { heading: 'Why Image Quality Matters in Real Estate', points: ['97% of home buyers start their search online', 'Listings with professional photos get 118% more views', 'First impression is made in under 10 seconds', 'Poor photos can reduce perceived home value by thousands of dollars'] },
      { heading: 'Common Real Estate Photo Challenges', points: ['Cluttered rooms that distract from the property features', 'Harsh shadows and uneven lighting', 'Exterior shots with distracting elements (cars, trash bins, signs)', 'Seasonal inconsistencies between interior and exterior shots'] },
      { heading: 'Ethical Guidelines for Real Estate Photo Editing', points: ['Remove temporary distractions but never structural elements', 'Enhance lighting and color balance but do not misrepresent the property', 'Transparent skies can be replaced but the property itself must be accurate', 'Always disclose significant edits to buyers when required by local regulations'] },
      { heading: 'Building a Professional Real Estate Photo Workflow', points: ['Shoot in RAW format for maximum editing flexibility', 'Use consistent white balance across all rooms', 'Process exterior skies separately for consistent look', 'Batch process property photos for efficiency'] }
    ],
    benefits: 'Real estate photography is one of the highest-stakes applications of image editing. A single listing photo can make the difference between a quick sale and months on the market. AI background removal helps agents and photographers clean up property photos by removing distractions, replacing skies, and ensuring every shot presents the property in its best light while staying within ethical editing guidelines.',
    cta: 'Transform your property photos in seconds. BG Remover Digital helps real estate professionals create clean, compelling listing images. Try it free with 2 images and see the difference professional background removal makes.'
  },
  {
    topic: 'How to Remove Background from Passport Photos at Home',
    slug: 'passport-photo-background-removal',
    keywords: ['passport photo', 'ID photo', 'background removal'],
    sections: [
      { heading: 'Passport Photo Background Requirements by Country', points: ['USA: plain white or off-white background', 'UK: plain light grey or cream background', 'Canada: plain white background', 'EU: generally white or light grey', 'Pakistan: white or light blue background'] },
      { heading: 'Taking a Passport Photo at Home', points: ['Use natural daylight facing a window for even lighting', 'Stand against a plain white wall or hang a white sheet', 'Position camera at eye level, about 4 feet away', 'Ensure full face is visible, no sunglasses or hats'] },
      { heading: 'Removing and Replacing the Background', points: ['Upload your photo to BG Remover Digital', 'The AI removes the existing background automatically', 'Your cutout can be placed on the required color background', 'Check your country requirements for exact background color specification'] },
      { heading: 'Common Passport Photo Mistakes to Avoid', points: ['Uneven or colored lighting on the face', 'Shadows on the wall behind you', 'Wrong image size or resolution for your country', 'Red-eye or blurriness from poor lighting', 'Incorrect background color for your specific country'] }
    ],
    benefits: 'Getting passport photos taken professionally costs $15-30 per set. With AI background removal, you can take your own photo at home, remove the background, and place it on the correct color for your country. The savings add up, especially for families who need multiple photos. The quality from modern AI tools matches or exceeds what most photo booths and drugstores produce.',
    cta: 'Save money on passport photos. BG Remover Digital lets you remove backgrounds from your home photos and place them on the correct background color. Free to try, instant results, no signup required.'
  },
  {
    topic: 'The Science Behind AI Background Removal Technology',
    slug: 'science-ai-background-removal',
    keywords: ['AI technology', 'neural networks', 'computer vision'],
    sections: [
      { heading: 'From Traditional Image Editing to AI Segmentation', points: ['Traditional methods: manual selection, magic wand, color range', 'Early AI: simple classifiers that could not handle complex edges', 'Modern AI: deep neural networks trained on millions of images', 'Current state: real-time processing with near-human accuracy'] },
      { heading: 'How Neural Networks Learn to Separate Foreground from Background', points: ['Training data: millions of images with annotated foreground/background masks', 'Architecture: encoder-decoder networks with skip connections', 'Attention mechanisms: focus on relevant parts of the image', 'Fine-tuning: specialized training for product photos, portraits, documents'] },
      { heading: 'Running AI Models in the Browser', points: ['ONNX Runtime enables running neural networks via WebAssembly', 'Models are optimized for web performance and size', 'GPU acceleration available through WebGL for faster processing', 'Model caching means only the first use requires a download'] },
      { heading: 'Limitations and Edge Cases', points: ['Very low contrast between subject and background', 'Transparent or semi-transparent objects (glass, water)', 'Extremely complex subjects (dense foliage, crowds)', 'Images with motion blur or severe compression artifacts'] }
    ],
    benefits: 'Understanding the technology behind AI background removal helps you appreciate both its capabilities and its limitations. Modern neural networks achieve remarkable accuracy for most common use cases, processing images in seconds on hardware you already own. As the technology continues to improve, the edge cases that still challenge AI will become fewer and fewer.',
    cta: 'Experience cutting-edge AI technology firsthand. BG Remover Digital runs advanced neural networks directly in your browser to deliver professional-quality background removal. Try your first image free and see the science in action.'
  },
  {
    topic: 'Transparent PNG vs White Background: When to Use Which',
    slug: 'transparent-png-vs-white-background',
    keywords: ['transparent PNG', 'white background', 'when to use'],
    sections: [
      { heading: 'Understanding the Difference', points: ['Transparent PNG: no background, see-through areas', 'White background: solid white behind the subject', 'Both have valid use cases depending on your needs', 'Most tools output transparent PNG, which you can then place on any color'] },
      { heading: 'When to Use Transparent PNG', points: ['Sticker creation for messaging apps and social media', 'Layering multiple images in a design or composite', 'Product catalogs where backgrounds change seasonally', 'Logo placement on various colored backgrounds'] },
      { heading: 'When to Use White Background', points: ['Amazon and other marketplace main product images', 'Print materials where transparency is not supported', 'Clean, minimalist website layouts', 'Catalog layouts with a consistent white theme'] },
      { heading: 'Converting Between Formats', points: ['Transparent PNG to white: place on white canvas, export as JPEG', 'White to transparent: use AI tool to detect and remove the white', 'Keep original transparent file for maximum future flexibility', 'Use the right format for each platform to avoid quality loss'] }
    ],
    benefits: 'Having both transparent and white-background versions of your product images gives you maximum flexibility. The transparent version is your master asset that you can place on any background, while the white version is ready for marketplaces that require it. AI background removal tools make it easy to create both from a single photo.',
    cta: 'Get the best of both worlds. BG Remover Digital creates transparent PNG cutouts you can use anywhere. Place them on white for Amazon, on branded colors for your website, or on lifestyle scenes for social media. Try 2 images free.'
  },
  {
    topic: 'How to Remove Backgrounds from Batch Images Efficiently',
    slug: 'batch-background-removal',
    keywords: ['batch processing', 'efficient', 'productivity'],
    sections: [
      { heading: 'Why Batch Processing Matters for Your Business', points: ['Ecommerce sellers process 50-500+ product images per month', 'Manual editing takes 5-20 minutes per image', 'Batch AI processing reduces this to seconds per image', 'Time savings translate directly to cost savings and faster launches'] },
      { heading: 'Setting Up an Efficient Batch Workflow', points: ['Organize images into folders by product category', 'Use consistent file naming conventions', 'Prepare all images at the same resolution and format', 'Process in batches of 20-30 for manageable results'] },
      { heading: 'Quality Control After Batch Processing', points: ['Review each cutout at 100% zoom for edge quality', 'Check for artifacts around complex shapes', 'Verify that all background elements were removed', 'Flag any images that need manual touch-up'] },
      { heading: 'BG Remover Digital Batch Processing', points: ['Upload up to 30 images simultaneously with Pro plan', 'Each image is processed independently with full AI quality', 'Failed images do not affect the rest of the batch', 'Download all results at once or individually'] }
    ],
    benefits: 'Batch background removal is where AI tools deliver the most dramatic time savings. Processing 30 product images manually could take 5-10 hours. With batch AI processing, the same 30 images are done in under 5 minutes. For businesses launching new product lines, updating seasonal catalogs, or migrating from one marketplace to another, this efficiency is a game-changer.',
    cta: 'Process 30 images in minutes, not hours. BG Remover Digital supports batch uploads of up to 30 images with the Pro plan. Each image gets the same professional-quality AI background removal. Upgrade to Pro for just $9 and save hours every week.'
  },
  {
    topic: 'Background Removal for Graphic Designers: A Complete Workflow',
    slug: 'graphic-designer-background-removal',
    keywords: ['graphic design', 'workflow', 'designer tips'],
    sections: [
      { heading: 'Background Removal in a Designer Workflow', points: ['Asset preparation: creating clean cutouts from client photos', 'Mockup creation: placing products in scene templates', 'Social media templates: flexible product placement', 'Brand collateral: consistent product imagery across materials'] },
      { heading: 'Choosing the Right Tool for Professional Work', points: ['Accuracy and edge quality for client-facing deliverables', 'Batch processing for large asset libraries', 'Privacy for unreleased product photography', 'Speed for tight deadlines and quick turnaround requests'] },
      { heading: 'Integrating AI Background Removal with Design Tools', points: ['Export transparent PNGs for use in Photoshop, Illustrator, or Figma', 'Create template libraries with pre-cut product assets', 'Build automated design pipelines for recurring content needs', 'Use as a starting point for manual refinement when needed'] },
      { heading: 'Time and Cost Savings for Design Businesses', points: ['Reduce manual clipping path time by 90%', 'Take on more clients without increasing headcount', 'Offer faster turnaround times as a competitive advantage', 'Reduce outsourcing costs for basic photo editing tasks'] }
    ],
    benefits: 'For graphic designers, AI background removal is not about replacing your skills but about eliminating tedious repetitive work. The time you save on basic cutout tasks can be redirected to creative strategy, client communication, and high-value design work. This makes your business more profitable and your work more enjoyable.',
    cta: 'Streamline your design workflow. BG Remover Digital gives you professional-quality cutouts in seconds, freeing you to focus on the creative work that matters. Try 2 images free and see how much time you can save.'
  }
];

function generateArticle(topicData) {
  // Title variants
  const titleA = topicData.topic;
  const titleB = `${Math.floor(Math.random() * 5) + 5} Tips for ${topicData.topic.split(':').pop().trim()} | BG Remover Digital`;

  // Build article body
  const intro = `When it comes to ${topicData.keywords[0]}, having the right knowledge and tools makes all the difference. Whether you are a professional photographer, an ecommerce seller, or a small business owner managing your own content, understanding how to efficiently ${topicData.keywords[0].toLowerCase()} can save you hours of work and significantly improve your results. This comprehensive guide covers everything you need to know about ${topicData.keywords[0].toLowerCase()}, from the underlying technology to practical tips you can implement today. By the end, you will have a clear workflow for producing professional-quality images that drive engagement and sales.`;

  // Main sections
  const mainSections = topicData.sections.map(s => ({
    heading: s.heading,
    content: s.points.map(p => {
      const sentences = [];
      sentences.push(p + '.');
      // Expand with additional context
      const expansions = [
        `This is especially relevant when you consider how ${topicData.keywords[0].toLowerCase()} impacts your overall visual strategy.`,
        `Many professionals overlook this aspect, but it can make a significant difference in your final output quality.`,
        `Taking the time to address this properly will pay dividends across all your visual content.`,
        `The key is to integrate this into your regular workflow rather than treating it as an afterthought.`,
        `With the right approach, this becomes second nature and dramatically improves your efficiency.`
      ];
      sentences.push(expansions[Math.floor(Math.random() * expansions.length)]);
      return sentences.join(' ');
    }).join('\n\n')
  }));

  // FAQ section
  const faqs = [
    {
      question: `What is the best tool for ${topicData.keywords[0].toLowerCase()}?`,
      answer: `BG Remover Digital uses advanced AI technology to deliver professional-quality results in seconds. It processes images entirely in your browser for complete privacy, requires no signup, and offers 2 free images to test the quality.`
    },
    {
      question: `Is ${topicData.keywords[0].toLowerCase()} free?`,
      answer: `Yes, you can start for free with BG Remover Digital. The free plan includes 2 images with no signup required. For larger volumes, the Pro plan offers 500 images for a one-time payment of $9 with no recurring charges.`
    },
    {
      question: `How long does it take to process one image?`,
      answer: `Most images are processed in 2-10 seconds depending on their size and complexity. The first time you use BG Remover Digital, the AI model downloads (about 40MB) and caches in your browser for faster subsequent processing.`
    },
    {
      question: `Are my images safe and private?`,
      answer: `Absolutely. BG Remover Digital processes all images locally in your browser using client-side AI technology. Your images are never uploaded to any server, ensuring complete privacy and security for your product photos, client images, and personal content.`
    },
    {
      question: `What image formats are supported?`,
      answer: `BG Remover Digital supports PNG, JPG, and WEBP formats. Images can be up to 20 MB and up to 4096 pixels on their longest side. The output is always a transparent PNG for maximum versatility.`
    }
  ];

  // Calculate word count
  const fullText = [intro, ...mainSections.map(s => s.content), topicData.benefits, topicData.cta, ...faqs.map(f => f.answer)].join(' ');
  const wordCount = fullText.split(/\s+/).length;

  return {
    titleA,
    titleB,
    intro,
    mainSections,
    benefits: topicData.benefits,
    cta: topicData.cta,
    faqs,
    wordCount,
    topic: topicData.topic,
    slug: topicData.slug,
    keywords: topicData.keywords
  };
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════
async function main() {
  log('=== Content Agent Started ===');

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASS) {
    log('ERROR: Missing email credentials'); process.exit(1);
  }

  let brain = readJSON('brain.json');
  let config = readJSON('config.json');
  let blog = readJSON('blog.json');

  if (!brain) brain = { version: '1.0', emergency: { brake_active: false }, content: { blog_posts: { total: 0, ranking_keywords: 0, best_topic: null } }, social: {}, backlinks: {}, week: 1, current_phase: 'week1_baby_steps', evolution_log: [], paid_users: 0 };
  if (!blog) blog = { posts: [], next_post_id: 1 };
  if (!config) config = { mitigation: { week1: { blog_frequency_days: 2 } } };

  // Emergency brake
  if (brain.emergency?.brake_active) {
    log('Emergency brake active - skipping content creation');
    await sendEmail('Content Agent: BRAKE ACTIVE', `<div style="font-family:sans-serif;padding:20px">
      <h2 style="color:#dc2626">Emergency Brake Active</h2>
      <p>Content creation skipped. Deindexed pages detected. All growth agents paused.</p>
    </div>`);
    return;
  }

  // Check mitigation rules
  const weekNum = brain.week || 1;
  const recentPosts = blog.posts.filter(p => {
    const daysAgo = Math.floor((Date.now() - new Date(p.created_date).getTime()) / 86400000);
    return daysAgo < (config.mitigation[`week${weekNum}`]?.blog_frequency_days || 2);
  });

  if (recentPosts.length > 0) {
    log(`Mitigation: ${recentPosts.length} recent post(s), skipping (frequency limit)`);
    await sendEmail(`Content Agent: Mitigation Active | ${blog.posts.length} total posts`, `<div style="font-family:sans-serif;padding:20px">
      <h2>Content Agent - Mitigation Check</h2>
      <p>Week ${weekNum} limit: 1 post every ${config.mitigation[`week${weekNum}`]?.blog_frequency_days || 2} days</p>
      <p>Recent posts: ${recentPosts.length} - Skipping creation today.</p>
      <p>Total posts: ${blog.posts.length}</p>
    </div>`);
    return;
  }

  // Find unused topic
  const usedTopics = new Set(blog.posts.map(p => p.topic));
  const availableTopics = BLOG_TOPICS.filter(t => !usedTopics.has(t.topic));

  if (availableTopics.length === 0) {
    log('All topics used. Skipping.');
    await sendEmail('Content Agent: All Topics Exhausted', `<div style="font-family:sans-serif;padding:20px">
      <h2>All ${BLOG_TOPICS.length} blog topics have been used.</h2>
      <p>Add new topics to the Content Agent to continue.</p>
    </div>`);
    return;
  }

  // Pick topic (use best_topic from brain if available, else rotate)
  const bestTopic = brain.content?.blog_posts?.best_topic;
  let topicData = availableTopics.find(t => t.topic === bestTopic) || availableTopics[0];
  if (Math.random() < 0.2 && availableTopics.length > 1) {
    // 20% experiment: pick a random different topic
    topicData = availableTopics[Math.floor(Math.random() * availableTopics.length)];
  }

  // Generate article
  log(`Generating article: ${topicData.topic}`);
  const article = generateArticle(topicData);
  const postId = blog.next_post_id;

  // Save to blog.json
  blog.posts.push({
    id: postId,
    title: article.titleA,
    title_variant_a: article.titleA,
    title_variant_b: article.titleB,
    active_title: 'A',
    topic: article.topic,
    slug: article.slug,
    word_count: article.wordCount,
    keywords: article.keywords,
    created_date: TODAY,
    status: 'generated'
  });
  blog.next_post_id = postId + 1;

  // Update brain.json
  if (!brain.content) brain.content = { blog_posts: { total: 0, ranking_keywords: 0, best_topic: null }, blog_lengths: {}, best_blog_length: 1200, title_ab_tests: {}, faq_sections_added: 0 };
  brain.content.blog_posts.total = (brain.content.blog_posts.total || 0) + 1;
  brain.content.faq_sections_added = (brain.content.faq_sections_added || 0) + article.faqs.length;
  brain.content.title_ab_tests[article.slug] = {
    variant_a: article.titleA,
    variant_b: article.titleB,
    active: 'A',
    created: TODAY,
    impressions_a: 0,
    impressions_b: 0
  };
  brain.last_updated = TODAY;

  // Save files
  writeJSON('blog.json', blog);
  writeJSON('brain.json', brain);

  // Git
  gitCommitAndPush();

  // Email report
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:700px;margin:0 auto;padding:20px">
<div style="background:#059669;color:white;padding:14px 16px;border-radius:8px 8px 0 0">
  <h2 style="margin:0;font-size:18px">Content Agent - Blog Article Generated</h2>
  <p style="margin:4px 0 0;font-size:13px;opacity:0.9">${TODAY} | Week ${weekNum} | ${blog.posts.length} total posts</p>
</div>
<div style="border:1px solid #e5e7eb;padding:16px;border-radius:0 0 8px 8px">

  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:12px;margin-bottom:14px">
    <div style="font-size:14px;font-weight:bold;color:#16a34a">${article.titleA}</div>
    <div style="font-size:12px;color:#64748b;margin-top:4px">Slug: ${article.slug}</div>
    <div style="font-size:12px;color:#64748b">Words: ${article.wordCount}</div>
    <div style="font-size:12px;color:#64748b">Keywords: ${article.keywords.join(', ')}</div>
  </div>

  <h3 style="font-size:14px;color:#1e293b;margin:0 0 6px">Title A/B Test</h3>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px;margin-bottom:14px">
    <div style="font-size:12px;color:#374151"><strong>Variant A (Active):</strong> ${article.titleA}</div>
    <div style="font-size:12px;color:#374151;margin-top:4px"><strong>Variant B:</strong> ${article.titleB}</div>
  </div>

  <h3 style="font-size:14px;color:#1e293b;margin:0 0 6px">Article Sections</h3>
  <div style="font-size:12px;color:#64748b;margin-bottom:14px">
    <p style="margin:2px 0"><strong>Intro:</strong> ${article.intro.substring(0, 120)}...</p>
    ${article.mainSections.map(s => `<p style="margin:2px 0"><strong>${s.heading}</strong></p>`).join('')}
    <p style="margin:2px 0"><strong>FAQs:</strong> ${article.faqs.length} questions</p>
    <p style="margin:2px 0"><strong>CTA:</strong> ${article.cta.substring(0, 100)}...</p>
  </div>

  <div style="display:flex;gap:10px;margin-bottom:14px">
    <div style="flex:1;background:#eff6ff;padding:12px;border-radius:6px;text-align:center">
      <div style="font-size:22px;font-weight:bold;color:#2563eb">${blog.posts.length}</div>
      <div style="font-size:11px;color:#6b7280">Total Posts</div>
    </div>
    <div style="flex:1;background:#faf5ff;padding:12px;border-radius:6px;text-align:center">
      <div style="font-size:22px;font-weight:bold;color:#7c3aed">${availableTopics.length - 1}</div>
      <div style="font-size:11px;color:#6b7280">Topics Remaining</div>
    </div>
  </div>

  <div style="font-size:11px;color:#94a3b8;border-top:1px solid #e5e7eb;padding-top:10px;margin-top:14px">
    <p style="margin:0">Content Agent | Next run: Mon/Wed/Fri 9:00 UTC | Mitigation: Week ${weekNum}</p>
    <p style="margin:4px 0 0">Posts are tracked in data/blog.json for rendering by the website.</p>
  </div>
</div></div>`;

  try {
    await sendEmail(`Content Agent: "${article.titleA}" (${article.wordCount} words)`, html);
    log('Email sent successfully.');
  } catch (e) {
    log(`Email error: ${e.message}`);
  }

  log('=== Content Agent Finished ===');
}

main().catch(e => { log(`Fatal: ${e.message}`); process.exit(1); });
