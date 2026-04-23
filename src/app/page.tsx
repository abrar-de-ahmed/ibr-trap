'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Upload,
  Download,
  X,
  ImageIcon,
  Loader2,
  Lock,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

// ── Config ──────────────────────────────────────────────
const FREE_LIMIT = 2;
const PAID_LIMIT = 500;
const BATCH_MAX = 30;
const STORAGE_KEY_COUNT = 'bg_remover_used_count';
const STORAGE_KEY_PAID = 'bg_remover_is_paid';
const STORAGE_KEY_CLIENT_REF = 'bg_remover_client_ref';
const STORAGE_KEY_SESSION_ID = 'bg_remover_session_id';
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_DIMENSION = 4096;

// ── Helpers ─────────────────────────────────────────────
function lsGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsSet(key: string, val: string): void {
  try { localStorage.setItem(key, val); } catch { /* noop */ }
}
function getUsedCount(): number {
  const v = lsGet(STORAGE_KEY_COUNT);
  return v ? parseInt(v, 10) : 0;
}
function setUsedCount(n: number): void { lsSet(STORAGE_KEY_COUNT, n.toString()); }
function isPaidUser(): boolean { return lsGet(STORAGE_KEY_PAID) === 'true'; }

// Get or create a persistent client reference ID (UUID)
function getClientRefId(): string {
  let ref = lsGet(STORAGE_KEY_CLIENT_REF);
  if (!ref) {
    ref = crypto.randomUUID();
    lsSet(STORAGE_KEY_CLIENT_REF, ref);
  }
  return ref;
}

// Create Stripe checkout session via CF Pages Function, then open popup
async function openCheckout(): Promise<void> {
  const clientRefId = getClientRefId();
  try {
    const resp = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientRefId }),
    });
    const data = await resp.json() as { url?: string; sessionId?: string; error?: string };
    if (!resp.ok || !data.url) {
      toast.error(data.error || 'Could not start checkout. Please try again.');
      return;
    }
    // Store session ID for post-payment verification
    if (data.sessionId) {
      lsSet(STORAGE_KEY_SESSION_ID, data.sessionId);
    }
    const w = 520;
    const h = 720;
    const left = (screen.width - w) / 2;
    const top = (screen.height - h) / 2;
    window.open(
      data.url,
      'stripe-checkout',
      `width=${w},height=${h},top=${top},left=${left},scrollbars=yes,resizable=yes`
    );
  } catch {
    toast.error('Network error. Please check your connection and try again.');
  }
}

