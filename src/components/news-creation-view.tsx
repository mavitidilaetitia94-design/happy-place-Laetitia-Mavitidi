import React, { useState, useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import sharkLogo from "@/assets/bigger-boat-shark.png";
import { NewsMediaEditor, NewsImage } from "./news-media";
import { type MediaDraft, emptyMedia, mediaFromNews, toNewsLinks, linkErrors } from "@/lib/news-media";
import { RichMarkdown } from "./rich-markdown";
import type { News } from "@/lib/dashboard";

interface NewsCreationViewProps {
  initialNews?: News | null;
  authorName: string;
  authorEmail: string;
  authorTitle: string;
  onCancel: () => void;
  onSaveDraft: (data: {
    id?: string;
    title: string;
    body: string;
    category: string;
    media: MediaDraft;
    links: ReturnType<typeof toNewsLinks>;
    attribution: "personal" | "collective";
    scheduleType: "now" | "scheduled";
    scheduledDate?: string;
    scheduledTime?: string;
  }) => Promise<void> | void;
  onPublish: (data: {
    id?: string;
    title: string;
    body: string;
    category: string;
    media: MediaDraft;
    links: ReturnType<typeof toNewsLinks>;
    attribution: "personal" | "collective";
    scheduleType: "now" | "scheduled";
    scheduledDate?: string;
    scheduledTime?: string;
  }) => Promise<void> | void;
  isSaving?: boolean;
}

export function NewsCreationView({
  initialNews,
  authorName,
  authorEmail,
  authorTitle,
  onCancel,
  onSaveDraft,
  onPublish,
  isSaving = false,
}: NewsCreationViewProps) {
  // Form States
  const [title, setTitle] = useState(
    initialNews ? initialNews.title : "",
  );
  const [category, setCategory] = useState(initialNews?.category ?? "Recrutement");
  const [body, setBody] = useState(
    initialNews ? (initialNews.body ?? "") : "",
  );
  const [media, setMedia] = useState<MediaDraft>(() =>
    initialNews ? mediaFromNews(initialNews) : emptyMedia(),
  );
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [activeTemplate, setActiveTemplate] = useState<"standard" | "express" | "synthese">("standard");
  const [attribution, setAttribution] = useState<"personal" | "collective">("personal");
  const [scheduleType, setScheduleType] = useState<"now" | "scheduled">(() => {
    return initialNews?.scheduled_for || initialNews?.status === "planifiée" ? "scheduled" : "now";
  });
  const [scheduledDate, setScheduledDate] = useState(() => {
    if (initialNews?.scheduled_for) {
      try {
        return new Date(initialNews.scheduled_for).toISOString().split("T")[0];
      } catch {
        return "2025-05-15";
      }
    }
    return "2025-05-15";
  });
  const [scheduledTime, setScheduledTime] = useState(() => {
    if (initialNews?.scheduled_for) {
      try {
        const d = new Date(initialNews.scheduled_for);
        return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
      } catch {
        return "09:00";
      }
    }
    return "09:00";
  });
  const [lastSavedTime, setLastSavedTime] = useState("09:42");
  const [editorTab, setEditorTab] = useState<"edit" | "preview">("edit");

  // AI Suggestion State
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSuggestionTitle, setAiSuggestionTitle] = useState(
    "Structuration suggérée à partir de vos 3 points bruts :",
  );
  const [aiSuggestionText, setAiSuggestionText] = useState(
    "Organiser en 3 sections claires : 1. Contexte logistique régional, 2. Postes & Profils recherchés, 3. Calendrier de recrutement.",
  );
  const [pendingAppliedBody, setPendingAppliedBody] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Character and Word Counts
  const charCount = body.length;
  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;

  // Auto-save clock update simulation
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      setLastSavedTime(`${hh}:${mm}`);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Format scheduled date label (ex: "15 mai à 09:00")
  const formattedScheduledBadge = (() => {
    try {
      const [year, month, day] = scheduledDate.split("-");
      const months = [
        "janvier", "février", "mars", "avril", "mai", "juin",
        "juillet", "août", "septembre", "octobre", "novembre", "décembre",
      ];
      const monthName = months[parseInt(month, 10) - 1] || month;
      return `Envoi prévu le ${parseInt(day, 10)} ${monthName} à ${scheduledTime}`;
    } catch {
      return `Envoi prévu le ${scheduledDate} à ${scheduledTime}`;
    }
  })();

  // Insert markdown syntax helper
  function insertMarkdown(prefix: string, suffix: string = "") {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = body.slice(start, end);
    const replacement = `${prefix}${selected || "texte"}${suffix}`;
    const newBody = body.slice(0, start) + replacement + body.slice(end);
    setBody(newBody);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + (selected ? selected.length : 5));
    }, 10);
  }

  // Trigger server AI call
  async function triggerAiAction(action: "suggest_structure" | "expand_points" | "review_tone" | "auto_layout") {
    setIsAiLoading(true);
    try {
      const res = await fetch("/api/news/ai-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          title,
          body,
          category,
          template: activeTemplate,
        }),
      });

      if (!res.ok) throw new Error("Erreur de communication avec l'assistant");
      const data = await res.json();

      setAiSuggestionTitle(data.suggestionTitle || "Suggestion générée :");
      setAiSuggestionText(data.suggestionText || "Voici la proposition pour votre texte.");
      setPendingAppliedBody(data.appliedBody || null);

      if (action === "auto_layout" && data.appliedBody) {
        setBody(data.appliedBody);
        toast.success("Mise en page Markdown appliquée !");
      } else {
        toast.info("Nouvelle suggestion prête à être appliquée.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Impossible de joindre le service d'aide IA.");
    } finally {
      setIsAiLoading(false);
    }
  }

  // Apply suggestion into editor
  function applySuggestion() {
    if (pendingAppliedBody) {
      setBody(pendingAppliedBody);
      toast.success("Suggestion appliquée au corps du message");
    } else {
      // Fallback default structure if user clicks before fetching
      const structured = `### 1. Contexte logistique régional
Nos équipes opérationnelles font face à une accélération marquée de l'activité sur l'ensemble de nos hubs logistiques.

### 2. Postes & Profils recherchés
Ouverture officielle de 3 postes clés : coordinateurs de flux, superviseurs d'entrepôt et référents planning.

### 3. Calendrier de recrutement
Les entretiens débuteront dès la semaine prochaine, avec une priorisation accordée aux profils terrain disponibles immédiatement.

*Des questions ? Contactez la Direction des Opérations.*`;
      setBody(structured);
      toast.success("Structure appliquée au corps du message");
    }
  }

  // Cover image upload
  function handleCoverFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("L'image dépasse la taille maximale de 5 Mo.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      setMedia((prev) => ({
        ...prev,
        file,
        removeExisting: false,
      }));
      setCoverPreviewUrl(dataUrl);
      toast.success("Image de couverture sélectionnée");
    };
    reader.readAsDataURL(file);
  }

  async function handleSave(isDraft: boolean) {
    if (!title.trim()) {
      toast.error("Veuillez renseigner un titre pour la publication.");
      return;
    }

    const payload = {
      id: initialNews?.id,
      title: title.trim(),
      body,
      category,
      media,
      links: toNewsLinks(media.links),
      attribution,
      scheduleType,
      scheduledDate,
      scheduledTime,
    };

    if (isDraft) {
      setSaving(true);
      try {
        await onSaveDraft(payload);
      } finally {
        setSaving(false);
      }
    } else {
      await onPublish(payload);
    }
  }

  return (
    <div className="min-h-screen bg-[#FBFBFA] text-[#1E1E1E] font-['Inter_Tight',sans-serif] flex flex-col antialiased">
      {/* =========================================================================
          1. HEADER NAVIGATION (Fidèle à l'image 01-creationactualite)
         ========================================================================= */}
      <header className="sticky top-0 z-40 bg-[#FFFFFF] border-b border-[#EAEAE8]">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Brand identifier */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 group">
              <img
                src={sharkLogo}
                alt="Bigger Boat Logo"
                className="w-7 h-7 object-contain group-hover:scale-105 transition-transform"
              />
              <span className="font-['Bodoni_Moda',Georgia,serif] text-xl font-bold tracking-tight text-[#111111]">
                Happy Place
              </span>
            </Link>
            <span className="bg-[#F4F4F5] border border-[#E4E4E7] text-[#52525B] text-[10px] font-semibold px-2 py-0.5 rounded tracking-wider uppercase font-mono">
              INTRA.MGR
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-[#52525B]">
            <button
              type="button"
              onClick={onCancel}
              className="hover:text-[#111111] transition-colors cursor-pointer"
            >
              Actualités
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="hover:text-[#111111] transition-colors cursor-pointer"
            >
              Équipe
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="hover:text-[#111111] transition-colors cursor-pointer"
            >
              Espaces
            </button>
          </nav>

          {/* User Profile */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block leading-tight">
              <p className="text-xs font-semibold text-[#111111]">{authorName || "K. Delacroix"}</p>
              <p className="text-[10px] text-[#71717A] tracking-wide uppercase font-mono">
                {authorTitle || "Dir. Opérations"}
              </p>
            </div>
            <div className="w-8 h-8 rounded-full bg-[#111111] text-white flex items-center justify-center font-bold text-xs shadow-xs">
              <span className="material-symbols-outlined text-[18px]">person</span>
            </div>
          </div>
        </div>
      </header>

      {/* =========================================================================
          2. CONTEXT BREADCRUMB BAR
         ========================================================================= */}
      <div className="max-w-[1180px] w-full mx-auto px-4 md:px-8 pt-6 pb-4 flex items-center justify-between text-xs tracking-wider">
        <div className="flex items-center gap-2 font-mono text-[11px] text-[#71717A] uppercase">
          <button
            type="button"
            onClick={onCancel}
            className="hover:text-[#111111] transition-colors cursor-pointer flex items-center gap-1"
          >
            ESPACE MANAGER
          </button>
          <span>/</span>
          <span className="text-[#71717A]">COMMUNICATION</span>
          <span>/</span>
          <span className="text-[#111111] font-bold">RÉDACTION</span>
        </div>
        <div className="font-mono text-[11px] text-[#71717A] tracking-wider uppercase">
          REF · ACTU-2025-048
        </div>
      </div>

      {/* =========================================================================
          3. MAIN DOCUMENT CARD
         ========================================================================= */}
      <main className="max-w-[1180px] w-full mx-auto px-4 md:px-8 pb-16">
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-6 md:p-10 shadow-[0_2px_8px_rgba(0,0,0,0.02)] space-y-8">
          {/* Card Top: Tag & Auto-save status */}
          <div className="flex items-center justify-between">
            <span className="bg-[#FCECE8] text-[#9F2E22] text-[11px] font-mono font-bold px-2.5 py-0.5 rounded uppercase tracking-wider">
              BROUILLON
            </span>
            <span className="text-[11px] text-[#71717A] flex items-center gap-1.5 font-mono">
              <span className="material-symbols-outlined text-[14px]">schedule</span>
              Sauvegardé auto. à {lastSavedTime}
            </span>
          </div>

          {/* Heading */}
          <div className="space-y-1">
            <h1 className="font-['Bodoni_Moda',Georgia,serif] text-3xl md:text-4xl font-bold text-[#111111] tracking-tight">
              Nouvelle actualité
            </h1>
            <p className="text-xs md:text-sm text-[#71717A]">
              Rédigez une annonce institutionnelle ou opérationnelle à destination des collaborateurs.
            </p>
          </div>

          {/* =========================================================================
              01. TITRE DE LA PUBLICATION
             ========================================================================= */}
          <div className="space-y-2 pt-2 border-t border-[#F4F4F5]">
            <div className="flex items-center justify-between text-xs font-mono">
              <label htmlFor="news-title-input" className="font-bold text-[#111111] uppercase tracking-wider">
                01. TITRE DE LA PUBLICATION
              </label>
              <span className="text-[#71717A]">Max. 90 caractères ({title.length}/90)</span>
            </div>
            <input
              id="news-title-input"
              type="text"
              maxLength={90}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Lancement du projet Q3 et renfort logistique"
              className="w-full bg-[#FFFFFF] border border-[#E5E7EB] rounded px-4 py-3 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:ring-1 focus:ring-[#111111] transition-all"
            />
          </div>

          {/* =========================================================================
              02. CATÉGORIES
             ========================================================================= */}
          <div className="space-y-2 pt-2 border-t border-[#F4F4F5]">
            <div className="flex items-center justify-between text-xs font-mono">
              <label htmlFor="news-category-select" className="font-bold text-[#111111] uppercase tracking-wider">
                02. CATÉGORIES
              </label>
              <span className="text-[#71717A]">Classification interne</span>
            </div>
            <div className="relative">
              <select
                id="news-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[#FFFFFF] border border-[#E5E7EB] rounded px-4 py-3 text-sm text-[#111111] appearance-none focus:outline-none focus:border-[#111111] cursor-pointer"
              >
                <option value="Recrutement">Recrutement</option>
                <option value="Espaces de travail">Espaces de travail & Logistique</option>
                <option value="Projets stratégiques">Projets stratégiques</option>
                <option value="Vie d'équipe">Vie d'équipe & Culture</option>
                <option value="RH & Avantages">RH & Avantages</option>
                <option value="Événements internes">Événements internes</option>
              </select>
              <span className="material-symbols-outlined absolute right-3 top-3.5 text-[#71717A] pointer-events-none text-[20px]">
                expand_more
              </span>
            </div>
          </div>

          {/* =========================================================================
              03. IMAGE DE COUVERTURE
             ========================================================================= */}
          <div className="space-y-2 pt-2 border-t border-[#F4F4F5]">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-bold text-[#111111] uppercase tracking-wider">
                03. IMAGE DE COUVERTURE
              </span>
              <span className="text-[#71717A]">JPG, PNG, WebP · Max 5 Mo · 16:9</span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleCoverFileChange}
              className="hidden"
            />

            {coverPreviewUrl || media.existingPath ? (
              <div className="relative rounded-lg overflow-hidden border border-[#E5E7EB] bg-[#FAFAFA]">
                {coverPreviewUrl ? (
                  <img
                    src={coverPreviewUrl}
                    alt="Aperçu couverture"
                    className="w-full h-48 md:h-64 object-cover"
                  />
                ) : (
                  <NewsImage
                    path={media.existingPath!}
                    alt="Aperçu couverture"
                    className="w-full h-48 md:h-64 object-cover !border-0 !max-h-none"
                  />
                )}
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center gap-3 opacity-0 hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-white text-[#111111] text-xs font-semibold px-3 py-1.5 rounded hover:bg-neutral-100 cursor-pointer"
                  >
                    Changer l'image
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMedia((prev) => ({
                        ...prev,
                        file: null,
                        existingPath: null,
                        removeExisting: true,
                      }));
                      setCoverPreviewUrl(null);
                    }}
                    className="bg-[#DC2626] text-white text-xs font-semibold px-3 py-1.5 rounded hover:bg-red-700 cursor-pointer"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border border-dashed border-[#D1D5DB] bg-[#FAFAF9] hover:bg-[#F5F5F4] transition-colors rounded-lg p-8 flex flex-col items-center justify-center gap-2 cursor-pointer text-center"
              >
                <div className="w-10 h-10 rounded-full bg-[#E5E7EB] flex items-center justify-center text-[#52525B]">
                  <span className="material-symbols-outlined text-[20px]">image</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#111111]">
                    Parcourir les fichiers ou glisser-déposer ici
                  </p>
                  <p className="text-[11px] text-[#71717A] mt-0.5">
                    Optionnel · Format recommandé 1200×675 px
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* =========================================================================
              04. CORPS DU MESSAGE & SUGGESTIONS IA
             ========================================================================= */}
          <div className="space-y-3 pt-2 border-t border-[#F4F4F5]">
            <div className="flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#111111] uppercase tracking-wider">
                  04. CORPS DU MESSAGE
                </span>
                <span className="bg-[#F4F4F5] text-[#71717A] text-[10px] font-semibold px-2 py-0.2 rounded">
                  Brouillon en cours
                </span>
              </div>
              <span className="text-[#71717A]">Format Markdown supporté</span>
            </div>

            {/* Markdown Toolbar */}
            <div className="border border-[#E5E7EB] rounded-t-lg bg-[#FAFAFA] px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title="Gras"
                  onClick={() => insertMarkdown("**", "**")}
                  className="w-7 h-7 flex items-center justify-center font-bold text-[#111111] hover:bg-[#E5E7EB] rounded cursor-pointer"
                >
                  B
                </button>
                <button
                  type="button"
                  title="Italique"
                  onClick={() => insertMarkdown("*", "*")}
                  className="w-7 h-7 flex items-center justify-center italic font-serif text-[#111111] hover:bg-[#E5E7EB] rounded cursor-pointer"
                >
                  I
                </button>
                <button
                  type="button"
                  title="Liste à puces"
                  onClick={() => insertMarkdown("\n- ")}
                  className="w-7 h-7 flex items-center justify-center text-[#111111] hover:bg-[#E5E7EB] rounded cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">format_list_bulleted</span>
                </button>
                <button
                  type="button"
                  title="Lien"
                  onClick={() => insertMarkdown("[Lien](", ")")}
                  className="w-7 h-7 flex items-center justify-center text-[#111111] hover:bg-[#E5E7EB] rounded cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">link</span>
                </button>
                <button
                  type="button"
                  title="Citation"
                  onClick={() => insertMarkdown("\n> ")}
                  className="w-7 h-7 flex items-center justify-center text-[#111111] hover:bg-[#E5E7EB] rounded cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">format_quote</span>
                </button>

                <div className="h-4 w-px bg-[#D1D5DB] mx-1" />

                {/* Gabarits */}
                <div className="flex items-center gap-1.5 text-[11px] text-[#71717A]">
                  <span className="font-mono">Gabarit :</span>
                  <button
                    type="button"
                    onClick={() => setActiveTemplate("standard")}
                    className={`px-2 py-0.5 rounded cursor-pointer font-medium transition-colors ${
                      activeTemplate === "standard"
                        ? "bg-[#FCECE8] text-[#9F2E22] font-semibold"
                        : "hover:bg-[#E5E7EB] text-[#52525B]"
                    }`}
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTemplate("express")}
                    className={`px-2 py-0.5 rounded cursor-pointer font-medium transition-colors ${
                      activeTemplate === "express"
                        ? "bg-[#FCECE8] text-[#9F2E22] font-semibold"
                        : "hover:bg-[#E5E7EB] text-[#52525B]"
                    }`}
                  >
                    Express
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTemplate("synthese")}
                    className={`px-2 py-0.5 rounded cursor-pointer font-medium transition-colors ${
                      activeTemplate === "synthese"
                        ? "bg-[#FCECE8] text-[#9F2E22] font-semibold"
                        : "hover:bg-[#E5E7EB] text-[#52525B]"
                    }`}
                  >
                    Synthèse
                  </button>
                </div>
              </div>

              {/* Mise en page auto IA button */}
              <button
                type="button"
                onClick={() => triggerAiAction("auto_layout")}
                disabled={isAiLoading}
                className="flex items-center gap-1 text-[11px] font-semibold bg-white border border-[#D1D5DB] px-2.5 py-1 rounded hover:bg-[#F4F4F5] transition-colors cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[14px] text-[#E06D53]">auto_fix_high</span>
                Mise en page auto IA
              </button>
            </div>

            {/* Textarea */}
            <div className="-mt-3">
              <textarea
                ref={textareaRef}
                rows={7}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Points à aborder : ouverture de 3 postes clés logistique en région, calendrier des entretiens semaine pro, priorisation des profils coordinateurs de flux..."
                className="w-full bg-[#FFFFFF] border-x border-b border-[#E5E7EB] rounded-b-lg p-4 text-sm text-[#111111] focus:outline-none focus:border-[#111111] transition-all leading-relaxed"
              />
            </div>

            {/* Editor Footer: editorial standards + counts */}
            <div className="flex items-center justify-between text-[11px] text-[#71717A] px-1 font-mono">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px] text-[#71717A]">verified</span>
                Standards éditoriaux Happy Place disponibles
              </span>
              <span>
                {wordCount} mots · {charCount} car.
              </span>
            </div>

            {/* =========================================================================
                SUGGESTIONS IA À PARTIR DE VOS ÉCRITS
               ========================================================================= */}
            <div className="mt-4 border border-[#F0D8CF] bg-[#FAF5F4] rounded-lg p-4 space-y-3">
              {/* AI Block Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[#E06D53] font-bold text-sm">✦</span>
                  <span className="text-xs font-mono font-bold text-[#111111] uppercase tracking-wider">
                    SUGGESTIONS IA À PARTIR DE VOS ÉCRITS
                  </span>
                  <span className="bg-[#FFFFFF] border border-[#F0D8CF] text-[#9F2E22] text-[10px] font-semibold px-2 py-0.2 rounded-full">
                    Actif dès votre premier jet
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => triggerAiAction("expand_points")}
                    disabled={isAiLoading}
                    className="flex items-center gap-1 text-[11px] font-semibold bg-white border border-[#E5E7EB] px-2.5 py-1 rounded hover:bg-[#F4F4F5] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[13px] text-[#E06D53]">lightbulb</span>
                    Développer les points
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerAiAction("review_tone")}
                    disabled={isAiLoading}
                    className="flex items-center gap-1 text-[11px] font-semibold bg-white border border-[#E5E7EB] px-2.5 py-1 rounded hover:bg-[#F4F4F5] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[13px] text-[#52525B]">article</span>
                    Vérifier le ton & style
                  </button>
                </div>
              </div>

              {/* Suggestion Content Card */}
              <div className="bg-[#FFFFFF] border border-[#F3E2DB] rounded-md p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-[#E06D53] text-[20px] shrink-0 mt-0.5">
                    lightbulb
                  </span>
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-[#111111]">{aiSuggestionTitle}</p>
                    <p className="text-xs text-[#52525B] italic leading-relaxed">
                      {aiSuggestionText}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={applySuggestion}
                  disabled={isAiLoading}
                  className="bg-[#FCECE8] border border-[#F8C8BE] text-[#9F2E22] hover:bg-[#F9DDD5] text-xs font-semibold px-3.5 py-1.5 rounded transition-colors whitespace-nowrap cursor-pointer shrink-0"
                >
                  Appliquer la suggestion
                </button>
              </div>
            </div>
          </div>

          {/* =========================================================================
              05. PÉRIMÈTRE DE DIFFUSION
             ========================================================================= */}
          <div className="space-y-2 pt-2 border-t border-[#F4F4F5]">
            <label className="text-xs font-mono font-bold text-[#111111] uppercase tracking-wider block">
              05. PÉRIMÈTRE DE DIFFUSION
            </label>
            <div className="bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#E5E7EB] flex items-center justify-center text-[#111111]">
                  <span className="material-symbols-outlined text-[18px]">public</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-[#111111]">Toute l'entreprise</p>
                  <p className="text-[11px] text-[#71717A]">
                    Siège · Filiales régionales · Collaborateurs distants
                  </p>
                </div>
              </div>
              <span className="bg-white border border-[#D1D5DB] text-[#52525B] text-[10px] font-mono font-semibold px-2.5 py-1 rounded flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">lock</span>
                Fixé par défaut
              </span>
            </div>
          </div>

          {/* =========================================================================
              06. ATTRIBUTION & SIGNATURE
             ========================================================================= */}
          <div className="space-y-2 pt-2 border-t border-[#F4F4F5]">
            <label className="text-xs font-mono font-bold text-[#111111] uppercase tracking-wider block">
              06. ATTRIBUTION & SIGNATURE
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Option 1: Mon nom */}
              <div
                onClick={() => setAttribution("personal")}
                className={`p-4 border rounded-lg cursor-pointer transition-all flex items-start gap-3 ${
                  attribution === "personal"
                    ? "bg-[#FFFFFF] border-[#111111] ring-1 ring-[#111111]"
                    : "bg-[#FAFAFA] border-[#E5E7EB] hover:border-[#D1D5DB]"
                }`}
              >
                <div className="pt-0.5">
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      attribution === "personal" ? "border-[#111111]" : "border-[#9CA3AF]"
                    }`}
                  >
                    {attribution === "personal" && <div className="w-2 h-2 rounded-full bg-[#111111]" />}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-[#111111]">Mon nom</p>
                  <p className="text-[11px] text-[#71717A] mt-0.5">
                    {authorName || "Kesha Delacroix"} · {authorTitle || "Directrice des Opérations"}
                  </p>
                </div>
              </div>

              {/* Option 2: Collectif Équipe */}
              <div
                onClick={() => setAttribution("collective")}
                className={`p-4 border rounded-lg cursor-pointer transition-all flex items-start gap-3 ${
                  attribution === "collective"
                    ? "bg-[#FFFFFF] border-[#111111] ring-1 ring-[#111111]"
                    : "bg-[#FAFAFA] border-[#E5E7EB] hover:border-[#D1D5DB]"
                }`}
              >
                <div className="pt-0.5">
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      attribution === "collective" ? "border-[#111111]" : "border-[#9CA3AF]"
                    }`}
                  >
                    {attribution === "collective" && <div className="w-2 h-2 rounded-full bg-[#111111]" />}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-[#111111]">Collectif Équipe</p>
                  <p className="text-[11px] text-[#71717A] mt-0.5">
                    Pôle Opérations & Projets · Mention anonymisée d'équipe
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* =========================================================================
              BOTTOM ACTION BAR
             ========================================================================= */}
          <div className="pt-4 border-t border-[#F4F4F5] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 text-xs text-[#71717A] font-mono">
              <span className="material-symbols-outlined text-[16px]">info</span>
              <span>Sera notifié instantanément sur Slack & Email</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={isSaving || saving}
                className="bg-white border border-[#111111] text-[#111111] text-xs font-semibold px-5 py-2.5 rounded hover:bg-[#F4F4F5] transition-colors cursor-pointer disabled:opacity-50"
              >
                Enregistrer le brouillon
              </button>

              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={isSaving || saving}
                className="bg-[#111111] text-white text-xs font-semibold px-6 py-2.5 rounded hover:bg-neutral-800 transition-colors flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[15px]">campaign</span>
                Publier
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* =========================================================================
          GLOBAL FOOTER (Fidèle à l'image 01-creationactualite)
         ========================================================================= */}
      <footer className="border-t border-[#EAEAE8] bg-[#FFFFFF] py-4 mt-auto">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] font-mono text-[#71717A] uppercase tracking-wider">
          <span>HAPPY PLACE INTRANET • PORTAIL MANAGÉRIAL</span>
          <span>SYS.VER 2.4.0 — DERNIÈRE SYNC 08:30</span>
        </div>
      </footer>
    </div>
  );
}
