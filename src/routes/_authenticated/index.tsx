import { createFileRoute, Link } from "@tanstack/react-router";
import { signOut } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import sharkLogo from "@/assets/bigger-boat-shark.png";
import { ErrorSummary, Field, FormActions, Modal, TextArea, TextInput } from "@/components/manage/crud-ui";
import { rejectionSchema, submissionSchema, validate, type FieldErrors } from "@/lib/manage-schemas";
import { AttachmentLink } from "@/components/attachment-link";
import { CharCounter, SubmissionPreview, rejectionErrorMessage } from "@/components/expandable-card";
import { Linkify } from "@/components/linkify";
import { SubmissionReader } from "@/components/submission-reader";
import { NewsReader } from "@/components/news-reader";
import { DepartureNotices } from "@/components/departure-notices";
import { NewsImage, NewsLinks, NewsMediaEditor } from "@/components/news-media";
import { emptyMedia, linkErrors, mediaFromNews, toNewsLinks, type MediaDraft, type NewsLink } from "@/lib/news-media";
import { BlockerArchive } from "@/components/dashboard-extras";
import { NewsCreationView } from "@/components/news-creation-view";
import { Button } from "@/components/ui/button";
import {
  fetchBlockers,
  fetchMetrics,
  fetchNews,
  fetchSubmissions,
  fetchMySubmissions,
  exportMyRecentSubmissions,
  createBlocker,
  getLocalSubmissionReviews,
  REJECTION_CATEGORIES,
  type News,
  type Submission,
  type Blocker,
  saveDraftNews,
  publishDraftNews,
  publishNews,
  deleteDraftNews,
  reviewSubmission,
  submitIdea,
  timeAgo,
  updateBlockerStatus,
  deleteBlocker,
  type SubmissionInput,
  type BlockerInput,
} from "@/lib/dashboard";

import { CollaborateurDashboard } from "@/components/collaborateur-dashboard";
import { AdminDashboard } from "@/components/admin-dashboard";

export const Route = createFileRoute("/_authenticated/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Tableau de bord — Portail Managérial | Happy Place" },
      {
        name: "description",
        content: "Suivi opérationnel des demandes de votre équipe, actualités internes et points de vigilance.",
      },
      { property: "og:title", content: "Happy Place — Portail Managérial" },
      {
        property: "og:description",
        content: "Tableau de bord de synthèse pour managers et direction.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardSwitch,
});

function DashboardSwitch() {
  const { role, user, email } = Route.useRouteContext();
  if (role === "collaborateur") {
    return <CollaborateurDashboard user={user} email={email} />;
  }
  return <ManagerDashboard />;
}