// Verify payment status via Stripe API (server-validated, no KV needed)
async function verifyPaymentStatus(): Promise<boolean> {
  // Try session_id from URL params first (user just returned from Stripe), then from localStorage
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session_id') || lsGet(STORAGE_KEY_SESSION_ID);
  if (!sessionId) return false;
  try {
    const resp = await fetch('/api/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    const data = await resp.json() as { paid?: boolean; images?: number };
    if (data.paid) {
      lsSet(STORAGE_KEY_PAID, 'true');
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ── Types ───────────────────────────────────────────────
type ImageStatus = 'pending' | 'processing' | 'done' | 'error';

interface ImageItem {
  id: string;
  file: File;
  originalUrl: string;
  resultUrl: string | null;
  status: ImageStatus;
  progress: number;
  error: string | null;
}

// ── Component ───────────────────────────────────────────
export default function Home() {
  const [paid, setPaid] = useState(false);
  const [usedCount, setUsedCountState] = useState(0);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showUpgradeInfo, setShowUpgradeInfo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const verifyingRef = useRef(false);

  // On mount: check localStorage first, then verify with server
  useEffect(() => {
    const init = async () => {
      const lsPaid = isPaidUser();
      setUsedCountState(getUsedCount());
      if (lsPaid) {
        setPaid(true);
      } else {
        // Server-verified check (catches payments made in other tabs/devices)
        const serverPaid = await verifyPaymentStatus();
        if (serverPaid) {
          setPaid(true);
          toast.success('Payment verified! 500 images unlocked.');
        } else {
          setPaid(false);
        }
      }
      // Check if user just returned from Stripe success
      const params = new URLSearchParams(window.location.search);
      if (params.get('payment') === 'success') {
        window.history.replaceState({}, '', window.location.pathname);
        if (!verifyingRef.current) {
          verifyingRef.current = true;
          toast.success('Processing payment...');
          // Poll a few times since webhook might take a second
          for (let i = 0; i < 5; i++) {
            await new Promise((r) => setTimeout(r, 2000));
            const verified = await verifyPaymentStatus();
            if (verified) {
              setPaid(true);
              toast.success('Payment confirmed! 500 images unlocked.');
              break;
            }
          }
          verifyingRef.current = false;
        }
      }
    };
    init();
  }, []);

  const limit = paid ? PAID_LIMIT : FREE_LIMIT;
  const remaining = Math.max(0, limit - usedCount);
  const hasAnyProcessing = images.some((i) => i.status === 'processing');
  const hasAnyPending = images.some((i) => i.status === 'pending');

  // Cleanup object URLs when images change or component unmounts
  useEffect(() => {
    const urls = images.flatMap((i) =>
      [i.originalUrl, i.resultUrl].filter(Boolean) as string[]
    );
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [images]);

  const validateAndNormalize = useCallback(
    async (file: File): Promise<Blob> => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        const ext = file.name.split('.').pop()?.toUpperCase() ?? 'unknown';
        throw new Error(`Unsupported format (${ext}). Use PNG, JPG, or WEBP.`);
      }
      if (file.size > 20 * 1024 * 1024) {
        throw new Error('File too large. Maximum size is 20MB.');
      }

      const objUrl = URL.createObjectURL(file);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => {
          URL.revokeObjectURL(objUrl);
          reject(new Error('Cannot decode this image. Try PNG or JPG.'));
        };
        img.src = objUrl;
      });

      if (img.width <= MAX_DIMENSION && img.height <= MAX_DIMENSION) {
        URL.revokeObjectURL(objUrl);
        return file;
      }

      const scale = Math.min(MAX_DIMENSION / img.width, MAX_DIMENSION / img.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      URL.revokeObjectURL(objUrl);
      if (!ctx) throw new Error('Canvas not available.');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      return new Promise<Blob>((res, rej) =>
        canvas.toBlob((b) => (b ? res(b) : rej(new Error('Resize failed.'))), 'image/png')
      );
    },
    []
  );

  const processImage = useCallback(
    async (itemId: string) => {
      setImages((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, status: 'processing' as ImageStatus, progress: 0 } : i))
      );

      const item = images.find((i) => i.id === itemId);
      if (!item) return;

      try {
        const blob = await validateAndNormalize(item.file);

        const { removeBackground } = await import('@imgly/background-removal');
        const resultBlob = await removeBackground(blob, {
          progress: (_key: string, current: number, total: number) => {
            if (total > 0) {
              setImages((prev) =>
                prev.map((i) =>
                  i.id === itemId ? { ...i, progress: Math.round((current / total) * 100) } : i
                )
              );
            }
          },
        });

        const resultUrl = URL.createObjectURL(resultBlob);
        setImages((prev) =>
          prev.map((i) => (i.id === itemId ? { ...i, status: 'done' as ImageStatus, resultUrl, progress: 100 } : i))
        );

        const latest = getUsedCount();
        const newCount = latest + 1;
        setUsedCount(newCount);
        setUsedCountState(newCount);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Processing failed.';
        setImages((prev) =>
          prev.map((i) => (i.id === itemId ? { ...i, status: 'error' as ImageStatus, error: msg } : i))
        );
      }
    },
    [images, validateAndNormalize]
  );

  useEffect(() => {
    if (hasAnyProcessing) return;
    const next = images.find((i) => i.status === 'pending');
    if (!next) return;

    const currentCount = getUsedCount();
    const effectiveLimit = paid ? PAID_LIMIT : FREE_LIMIT;
    if (currentCount >= effectiveLimit) {
      setImages((prev) =>
        prev.map((i) =>
          i.status === 'pending'
            ? { ...i, status: 'error' as ImageStatus, error: paid ? 'Limit reached.' : 'upgrade' }
            : i
        )
      );
      if (!paid) setShowPaywall(true);
      return;
    }

    processImage(next.id);
  }, [images, hasAnyProcessing, paid, processImage]);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArr = Array.from(files);

      if (!paid && fileArr.length > 1) {
        toast.error('Free users can upload 1 image at a time. Upgrade for batch upload.');
        return;
      }

      if (paid && fileArr.length > BATCH_MAX) {
        toast.error(`Maximum ${BATCH_MAX} images at a time.`);
        return;
      }

      const currentCount = getUsedCount();
      const effectiveLimit = paid ? PAID_LIMIT : FREE_LIMIT;
      if (currentCount >= effectiveLimit) {
        if (!paid) setShowPaywall(true);
        else toast.error('You have used all 500 images.');
        return;
      }

      const newItems: ImageItem[] = fileArr.map((file) => ({
        id: crypto.randomUUID(),
        file,
        originalUrl: URL.createObjectURL(file),
        resultUrl: null,
        status: 'pending' as ImageStatus,
        progress: 0,
        error: null,
      }));

      setImages(newItems);
    },
    [paid]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (hasAnyProcessing || hasAnyPending) return;
      if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
    },
    [handleFiles, hasAnyProcessing, hasAnyPending]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
      e.target.value = '';
    },
    [handleFiles]
  );

  const handleUploadClick = useCallback(() => {
    const currentCount = getUsedCount();
    const effectiveLimit = paid ? PAID_LIMIT : FREE_LIMIT;
    if (currentCount >= effectiveLimit) {
      if (!paid) setShowPaywall(true);
      else toast.error('You have used all 500 images.');
      return;
    }
    fileInputRef.current?.click();
  }, [paid]);

  const handleDropzoneKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleUploadClick();
      }
    },
    [handleUploadClick]
  );

  const handleDownloadOne = useCallback((item: ImageItem) => {
    if (!item.resultUrl) return;
    const a = document.createElement('a');
    a.href = item.resultUrl;
    const baseName = item.file.name.replace(/\.[^.]+$/, '');
    a.download = `${baseName}-no-bg.png`;
    a.click();
  }, []);

  const handleDownloadAll = useCallback(() => {
    images
      .filter((i) => i.status === 'done' && i.resultUrl)
      .forEach((item) => {
        const a = document.createElement('a');
        a.href = item.resultUrl!;
        const baseName = item.file.name.replace(/\.[^.]+$/, '');
        a.download = `${baseName}-no-bg.png`;
        a.click();
      });
  }, [images]);

  const handleReset = useCallback(() => {
    images.forEach((i) => {
      URL.revokeObjectURL(i.originalUrl);
      if (i.resultUrl) URL.revokeObjectURL(i.resultUrl);
    });
    setImages([]);
  }, [images]);

  const doneCount = images.filter((i) => i.status === 'done').length;

  const handleBuyClick = useCallback(async () => {
    setShowPaywall(false);
    setShowUpgradeInfo(false);
    await openCheckout();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      <main className="flex-1 flex flex-col items-center px-4 py-10 sm:py-12">
        {/* Hero */}
        <div className="text-center mb-8 max-w-xl">
          <div className="flex items-center justify-center gap-2 mb-3">
            <ImageIcon className="w-8 h-8 text-violet-600" />
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              Background Image Remover
            </h1>
          </div>
          <p className="text-slate-500 text-base sm:text-lg">
            Remove backgrounds instantly - AI-powered, pixel-perfect
          </p>

          <div className="mt-4 flex flex-col items-center gap-2">
            <div
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border ${
                paid
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-amber-50 border-amber-200 text-amber-700'
              }`}
            >
              {paid ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="font-bold">{remaining}</span> images remaining
                </>
              ) : (
                <>
                  <span className="font-bold">{remaining}</span> free image{remaining !== 1 ? 's' : ''} remaining
                </>
              )}
            </div>

            {!paid && (
              <button
                onClick={() => setShowUpgradeInfo(true)}
                className="text-sm text-violet-600 hover:text-violet-700 font-medium underline underline-offset-2 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 inline mr-1" />
                Unlock 500 images for $9 - upload up to 30 at once
              </button>
            )}
          </div>
        </div>

        {/* Upload Zone */}
        {images.length === 0 && (
          <div
            role="button"
            tabIndex={0}
            aria-label={`Upload ${paid ? 'up to 30 images' : 'an image'} to remove background`}
            onClick={handleUploadClick}
            onKeyDown={handleDropzoneKeyDown}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`w-full max-w-lg cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-200 outline-none ${
              isDragOver
                ? 'border-violet-500 bg-violet-50 scale-[1.02]'
                : 'border-slate-300 bg-white hover:border-violet-400 hover:bg-violet-50/50 focus-visible:border-violet-500 focus-visible:ring-2 focus-visible:ring-violet-200'
            } p-12 flex flex-col items-center justify-center gap-4 shadow-sm`}
          >
            <Upload className="w-10 h-10 text-slate-400" />
            <div className="text-center">
              <p className="text-slate-700 font-medium text-lg">
                {paid ? 'Drop your images here' : 'Drop your image here'}
              </p>
              <p className="text-slate-400 text-sm mt-1">
                {paid
                  ? `or click to browse - Up to ${BATCH_MAX} images - PNG, JPG, WEBP`
                  : 'or click to browse - 1 image at a time - PNG, JPG, WEBP'}
              </p>
            </div>
          </div>
        )}

        {/* CTA below upload zone */}
        {!paid && images.length === 0 && (
          <button
            onClick={openCheckout}
            disabled={false}
            className="mt-5 inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-md hover:shadow-lg text-sm sm:text-base"
          >
            <Sparkles className="w-4 h-4" />
            <span>Need more? 500 images for just $9</span>
          </button>
        )}

        {/* Image Grid */}
        {images.length > 0 && (
          <div className="w-full max-w-5xl">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <p className="text-sm text-slate-500">
                {doneCount} of {images.length} done
                {hasAnyProcessing && (
                  <span className="ml-1 text-violet-600 font-medium">- Processing...</span>
                )}
              </p>
              <div className="flex items-center gap-2">
                {doneCount > 1 && (
                  <button
                    onClick={handleDownloadAll}
                    className="flex items-center gap-1.5 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download All
                  </button>
                )}
                {!hasAnyProcessing && !hasAnyPending && (
                  <button
                    onClick={handleReset}
                    className="text-sm text-slate-500 hover:text-violet-600 underline underline-offset-2 transition-colors"
                  >
                    Upload more
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {images.map((item) => (
                <ImageCard
                  key={item.id}
                  item={item}
                  onDownload={() => handleDownloadOne(item)}
                  onRetry={() =>
                    setImages((prev) =>
                      prev.map((i) =>
                        i.id === item.id ? { ...i, status: 'pending' as ImageStatus, error: null, progress: 0 } : i
                      )
                    )
                  }
                  onUpgradeClick={() => {
                    if (item.error === 'upgrade') setShowPaywall(true);
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple={paid}
          onChange={handleInputChange}
          className="hidden"
        />
      </main>

      {/* Paywall Modal */}
      <Dialog open={showPaywall} onOpenChange={setShowPaywall}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center text-center pt-2">
            <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mb-4">
              <ImageIcon className="w-7 h-7 text-amber-600" />
            </div>
            <DialogTitle className="text-2xl font-bold text-slate-900 mb-2">
              Free Limit Reached
            </DialogTitle>
            <DialogDescription className="text-slate-500 mb-2">
              You&apos;ve used your 2 free images. Get{' '}
              <span className="font-bold text-slate-900">500 images for just $9</span>{' '}
              - they never expire.
            </DialogDescription>
            <div className="text-sm text-slate-400 mb-6">
              Upload up to 30 images at a time with batch processing
            </div>
            <button
              onClick={handleBuyClick}
              className="inline-flex items-center justify-center w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors text-lg"
            >
              Buy Now - $9
            </button>
            <button
              onClick={() => setShowPaywall(false)}
              className="mt-4 text-sm text-slate-400 hover:text-slate-600 transition-colors"
            >
              Maybe later
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upgrade Info Modal */}
      <Dialog open={showUpgradeInfo} onOpenChange={setShowUpgradeInfo}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center text-center pt-2">
            <div className="w-14 h-14 bg-violet-100 rounded-full flex items-center justify-center mb-4">
              <Sparkles className="w-7 h-7 text-violet-600" />
            </div>
            <DialogTitle className="text-2xl font-bold text-slate-900 mb-2">
              Upgrade to Pro
            </DialogTitle>
            <DialogDescription className="text-slate-500 mb-6">
              Get <span className="font-bold text-slate-900">500 images for just $9</span> - they never expire. Upload up to 30 images at a time and process them all in one go.
            </DialogDescription>
            <button
              onClick={handleBuyClick}
              className="inline-flex items-center justify-center w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors text-lg"
            >
              Buy Now - $9
            </button>
            <button
              onClick={() => setShowUpgradeInfo(false)}
              className="mt-4 text-sm text-slate-400 hover:text-slate-600 transition-colors"
            >
              Maybe later
            </button>
          </div>
        </DialogContent>
      </Dialog>

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

// ── Image Card ──────────────────────────────────────────
function ImageCard({
  item,
  onDownload,
  onRetry,
  onUpgradeClick,
}: {
  item: ImageItem;
  onDownload: () => void;
  onRetry: () => void;
  onUpgradeClick: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="relative checkerboard-bg aspect-square">
        <img
          src={item.status === 'done' && item.resultUrl ? item.resultUrl : item.originalUrl}
          alt={item.file.name}
          className="w-full h-full object-contain"
        />

        {item.status === 'processing' && (
          <div className="absolute inset-0 bg-white/70 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-8 h-8 text-violet-600 animate-spin" />
            <div className="w-32 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-600 rounded-full transition-all duration-300"
                style={{ width: `${item.progress}%` }}
              />
            </div>
            <span className="text-xs text-slate-500">{item.progress}%</span>
          </div>
        )}

        {item.status === 'pending' && (
          <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
            <span className="text-sm text-slate-500 font-medium">Waiting...</span>
          </div>
        )}

        {item.status === 'error' && (
          <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center gap-2">
            {item.error === 'upgrade' ? (
              <>
                <Lock className="w-8 h-8 text-amber-500" />
                <span className="text-sm text-slate-600 font-medium">Upgrade to process</span>
                <button
                  onClick={onUpgradeClick}
                  className="text-xs bg-violet-600 text-white px-3 py-1 rounded-lg hover:bg-violet-700 transition-colors"
                >
                  Unlock $9
                </button>
              </>
            ) : (
              <>
                <X className="w-8 h-8 text-red-400" />
                <span className="text-xs text-red-500 px-4 text-center">{item.error}</span>
                <button
                  onClick={onRetry}
                  className="text-xs bg-slate-200 text-slate-700 px-3 py-1 rounded-lg hover:bg-slate-300 transition-colors"
                >
                  Retry
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="p-3 flex items-center justify-between">
        <span className="text-xs text-slate-500 truncate max-w-[60%]" title={item.file.name}>
          {item.file.name}
        </span>
        {item.status === 'done' && (
          <button
            onClick={onDownload}
            className="flex items-center gap-1 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 px-2.5 py-1 rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </button>
        )}
      </div>
    </div>
  );
}
