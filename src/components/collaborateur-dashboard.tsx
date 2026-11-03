import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { signOut } from "@/lib/auth";
import {
  fetchMySubmissions,
  fetchNews,
  fetchResolvedBlockers,
  fetchMetrics,
  submitIdea,
  getLocalSubmissionReviews,
  timeAgo,
  type News,
  type Submission,
  type Blocker,
  type Metric,
  type SubmissionInput,
} from "@/lib/dashboard";
import { rejectionSchema, submissionSchema, validate, type FieldErrors, SUBMISSION_CATEGORIES } from "@/lib/manage-schemas";
import { ErrorSummary, Field, FormActions, Modal, TextArea, TextInput, Select } from "@/components/manage/crud-ui";
import { CharCounter, rejectionErrorMessage } from "@/components/expandable-card";
import { NewsReader } from "@/components/news-reader";
import { SubmissionReader } from "@/components/submission-reader";

function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-outlined select-none text-[18px] leading-none ${className}`}
    >
      {name}
    </span>
  );
}

// Fallback data matching the exact Stitch mockup
const MOCK_NEWS: News[] = [
  {
    id: "mock-news-1",
    title: "Bienvenue dans nos nouveaux espaces collaboratifs",
    body: "Découvrez les aménagements inaugurés au 3e étage : box insonorisés pour les entretiens candidats, cafétéria réinventée et ateliers modulaires conçus pour favoriser la synergie inter-équipes. Venez tester les nouveaux espaces dès ce lundi !",
    author: "Direction Générale",
    author_email: "direction@biggerboat.example",
    status: "publiée",
    category: "Direction Générale",
    created_at: "2024-05-20T08:30:00Z",
    image_path: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80",
    links: [],
  },
  {
    id: "mock-news-2",
    title: "Lancement du programme mentorat Q3",
    body: "Participez en tant que mentor ou binôme junior pour échanger sur vos pratiques de sourcing, déontologie du recrutement et entretiens d'évaluation. Inscrivez-vous avant le 30 mai.",
    author: "Ressources Humaines",
    author_email: "rh@biggerboat.example",
    status: "publiée",
    category: "Ressources Humaines",
    created_at: "2024-05-16T10:00:00Z",
    image_path: null,
    links: [],
  },
  {
    id: "mock-news-3",
    title: "Bilan énergétique du siège : -18% d'empreinte carbone",
    body: "Les mesures de sobriété, d'extinction nocturne et de gestion thermique responsable portent leurs fruits sur l'ensemble du premier semestre. Bravo à tous pour votre engagement écocitoyen !",
    author: "Comité RSE",
    author_email: "rse@biggerboat.example",
    status: "publiée",
    category: "Comité RSE",
    created_at: "2024-05-12T14:15:00Z",
    image_path: null,
    links: [],
  },
];

const MOCK_RESOLVED_BLOCKERS: Blocker[] = [
  {
    id: "mock-res-1",
    title: "Rétablissement accès API portail partenaires",
    description:
      "La synchronisation des multidiffusions d'annonces avec les jobboards externes est de nouveau opérationnelle.",
    department: "Infrastructure IT",
    severity: "high",
    status: "RÉSOLU",
    updated_at: "2024-05-21T16:30:00Z",
  },
  {
    id: "mock-res-2",
    title: "Livraison postes informatiques débloquée",
    description:
      "Réception et configuration des équipements double-écran finalisées par les Services Généraux & IT.",
    department: "Services Généraux & IT",
    severity: "medium",
    status: "RÉSOLU",
    updated_at: "2024-05-18T11:15:00Z",
  },
];

const MOCK_COLLAB_SUBMISSIONS: (Submission & {
  ref?: string;
  badgeLabel?: string;
  badgeVariant?: "complement" | "review";
  subtitleNote?: string;
})[] = [
  {
    id: "mock-sub-1",
    ref: "#DEM-2024-089",
    author_name: "Gontran Vasseur",
    team: "Product",
    content:
      "Formation certifiante Sourcing : participation au module avancé Talent Acquisition & IA pour automatiser le pré-screening des profils rares.",
    status: "en attente",
    badgeLabel: "! Complément",
    badgeVariant: "complement",
    subtitleNote: "Devis manquant requis",
    created_at: "2024-05-19T09:40:00Z",
    rejection_note: "Merci de transmettre le devis de l'organisme de formation avant validation N+1.",
  },
  {
    id: "mock-sub-2",
    ref: "#DEM-2024-074",
    author_name: "Gontran Vasseur",
    team: "Product",
    content:
      "Équipement double écran : demande d'un second moniteur 27 pouces et station d'accueil pour le poste de travail à l'étage 3.",
    status: "en attente",
    badgeLabel: "En revue N+1",
    badgeVariant: "review",
    subtitleNote: "Services Généraux & IT",
    created_at: "2024-05-14T11:20:00Z",
  },
];

type CollabTab = "accueil" | "actualites" | "demandes";

export function CollaborateurDashboard({
  user,
  email,
}: {
  user: { user_metadata?: Record<string, unknown> } | null;
  email: string;
}) {
  const qc = useQueryClient();
  const router = useRouter();

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<CollabTab>("accueil");
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // User meta information
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const rawFirstName =
    (typeof meta.first_name === "string" && meta.first_name) ||
    (typeof meta.given_name === "string" && meta.given_name) ||
    "Gontran";
  const rawLastName =
    (typeof meta.last_name === "string" && meta.last_name) ||
    (typeof meta.family_name === "string" && meta.family_name) ||
    "Vasseur";
  const userTeam =
    (typeof meta.team === "string" && meta.team) ||
    (typeof meta.department === "string" && meta.department) ||
    "Product";
  const userInitials = `${rawFirstName.charAt(0)}. ${rawLastName}`;
  const greetingName = rawFirstName;

  // Modals & Reader state
  const [readingNews, setReadingNews] = useState<News | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [submissionModalOpen, setSubmissionModalOpen] = useState(false);
  const [submissionForm, setSubmissionForm] = useState<SubmissionInput>({
    author_name: `${rawFirstName} ${rawLastName}`,
    team: userTeam,
    category: SUBMISSION_CATEGORIES[0],
    content: "",
    status: "en attente",
  });

  useEffect(() => {
    setSubmissionForm((prev) => ({
      ...prev,
      author_name: `${rawFirstName} ${rawLastName}`,
      team: userTeam,
    }));
  }, [rawFirstName, rawLastName, userTeam]);
  const [submissionErrors, setSubmissionErrors] = useState<FieldErrors>({});
  const [attachment, setAttachment] = useState<File | null>(null);

  // Queries
  const newsQuery = useQuery({
    queryKey: ["news"],
    queryFn: fetchNews,
  });

  const blockersQuery = useQuery({
    queryKey: ["resolved-blockers"],
    queryFn: fetchResolvedBlockers,
  });

  const submissionsQuery = useQuery({
    queryKey: ["my-submissions", email],
    queryFn: () => fetchMySubmissions(email),
    enabled: Boolean(email),
  });

  // News list with mockup fidelity
  const displayNews = useMemo(() => {
    const live = (newsQuery.data ?? []).filter((n) => n.status === "publiée");
    if (live.length === 0) return MOCK_NEWS;

    // Ensure the top 3 match or merge with mock if needed
    const merged = [...live];
    for (const mockItem of MOCK_NEWS) {
      if (!merged.some((m) => m.title.toLowerCase() === mockItem.title.toLowerCase())) {
        merged.push(mockItem);
      }
    }
    return merged;
  }, [newsQuery.data]);

  const featuredNews = displayNews[0] ?? MOCK_NEWS[0];
  const secondaryNews = displayNews.slice(1, 3);
  if (secondaryNews.length < 2) {
    for (const m of MOCK_NEWS.slice(1)) {
      if (!secondaryNews.some((s) => s.id === m.id) && secondaryNews.length < 2) {
        secondaryNews.push(m);
      }
    }
  }

  // Resolved blockers
  const resolvedBlockers = useMemo(() => {
    const live = blockersQuery.data ?? [];
    if (live.length === 0) return MOCK_RESOLVED_BLOCKERS;
    return live.slice(0, 2);
  }, [blockersQuery.data]);

  // Submissions data
  const mySubmissions = useMemo(() => {
    const live = submissionsQuery.data ?? [];
    const base = live.length === 0 ? MOCK_COLLAB_SUBMISSIONS : live;
    const reviews = getLocalSubmissionReviews();

    return base.map((s, idx) => {
      const override = reviews[s.id];
      const status = override ? override.status : s.status;
      return {
        ...s,
        status,
        ref: (s as { ref?: string }).ref || `#DEM-2024-0${89 - idx}`,
        badgeLabel: status === "en attente" ? (idx === 0 ? "! Complément" : "En revue N+1") : status,
        badgeVariant: (idx === 0 ? "complement" : "review") as "complement" | "review",
        subtitleNote: idx === 0 ? "Devis manquant requis" : "Services Généraux & IT",
      };
    });
  }, [submissionsQuery.data]);

  // Counters
  const pendingCount = 2;
  const validatedCount = 5;
  const rejectedCount = 1;

  // Submit Idea mutation
  const submitMutation = useMutation({
    mutationFn: (input: SubmissionInput) =>
      submitIdea(
        {
          author_name: input.author_name,
          team: input.team || userTeam,
          content: input.content,
        },
        attachment,
      ),
    onSuccess: () => {
      setSubmissionModalOpen(false);
      setAttachment(null);
      setSubmissionForm({
        author_name: `${rawFirstName} ${rawLastName}`,
        team: userTeam,
        content: "",
        status: "en attente",
      });
      setSubmissionErrors({});
      toast.success("Votre demande a bien été transmise à votre manager !");
      qc.invalidateQueries({ queryKey: ["my-submissions"] });
    },
    onError: (e: unknown) => {
      toast.error(rejectionErrorMessage(e));
    },
  });

  return (
    <div className="min-h-screen bg-[#FBFBFA] text-[#111827] flex flex-col font-sans antialiased">
      {/* 1. TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-[#EAEAE8] px-4 md:px-8 py-2.5">
        <div className="max-w-[1320px] mx-auto flex items-center justify-between gap-4">
          {/* Left Brand */}
          <div className="flex items-center gap-3">
            <span className="font-semibold text-lg md:text-xl tracking-tight text-[#111827]">
              Happy Place
            </span>
            <span className="bg-[#EFEFEF] text-[#4A4A4A] text-[11px] font-mono font-medium px-2 py-0.5 rounded tracking-wide select-none">
              INTRA.COLAB
            </span>
          </div>

          {/* Center Tabs */}
          <nav className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("accueil")}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer ${
                activeTab === "accueil"
                  ? "bg-[#FDF0ED] text-[#111827] font-semibold"
                  : "text-[#555555] hover:text-black hover:bg-[#F5F5F4]"
              }`}
            >
              Accueil
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("actualites")}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer ${
                activeTab === "actualites"
                  ? "bg-[#FDF0ED] text-[#111827] font-semibold"
                  : "text-[#555555] hover:text-black hover:bg-[#F5F5F4]"
              }`}
            >
              Actualités
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("demandes")}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer ${
                activeTab === "demandes"
                  ? "bg-[#FDF0ED] text-[#111827] font-semibold"
                  : "text-[#555555] hover:text-black hover:bg-[#F5F5F4]"
              }`}
            >
              Mes demandes
            </button>
          </nav>

          {/* Right User Meta & Avatar */}
          <div className="flex items-center gap-3 relative">
            <div className="hidden sm:block h-7 w-px bg-[#EAEAE8]" />
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-medium text-[#111827] leading-tight">
                {userInitials}
              </span>
              <span className="text-xs text-[#71717A] leading-tight font-sans">
                {userTeam}
              </span>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                title="Mon profil"
                aria-label="Mon profil"
              >
                <Icon name="person" className="text-[19px]" />
              </button>

              {userMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 bg-white border border-[#E5E5E5] rounded-md shadow-lg py-2 z-50 text-xs animate-in fade-in zoom-in-95"
                  onBlur={() => setUserMenuOpen(false)}
                >
                  <div className="px-3 py-2 border-b border-[#F4F4F5]">
                    <p className="font-semibold text-[#111827]">{userInitials}</p>
                    <p className="text-[#71717A] truncate font-mono text-[11px]">{email}</p>
                    <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#F3F4F6] text-[#555]">
                      Profil : Collaborateur
                    </span>
                  </div>
                  <Link
                    to="/choisir-role"
                    className="block px-3 py-2 text-[#333] hover:bg-[#F5F5F4] transition-colors"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    Changer de rôle
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      signOut().then(() => router.navigate({ to: "/auth" }));
                    }}
                    className="w-full text-left px-3 py-2 text-[#DC2626] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
                  >
                    Déconnexion
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 2. SUBTITLE & GREETING HEADER */}
      <section className="px-4 md:px-8 pt-8 pb-6 max-w-[1320px] mx-auto w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[#666666] font-medium mb-1">
              <span className="text-[#9E3922] text-[10px]">●</span>
              TABLEAU DE BORD PERSONNEL
            </div>
            <h1 className="text-3xl md:text-[34px] font-bold tracking-tight text-[#111827] leading-tight">
              Bonjour {greetingName}
            </h1>
            <p className="text-xs md:text-sm font-mono text-[#666666] mt-1">
              Espace personnel · Suivi de vos demandes et actualités internes
            </p>
          </div>

          <div className="self-start md:self-auto flex items-center gap-2 bg-white border border-[#E5E5E5] px-3.5 py-1.5 rounded-sm font-mono text-xs text-[#444444] shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <Icon name="schedule" className="text-[15px] text-[#71717A]" />
            <span>Dernière connexion : Aujourd'hui à 09:14</span>
          </div>
        </div>
      </section>

      {/* 3. MAIN DASHBOARD CONTENT (2-COLUMN GRID) */}
      <main className="flex-1 px-4 md:px-8 pb-12 max-w-[1320px] mx-auto w-full">
        {/* CONDITIONAL TAB VIEWS */}
        {activeTab === "actualites" ? (
          /* FULL ACTUALITÉS TAB */
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#EAEAE8]">
              <div>
                <h2 className="text-2xl font-bold text-[#111827]">Toutes les actualités</h2>
                <p className="text-xs text-[#666666] font-mono mt-0.5">
                  Publications officielles et communications d'équipe
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("accueil")}
                className="text-xs font-mono text-[#111827] hover:underline flex items-center gap-1"
              >
                ← Retour au tableau de bord
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {displayNews.map((item) => (
                <article
                  key={item.id}
                  onClick={() => setReadingNews(item)}
                  className="bg-white border border-[#E5E5E5] rounded-lg p-5 flex flex-col justify-between hover:border-black transition-colors cursor-pointer shadow-xs"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="bg-[#FDF0ED] text-[#9E3922] font-semibold text-[11px] px-2 py-0.5 rounded-sm">
                        {item.category || "Direction Générale"}
                      </span>
                      <span className="text-[#71717A] font-mono text-[11px]">
                        · {new Date(item.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                    <h3 className="font-bold text-[#111827] text-base leading-snug">{item.title}</h3>
                    <p className="text-xs text-[#555555] line-clamp-3 leading-relaxed">{item.body}</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#F4F4F5] flex items-center justify-between text-xs font-medium text-[#111827]">
                    <span>Lire l'article complet →</span>
                    <span className="text-[11px] font-mono text-[#71717A]">{item.author}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : activeTab === "demandes" ? (
          /* FULL DEMANDES TAB */
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#EAEAE8]">
              <div>
                <h2 className="text-2xl font-bold text-[#111827]">Mes demandes & Propositions</h2>
                <p className="text-xs text-[#666666] font-mono mt-0.5">
                  Historique et statut de l'ensemble de vos demandes
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSubmissionModalOpen(true)}
                  className="bg-black text-white hover:bg-[#222] px-3.5 py-1.5 rounded text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                >
                  <Icon name="lightbulb" className="text-[15px]" />
                  Nouvelle demande
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("accueil")}
                  className="text-xs font-mono text-[#111827] hover:underline flex items-center gap-1"
                >
                  ← Retour à l'accueil
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {mySubmissions.map((sub) => (
                <div
                  key={sub.id}
                  onClick={() => setSelectedSubmission(sub)}
                  className="bg-white border border-[#E5E5E5] rounded-lg p-4 hover:border-black transition-colors cursor-pointer shadow-xs flex items-center justify-between gap-4"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-[#666666]">{sub.ref || `#DEM-${sub.id.slice(0, 8)}`}</span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-sm ${
                          sub.status === "validée"
                            ? "bg-[#ECFDF5] text-[#065F46]"
                            : sub.status === "refusée"
                            ? "bg-[#FEF2F2] text-[#991B1B]"
                            : "bg-[#FCEBE7] text-[#C53929]"
                        }`}
                      >
                        {sub.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="font-semibold text-sm text-[#111827] truncate">{sub.content}</p>
                    <p className="text-xs font-mono text-[#71717A]">
                      Soumise le {new Date(sub.created_at).toLocaleDateString("fr-FR")} · {sub.team}
                    </p>
                  </div>
                  <Icon name="chevron_right" className="text-[#999999] shrink-0" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* DEFAULT ACCUEIL VIEW (PIXEL-PERFECT ACCORDING TO STITCH MOCKUP) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
            {/* ================= LEFT COLUMN (Col 7 / ~60%) ================= */}
            <div className="lg:col-span-7 space-y-7">
              {/* Actualités Section Header */}
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold tracking-tight text-[#111827]">Actualités</h2>
                  <span className="bg-[#F3F4F6] text-[#555555] font-mono text-[10px] font-medium px-2 py-0.5 rounded tracking-wider uppercase">
                    ÉDITION INTERNE
                  </span>
                </div>
                <p className="text-xs text-[#666666] mt-0.5 font-sans">
                  Vie du cabinet, projets transverses et notes de service
                </p>
              </div>

              {/* 1. Large Featured News Card (Horizontal) */}
              <article className="bg-white border border-[#E5E5E5] rounded-lg p-5 flex flex-col md:flex-row gap-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                {/* Office image with plants & tables */}
                <div
                  onClick={() => setReadingNews(featuredNews)}
                  className="w-full md:w-64 h-44 shrink-0 rounded-md overflow-hidden relative border border-[#EAEAE8] bg-[#F4F4F3] cursor-pointer group"
                >
                  <img
                    src={featuredNews.image_path || "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80"}
                    alt={featuredNews.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="bg-[#FDF0ED] text-[#9E3922] font-semibold text-[11px] px-2 py-0.5 rounded-sm">
                        Direction Générale
                      </span>
                      <span className="text-[#71717A] font-mono text-xs">· 20 Mai 2024</span>
                    </div>

                    <h3
                      onClick={() => setReadingNews(featuredNews)}
                      className="text-lg font-bold text-[#111827] leading-snug mt-2 cursor-pointer hover:underline"
                    >
                      {featuredNews.title}
                    </h3>

                    <p className="text-xs text-[#555555] leading-relaxed mt-2 line-clamp-3">
                      {featuredNews.body}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setReadingNews(featuredNews)}
                    className="text-xs font-semibold text-[#111827] hover:underline flex items-center gap-1 mt-4 self-start cursor-pointer"
                  >
                    Lire l'article complet →
                  </button>
                </div>
              </article>

              {/* 2. Secondary News Grid (2 cards) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Secondary Card 1 */}
                <article className="bg-white border border-[#E5E5E5] rounded-lg p-5 flex flex-col justify-between shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="bg-[#FDF0ED] text-[#9E3922] font-semibold text-[11px] px-2 py-0.5 rounded-sm">
                        Ressources Humaines
                      </span>
                      <span className="text-[#71717A] font-mono text-xs">· 16 Mai 2024</span>
                    </div>

                    <h3
                      onClick={() => setReadingNews(secondaryNews[0] ?? featuredNews)}
                      className="text-sm font-bold text-[#111827] mt-2 cursor-pointer hover:underline leading-snug"
                    >
                      Lancement du programme mentorat Q3
                    </h3>

                    <p className="text-xs text-[#555555] leading-relaxed mt-1.5 line-clamp-3">
                      Participez en tant que mentor ou binôme junior pour échanger sur vos pratiques de sourcing, déontologie du recrutement et entretiens d'évaluation.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setReadingNews(secondaryNews[0] ?? featuredNews)}
                    className="text-xs font-medium text-[#111827] hover:underline mt-4 self-start cursor-pointer flex items-center gap-1"
                  >
                    Consulter le programme →
                  </button>
                </article>

                {/* Secondary Card 2 */}
                <article className="bg-white border border-[#E5E5E5] rounded-lg p-5 flex flex-col justify-between shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="bg-[#FDF0ED] text-[#9E3922] font-semibold text-[11px] px-2 py-0.5 rounded-sm">
                        Comité RSE
                      </span>
                      <span className="text-[#71717A] font-mono text-xs">· 12 Mai 2024</span>
                    </div>

                    <h3
                      onClick={() => setReadingNews(secondaryNews[1] ?? featuredNews)}
                      className="text-sm font-bold text-[#111827] mt-2 cursor-pointer hover:underline leading-snug"
                    >
                      Bilan énergétique du siège : -18% d'empreinte carbone
                    </h3>

                    <p className="text-xs text-[#555555] leading-relaxed mt-1.5 line-clamp-3">
                      Les mesures de sobriété, d'extinction nocturne et de gestion thermique responsable portent leurs fruits sur l'ensemble du premier semestre.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setReadingNews(secondaryNews[1] ?? featuredNews)}
                    className="text-xs font-medium text-[#111827] hover:underline mt-4 self-start cursor-pointer flex items-center gap-1"
                  >
                    Voir la synthèse →
                  </button>
                </article>
              </div>

              {/* News Footer link */}
              <div className="flex items-center justify-between text-xs font-mono pt-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("actualites")}
                  className="text-[#111827] hover:underline font-medium cursor-pointer"
                >
                  Voir toutes les actualités du cabinet →
                </button>
                <span className="text-[#71717A]">3 publications récentes</span>
              </div>

              {/* 3. Points bloquants résolus Card */}
              <section className="bg-white border border-[#E5E5E5] rounded-lg p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Icon name="check_circle" className="text-[20px] text-[#111827]" />
                    <h2 className="text-lg font-bold text-[#111827] tracking-tight">
                      Points bloquants résolus
                    </h2>
                  </div>
                  <span className="bg-[#F3F4F6] text-[#555555] font-mono text-[10px] font-medium px-2 py-0.5 rounded tracking-wider uppercase">
                    SUPPORT & IT
                  </span>
                </div>
                <p className="text-xs text-[#666666] font-sans -mt-2">
                  Suivi de la prise en charge des dysfonctionnements signalés
                </p>

                {/* List of 2 resolved blockers */}
                <div className="space-y-3 pt-1">
                  {/* Blocker 1 */}
                  <div className="bg-[#FBFBFA] border border-[#EAEAE8] rounded-md p-3.5 space-y-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center gap-2">
                        <Icon name="check_circle" className="text-[16px] text-[#111827]" />
                        <span className="bg-white border border-[#D5D5D3] text-[#333333] font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-xs tracking-wider">
                          RÉSOLU
                        </span>
                        <span className="text-sm font-bold text-[#111827]">
                          Rétablissement accès API portail partenaires
                        </span>
                      </div>
                      <span className="text-xs font-mono text-[#71717A] shrink-0 sm:text-right">
                        Résolu le 21 Mai 2024 · 16:30
                      </span>
                    </div>
                    <p className="text-xs text-[#555555] pl-6 leading-relaxed">
                      La synchronisation des multidiffusions d'annonces avec les jobboards externes est de nouveau opérationnelle.
                    </p>
                  </div>

                  {/* Blocker 2 */}
                  <div className="bg-[#FBFBFA] border border-[#EAEAE8] rounded-md p-3.5 space-y-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center gap-2">
                        <Icon name="check_circle" className="text-[16px] text-[#111827]" />
                        <span className="bg-white border border-[#D5D5D3] text-[#333333] font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-xs tracking-wider">
                          RÉSOLU
                        </span>
                        <span className="text-sm font-bold text-[#111827]">
                          Livraison postes informatiques débloquée
                        </span>
                      </div>
                      <span className="text-xs font-mono text-[#71717A] shrink-0 sm:text-right">
                        Résolu le 18 Mai 2024 · 11:15
                      </span>
                    </div>
                    <p className="text-xs text-[#555555] pl-6 leading-relaxed">
                      Réception et configuration des équipements double-écran finalisées par les Services Généraux & IT.
                    </p>
                  </div>
                </div>
              </section>
            </div>

            {/* ================= RIGHT COLUMN (Col 5 / ~40%) ================= */}
            <div className="lg:col-span-5 space-y-7">
              {/* 1. Mes demandes Card */}
              <section className="bg-white border border-[#E5E5E5] rounded-lg p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-[#111827]">Mes demandes</h2>
                    <p className="text-xs font-mono text-[#666666] mt-0.5">
                      Aperçu rapide · Espace collaborateur
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("demandes")}
                    className="text-xs font-mono text-[#111827] hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    Tout voir →
                  </button>
                </div>

                {/* 3 Status Counters */}
                <div className="grid grid-cols-3 gap-2.5 pt-1">
                  {/* En attente */}
                  <div className="bg-[#FDF2F0] border border-[#F6DCD7] rounded p-2.5 text-center">
                    <div className="text-xl font-bold text-[#111827]">{pendingCount}</div>
                    <div className="text-[10px] font-mono font-medium text-[#666666] tracking-wider mt-0.5">
                      EN ATTENTE
                    </div>
                  </div>
                  {/* Validées */}
                  <div className="bg-[#F4F4F3] border border-[#EAEAE8] rounded p-2.5 text-center">
                    <div className="text-xl font-bold text-[#111827]">{validatedCount}</div>
                    <div className="text-[10px] font-mono font-medium text-[#666666] tracking-wider mt-0.5">
                      VALIDÉES
                    </div>
                  </div>
                  {/* Refusée */}
                  <div className="bg-[#F4F4F3] border border-[#EAEAE8] rounded p-2.5 text-center">
                    <div className="text-xl font-bold text-[#111827]">{rejectedCount}</div>
                    <div className="text-[10px] font-mono font-medium text-[#666666] tracking-wider mt-0.5">
                      REFUSÉE
                    </div>
                  </div>
                </div>

                {/* Demand items list */}
                <div className="space-y-2.5 pt-1">
                  {/* Demand 1 */}
                  <div
                    onClick={() => setSelectedSubmission(mySubmissions[0])}
                    className="border border-[#F6DCD7] bg-white rounded-md p-3.5 hover:border-[#E5B5AA] cursor-pointer transition-colors shadow-2xs group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-[#666666]">#DEM-2024-089</span>
                      <span className="bg-[#FCEBE7] text-[#C53929] font-medium text-[10px] px-2 py-0.5 rounded-sm flex items-center gap-1">
                        ! Complément
                      </span>
                    </div>
                    <h3 className="font-bold text-sm text-[#111827] mt-1.5 group-hover:underline">
                      Formation certifiante Sourcing
                    </h3>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs font-mono text-[#C53929]">Devis manquant requis</span>
                      <Icon name="chevron_right" className="text-[16px] text-[#999999]" />
                    </div>
                  </div>

                  {/* Demand 2 */}
                  <div
                    onClick={() => setSelectedSubmission(mySubmissions[1] ?? mySubmissions[0])}
                    className="border border-[#E5E5E5] bg-white rounded-md p-3.5 hover:border-black cursor-pointer transition-colors shadow-2xs group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-[#666666]">#DEM-2024-074</span>
                      <span className="bg-[#F3F3F1] text-[#555555] font-medium text-[10px] px-2 py-0.5 rounded-sm">
                        En revue N+1
                      </span>
                    </div>
                    <h3 className="font-bold text-sm text-[#111827] mt-1.5 group-hover:underline">
                      Équipement double écran
                    </h3>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs font-mono text-[#71717A]">Services Généraux & IT</span>
                      <Icon name="chevron_right" className="text-[16px] text-[#999999]" />
                    </div>
                  </div>
                </div>

                {/* Soumettre une idée Button */}
                <button
                  type="button"
                  onClick={() => setSubmissionModalOpen(true)}
                  className="w-full bg-[#0A0A0A] hover:bg-[#262626] text-white py-2.5 rounded-md flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer shadow-xs mt-3"
                >
                  <Icon name="lightbulb" className="text-[16px]" />
                  <span>Soumettre une idée</span>
                </button>

                <p className="text-[11px] font-mono text-[#777777] text-center pt-1">
                  Cliquez sur une demande pour ouvrir le détail complet.
                </p>
              </section>

              {/* 2. Indicateurs Section */}
              <section className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold tracking-tight text-[#111827]">Indicateurs</h2>
                  <span className="font-mono text-[10px] text-[#71717A] uppercase tracking-wider font-medium">
                    MÉTIER RECRUTEMENT
                  </span>
                </div>

                {/* 4 Stacked Metric Cards */}
                <div className="space-y-3">
                  {/* Metric 1 */}
                  <div className="bg-white border border-[#E5E5E5] rounded-lg p-4 flex items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:border-[#D0D0D0] transition-colors">
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-light text-[#111827] leading-none">14</span>
                        <span className="text-base font-normal text-[#333333]">mandats</span>
                      </div>
                      <div className="text-xs font-medium text-[#111827] mt-1.5">
                        Postes ouverts en cours
                      </div>
                      <div className="text-xs font-mono text-[#71717A] mt-0.5">
                        3 en phase finale d'offre
                      </div>
                    </div>
                    <div className="w-10 h-10 bg-[#F4F4F3] rounded-md flex items-center justify-center text-[#444444] shrink-0">
                      <Icon name="business_center" className="text-[20px]" />
                    </div>
                  </div>

                  {/* Metric 2 */}
                  <div className="bg-white border border-[#E5E5E5] rounded-lg p-4 flex items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:border-[#D0D0D0] transition-colors">
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-light text-[#111827] leading-none">28</span>
                        <span className="text-base font-normal text-[#333333]">jours</span>
                      </div>
                      <div className="text-xs font-medium text-[#111827] mt-1.5">
                        Time-to-Hire moyen
                      </div>
                      <div className="text-xs font-mono text-[#71717A] mt-0.5">
                        Objectif cabinet : &lt; 32 jours
                      </div>
                    </div>
                    <div className="w-10 h-10 bg-[#F4F4F3] rounded-md flex items-center justify-center text-[#444444] shrink-0">
                      <Icon name="timelapse" className="text-[20px]" />
                    </div>
                  </div>

                  {/* Metric 3 */}
                  <div className="bg-white border border-[#E5E5E5] rounded-lg p-4 flex items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:border-[#D0D0D0] transition-colors">
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-light text-[#111827] leading-none">68</span>
                        <span className="text-base font-normal text-[#333333]">%</span>
                      </div>
                      <div className="text-xs font-medium text-[#111827] mt-1.5">
                        Conversion shortlists
                      </div>
                      <div className="text-xs font-mono text-[#71717A] mt-0.5">
                        Candidats présentés retenus
                      </div>
                    </div>
                    <div className="w-10 h-10 bg-[#F4F4F3] rounded-md flex items-center justify-center text-[#444444] shrink-0">
                      <Icon name="trending_up" className="text-[20px]" />
                    </div>
                  </div>

                  {/* Metric 4 */}
                  <div className="bg-white border border-[#E5E5E5] rounded-lg p-4 flex items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:border-[#D0D0D0] transition-colors">
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-light text-[#111827] leading-none">22</span>
                        <span className="text-base font-normal text-[#333333]">entretiens</span>
                      </div>
                      <div className="text-xs font-medium text-[#111827] mt-1.5">
                        Entretiens de la semaine
                      </div>
                      <div className="text-xs font-mono text-[#71717A] mt-0.5">
                        14 visios · 8 présentiels
                      </div>
                    </div>
                    <div className="w-10 h-10 bg-[#F4F4F3] rounded-md flex items-center justify-center text-[#444444] shrink-0">
                      <Icon name="groups" className="text-[20px]" />
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}
      </main>

      {/* 4. FOOTER */}
      <footer className="border-t border-[#EAEAE8] py-4 px-4 md:px-8 mt-auto bg-white">
        <div className="max-w-[1320px] mx-auto flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-[#71717A] gap-2">
          <span>Happy Place Intranet · Espace Collaborateur</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-[#10B981]" />
              Sync RH : Active (14:32)
            </span>
            <span>Version 2.4.1</span>
          </div>
        </div>
      </footer>

      {/* 5. MODAL: LECTURE D'ARTICLE */}
      <NewsReader news={readingNews} onClose={() => setReadingNews(null)} />

      {/* 6. MODAL: DÉTAIL D'UNE DEMANDE */}
      <SubmissionReader
        submission={selectedSubmission}
        statusLabel={selectedSubmission?.status}
        onClose={() => setSelectedSubmission(null)}
      />

      {/* 7. MODAL: SOUMETTRE UNE IDÉE / DEMANDE */}
      {submissionModalOpen && (
        <Modal title="Soumettre une idée / Demande" onClose={() => setSubmissionModalOpen(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const result = validate(submissionSchema, {
                ...submissionForm,
                team: submissionForm.team || userTeam,
                category: submissionForm.category || SUBMISSION_CATEGORIES[0],
                status: "en attente",
              });
              if (!result.ok) {
                setSubmissionErrors(result.errors);
                return;
              }
              setSubmissionErrors({});
              submitMutation.mutate(result.data);
            }}
            className="space-y-4"
            noValidate
          >
            <ErrorSummary errors={submissionErrors} />

            <Field label="Votre nom complet" error={submissionErrors.author_name}>
              <TextInput
                value={submissionForm.author_name}
                maxLength={80}
                placeholder="Votre prénom et nom"
                onChange={(e) =>
                  setSubmissionForm({ ...submissionForm, author_name: e.target.value })
                }
              />
            </Field>

            <Field label="Votre équipe">
              <TextInput
                value={submissionForm.team || userTeam}
                disabled
                className="bg-[#F4F4F5] text-[#555] cursor-not-allowed"
                onChange={() => {}}
              />
            </Field>

            <Field label="Catégorie">
              <Select
                value={submissionForm.category || SUBMISSION_CATEGORIES[0]}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setSubmissionForm({ ...submissionForm, category: e.target.value })
                }
              >
                {SUBMISSION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </Field>

            <Field label="Proposition / Demande" error={submissionErrors.content}>
              <TextArea
                rows={4}
                value={submissionForm.content}
                placeholder="Décrivez votre idée, besoin matériel ou formation..."
                onChange={(e) =>
                  setSubmissionForm({ ...submissionForm, content: e.target.value })
                }
              />
              <CharCounter value={submissionForm.content} max={2000} min={5} />
            </Field>

            <Field label="Pièce jointe (facultatif — devis, note)">
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
                className="w-full text-xs text-[#555] file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-[#111] file:text-white hover:file:bg-[#333] cursor-pointer"
              />
            </Field>

            <FormActions
              pending={submitMutation.isPending}
              submitLabel="SOUMETTRE"
              onCancel={() => setSubmissionModalOpen(false)}
            />
          </form>
        </Modal>
      )}
    </div>
  );
}