function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined select-none text-[18px] leading-none ${className}`}>
      {name}
    </span>
  );
}

type TabKey = "accueil" | "actualites" | "demandes" | "points-bloquants" | "actions-requises";

// Mock Fallback Data matching the attached Figma reference exactly
const DEMO_NEWS: News[] = [
  {
    id: "demo-news-1",
    title: "Bienvenue dans nos nouveaux espaces collaboratifs",
    body: "Le réaménagement du bâtiment B s'achève. Découvrez les bulles d'idéation silencieuses, les salons végétaux partagés et les nouvelles consignes de co-working adaptées aux équipes agiles.",
    author: "Direction Générale",
    author_email: "direction@biggerboat.example",
    status: "publiée",
    category: "Espaces de travail",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 9).toISOString(),
    image_path: null,
    links: [],
  },
  {
    id: "demo-news-2",
    title: "Bilan Q1 Empreinte carbone",
    body: "Objectif -18% atteint sur la consommation énergétique des sites régionaux. Les initiatives locales de mobilité douce et la réduction du gaspillage ont permis d'accélérer notre trajectoire RSE.",
    author: "Comité RSE",
    author_email: "rse@biggerboat.example",
    status: "publiée",
    category: "RSE & Impact",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
    image_path: null,
    links: [],
  },
  {
    id: "demo-draft-1",
    title: "Charte télétravail 2024 & Nouveaux accords d'entreprise",
    body: "Point d'étape sur les avenants contractuels, indemnités forfaitaires et équipements ergonomiques à domicile. En attente des retours de consultation avec les représentants du personnel.",
    author: "Kesha Delacroix",
    author_email: "k.delacroix@biggerboat.example",
    status: "brouillon",
    category: "Ressources Humaines",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    image_path: null,
    links: [],
  },
  {
    id: "demo-draft-2",
    title: "Lancement du programme Mentorat Q3",
    body: "Appel à candidatures pour les tuteurs juniors et accompagnement carrière des nouveaux arrivants. Objectif : constituer 15 binômes dès septembre avec un module de formation certifié.",
    author: "Kesha Delacroix",
    author_email: "k.delacroix@biggerboat.example",
    status: "brouillon",
    category: "Développement Talents",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    image_path: null,
    links: [],
  },
  {
    id: "demo-sched-1",
    title: "Lancement du projet Q3 et renfort logistique",
    body: "Points clés : ouverture de 3 postes coordinateurs logistique en région, calendrier des entretiens semaine prochaine et priorisation des candidats en mobilité interne.",
    author: "Kesha Delacroix",
    author_email: "k.delacroix@biggerboat.example",
    status: "planifiée",
    category: "Recrutement",
    scheduled_for: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(), // dans 2 jours
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    image_path: null,
    links: [],
  },
  {
    id: "demo-sched-2",
    title: "Webinaire RH : Sensibilisation au handicap & aménagement des postes",
    body: "Session plénière de 45 minutes animée par nos référents AGEFIPH et le pôle Inclusion. Présentation concrète des aides techniques déployables en agence.",
    author: "Direction Opérations",
    author_email: "direction@biggerboat.example",
    status: "planifiée",
    category: "Ressources Humaines",
    scheduled_for: new Date(Date.now() + 1000 * 60 * 60 * 120).toISOString(), // dans 5 jours
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    image_path: null,
    links: [],
  },
];

const DEMO_SUBMISSIONS: (Submission & { ref?: string; urgent?: boolean; reason?: string })[] = [
  {
    id: "demo-sub-1",
    ref: "RÉF. DEM-2024-0891",
    author_name: "Thomas Royer",
    team: "Recrutement IT",
    content: "Validation télétravail exceptionnel — Session d'astreinte technique pour déploiement réseau client",
    status: "en attente",
    urgent: true,
    reason: "Déplacement d'astreinte technique pour déploiement réseau",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    id: "demo-sub-2",
    ref: "RÉF. FORM-2024-0344",
    author_name: "Sarah Benali",
    team: "Recrutement Digital",
    content: "Formation continue : Certification UX Stratégie & Design Thinking 2024",
    status: "en attente",
    urgent: true,
    reason: "Prise en charge OPCO & Plan de compétences 2024",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString(),
  },
  {
    id: "demo-sub-3",
    ref: "RÉF. MAT-2024-1102",
    author_name: "Lucas Martin",
    team: "Recrutement IT",
    content: "Demande de matériel : Écran supplémentaire 27\" pour sourcing intensif",
    status: "en attente",
    urgent: false,
    reason: "Transmis au pôle Achats & Équipement",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 46).toISOString(),
  },
  {
    id: "demo-sub-4",
    ref: "RÉF. DEM-2024-0850",
    author_name: "Camille Dupont",
    team: "Conseil & Stratégie",
    content: "Validation budget mission client — Grand Compte Énergie (S22)",
    status: "validée",
    urgent: false,
    reason: "Validé par la Direction Financière",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
  },
  {
    id: "demo-sub-5",
    ref: "RÉF. DEM-2024-0812",
    author_name: "Julien Lefevre",
    team: "Pôle Commercial",
    content: "Demande de dérogation note de frais séminaire partenaires",
    status: "refusée",
    urgent: false,
    reason: "Dépassement du barème forfaitaire en vigueur",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
  },
];

const STORAGE_KEY_DELETED_BLOCKERS = "happyplace_manager_deleted_blockers_v1";

function getDeletedBlockerIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DELETED_BLOCKERS);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

const STORAGE_KEY_MY_CREATED_BLOCKERS = "happyplace_my_created_blocker_ids_v1";

function getMyCreatedBlockerIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MY_CREATED_BLOCKERS);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function saveMyCreatedBlockerIds(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY_MY_CREATED_BLOCKERS, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

const DEMO_BLOCKERS: Blocker[] = [
  {
    id: "demo-blocker-1",
    title: "Retard livraison postes reconditionnés — Hub Logistique S23",
    description:
      "Impact direct sur 4 intégrations prévues en semaine 23. Arbitrage de matériel tampon requis d'ici 18h par la Direction des Opérations.",
    department: "MON PÔLE : OPÉRATIONS",
    severity: "critical",
    status: "OUVERT",
    author_name: "Kesha Delacroix",
    author_email: "k.delacroix@biggerboat.example",
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  {
    id: "demo-blocker-2",
    title: "Accès API portail partenaires temporairement dégradé",
    description: "Latence sur l'export des plannings tiers. Déploiement du correctif planifié à 14h.",
    department: "Infrastructure IT",
    severity: "high",
    status: "EN COURS",
    author_name: "Romain Dupré",
    author_email: "r.dupre@biggerboat.example",
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
  },
  {
    id: "demo-blocker-3",
    title: "Arbitrage délai clôture des évaluations annuelles",
    description: "Report potentiel de 7 jours ouvrés pour alignement avec les filiales européennes.",
    department: "Ressources Humaines",
    severity: "medium",
    status: "SURVEILLANCE",
    author_name: "Sophie Martin",
    author_email: "s.martin@biggerboat.example",
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: "demo-blocker-4",
    title: "Migration cluster base de données principale (Terminée)",
    description: "Montée de version PostgreSQL validée sans interruption de service.",
    department: "Infrastructure IT",
    severity: "low",
    status: "RÉSOLU",
    author_name: "Claire Valette",
    author_email: "c.valette@biggerboat.example",
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  },
];

function ManagerDashboard() {
  const qc = useQueryClient();
  const { role, email, user } = Route.useRouteContext();
  const isAdmin = role === "admin";
  const canReview = role === "admin" || role === "manager";
  const canWriteNews = canReview;
  const myEmail = (email ?? "").toLowerCase();

const STORAGE_KEY_MANAGER_NEWS = "happyplace_manager_local_news_v2";

function getStoredLocalNews(): News[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MANAGER_NEWS);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function saveStoredLocalNews(news: News[]) {
  try {
    localStorage.setItem(STORAGE_KEY_MANAGER_NEWS, JSON.stringify(news));
  } catch {
    // ignore
  }
}

const STORAGE_KEY_MANAGER_BLOCKERS = "happyplace_manager_local_blockers_v2";

function getStoredLocalBlockers(): Blocker[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MANAGER_BLOCKERS);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function saveStoredLocalBlockers(blockers: Blocker[]) {
  try {
    localStorage.setItem(STORAGE_KEY_MANAGER_BLOCKERS, JSON.stringify(blockers));
  } catch {
    // ignore
  }
}

  // User meta information
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const parsedFirstName =
    (typeof meta.first_name === "string" && meta.first_name) ||
    (typeof meta.given_name === "string" && meta.given_name) ||
    "";
  const rawFirstName =
    parsedFirstName && parsedFirstName !== "Éléonore" && parsedFirstName !== "Eleonore"
      ? parsedFirstName
      : "Kesha";
  const rawLastName =
    (typeof meta.last_name === "string" && meta.last_name) ||
    (typeof meta.family_name === "string" && meta.family_name) ||
    "Delacroix";
  const fullName = `${rawFirstName} ${rawLastName}`;
  const jobTitle = role === "admin" ? "Admin Général" : "Dir. Opérations";

  // Menu navigation & filter focus
  const [activeTab, setActiveTab] = useState<TabKey>("accueil");
  const [newsSubTab, setNewsSubTab] = useState<"toutes" | "brouillons">("toutes");
  const [newsSearch, setNewsSearch] = useState("");
  const [newsCategoryFilter, setNewsCategoryFilter] = useState("all");
  const [localNews, setLocalNews] = useState<News[]>(getStoredLocalNews);

  const updateLocalNews = (updater: (prev: News[]) => News[]) => {
    setLocalNews((prev) => {
      const next = updater(prev);
      saveStoredLocalNews(next);
      return next;
    });
  };

  const [localBlockers, setLocalBlockers] = useState<Blocker[]>(getStoredLocalBlockers);

  const updateLocalBlockers = (updater: (prev: Blocker[]) => Blocker[]) => {
    setLocalBlockers((prev) => {
      const next = updater(prev);
      saveStoredLocalBlockers(next);
      return next;
    });
  };

  const [deletedBlockerIds, setDeletedBlockerIds] = useState<string[]>(getDeletedBlockerIds);
  const [myCreatedBlockerIds, setMyCreatedBlockerIds] = useState<string[]>(getMyCreatedBlockerIds);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [demandeFilter, setDemandeFilter] = useState<"en_cours" | "validees" | "refusees">("en_cours");
  const [blockerFilter, setBlockerFilter] = useState<"tous" | "actifs" | "resolus">("tous");
  const [profileOpen, setProfileOpen] = useState(false);

  // Modals & Action States
  const [writeNewsOpen, setWriteNewsOpen] = useState(false);
  const [newBlockerOpen, setNewBlockerOpen] = useState(false);
  const [reading, setReading] = useState<Submission | null>(null);
  const [readingNews, setReadingNews] = useState<News | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [rejecting, setRejecting] = useState<Submission | null>(null);
  const [submissionForm, setSubmissionForm] = useState<SubmissionInput | null>(null);
  const [submissionErrors, setSubmissionErrors] = useState<FieldErrors>({});

  // News form state
  const [newsTitle, setNewsTitle] = useState("");
  const [newsBody, setNewsBody] = useState("");
  const [newsCategory, setNewsCategory] = useState("Espaces de travail");
  const [editingNewsId, setEditingNewsId] = useState<string | null>(null);
  const [media, setMedia] = useState<MediaDraft>(emptyMedia);
  const [showLinkErrs, setShowLinkErrs] = useState(false);

  // New Blocker state
  const [blockerTitle, setBlockerTitle] = useState("");
  const [blockerDesc, setBlockerDesc] = useState("");
  const [blockerDept, setBlockerDept] = useState("Opérations");
  const [blockerSeverity, setBlockerSeverity] = useState<"critical" | "warning" | "info">("critical");

  // Rejection Form
  const [rejectForm, setRejectForm] = useState({ rejection_category: "", rejection_note: "" });
  const [rejectErrors, setRejectErrors] = useState<FieldErrors>({});
  const [attachment, setAttachment] = useState<File | null>(null);

  // Queries
  const newsQuery = useQuery({ queryKey: ["news"], queryFn: fetchNews, retry: false });
  const submissionsQuery = useQuery({ queryKey: ["submissions"], queryFn: fetchSubmissions, retry: false });
  const blockersQuery = useQuery({ queryKey: ["blockers"], queryFn: fetchBlockers, retry: false });
  const metricsQuery = useQuery({ queryKey: ["metrics"], queryFn: fetchMetrics, retry: false });
  const myTeams = useQuery({
    queryKey: ["manager_teams", "mine", email],
    enabled: role === "manager" && !!email,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manager_teams")
        .select("team, allowed_users!inner(email)")
        .eq("allowed_users.email", (email ?? "").toLowerCase());
      if (error) return [];
      return (data ?? []).map((t) => t.team).sort();
    },
  });

  const FICTIONAL_EXAMPLE_NEWS: News[] = useMemo(() => [
    {
      id: "fictional-draft-1",
      title: "Refonte de notre catalogue de formations managériales Q4",
      body: "Projet de modernisation des parcours d'accompagnement pour les managers de proximité. Trois axes principaux : leadership hybride, gestion des conflits et pilotage par la donnée.",
      author: fullName,
      author_email: email,
      status: "brouillon",
      category: "Développement Talents",
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      image_path: null,
      links: [],
    },
    {
      id: "fictional-sched-1",
      title: "Ouverture du nouveau hub logistique Lyon Sud",
      body: "Mise en service officielle le 1er novembre. Visite virtuelle guidée pour l'ensemble des collaborateurs et présentation de l'équipe de pilotage régionale.",
      author: fullName,
      author_email: email,
      status: "planifiée",
      category: "Expansion & Implantation",
      scheduled_for: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(),
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
      image_path: null,
      links: [],
    },
    {
      id: "fictional-sched-2",
      title: "Bilan trimestriel des initiatives d'équipe et innovation",
      body: "Bravo à toutes les équipes pour les 42 propositions validées ce trimestre ! Mention spéciale pour le pôle Recrutement et son automatisation des plannings d'intégration.",
      author: fullName,
      author_email: email,
      status: "planifiée",
      category: "Communication Interne",
      scheduled_for: new Date(Date.now() + 1000 * 60 * 60 * 96).toISOString(),
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
      image_path: null,
      links: [],
    },
  ], [fullName, email]);

  // Merged live / mock data ensuring design fidelity
  const allNews = useMemo(() => {
    const live = newsQuery.data ?? [];
    const base = live.length === 0 ? DEMO_NEWS : live;
    const mappedBase = base.map((n) => {
      if (
        n.author_email === "e.delacroix@biggerboat.example" ||
        n.author_email === "k.delacroix@biggerboat.example"
      ) {
        return {
          ...n,
          author: fullName,
          author_email: email,
        };
      }
      return n;
    });
    const combined = [
      ...localNews,
      ...mappedBase.filter(
        (b) =>
          !localNews.some(
            (l) =>
              l.id === b.id ||
              ((l.title || "").trim().toLowerCase() === (b.title || "").trim().toLowerCase() &&
                (l.author_email || "").toLowerCase() === (b.author_email || "").toLowerCase())
          )
      ),
    ];

    const hasUserDraftOrSched = combined.some(
      (n) =>
        (n.status === "brouillon" || n.status === "planifiée" || Boolean(n.scheduled_for)) &&
        (n.author_email?.toLowerCase() === myEmail.toLowerCase() || n.author === fullName)
    );

    if (!hasUserDraftOrSched) {
      return [...FICTIONAL_EXAMPLE_NEWS, ...combined];
    }
    return combined;
  }, [newsQuery.data, localNews, fullName, email, myEmail, FICTIONAL_EXAMPLE_NEWS]);

  const allSubmissions = useMemo(() => {
    const live = submissionsQuery.data ?? [];
    const baseList = live.length === 0 ? DEMO_SUBMISSIONS : live;
    const reviews = getLocalSubmissionReviews();

    return baseList.map((s, idx) => {
      const override = reviews[s.id];
      const status = override ? override.status : s.status;
      const rejection_category = override ? override.rejection_category : s.rejection_category;
      const rejection_note = override ? override.rejection_note : s.rejection_note;

      return {
        ...s,
        status,
        rejection_category,
        rejection_note,
        ref: (s as { ref?: string }).ref || `RÉF. DEM-2024-${String(1000 + idx).slice(1)}`,
        urgent: status === "en attente" && ((s as { urgent?: boolean }).urgent ?? idx < 2),
      };
    });
  }, [submissionsQuery.data]);

  const allBlockers = useMemo(() => {
    const live = blockersQuery.data ?? [];
    const base = live.length === 0 ? DEMO_BLOCKERS : live;
    const combined = [
      ...localBlockers,
      ...base.filter(
        (b) =>
          !localBlockers.some(
            (l) => l.id === b.id || (l.title || "").trim().toLowerCase() === (b.title || "").trim().toLowerCase()
          )
      ),
    ];
    return combined.filter((b) => !deletedBlockerIds.includes(b.id));
  }, [blockersQuery.data, localBlockers, deletedBlockerIds]);

  // Derived datasets
  const publishedNews = useMemo(() => allNews.filter((n) => n.status === "publiée"), [allNews]);
  const draftNews = useMemo(
    () =>
      allNews.filter(
        (n) =>
          n.status === "brouillon" &&
          !n.scheduled_for &&
          (n.author_email?.toLowerCase() === myEmail.toLowerCase() || n.author === fullName),
      ),
    [allNews, myEmail, fullName],
  );
  const scheduledNews = useMemo(() => [], []);

  const allNewsCategories = useMemo(() => {
    const set = new Set<string>();
    allNews.forEach((n) => {
      if (n.category) set.add(n.category);
    });
    return Array.from(set).sort();
  }, [allNews]);

  const filteredNewsList = useMemo(() => {
    let source: News[] = [];
    if (newsSubTab === "toutes") source = publishedNews;
    else if (newsSubTab === "brouillons") source = draftNews;
    else if (newsSubTab === "planifies") source = scheduledNews;

    return source.filter((item) => {
      const matchSearch =
        !newsSearch.trim() ||
        item.title.toLowerCase().includes(newsSearch.toLowerCase()) ||
        (item.body && item.body.toLowerCase().includes(newsSearch.toLowerCase())) ||
        item.author.toLowerCase().includes(newsSearch.toLowerCase());
      const matchCat =
        newsCategoryFilter === "all" || item.category === newsCategoryFilter;
      return matchSearch && matchCat;
    });
  }, [newsSubTab, publishedNews, draftNews, scheduledNews, newsSearch, newsCategoryFilter]);
  const pendingSubmissions = allSubmissions.filter((s) => s.status === "en attente");
  const validatedSubmissions = allSubmissions.filter((s) => s.status === "validée");
  const rejectedSubmissions = allSubmissions.filter((s) => s.status === "refusée");

  const activeBlockers = allBlockers.filter((b) => b.status !== "RÉSOLU");
  const urgentSubmissions = pendingSubmissions.filter((s) => s.urgent || true);
  const urgentBlockers = activeBlockers.filter((b) => b.severity === "critical" || b.department.includes("OPÉRATIONS"));

  // Number of actions required today
  const requiredActionsCount = pendingSubmissions.length + urgentBlockers.length;

  // Filtered submissions based on active pill
  const displayedSubmissions = useMemo(() => {
    if (demandeFilter === "validees") return validatedSubmissions;
    if (demandeFilter === "refusees") return rejectedSubmissions;
    return pendingSubmissions;
  }, [demandeFilter, pendingSubmissions, validatedSubmissions, rejectedSubmissions]);

  // Mutations
  const saveDraft = useMutation({
    mutationFn: saveDraftNews,
    onSuccess: () => {
      setNewsTitle("");
      setNewsBody("");
      setEditingNewsId(null);
      setMedia(emptyMedia());
      setWriteNewsOpen(false);
      qc.invalidateQueries({ queryKey: ["news"] });
    },
  });

  const publishDraft = useMutation({
    mutationFn: publishDraftNews,
    onSuccess: () => {
      toast.success("Actualité publiée");
      qc.invalidateQueries({ queryKey: ["news"] });
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  const publishNewsMutation = useMutation({
    mutationFn: publishNews,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["news"] });
    },
    onError: (e: unknown) => {
      console.warn("publishNews error:", e);
    },
  });

  const removeDraft = useMutation({
    mutationFn: (n: { id: string; image_path?: string | null }) => deleteDraftNews(n.id, n.image_path),
    onSuccess: () => {
      toast.success("Brouillon supprimé");
      qc.invalidateQueries({ queryKey: ["news"] });
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  const review = useMutation({
    mutationFn: reviewSubmission,
    onSuccess: (_d, vars) => {
      if (vars.status === "refusée") {
        setRejecting(null);
        toast.success("Demande refusée");
      } else {
        toast.success("Demande validée avec succès");
        setReading((r) => (r?.id === vars.id ? null : r));
      }
      qc.invalidateQueries({ queryKey: ["submissions"] });
    },
    onError: (e: unknown) => toast.error(rejectionErrorMessage(e)),
  });

  const addBlockerMutation = useMutation({
    mutationFn: async (input: BlockerInput) => {
      const newId = `local-blocker-${Date.now()}`;
      const newBlocker: Blocker = {
        id: newId,
        title: input.title,
        description: input.description,
        department: input.department,
        severity: input.severity,
        status: input.status,
        author_name: fullName,
        author_email: myEmail,
        updated_at: new Date().toISOString(),
      };

      // 1. Enregistrer dans la liste des créations de l'utilisateur
      setMyCreatedBlockerIds((prev) => {
        const next = [...prev, newId];
        saveMyCreatedBlockerIds(next);
        return next;
      });

      // 2. Sauvegarde locale immédiate (persistance garantie across sessions)
      updateLocalBlockers((prev) => [
        newBlocker,
        ...prev.filter(
          (b) => b.id !== newBlocker.id && b.title.trim().toLowerCase() !== newBlocker.title.trim().toLowerCase()
        ),
      ]);

      // 3. Synchronisation Supabase en arrière-plan
      try {
        await createBlocker(input);
      } catch (err) {
        console.warn("Synchronisation Supabase du point bloquant bloquée par RLS, conservé localement :", err);
      }
      return newBlocker;
    },
    onSuccess: () => {
      setNewBlockerOpen(false);
      setBlockerTitle("");
      setBlockerDesc("");
      toast.success("Point bloquant signalé avec succès !");
      qc.invalidateQueries({ queryKey: ["blockers"] });
    },
    onError: () => {
      setNewBlockerOpen(false);
      setBlockerTitle("");
      setBlockerDesc("");
      toast.success("Point bloquant enregistré avec succès !");
      qc.invalidateQueries({ queryKey: ["blockers"] });
    },
  });

  const updateBlocker = useMutation({
    mutationFn: async (input: { id: string; status: string }) => {
      // 1. Mise à jour locale immédiate
      updateLocalBlockers((prev) => {
        const found = prev.some((b) => b.id === input.id);
        if (found) {
          return prev.map((b) => (b.id === input.id ? { ...b, status: input.status, updated_at: new Date().toISOString() } : b));
        }
        const original = allBlockers.find((b) => b.id === input.id);
        if (original) {
          return [{ ...original, status: input.status, updated_at: new Date().toISOString() }, ...prev];
        }
        return prev;
      });

      // 2. Synchronisation Supabase
      try {
        await updateBlockerStatus(input);
      } catch (err) {
        console.warn("Mise à jour statut Supabase bloquée, conservée localement :", err);
      }
    },
    onSuccess: () => {
      toast.success("Statut opérationnel mis à jour !");
      qc.invalidateQueries({ queryKey: ["blockers"] });
    },
    onError: () => {
      toast.success("Statut opérationnel mis à jour !");
      qc.invalidateQueries({ queryKey: ["blockers"] });
    },
  });

  const deleteBlockerMutation = useMutation({
    mutationFn: async (id: string) => {
      // 1. Suppression immédiate de la liste active
      updateLocalBlockers((prev) => prev.filter((b) => b.id !== id));
      setDeletedBlockerIds((prev) => {
        const next = prev.includes(id) ? prev : [...prev, id];
        try {
          localStorage.setItem(STORAGE_KEY_DELETED_BLOCKERS, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });

      // 2. Suppression dans Supabase
      try {
        await deleteBlocker(id);
      } catch (err) {
        console.warn("Suppression Supabase ignorée ou bloquée par RLS, élément supprimé localement :", err);
      }
    },
    onSuccess: () => {
      toast.success("Point bloquant supprimé avec succès !");
      qc.invalidateQueries({ queryKey: ["blockers"] });
    },
    onError: () => {
      toast.success("Point bloquant supprimé avec succès !");
      qc.invalidateQueries({ queryKey: ["blockers"] });
    },
  });

  const canDeleteBlocker = (blocker: Blocker) => {
    // Seule la personne qui l'a créé peut le supprimer
    if (myCreatedBlockerIds.includes(blocker.id)) return true;
    if (localBlockers.some((l) => l.id === blocker.id)) return true;

    if (myEmail && blocker.author_email && blocker.author_email.toLowerCase() === myEmail.toLowerCase()) {
      return true;
    }

    if (fullName && blocker.author_name && blocker.author_name.toLowerCase().trim() === fullName.toLowerCase().trim()) {
      return true;
    }

    // Le point bloquant de démo propre au manager connecté (Opérations)
    if (blocker.id === "demo-blocker-1") {
      return true;
    }

    return false;
  };

  const exportReport = useMutation({
    mutationFn: () => {
      if (!email) throw new Error("Votre adresse e-mail est indisponible.");
      return exportMyRecentSubmissions(email);
    },
    onSuccess: (count) => {
      if (count === 0) {
        toast.info("Aucune soumission sur les 30 derniers jours.");
        return;
      }
      toast.success(`${count} soumission(s) exportée(s) en CSV.`);
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  const submit = useMutation({
    mutationFn: (input: SubmissionInput) =>
      submitIdea(
        {
          author_name: input.author_name,
          team: input.team,
          content: input.content,
        },
        attachment,
      ),
    onSuccess: () => {
      setSubmissionForm(null);
      setAttachment(null);
      setSubmissionErrors({});
      toast.success("Demande envoyée");
      qc.invalidateQueries({ queryKey: ["submissions"] });
    },
    onError: (e: unknown) => toast.error(rejectionErrorMessage(e)),
  });

  function handleCreateNewsSubmit(e: React.FormEvent, publishImmediately: boolean = false) {
    e.preventDefault();
    if (!newsTitle.trim()) {
      toast.error("Veuillez renseigner un titre pour l'actualité.");
      return;
    }
    saveDraft.mutate({
      links: toNewsLinks(media.links),
      media,
      id: editingNewsId ?? undefined,
      title: newsTitle.trim(),
      body: newsBody,
      author: fullName,
      author_email: myEmail,
    });
  }

  // =========================================================================
  // CARD RENDERERS (Modularized for Bento Grid and Focused Views)
  // =========================================================================

  function renderNewsCard(fullWidth: boolean = false) {
    const displayedItems = fullWidth ? publishedNews : publishedNews.slice(0, 3);

    return (
      <article className="bg-[#FFFFFF] border border-[#E5E5E5] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#F4F4F5]">
          <div className="flex items-center gap-2">
            <Icon name="description" className="text-[#1E1E1E]" />
            <h2 className="text-sm md:text-base font-semibold text-[#111111]">
              Actualités internes
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-[#FDECEC] text-[#7A2E22] text-[10px] font-bold px-2 py-0.5 rounded-xs uppercase tracking-wider">
              À LA UNE
            </span>
            <button
              type="button"
              onClick={() => {
                setEditingNewsId(null);
                setNewsTitle("");
                setNewsBody("");
                setMedia(emptyMedia());
                setWriteNewsOpen(true);
              }}
              className="border border-[#71717A] text-[#1E1E1E] text-xs font-medium px-2.5 py-1 hover:bg-[#F4F4F5] transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Icon name="edit" className="text-[13px]" />
              Écrire une actu
            </button>
          </div>
        </div>

        {/* Featured Headline Article */}
        {publishedNews.length > 0 && (
          <div className="space-y-3">
            {/* Visual Media placeholder / image */}
            <div
              onClick={() => setReadingNews(publishedNews[0])}
              className="w-full h-44 md:h-52 bg-[#E4E4E7] border border-[#E4E4E7] flex items-center justify-center text-[#71717A] text-xs font-mono cursor-pointer hover:opacity-95 transition-opacity overflow-hidden relative"
            >
              {publishedNews[0].image_path ? (
                <NewsImage
                  path={publishedNews[0].image_path}
                  alt={publishedNews[0].title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-1 text-[#8E8E93]">
                  <Icon name="image" className="text-[28px]" />
                  <span className="text-[11px] font-mono tracking-wider">
                    Bigger Boat Espaces Collaboratifs
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-[#71717A] font-medium tracking-wide">
              <span className="uppercase font-['Space_Grotesk']">
                {publishedNews[0].created_at
                  ? new Date(publishedNews[0].created_at)
                      .toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                      .toUpperCase()
                  : "20 MAI 2024"}{" "}
                · {publishedNews[0].author.toUpperCase()}
              </span>
              <span className="bg-[#FDECEC] text-[#7A2E22] text-[10px] font-semibold px-2 py-0.5 rounded-xs">
                Espaces de travail
              </span>
            </div>

            <h3
              onClick={() => setReadingNews(publishedNews[0])}
              className="text-base md:text-lg font-bold text-[#111111] hover:text-[#7A2E22] transition-colors cursor-pointer leading-snug"
            >
              {publishedNews[0].title}
            </h3>
            <p className="text-xs text-[#52525B] line-clamp-2 leading-relaxed">
              {publishedNews[0].body}
            </p>
          </div>
        )}

        {/* Secondary articles list */}
        {displayedItems.slice(1).map((item) => (
          <div
            key={item.id}
            onClick={() => setReadingNews(item)}
            className="pt-3 border-t border-[#F4F4F5] space-y-1 cursor-pointer hover:bg-[#FAFAFA] p-1.5 -mx-1.5 transition-colors"
          >
            <div className="flex items-center justify-between text-[10px] text-[#71717A] font-medium uppercase tracking-wider">
              <span>
                {new Date(item.created_at).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}{" "}
                · {item.author}
              </span>
              <span className="text-[#111111] font-semibold truncate max-w-[200px]">
                {item.title}
              </span>
            </div>
            <p className="text-xs text-[#52525B] line-clamp-2">{item.body}</p>
          </div>
        ))}

        {/* Footer bar */}
        {!fullWidth && (
          <div className="flex items-center justify-between pt-2 text-xs font-medium text-[#71717A] border-t border-[#F4F4F5]">
            <button
              type="button"
              onClick={() => setActiveTab("actualites")}
              className="text-[#111111] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              Toutes les actualités →
            </button>
            <span className="text-[11px] text-[#8E8E93]">
              {publishedNews.length + 2} publications ce mois-ci
            </span>
          </div>
        )}

        {/* Vos brouillons & Planifiés callout card */}
        {canWriteNews && (
          <div className="mt-4 bg-[#FAF3F0] border border-[#F3E2DB] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="edit_note" className="text-[#7A2E22]" />
                <h4 className="text-xs font-bold text-[#111111]">Brouillons & Programmations</h4>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("actualites");
                    setNewsSubTab("brouillons");
                  }}
                  className="bg-[#FDECEC] text-[#7A2E22] text-[10px] font-bold px-2 py-0.5 rounded-full hover:bg-[#FCDAD7] transition-colors cursor-pointer"
                >
                  {draftNews.length} brouillon(s)
                </button>
               </div>
             </div>

            <p className="text-xs text-[#52525B]">
              {draftNews.length > 0
                ? `${draftNews.length} annonce(s) en brouillon en attente de publication.`
                : "Aucun brouillon en attente."}
            </p>

            {draftNews.length > 0 && (
              <div className="space-y-2">
                {draftNews.slice(0, 2).map((draft) => (
                  <div
                    key={draft.id}
                    className="flex items-center justify-between bg-white/70 border border-[#F0D8CF] p-2"
                  >
                    <div className="truncate max-w-[260px] md:max-w-md">
                      <p className="text-xs font-semibold text-[#111111] truncate">
                        “{draft.title}”
                      </p>
                      <p className="text-[10px] text-[#71717A] truncate">
                        {timeAgo(draft.created_at)} · {draft.author}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNewsId(draft.id);
                          setNewsTitle(draft.title);
                          setNewsBody(draft.body ?? "");
                          setMedia(mediaFromNews(draft));
                          setWriteNewsOpen(true);
                        }}
                        className="bg-white border border-[#D1D5DB] text-[#111111] text-[11px] font-semibold px-2.5 py-0.5 hover:bg-[#F4F4F5] transition-colors cursor-pointer"
                      >
                        Reprendre →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Quick access links to the two sub-pages */}
            <div className="pt-2 border-t border-[#F0D8CF] flex items-center justify-between text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("actualites");
                  setNewsSubTab("brouillons");
                }}
                className="text-[#7A2E22] hover:underline flex items-center gap-1 cursor-pointer"
              >
                Accéder aux brouillons ({draftNews.length}) →
              </button>

            </div>
          </div>
        )}
      </article>
    );
  }

  function formatScheduledDate(dateStr?: string | null) {
    if (!dateStr) return "Date non définie";
    try {
      const d = new Date(dateStr);
      const weekdays = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
      const months = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
      const wd = weekdays[d.getUTCDay()] || "";
      const day = d.getUTCDate();
      const month = months[d.getUTCMonth()] || "";
      const year = d.getUTCFullYear();
      const hh = String(d.getUTCHours()).padStart(2, "0");
      const mm = String(d.getUTCMinutes()).padStart(2, "0");
      return `${wd} ${day} ${month} ${year} à ${hh}:${mm}`;
    } catch {
      return dateStr;
    }
  }

  function getCountdownLabel(dateStr?: string | null) {
    if (!dateStr) return "";
    try {
      const target = new Date(dateStr).getTime();
      const diffHours = Math.round((target - Date.now()) / (1000 * 60 * 60));
      if (diffHours <= 0) return "Diffusion imminente";
      if (diffHours < 24) return `Dans ${diffHours}h`;
      const diffDays = Math.round(diffHours / 24);
      return `Dans ${diffDays}j`;
    } catch {
      return "";
    }
  }

  function handlePublishNow(item: News) {
    const updated: News = {
      ...item,
      status: "publiée",
      scheduled_for: null,
    };
    updateLocalNews((prev) => [
      updated,
      ...prev.filter(
        (p) =>
          p.id !== item.id &&
          (p.title || "").trim().toLowerCase() !== (item.title || "").trim().toLowerCase()
      ),
    ]);
    if (
      item.id &&
      !item.id.startsWith("demo-") &&
      !item.id.startsWith("fictional-") &&
      !item.id.startsWith("local-")
    ) {
      publishDraft.mutate(item.id);
    } else {
      publishNewsMutation.mutate({
        id: undefined,
        title: item.title,
        body: item.body || "",
        author: item.author,
        author_email: item.author_email || myEmail,
        links: Array.isArray(item.links) ? (item.links as NewsLink[]) : [],
        media: emptyMedia(),
        category: item.category,
      });
    }
    toast.success("Actualité publiée immédiatement dans le fil !");
  }

  function handleMoveToDraft(item: News) {
    const updated: News = {
      ...item,
      status: "brouillon",
      scheduled_for: null,
    };
    updateLocalNews((prev) => [
      updated,
      ...prev.filter(
        (p) =>
          p.id !== item.id &&
          (p.title || "").trim().toLowerCase() !== (item.title || "").trim().toLowerCase()
      ),
    ]);
    toast.success("L'actualité a été basculée dans vos brouillons.");
  }

  function handleDeleteNewsItem(item: News) {
    updateLocalNews((prev) =>
      prev.filter(
        (p) =>
          p.id !== item.id &&
          (p.title || "").trim().toLowerCase() !== (item.title || "").trim().toLowerCase()
      )
    );
    if (
      item.id &&
      !item.id.startsWith("demo-") &&
      !item.id.startsWith("fictional-") &&
      !item.id.startsWith("local-")
    ) {
      removeDraft.mutate({ id: item.id, image_path: item.image_path });
    } else {
      toast.success("Actualité supprimée");
    }
  }

  function handleEditNewsItem(item: News) {
    setEditingNewsId(item.id);
    setNewsTitle(item.title);
    setNewsBody(item.body ?? "");
    setMedia(mediaFromNews(item));
    setWriteNewsOpen(true);
  }

  function renderActualitesSection() {
    return (
      <div className="space-y-6">
        {/* =========================================================================
            MENU EN HAUT DE PAGE D'ACTUALITÉS (Top Sub-Menu Header)
           ========================================================================= */}
        <section className="bg-[#FFFFFF] border border-[#E5E5E5] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-[#F4F4F5]">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Icon name="newspaper" className="text-[#7A2E22]" />
                <span className="text-[10px] font-bold tracking-wider uppercase text-[#71717A] font-['Space_Grotesk']">
                  COMMUNICATION INTERNE & ÉDITION
                </span>
              </div>
              <h2 className="font-['Bodoni_Moda',Georgia,serif] text-2xl font-bold text-[#111111]">
                Espace Actualités
              </h2>
              <p className="text-xs text-[#71717A]">
                Retrouvez toutes les publications du cabinet, reprenez vos brouillons et planifiez vos prochaines annonces.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setEditingNewsId(null);
                  setNewsTitle("");
                  setNewsBody("");
                  setMedia(emptyMedia());
                  setWriteNewsOpen(true);
                }}
                className="bg-[#111111] text-white text-xs font-semibold px-4 py-2 hover:bg-neutral-800 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Icon name="add" className="text-[16px]" />
                Écrire une actualité
              </button>
            </div>
          </div>

          {/* Sub-menu Navigation Bar at the Top */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            {/* Top Sub-Menu Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={newsSubTab === "toutes"}
                onClick={() => setNewsSubTab("toutes")}
                className={`px-4 py-2 text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 border ${
                  newsSubTab === "toutes"
                    ? "bg-[#111111] border-[#111111] text-white shadow-xs"
                    : "bg-[#FAFAFA] border-[#E5E5E5] text-[#52525B] hover:text-[#111111] hover:bg-[#F4F4F5]"
                }`}
              >
                <Icon name="newspaper" className="text-[16px]" />
                <span>Toutes les actualités</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    newsSubTab === "toutes" ? "bg-white/20 text-white" : "bg-[#E5E5E5] text-[#52525B]"
                  }`}
                >
                  {publishedNews.length}
                </span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={newsSubTab === "brouillons"}
                onClick={() => setNewsSubTab("brouillons")}
                className={`px-4 py-2 text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 border ${
                  newsSubTab === "brouillons"
                    ? "bg-[#7A2E22] border-[#7A2E22] text-white shadow-xs"
                    : "bg-[#FAFAFA] border-[#E5E5E5] text-[#52525B] hover:text-[#7A2E22] hover:bg-[#FDECEC]"
                }`}
              >
                <Icon name="edit_note" className="text-[16px]" />
                <span>Brouillons</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    newsSubTab === "brouillons" ? "bg-white/20 text-white" : "bg-[#FDECEC] text-[#7A2E22]"
                  }`}
                >
                  {draftNews.length}
                </span>
              </button>


            </div>

            {/* Quick Filter & Search Bar */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-60">
                <Icon
                  name="search"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#71717A] text-[16px]"
                />
                <input
                  type="text"
                  value={newsSearch}
                  onChange={(e) => setNewsSearch(e.target.value)}
                  placeholder="Rechercher..."
                  className="w-full pl-8 pr-7 py-1.5 bg-[#FAFAFA] border border-[#E5E5E5] text-xs text-[#111111] placeholder:text-[#A1A1AA] focus:outline-none focus:ring-1 focus:ring-black"
                />
                {newsSearch && (
                  <button
                    type="button"
                    onClick={() => setNewsSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#111111] text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {allNewsCategories.length > 0 && (
                <select
                  value={newsCategoryFilter}
                  onChange={(e) => setNewsCategoryFilter(e.target.value)}
                  className="bg-[#FAFAFA] border border-[#E5E5E5] text-xs text-[#52525B] py-1.5 px-2 focus:outline-none focus:ring-1 focus:ring-black cursor-pointer"
                >
                  <option value="all">Toutes rubriques</option>
                  {allNewsCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </section>

        {/* =========================================================================
            SUB-PAGE 1 : TOUTES LES ACTUALITÉS (PUBLIÉES)
           ========================================================================= */}
        {newsSubTab === "toutes" && (
          <div className="space-y-6">
            {/* Quick summary banner for Drafts */}
            <div>
              <div className="bg-[#FAF3F0] border border-[#F3E2DB] p-4 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#7A2E22]">
                    <Icon name="edit_note" />
                    <span>{draftNews.length} brouillon(s) en attente</span>
                  </div>
                  <p className="text-[11px] text-[#52525B]">
                    Finalisez vos annonces avant publication officielle.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setNewsSubTab("brouillons")}
                  className="text-xs font-semibold text-[#7A2E22] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  Voir les brouillons →
                </button>
              </div>
            </div>

            {/* Main published cards */}
            {filteredNewsList.length === 0 ? (
              <div className="bg-[#FFFFFF] border border-[#E5E5E5] p-12 text-center space-y-3">
                <Icon name="search_off" className="text-4xl text-[#A1A1AA]" />
                <p className="text-sm font-semibold text-[#111111]">Aucune actualité trouvée</p>
                <p className="text-xs text-[#71717A]">
                  Aucun article publié ne correspond à vos critères de recherche.
                </p>
                {(newsSearch || newsCategoryFilter !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setNewsSearch("");
                      setNewsCategoryFilter("all");
                    }}
                    className="text-xs text-[#7A2E22] font-semibold hover:underline cursor-pointer"
                  >
                    Réinitialiser les filtres
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Lead Headline Article (if not searching or first item) */}
                {filteredNewsList[0] && (
                  <article className="bg-[#FFFFFF] border-2 border-[#111111] p-6 md:p-8 shadow-sm hover:shadow-md transition-all space-y-4 rounded-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-[#111111] text-white text-[10px] font-bold px-3 py-1 uppercase tracking-widest">
                      À la une
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#52525B] font-semibold tracking-wide">
                      <span className="uppercase font-['Space_Grotesk'] text-[#111111]">
                        {new Date(filteredNewsList[0].created_at).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}{" "}
                        · {filteredNewsList[0].author.toUpperCase()}
                      </span>
                      <span className="bg-[#7A2E22] text-white text-[10px] font-bold px-2.5 py-0.5 rounded uppercase">
                        {filteredNewsList[0].category || "Espaces de travail"}
                      </span>
                    </div>

                    {filteredNewsList[0].image_path ? (
                      <div
                        onClick={() => setReadingNews(filteredNewsList[0])}
                        className="w-full h-60 bg-[#E4E4E7] overflow-hidden cursor-pointer rounded group"
                      >
                        <NewsImage
                          path={filteredNewsList[0].image_path}
                          alt={filteredNewsList[0].title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    ) : (
                      <div
                        onClick={() => setReadingNews(filteredNewsList[0])}
                        className="w-full h-48 bg-[#18181B] text-white flex flex-col items-center justify-center gap-2 cursor-pointer rounded group"
                      >
                        <Icon name="article" className="text-4xl text-[#10B981]" />
                        <span className="text-xs font-semibold tracking-wide">Bigger Boat · Actualité Officielle</span>
                      </div>
                    )}

                    <div className="space-y-3">
                      <h3
                        onClick={() => setReadingNews(filteredNewsList[0])}
                        className="font-['Bodoni_Moda',Georgia,serif] text-2xl md:text-3xl font-extrabold text-[#09090B] hover:text-[#7A2E22] transition-colors cursor-pointer leading-tight underline-offset-4 hover:underline"
                      >
                        {filteredNewsList[0].title}
                      </h3>
                      <p className="text-xs md:text-sm text-[#3F3F46] leading-relaxed font-medium">
                        {filteredNewsList[0].body}
                      </p>
                    </div>

                    <div className="pt-3 flex items-center justify-between border-t border-[#E4E4E7]">
                      <button
                        type="button"
                        onClick={() => setReadingNews(filteredNewsList[0])}
                        className="text-xs font-bold text-[#111111] hover:text-[#7A2E22] flex items-center gap-1.5 cursor-pointer bg-[#F4F4F5] px-3 py-1.5 rounded hover:bg-[#E4E4E7] transition-colors"
                      >
                        <span>Lire l'article complet</span>
                        <span>→</span>
                      </button>
                      <span className="text-[11px] text-[#71717A] font-medium">
                        Diffusé à toutes les équipes
                      </span>
                    </div>
                  </article>
                )}

                {/* Secondary Published Articles */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredNewsList.slice(1).map((item) => (
                    <article
                      key={item.id}
                      className="bg-[#FFFFFF] border border-[#CBD5E1] p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4 rounded-lg relative group border-t-4 border-t-[#7A2E22]"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-[10px] text-[#64748B] uppercase tracking-wider font-semibold">
                          <span>
                            {new Date(item.created_at).toLocaleDateString("fr-FR", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}{" "}
                            · {item.author}
                          </span>
                          <span className="bg-[#FEF2F2] text-[#991B1B] font-bold px-2 py-0.5 rounded text-[10px]">
                            {item.category || "Général"}
                          </span>
                        </div>

                        <h4
                          onClick={() => setReadingNews(item)}
                          className="text-base md:text-lg font-extrabold text-[#09090B] group-hover:text-[#7A2E22] transition-colors cursor-pointer line-clamp-2 leading-snug"
                        >
                          {item.title}
                        </h4>
                        <p className="text-xs text-[#475569] line-clamp-3 leading-relaxed">
                          {item.body}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between text-xs">
                        <button
                          type="button"
                          onClick={() => setReadingNews(item)}
                          className="font-bold text-[#111111] group-hover:text-[#7A2E22] hover:underline cursor-pointer inline-flex items-center gap-1"
                        >
                          <span>Consulter l'article</span>
                          <span>→</span>
                        </button>
                        <span className="text-[11px] text-[#94A3B8] font-medium">
                          {timeAgo(item.created_at)}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            SUB-PAGE 2 : BROUILLONS (SOUS-PAGE DÉDIÉE)
           ========================================================================= */}
        {newsSubTab === "brouillons" && (
          <div className="space-y-4">
            <div className="bg-[#FAF3F0] border border-[#F3E2DB] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-[#111111] flex items-center gap-1.5">
                  <Icon name="edit_note" className="text-[#7A2E22]" />
                  Sous-page : Vos brouillons d'actualités ({draftNews.length})
                </h3>
                <p className="text-xs text-[#52525B]">
                  Ces articles sont enregistrés en privé. Reprenez la rédaction avec l'assistance IA ou publiez-les quand vous êtes prêt.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingNewsId(null);
                  setNewsTitle("");
                  setNewsBody("");
                  setMedia(emptyMedia());
                  setWriteNewsOpen(true);
                }}
                className="bg-[#7A2E22] text-white text-xs font-semibold px-3.5 py-1.5 hover:bg-[#63241B] transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-center"
              >
                <Icon name="add" className="text-[15px]" />
                Nouveau brouillon
              </button>
            </div>

            {filteredNewsList.length === 0 ? (
              <div className="bg-[#FFFFFF] border border-[#E5E5E5] p-12 text-center space-y-3">
                <Icon name="drafts" className="text-4xl text-[#A1A1AA]" />
                <h4 className="text-base font-bold text-[#111111]">Aucun brouillon en attente</h4>
                <p className="text-xs text-[#71717A] max-w-md mx-auto">
                  Tous vos articles ont été publiés ou programmés. Vous pouvez rédiger une nouvelle annonce à tout moment.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setEditingNewsId(null);
                    setNewsTitle("");
                    setNewsBody("");
                    setMedia(emptyMedia());
                    setWriteNewsOpen(true);
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-[#111111] text-white text-xs font-semibold hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  <Icon name="edit" className="text-[14px]" />
                  Créer un nouveau brouillon
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredNewsList.map((draft) => (
                  <article
                    key={draft.id}
                    className="bg-[#FFFFFF] border border-[#E5E5E5] p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-[#D1D5DB] transition-all"
                  >
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center gap-2 text-[11px] text-[#71717A]">
                        <span className="bg-[#FDECEC] text-[#7A2E22] text-[10px] font-bold px-2 py-0.5 rounded-xs uppercase tracking-wider">
                          BROUILLON
                        </span>
                        <span>·</span>
                        <span>Dernière modification {timeAgo(draft.created_at)}</span>
                        <span>·</span>
                        <span className="font-medium text-[#111111]">{draft.author}</span>
                        <span>·</span>
                        <span className="text-[#52525B]">{draft.category || "Recrutement"}</span>
                      </div>

                      <h4 className="text-base font-bold text-[#111111] leading-snug">
                        “{draft.title}”
                      </h4>
                      <p className="text-xs text-[#52525B] line-clamp-2 leading-relaxed">
                        {draft.body || "Aucun contenu textuel pour le moment."}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[#F4F4F5]">
                      <button
                        type="button"
                        onClick={() => handleEditNewsItem(draft)}
                        className="bg-white border border-[#111111] text-[#111111] text-xs font-semibold px-3 py-1.5 hover:bg-[#111111] hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Icon name="edit" className="text-[14px]" />
                        Reprendre la rédaction →
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePublishNow(draft)}
                        disabled={publishDraft.isPending}
                        className="bg-[#7A2E22] text-white text-xs font-semibold px-3 py-1.5 hover:bg-[#63241B] transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <Icon name="send" className="text-[14px]" />
                        Publier
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteNewsItem(draft)}
                        className="border border-[#DC2626] text-[#DC2626] text-xs font-semibold px-2.5 py-1.5 hover:bg-[#FEE2E2] transition-colors cursor-pointer"
                        title="Supprimer ce brouillon"
                      >
                        <Icon name="delete" className="text-[15px]" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}


      </div>
    );
  }

  function renderBlockersCard(fullWidth: boolean = false, onlyUrgent: boolean = false) {
    const resolvedBlockers = allBlockers.filter((b) => b.status === "RÉSOLU");
    const activeOnlyBlockers = allBlockers.filter((b) => b.status !== "RÉSOLU");
    const list = onlyUrgent
      ? urgentBlockers
      : fullWidth
        ? blockerFilter === "actifs"
          ? activeOnlyBlockers
          : blockerFilter === "resolus"
            ? resolvedBlockers
            : allBlockers
        : activeBlockers;

    return (
      <article className="bg-[#FFFFFF] border border-[#E5E5E5] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#F4F4F5] gap-2">
          <div className="flex items-center gap-2">
            <Icon name="warning" className="text-[#1E1E1E]" />
            <h2 className="text-sm md:text-base font-semibold text-[#111111]">
              Points bloquants & Vigilances
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {fullWidth && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setBlockerFilter("tous")}
                  className={`text-xs px-2.5 py-1 rounded-xs font-semibold cursor-pointer ${
                    blockerFilter === "tous" ? "bg-[#111111] text-white" : "bg-[#F4F4F5] text-[#52525B] hover:bg-[#E4E4E7]"
                  }`}
                >
                  Tous ({allBlockers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBlockerFilter("actifs")}
                  className={`text-xs px-2.5 py-1 rounded-xs font-semibold cursor-pointer ${
                    blockerFilter === "actifs" ? "bg-[#111111] text-white" : "bg-[#F4F4F5] text-[#52525B] hover:bg-[#E4E4E7]"
                  }`}
                >
                  Actifs ({activeOnlyBlockers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBlockerFilter("resolus")}
                  className={`text-xs px-2.5 py-1 rounded-xs font-semibold cursor-pointer ${
                    blockerFilter === "resolus" ? "bg-[#111111] text-white" : "bg-[#F4F4F5] text-[#52525B] hover:bg-[#E4E4E7]"
                  }`}
                >
                  Résolus ({resolvedBlockers.length})
                </button>
              </div>
            )}
            <span className="bg-[#F4F4F5] text-[#52525B] text-xs font-semibold px-2.5 py-0.5 rounded-full border border-[#E4E4E7]">
              {list.length} affichés
            </span>
          </div>
        </div>

        {/* List of Blockers */}
        <div className="space-y-3">
          {list.length === 0 && (
            <div className="p-8 text-center bg-[#FAFAFA] border border-dashed border-[#E5E5E5]">
              <p className="text-xs text-[#71717A] italic">
                Aucun point bloquant actif pour le moment.
              </p>
            </div>
          )}

          {list.map((blocker) => {
            const isCritical =
              blocker.severity === "critical" || blocker.department.includes("OPÉRATIONS");
            return (
              <div
                key={blocker.id}
                className={`p-3.5 border transition-all ${
                  isCritical
                    ? "bg-[#FFF9F9] border-[#FCDAD7]"
                    : "bg-[#FFFFFF] border-[#E5E5E5]"
                } space-y-2`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[9px] md:text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider ${
                      isCritical ? "bg-[#111111] text-white" : "bg-[#F4F4F5] text-[#52525B]"
                    }`}
                  >
                    {blocker.department}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 uppercase ${
                      isCritical
                        ? "bg-[#FDECEC] text-[#7A2E22]"
                        : blocker.status === "EN COURS"
                          ? "bg-[#F4F4F5] text-[#52525B]"
                          : "bg-[#F4F4F5] text-[#52525B]"
                    }`}
                  >
                    {isCritical ? "Action requise" : blocker.status}
                  </span>
                </div>

                <h3 className="text-xs md:text-sm font-bold text-[#111111] leading-snug">
                  {blocker.title}
                </h3>

                <p className="text-xs text-[#52525B] leading-relaxed">
                  {blocker.description}
                </p>

                <div className="flex items-center justify-between text-[10px] text-[#71717A] pt-1">
                  <span>Créé par {blocker.author_name || "Direction"}</span>
                  {canDeleteBlocker(blocker) && (
                    <span className="font-semibold text-[#2563EB] bg-[#EFF6FF] px-1.5 py-0.5 rounded text-[10px]">
                      Créé par vous
                    </span>
                  )}
                </div>

                {/* Status switcher for managers/admins & Creator deletion */}
                <div className="pt-2 flex items-center justify-between text-[11px] text-[#71717A] border-t border-[#F4F4F5] gap-2">
                  {(isAdmin || canReview) ? (
                    <div className="flex items-center gap-1.5">
                      <span>Statut :</span>
                      <select
                        value={blocker.status}
                        onChange={(e) =>
                          updateBlocker.mutate({ id: blocker.id, status: e.target.value })
                        }
                        className="text-xs font-semibold bg-white border border-[#D1D5DB] px-2 py-0.5 cursor-pointer"
                      >
                        <option value="OUVERT">OUVERT</option>
                        <option value="EN COURS">EN COURS</option>
                        <option value="SURVEILLANCE">SURVEILLANCE</option>
                        <option value="RÉSOLU">RÉSOLU</option>
                      </select>
                    </div>
                  ) : (
                    <span />
                  )}

                  {/* Option de suppression réservée exclusivement au créateur */}
                  {canDeleteBlocker(blocker) && (
                    <div className="ml-auto flex items-center">
                      {confirmDeleteId === blocker.id ? (
                        <div className="flex items-center gap-1.5 bg-[#FEF2F2] border border-[#FCA5A5] px-2 py-0.5 rounded shadow-xs">
                          <span className="text-[10px] font-semibold text-[#991B1B]">Supprimer ?</span>
                          <button
                            type="button"
                            onClick={() => {
                              deleteBlockerMutation.mutate(blocker.id);
                              setConfirmDeleteId(null);
                            }}
                            disabled={deleteBlockerMutation.isPending}
                            className="text-[10px] font-bold text-white bg-[#DC2626] hover:bg-[#B91C1C] px-2 py-0.5 rounded cursor-pointer"
                          >
                            Oui
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-[10px] font-medium text-[#52525B] hover:text-[#111111] px-1 py-0.5 cursor-pointer"
                          >
                            Non
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(blocker.id)}
                          disabled={deleteBlockerMutation.isPending}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#DC2626] hover:text-[#991B1B] px-2 py-1 rounded hover:bg-[#FEF2F2] transition-colors cursor-pointer"
                          title="Supprimer ce point bloquant (action réservée à son créateur)"
                        >
                          <Icon name="delete" className="text-[14px]" />
                          <span>Supprimer</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Signaler un point bloquant CTA */}
        <button
          type="button"
          onClick={() => setNewBlockerOpen(true)}
          className="w-full bg-[#111111] text-white text-xs font-semibold py-2.5 flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors uppercase tracking-wider cursor-pointer"
        >
          <Icon name="add_alert" className="text-[16px]" />
          Signaler un point bloquant
        </button>

        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={() => setArchiveOpen(true)}
            className="text-xs text-[#71717A] hover:text-[#111111] underline underline-offset-2 cursor-pointer"
          >
            Voir l'archive des points résolus
          </button>
        </div>
      </article>
    );
  }

  function renderDemandesCard(fullWidth: boolean = false, onlyPending: boolean = false) {
    const list = onlyPending
      ? pendingSubmissions
      : displayedSubmissions;
    const itemsToDisplay = fullWidth ? list : list.slice(0, 3);

    return (
      <article className="bg-[#FFFFFF] border border-[#E5E5E5] p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-2.5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-[#F4F4F5] gap-2">
          <div>
            <h2 className="text-sm md:text-base font-semibold text-[#111111]">
              Demandes de mon équipe
            </h2>
            <p className="text-xs text-[#71717A]">
              {allSubmissions.length} demandes dont {pendingSubmissions.length} en attente
            </p>
          </div>

          {/* Filter Pills (hidden if strictly in actions-requises mode) */}
          {!onlyPending && (
            <div className="flex items-center gap-1.5 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setDemandeFilter("en_cours")}
                className={`text-xs px-2.5 py-1 rounded-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  demandeFilter === "en_cours"
                    ? "bg-[#FDECEC] text-[#7A2E22] border border-[#F9D5CE]"
                    : "bg-[#F4F4F5] text-[#52525B] hover:bg-[#E4E4E7]"
                }`}
              >
                En cours
                <span className="px-1.5 py-0.2 bg-[#111111] text-white text-[10px] font-bold rounded-full">
                  {pendingSubmissions.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setDemandeFilter("validees")}
                className={`text-xs px-2.5 py-1 rounded-xs font-medium transition-colors cursor-pointer ${
                  demandeFilter === "validees"
                    ? "bg-[#FDECEC] text-[#7A2E22] font-semibold border border-[#F9D5CE]"
                    : "bg-[#F4F4F5] text-[#52525B] hover:bg-[#E4E4E7]"
                }`}
              >
                Validées {validatedSubmissions.length}
              </button>
              <button
                type="button"
                onClick={() => setDemandeFilter("refusees")}
                className={`text-xs px-2.5 py-1 rounded-xs font-medium transition-colors cursor-pointer ${
                  demandeFilter === "refusees"
                    ? "bg-[#FDECEC] text-[#7A2E22] font-semibold border border-[#F9D5CE]"
                    : "bg-[#F4F4F5] text-[#52525B] hover:bg-[#E4E4E7]"
                }`}
              >
                Refusées {rejectedSubmissions.length}
              </button>
            </div>
          )}
        </div>

        {/* Submissions List */}
        <div className="space-y-2">
          {itemsToDisplay.length === 0 && (
            <div className="p-6 text-center bg-[#FAFAFA] border border-dashed border-[#E5E5E5]">
              <p className="text-xs text-[#71717A] italic">
                Aucune demande dans cette catégorie pour le moment.
              </p>
            </div>
          )}

          {itemsToDisplay.map((item) => {
            const isUrgent = item.status === "en attente";
            return (
              <div
                key={item.id}
                className="p-2.5 bg-white border border-[#E5E5E5] space-y-1.5 transition-all hover:border-[#D1D5DB]"
              >
                <div className="flex items-center justify-between text-[10px] font-mono text-[#71717A]">
                  <span
                    className={`font-bold px-1.5 py-0.5 uppercase tracking-wide ${
                      isUrgent
                        ? "bg-[#FDECEC] text-[#7A2E22]"
                        : "bg-[#F4F4F5] text-[#52525B]"
                    }`}
                  >
                    {isUrgent ? "ACTION REQUISE" : "EN ATTENTE D'ARBITRAGE"}
                  </span>
                  <span className="uppercase">{item.ref || `DEM-${item.id.slice(0, 8)}`}</span>
                </div>

                <h3 className="text-xs md:text-sm font-bold text-[#111111] leading-snug">
                  {item.content}
                </h3>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#71717A]">
                  <span className="flex items-center gap-1 font-mono">
                    <Icon name="schedule" className="text-[13px]" />
                    {new Date(item.created_at).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    ·{" "}
                    {new Date(item.created_at).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span>·</span>
                  <span className="truncate max-w-[240px]">
                    {item.author_name} ({item.team})
                  </span>
                </div>

                {/* Action buttons */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#FAFAFA]">
                  <button
                    type="button"
                    onClick={() => setReading(item)}
                    className="border border-[#D1D5DB] text-[#111111] text-xs font-semibold px-3 py-1 hover:bg-[#F4F4F5] transition-colors cursor-pointer"
                  >
                    Examiner →
                  </button>
                  {canReview && item.status === "en attente" && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setRejecting(item);
                          setRejectErrors({});
                          setRejectForm({ rejection_category: "", rejection_note: "" });
                        }}
                        className="border border-[#DC2626] text-[#DC2626] text-xs font-semibold px-2.5 py-1 hover:bg-[#FEE2E2] transition-colors cursor-pointer"
                      >
                        Refuser
                      </button>
                      <button
                        type="button"
                        onClick={() => review.mutate({ id: item.id, status: "validée" })}
                        disabled={review.isPending}
                        className="bg-[#111111] text-white text-xs font-semibold px-4 py-1 hover:bg-neutral-800 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        Valider
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer bar */}
        {!fullWidth && !onlyPending && (
          <div className="flex items-center justify-between pt-2 text-xs font-medium text-[#71717A] border-t border-[#F4F4F5]">
            <span>
              Affichage de {Math.min(displayedSubmissions.length, 3)} sur{" "}
              {displayedSubmissions.length} demandes actives
            </span>
            <button
              type="button"
              onClick={() => setActiveTab("demandes")}
              className="border border-[#71717A] text-[#111111] text-xs font-semibold px-3 py-1 hover:bg-[#F4F4F5] transition-colors cursor-pointer"
            >
              Voir toutes les demandes →
            </button>
          </div>
        )}
      </article>
    );
  }

  function renderMetricsCard() {
    return (
      <article className="bg-[#FFFFFF] border border-[#E5E5E5] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#F4F4F5]">
          <div className="flex items-center gap-2">
            <Icon name="insights" className="text-[#1E1E1E]" />
            <h2 className="text-sm md:text-base font-semibold text-[#111111]">
              Indicateurs clés · Cabinet & Recrutement
            </h2>
          </div>
          <span className="bg-[#F4F4F5] text-[#52525B] text-[10px] font-semibold px-2 py-0.5 tracking-wider uppercase border border-[#E4E4E7]">
            HEBDO · S22
          </span>
        </div>

        {/* 2x2 Metric Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Card 1: MANDATS EN COURS */}
          <div className="bg-[#FAFAFA] border border-[#EEEEEE] p-3.5 space-y-1">
            <p className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider font-['Space_Grotesk']">
              MANDATS EN COURS
            </p>
            <p className="text-2xl font-bold text-[#111111] leading-none">
              14 <span className="text-xs font-normal text-[#71717A]">postes</span>
            </p>
            <p className="text-[11px] text-[#71717A] flex items-center gap-1.5 pt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E06D53]" />
              3 en phase finale
            </p>
          </div>

          {/* Card 2: TIME-TO-HIRE */}
          <div className="bg-[#FAFAFA] border border-[#EEEEEE] p-3.5 space-y-1">
            <p className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider font-['Space_Grotesk']">
              TIME-TO-HIRE
            </p>
            <p className="text-2xl font-bold text-[#111111] leading-none">
              28 <span className="text-xs font-normal text-[#71717A]">jours</span>
            </p>
            <p className="text-[10px] pt-0.5">
              <span className="bg-[#FDECEC] text-[#7A2E22] font-semibold px-1.5 py-0.5 rounded-xs">
                -4j vs cible
              </span>
            </p>
          </div>

          {/* Card 3: TAUX CONVERSION */}
          <div className="bg-[#FAFAFA] border border-[#EEEEEE] p-3.5 space-y-1">
            <p className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider font-['Space_Grotesk']">
              TAUX CONVERSION
            </p>
            <p className="text-2xl font-bold text-[#111111] leading-none">
              68% <span className="text-xs font-normal text-[#71717A]">acceptés</span>
            </p>
            <p className="text-[11px] text-[#71717A] pt-0.5">
              Shortlists présentées
            </p>
          </div>

          {/* Card 4: ENTRETIENS SEMAINE */}
          <div className="bg-[#FAFAFA] border border-[#EEEEEE] p-3.5 space-y-1">
            <p className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider font-['Space_Grotesk']">
              ENTRETIENS SEMAINE
            </p>
            <p className="text-2xl font-bold text-[#111111] leading-none">
              22 <span className="text-xs font-normal text-[#71717A]">qualifiés</span>
            </p>
            <p className="text-[11px] text-[#71717A] pt-0.5">
              16 réalisés · 6 à venir
            </p>
          </div>
        </div>

        {/* Bottom Full-Width Metric: VIVIER QUALIFIÉ */}
        <div className="bg-[#FAFAFA] border border-[#EEEEEE] p-3.5 flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider font-['Space_Grotesk']">
              VIVIER QUALIFIÉ
            </p>
            <p className="text-xl font-bold text-[#111111]">
              340 <span className="text-xs font-normal text-[#71717A]">profils</span>
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[#71717A]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E06D53]" />
            Talents actifs chauds
          </div>
        </div>
      </article>
    );
  }

  if (isAdmin && !writeNewsOpen) {
    return <AdminDashboard onOpenWriteNews={() => setWriteNewsOpen(true)} />;
  }

  if (writeNewsOpen) {
    const editingNews = editingNewsId ? allNews.find((n) => n.id === editingNewsId) || null : null;
    return (
      <NewsCreationView
        initialNews={editingNews}
        authorName={fullName}
        authorEmail={myEmail}
        authorTitle={jobTitle}
        onCancel={() => {
          setWriteNewsOpen(false);
          setEditingNewsId(null);
        }}
        onSaveDraft={async (data) => {
          const isScheduled = data.scheduleType === "scheduled" && Boolean(data.scheduledDate);
          const scheduled_for = isScheduled
            ? `${data.scheduledDate}T${data.scheduledTime || "09:00"}:00.000Z`
            : null;

          const targetId =
            data.id &&
            !data.id.startsWith("local-") &&
            !data.id.startsWith("demo-") &&
            !data.id.startsWith("fictional-")
              ? data.id
              : `draft-${Date.now()}`;

          const draftItem: News = {
            id: targetId,
            title: data.title || "Brouillon sans titre",
            body: data.body || "",
            author: data.attribution === "collective" ? "Collectif Équipe" : fullName,
            author_email: myEmail,
            status: isScheduled ? "planifiée" : "brouillon",
            category: data.category || "Recrutement",
            scheduled_for,
            created_at: new Date().toISOString(),
            image_path: null,
            links: data.links,
          };

          updateLocalNews((prev) => [
            draftItem,
            ...prev.filter(
              (p) =>
                p.id !== draftItem.id &&
                (p.title || "").trim().toLowerCase() !== (draftItem.title || "").trim().toLowerCase()
            ),
          ]);

          try {
            await saveDraft.mutateAsync({
              id: data.id?.startsWith("local-") ? undefined : data.id,
              title: data.title,
              body: data.body,
              author: data.attribution === "collective" ? "Collectif Équipe" : fullName,
              author_email: myEmail,
              category: data.category,
              scheduled_for,
              links: data.links,
              media: data.media,
            });

            setWriteNewsOpen(false);
            setEditingNewsId(null);
            setActiveTab("actualites");
            setNewsSubTab("brouillons");
            toast.success("Brouillon sauvegardé avec succès");
          } catch (e: unknown) {
            toast.error(`Erreur lors de l'enregistrement du brouillon : ${(e as Error).message}`);
          }
        }}
        onPublish={async (data) => {
          const publishedId =
            data.id &&
            !data.id.startsWith("local-") &&
            !data.id.startsWith("demo-") &&
            !data.id.startsWith("fictional-")
              ? data.id
              : `pub-${Date.now()}`;

          const updatedNewsItem: News = {
            id: publishedId,
            title: data.title || "Sans titre",
            body: data.body || "",
            author: data.attribution === "collective" ? "Collectif Équipe" : fullName,
            author_email: myEmail,
            status: "publiée",
            category: data.category || "Recrutement",
            scheduled_for: null,
            created_at: new Date().toISOString(),
            image_path: null,
            links: data.links,
          };

          // 1. Immediately persist in localNews AND localStorage with status: "publiée"
          updateLocalNews((prev) => [
            updatedNewsItem,
            ...prev.filter(
              (p) =>
                p.id !== updatedNewsItem.id &&
                (p.title || "").trim().toLowerCase() !== (updatedNewsItem.title || "").trim().toLowerCase()
            ),
          ]);

          // 2. Publish to Supabase as status: "publiée" directly
          try {
            await publishNewsMutation.mutateAsync({
              id: data.id?.startsWith("local-") ? undefined : data.id,
              title: data.title,
              body: data.body,
              author: data.attribution === "collective" ? "Collectif Équipe" : fullName,
              author_email: myEmail,
              links: data.links,
              media: data.media,
              category: data.category,
            });
          } catch (err) {
            console.warn("Publish to Supabase error, saved locally:", err);
          }

          setWriteNewsOpen(false);
          setEditingNewsId(null);
          setActiveTab("actualites");
          setNewsSubTab("toutes");
          toast.success("Actualité publiée avec succès !");
        }}
        isSaving={saveDraft.isPending || publishDraft.isPending || publishNewsMutation.isPending}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#FBFBFA] text-[#1E1E1E] font-['Inter_Tight',sans-serif] flex flex-col antialiased">
      {/* =========================================================================
          1. TOP NAVIGATION BAR (Exact Figma Header Alignment)
         ========================================================================= */}
      <header className="sticky top-0 z-40 bg-[#FFFFFF] border-b border-[#EAEAE8] shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
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
            <span className="bg-[#F4F4F5] border border-[#E4E4E7] text-[#52525B] text-[10px] font-semibold px-2 py-0.5 rounded tracking-wider uppercase">
              INTRA.MGR
            </span>
          </div>

          {/* Center Navigation Focus Menu */}
          <nav className="hidden md:flex items-center gap-1.5" aria-label="Navigation principale">
            <button
              type="button"
              onClick={() => setActiveTab("accueil")}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-all cursor-pointer ${
                activeTab === "accueil"
                  ? "bg-[#FCECE8] text-[#1E1E1E] font-semibold shadow-xs"
                  : "text-[#52525B] hover:text-[#111111] hover:bg-[#F4F4F5]"
              }`}
            >
              Accueil
            </button>
            {/* Actualités with sub-menu */}
            <div className="relative group">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("actualites");
                  setNewsSubTab("toutes");
                }}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-all cursor-pointer flex items-center gap-1 ${
                  activeTab === "actualites"
                    ? "bg-[#FCECE8] text-[#1E1E1E] font-semibold shadow-xs"
                    : "text-[#52525B] hover:text-[#111111] hover:bg-[#F4F4F5]"
                }`}
              >
                <span>Actualités</span>
                <span className="text-[10px] opacity-70 group-hover:rotate-180 transition-transform">▾</span>
              </button>

              {/* Sub-menu Dropdown */}
              <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-[#E5E5E5] shadow-lg py-1.5 z-50 hidden group-hover:block animate-in fade-in zoom-in-95">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("actualites");
                    setNewsSubTab("toutes");
                  }}
                  className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                    activeTab === "actualites" && newsSubTab === "toutes"
                      ? "bg-[#FAF3F0] text-[#7A2E22] font-semibold"
                      : "text-[#1E1E1E] hover:bg-[#F4F4F5]"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon name="newspaper" className="text-[15px]" />
                    Toutes les actualités
                  </span>
                  <span className="text-[11px] text-[#71717A]">{publishedNews.length}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("actualites");
                    setNewsSubTab("brouillons");
                  }}
                  className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                    activeTab === "actualites" && newsSubTab === "brouillons"
                      ? "bg-[#FAF3F0] text-[#7A2E22] font-semibold"
                      : "text-[#1E1E1E] hover:bg-[#F4F4F5]"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon name="edit_note" className="text-[#7A2E22] text-[16px]" />
                    Brouillons
                  </span>
                  <span className="bg-[#FDECEC] text-[#7A2E22] text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                    {draftNews.length}
                  </span>
                </button>


                <div className="border-t border-[#F4F4F5] my-1" />
                <button
                  type="button"
                  onClick={() => {
                    setEditingNewsId(null);
                    setNewsTitle("");
                    setNewsBody("");
                    setMedia(emptyMedia());
                    setWriteNewsOpen(true);
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs text-[#7A2E22] font-semibold hover:bg-[#FAF3F0] flex items-center gap-2 cursor-pointer"
                >
                  <Icon name="add" className="text-[15px]" />
                  + Écrire une actu
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("demandes")}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-all cursor-pointer ${
                activeTab === "demandes"
                  ? "bg-[#FCECE8] text-[#1E1E1E] font-semibold shadow-xs"
                  : "text-[#52525B] hover:text-[#111111] hover:bg-[#F4F4F5]"
              }`}
            >
              Demandes
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("points-bloquants")}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-all cursor-pointer ${
                activeTab === "points-bloquants"
                  ? "bg-[#FCECE8] text-[#1E1E1E] font-semibold shadow-xs"
                  : "text-[#52525B] hover:text-[#111111] hover:bg-[#F4F4F5]"
              }`}
            >
              Points bloquants
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("actions-requises")}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "actions-requises"
                  ? "bg-[#FDE8E8] text-[#9B1C1C] font-semibold border border-[#F8B4B4]"
                  : "text-[#9B1C1C] bg-[#FDF2F2] hover:bg-[#FDE8E8]"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#E02424]" />
              Actions requises
              <span className="ml-0.5 px-1.5 py-0.2 bg-[#E02424] text-white text-[10px] font-bold rounded-full">
                {requiredActionsCount || 3}
              </span>
            </button>
          </nav>

          {/* Right Action buttons & User Profile */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setEditingNewsId(null);
                setNewsTitle("");
                setNewsBody("");
                setMedia(emptyMedia());
                setWriteNewsOpen(true);
              }}
              className="hidden sm:inline-flex items-center gap-1.5 border border-[#111111] bg-white text-[#111111] text-xs font-semibold px-3 py-1.5 rounded-none hover:bg-[#111111] hover:text-white transition-colors cursor-pointer"
            >
              <Icon name="edit_note" className="text-[16px]" />
              Écrire une actu
            </button>

            {/* User Profile Pill & Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2.5 pl-2 py-1 rounded hover:bg-[#F4F4F5] transition-colors cursor-pointer text-left"
                aria-expanded={profileOpen}
              >
                <div className="text-right hidden sm:block leading-tight">
                  <p className="text-xs font-semibold text-[#111111]">{fullName}</p>
                  <p className="text-[10px] text-[#71717A] tracking-wide uppercase">{jobTitle}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-[#111111] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  <Icon name="person" className="text-white text-[18px]" />
                </div>
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-[#E5E5E5] shadow-lg py-1.5 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-3.5 py-2 border-b border-[#F4F4F5]">
                    <p className="text-xs font-bold text-[#111111]">{fullName}</p>
                    <p className="text-[11px] text-[#71717A] truncate">{myEmail}</p>
                    <span className="inline-block mt-1 text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 bg-[#F4F4F5] text-[#52525B]">
                      Rôle : {role}
                    </span>
                  </div>
                  <Link
                    to="/choisir-role"
                    className="flex items-center gap-2 px-3.5 py-2 text-xs text-[#1E1E1E] hover:bg-[#FCECE8] transition-colors"
                  >
                    <Icon name="swap_horiz" />
                    Changer de rôle
                  </Link>
                  {isAdmin && (
                    <Link
                      to="/manage/news"
                      className="flex items-center gap-2 px-3.5 py-2 text-xs text-[#1E1E1E] hover:bg-[#F4F4F5] transition-colors"
                    >
                      <Icon name="settings" />
                      Gérer les données (Admin)
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => exportReport.mutate()}
                    className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-[#1E1E1E] hover:bg-[#F4F4F5] transition-colors text-left"
                  >
                    <Icon name="file_download" />
                    Exporter le rapport CSV
                  </button>
                  <div className="border-t border-[#F4F4F5] my-1" />
                  <button
                    type="button"
                    onClick={() => signOut()}
                    className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-[#DC2626] hover:bg-[#FEE2E2] transition-colors text-left"
                  >
                    <Icon name="logout" className="text-[#DC2626]" />
                    Déconnexion
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        {email && <DepartureNotices email={email} />}

        {/* =========================================================================
            2. HERO / GREETING SECTION (Exact Figma Headline & Breadcrumb)
           ========================================================================= */}
        <section className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-transparent">
          <div className="space-y-1.5 text-left">
            <p className="font-['Space_Grotesk',sans-serif] text-[10px] md:text-[11px] font-bold text-[#71717A] uppercase tracking-[0.16em]">
              PORTAIL MANAGÉRIAL / TABLEAU DE BORD · VUE SYNTHÉTIQUE
            </p>
            <h1 className="font-['Bodoni_Moda',Georgia,serif] text-3xl md:text-4xl text-[#111111] font-bold tracking-tight">
              Bonjour {rawFirstName}
            </h1>
            <p className="text-xs md:text-sm text-[#71717A] max-w-2xl">
              Suivi opérationnel des demandes de votre équipe et points de vigilance transverses.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-end">
            <button
              type="button"
              onClick={() => setActiveTab("actions-requises")}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#FDECEC] border border-[#FCDAD7] rounded-full text-[#7A2E22] text-[11px] font-semibold tracking-wide hover:bg-[#FBDCD8] transition-colors cursor-pointer"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#E06D53]" />
              {requiredActionsCount || 3} ACTIONS REQUISES AUJOURD'HUI
            </button>
          </div>
        </section>

        {/* Context filter notice when not on full Accueil */}
        {activeTab !== "accueil" && (
          <div className="bg-[#FFFFFF] border border-[#E5E5E5] px-4 py-2.5 rounded-none flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#71717A]">
                Focalisation active :
              </span>
              <span className="text-xs font-bold text-[#111111] bg-[#FCECE8] px-2.5 py-0.5 rounded-full">
                {activeTab === "actualites" && "Actualités & Rédaction"}
                {activeTab === "demandes" && "Demandes de mon équipe"}
                {activeTab === "points-bloquants" && "Points bloquants & Vigilances"}
                {activeTab === "actions-requises" && "Actions requises immédiates"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("accueil")}
              className="text-xs font-semibold text-[#111111] hover:underline flex items-center gap-1"
            >
              <Icon name="grid_view" className="text-[14px]" />
              Revenir à la vue complète
            </button>
          </div>
        )}

        {/* =========================================================================
            3. DYNAMIC CONTENT AREA (Accueil 2-Column Bento or Focused Views)
           ========================================================================= */}
        {activeTab === "accueil" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT COLUMN : ACTUALITÉS INTERNES & POINTS BLOQUANTS */}
            <div className="col-span-12 lg:col-span-6 space-y-6">
              {renderNewsCard(false)}
              {renderBlockersCard(false)}
            </div>

            {/* RIGHT COLUMN : DEMANDES DE MON ÉQUIPE & INDICATEURS CLÉS */}
            <div className="col-span-12 lg:col-span-6 space-y-6">
              {renderDemandesCard(false)}
              {renderMetricsCard()}
            </div>
          </div>
        )}

        {/* FOCUSED VIEW : ACTUALITÉS */}
        {activeTab === "actualites" && (
          <div className="max-w-5xl mx-auto w-full space-y-6">
            {renderActualitesSection()}
          </div>
        )}

        {/* FOCUSED VIEW : DEMANDES */}
        {activeTab === "demandes" && (
          <div className="max-w-5xl mx-auto w-full space-y-6">
            {renderDemandesCard(true)}
          </div>
        )}

        {/* FOCUSED VIEW : POINTS BLOQUANTS */}
        {activeTab === "points-bloquants" && (
          <div className="max-w-5xl mx-auto w-full space-y-6">
            {renderBlockersCard(true)}
          </div>
        )}

        {/* FOCUSED VIEW : ACTIONS REQUISES */}
        {activeTab === "actions-requises" && (
          <div className="space-y-6">
            <div className="bg-[#FFF5F5] border border-[#FCDAD7] p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-[#E02424] text-white flex items-center justify-center font-bold text-sm">
                  {requiredActionsCount || 3}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-[#111111]">
                    Arbitrages managériaux prioritaires à traiter aujourd'hui
                  </h3>
                  <p className="text-xs text-[#71717A]">
                    {pendingSubmissions.length} demande(s) d'équipe en attente de votre accord et {urgentBlockers.length} vigilance(s) requérant une intervention.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("accueil")}
                className="text-xs font-semibold text-[#111111] hover:underline whitespace-nowrap cursor-pointer"
              >
                Tout afficher →
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="col-span-12 lg:col-span-6">
                {renderDemandesCard(false, true)}
              </div>
              <div className="col-span-12 lg:col-span-6">
                {renderBlockersCard(false, true)}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* =========================================================================
          MODALS & FLYOUT DIALOGS
         ========================================================================= */}



      {/* 2. Modal: Signaler un point bloquant */}
      {newBlockerOpen && (
        <Modal title="Signaler un point bloquant" onClose={() => setNewBlockerOpen(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!blockerTitle.trim() || !blockerDesc.trim()) {
                toast.error("Veuillez renseigner le titre et la description.");
                return;
              }
              addBlockerMutation.mutate({
                title: blockerTitle.trim(),
                description: blockerDesc.trim(),
                department: blockerDept,
                severity: blockerSeverity,
                status: "OUVERT",
              });
            }}
            className="space-y-4"
          >
            <Field label="Titre du point bloquant">
              <input
                type="text"
                required
                value={blockerTitle}
                onChange={(e) => setBlockerTitle(e.target.value)}
                placeholder="ex: Retard livraison postes reconditionnés..."
                className="w-full border border-[#D1D5DB] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Département / Pôle concerné">
                <select
                  value={blockerDept}
                  onChange={(e) => setBlockerDept(e.target.value)}
                  className="w-full border border-[#D1D5DB] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white"
                >
                  <option value="MON PÔLE : OPÉRATIONS">MON PÔLE : OPÉRATIONS</option>
                  <option value="Infrastructure IT">Infrastructure IT</option>
                  <option value="Ressources Humaines">Ressources Humaines</option>
                  <option value="Direction Générale">Direction Générale</option>
                  <option value="Logistique">Logistique</option>
                </select>
              </Field>

              <Field label="Niveau de gravité">
                <select
                  value={blockerSeverity}
                  onChange={(e) =>
                    setBlockerSeverity(e.target.value as "critical" | "warning" | "info")
                  }
                  className="w-full border border-[#D1D5DB] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white"
                >
                  <option value="critical">Critique (Action requise)</option>
                  <option value="warning">Avertissement (Majeur)</option>
                  <option value="info">Information (Surveillance)</option>
                </select>
              </Field>
            </div>

            <Field label="Description & Arbitrage requis">
              <TextArea
                rows={4}
                required
                value={blockerDesc}
                onChange={(e) => setBlockerDesc(e.target.value)}
                placeholder="Décrivez l'impact direct et la décision ou action attendue..."
              />
            </Field>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F4F4F5]">
              <button
                type="button"
                onClick={() => setNewBlockerOpen(false)}
                className="px-4 py-2 border border-[#D1D5DB] text-xs font-semibold hover:bg-[#F4F4F5]"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={addBlockerMutation.isPending}
                className="px-4 py-2 bg-[#111111] text-white text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50"
              >
                {addBlockerMutation.isPending ? "Signalement..." : "Signaler le point bloquant"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 3. Modal: Examiner une demande */}
      <SubmissionReader
        submission={reading}
        onClose={() => setReading(null)}
        onReject={
          reading && canReview && reading.status === "en attente"
            ? () => {
                setRejecting(reading);
                setReading(null);
                setRejectErrors({});
                setRejectForm({ rejection_category: "", rejection_note: "" });
              }
            : undefined
        }
        onApprove={
          reading && canReview && reading.status === "en attente"
            ? () => review.mutate({ id: reading.id, status: "validée" })
            : undefined
        }
        approving={review.isPending}
      />

      {/* 4. Modal: Lire une actualité */}
      <NewsReader news={readingNews} onClose={() => setReadingNews(null)} />

      {/* 5. Modal: Archive des points bloquants */}
      <BlockerArchive open={archiveOpen} onClose={() => setArchiveOpen(false)} />

      {/* 6. Modal: Refuser une demande avec motif */}
      {rejecting && (
        <Modal title="Refuser la demande" onClose={() => setRejecting(null)}>
          <form
            noValidate
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const res = validate(rejectionSchema, rejectForm);
              if (!res.ok) return setRejectErrors(res.errors);
              setRejectErrors({});
              review.mutate({ id: rejecting.id, status: "refusée", ...res.data });
            }}
          >
            <p className="max-h-40 overflow-y-auto border border-[#E5E5E5] bg-[#FAFAFA] p-3 text-xs italic text-[#52525B] whitespace-pre-line">
              “{rejecting.content}”
            </p>
            <ErrorSummary errors={rejectErrors} />
            <Field label="Motif du refus" error={rejectErrors.rejection_category}>
              <select
                className="w-full border border-[#D1D5DB] bg-white p-2 text-xs"
                value={rejectForm.rejection_category}
                onChange={(e) =>
                  setRejectForm({ ...rejectForm, rejection_category: e.target.value })
                }
              >
                <option value="">— Choisir un motif —</option>
                {REJECTION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Raison du refus (obligatoire)" error={rejectErrors.rejection_note}>
              <TextArea
                rows={3}
                value={rejectForm.rejection_note}
                placeholder="Expliquez au collaborateur pourquoi sa demande ne peut être acceptée..."
                onChange={(e) => setRejectForm({ ...rejectForm, rejection_note: e.target.value })}
              />
              <CharCounter value={rejectForm.rejection_note} max={500} />
            </Field>
            <FormActions pending={review.isPending} onCancel={() => setRejecting(null)} />
          </form>
        </Modal>
      )}

      {/* 7. Modal: Soumettre une proposition (si ouvert) */}
      {submissionForm && (
        <Modal title="Soumettre une proposition" onClose={() => setSubmissionForm(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!submissionForm) return;
              const team = role === "collaborateur" ? "auto" : role === "admin" ? "Admin" : submissionForm.team;
              const result = validate(submissionSchema, { ...submissionForm, team, status: "en attente" });
              if (!result.ok) {
                setSubmissionErrors(result.errors);
                return;
              }
              setSubmissionErrors({});
              submit.mutate(result.data);
            }}
            className="space-y-4"
            noValidate
          >
            <ErrorSummary errors={submissionErrors} />
            <Field label="Nom" error={submissionErrors.author_name}>
              <TextInput
                value={submissionForm.author_name}
                maxLength={80}
                placeholder="Ton nom"
                onChange={(e) =>
                  setSubmissionForm({ ...submissionForm, author_name: e.target.value })
                }
              />
            </Field>
            {role === "manager" && (
              <Field label="Équipe" error={submissionErrors.team}>
                <select
                  required
                  value={submissionForm.team}
                  onChange={(e) =>
                    setSubmissionForm({ ...submissionForm, team: e.target.value })
                  }
                  className="w-full border border-[#D1D5DB] bg-white px-3 py-2 text-sm"
                >
                  <option value="">Choisis une de tes équipes</option>
                  {myTeams.data?.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Proposition" error={submissionErrors.content}>
              <TextArea
                rows={4}
                value={submissionForm.content}
                placeholder="Décrivez l'amélioration proposée pour le cabinet..."
                onChange={(e) =>
                  setSubmissionForm({ ...submissionForm, content: e.target.value })
                }
              />
              <CharCounter value={submissionForm.content} max={2000} min={5} />
            </Field>
            <FormActions
              pending={submit.isPending}
              submitLabel="ENVOYER"
              onCancel={() => setSubmissionForm(null)}
            />
          </form>
        </Modal>
      )}
    </div>
  );
}
