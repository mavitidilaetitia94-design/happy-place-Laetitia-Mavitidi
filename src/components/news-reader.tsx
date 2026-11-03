import * as DialogPrimitive from "@radix-ui/react-dialog";
import { formatExactDate } from "@/components/expandable-card";
import { NewsImage, NewsLinks } from "@/components/news-media";
import { RichMarkdown } from "@/components/rich-markdown";
import type { News } from "@/lib/dashboard";

/** Fenêtre de lecture d'une actualité (lecture seule, Échap, clic fond). */
export function NewsReader({ news: n, onClose }: { news: News | null; onClose: () => void }) {
  return (
    <DialogPrimitive.Root open={!!n} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] animate-in fade-in" />
        {n && (
          <DialogPrimitive.Content
            className="fixed z-50 inset-0 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 w-full md:w-[min(52rem,calc(100vw-2rem))] h-dvh md:h-auto md:max-h-[90vh] flex flex-col bg-[#FFFFFF] border border-[#E5E7EB] shadow-2xl focus:outline-none rounded-none md:rounded-lg animate-in fade-in zoom-in-95"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-[#F4F4F5] p-5 md:p-6 bg-[#FFFFFF]">
              <div className="min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 text-[11px] text-[#71717A] font-medium tracking-wide">
                  {n.category && (
                    <span className="bg-[#FDECEC] text-[#7A2E22] text-[10px] font-bold px-2 py-0.5 rounded-xs uppercase font-mono">
                      {n.category}
                    </span>
                  )}
                  {n.status === "planifiée" ? (
                    <span className="bg-[#EFF6FF] text-[#1D4ED8] text-[10px] font-bold px-2 py-0.5 rounded-xs uppercase font-mono">
                      Publication planifiée
                    </span>
                  ) : n.status === "brouillon" ? (
                    <span className="bg-[#F4F4F5] text-[#52525B] text-[10px] font-bold px-2 py-0.5 rounded-xs uppercase font-mono">
                      Brouillon en cours
                    </span>
                  ) : (
                    <span className="text-[10px] text-[#111111] font-bold uppercase font-mono">
                      Publication officielle
                    </span>
                  )}
                  <span>·</span>
                  <span>{formatExactDate(n.created_at)}</span>
                  <span>·</span>
                  <span className="text-[#111111] font-semibold">{n.author}</span>
                </div>

                <DialogPrimitive.Title className="font-['Bodoni_Moda',Georgia,serif] text-xl md:text-2xl font-bold text-[#111111] leading-snug wrap-anywhere">
                  {n.title}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="sr-only">
                  Détail de la publication {n.title}
                </DialogPrimitive.Description>
              </div>

              <DialogPrimitive.Close
                aria-label="Fermer"
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#F4F4F5] text-[#71717A] hover:text-[#111111] focus:outline-none focus-visible:ring-2 focus-visible:ring-black cursor-pointer shrink-0"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[20px]">close</span>
              </DialogPrimitive.Close>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 md:p-8 space-y-6 bg-[#FFFFFF]">
              {n.image_path && (
                <div className="w-full max-h-80 overflow-hidden border border-[#E5E7EB] rounded bg-[#FAFAFA]">
                  <NewsImage path={n.image_path} alt={n.title} className="w-full h-full object-cover" />
                </div>
              )}

              {n.body && (
                <div className="text-sm md:text-base text-[#3F3F46] leading-relaxed">
                  <RichMarkdown content={n.body} />
                </div>
              )}

              {Boolean(n.links) && (
                <div className="pt-4 border-t border-[#F4F4F5]">
                  <NewsLinks links={n.links as any} />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#F4F4F5] bg-[#FAFAFA] flex items-center justify-between text-xs text-[#71717A]">
              <span className="font-mono text-[10px] uppercase">Happy Place • Communication interne</span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 bg-[#111111] text-white text-xs font-semibold rounded hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </DialogPrimitive.Content>
        )}
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
