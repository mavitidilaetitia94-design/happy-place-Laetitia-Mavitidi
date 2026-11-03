import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import sharkLogo from "@/assets/bigger-boat-shark.png";
import {
  fetchNews,
  fetchSubmissions,
  fetchBlockers,
  fetchMetrics,
  reviewSubmission,
  getLocalSubmissionReviews,
  timeAgo,
  type News,
  type Submission,
  type Blocker,
  type Metric,
} from "@/lib/dashboard";
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Inbox,
  Plus,
  Shield,
  Activity,
  UserCheck,
  Lock,
  ChevronRight,
  Check,
  X,
  FileSpreadsheet,
} from "lucide-react";

export function AdminDashboard({ onOpenWriteNews }: { onOpenWriteNews: () => void }) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>("tableau-de-bord");

  const newsQuery = useQuery({ queryKey: ["news"], queryFn: fetchNews, retry: false });
  const submissionsQuery = useQuery({ queryKey: ["submissions"], queryFn: fetchSubmissions, retry: false });
  const blockersQuery = useQuery({ queryKey: ["blockers"], queryFn: fetchBlockers, retry: false });
  const metricsQuery = useQuery({ queryKey: ["metrics"], queryFn: fetchMetrics, retry: false });

  const reviewMutation = useMutation({
    mutationFn: reviewSubmission,
    onSuccess: (_d, vars) => {
      toast.success(vars.status === "validée" ? "Demande validée avec succès" : "Demande refusée avec succès");
      qc.invalidateQueries({ queryKey: ["submissions"] });
    },
    onError: (e: Error) => toast.error(`Erreur : ${e.message}`),
  });

  const newsList = newsQuery.data ?? [];
  const submissionsList = submissionsQuery.data ?? [];
  const blockersList = blockersQuery.data ?? [];
  const metricsList = metricsQuery.data ?? [];

  const reviews = getLocalSubmissionReviews();
  const rawAdminSubmissions = submissionsList.length > 0
    ? submissionsList.map((s) => ({
        id: s.id,
        badge: "DEMANDE",
        meta: `Dépôt le ${timeAgo(s.created_at)}`,
        title: s.content.slice(0, 60),
        desc: `${s.author_name} (${s.team}) · ${s.content}`,
        status: s.status,
      }))
    : [
        {
          id: "demo-1",
          badge: "OUTILLAGE",
          meta: "Dépôt le 24 Mai 2024 · 09:15 · Réf. #ADM-883",
          title: "Licence logicielle Recruteur Premium",
          desc: "Pôle Recrutement IT · Dérogation annuelle demandée par T. Vance. Extension budget non provisionné pour le sourcing Grands Comptes.",
          status: "en attente",
        },
        {
          id: "demo-2",
          badge: "ACCÈS SYSTÈME",
          meta: "Dépôt le 23 Mai 2024 · 16:40 · Réf. #ADM-880",
          title: "Ouverture accès base candidatures externes",
          desc: "Direction Commerciale · Accord de confidentialité signé requis pour intégration API ATS partenaire. Concerne 3 comptes consultants seniors.",
          status: "en attente",
        },
        {
          id: "demo-3",
          badge: "BUDGET RH",
          meta: "Dépôt le 22 Mai 2024 · 11:05 · Réf. #ADM-874",
          title: "Dérogation budget équipement ergonomique",
          desc: "Pôle Conseil · Préconisation médecine du travail pour aménagement station de travail double écran et siège adapté (dépassement plafond standard de 280 €).",
          status: "en attente",
        },
      ];

  const pendingAdminSubmissions = rawAdminSubmissions
    .map((s) => ({
      ...s,
      status: reviews[s.id]?.status ?? s.status,
    }))
    .filter((s) => s.status === "en attente");

  const publishedNewsCount = newsList.filter((n) => n.status === "publiée").length;
  const pendingSubmissionsCount = pendingAdminSubmissions.length;
  const validatedCount = 19; // From mockup
  const openBlockersCount = blockersList.filter((b) => b.status !== "RÉSOLU").length || 2;

  return (
    <div className="min-h-screen bg-[#FBFBFA] text-[#1E1E1E] font-['Inter',sans-serif] flex flex-col antialiased">
      {/* =========================================================================
          1. TOP NAVIGATION BAR (Exact Mockup Alignment)
         ========================================================================= */}
      <header className="sticky top-0 z-40 bg-[#FFFFFF] border-b border-[#EAEAE8] shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4">
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
              INTRA.COLAB
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-1.5" aria-label="Navigation principale">
            {[
              { id: "accueil", label: "Accueil", to: "/" },
              { id: "tableau-de-bord", label: "Tableau de bord", to: "/" },
              { id: "actualites", label: "Actualités", to: "/manage/news" },
              { id: "demandes", label: "Demandes", to: "/manage/submissions" },
              { id: "points-bloquants", label: "Points bloquants", to: "/manage/blockers" },
              { id: "utilisateurs", label: "Utilisateurs et accès", to: "/manage/users" },
            ].map((tab) => {
              const isActive = tab.id === "tableau-de-bord";
              return (
                <Link
                  key={tab.id}
                  to={tab.to}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    isActive
                      ? "bg-[#FCE7F3] border border-[#FBCFE8] text-[#9D174D] font-semibold shadow-sm"
                      : "text-[#52525B] hover:text-[#111111] hover:bg-[#F4F4F5]"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/choisir-role"
              className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A] hover:text-[#111111] transition-colors"
            >
              Changer de rôle
            </Link>
            <div className="flex items-center gap-2.5 pl-3 border-l border-[#E4E4E7]">
              <div className="text-right">
                <p className="text-xs font-semibold text-[#111111]">O. Laurent</p>
                <p className="text-[10px] text-[#71717A]">Administration Système</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-[#111111] text-[#FFFFFF] flex items-center justify-center text-xs font-bold shadow-sm">
                OL
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* =========================================================================
          2. MAIN CONTENT AREA
         ========================================================================= */}
      <main className="max-w-[1440px] mx-auto w-full px-4 md:px-8 py-6 space-y-6 flex-1">
        {/* Top Banner & Status */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#EAEAE8] pb-5">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A]">
              Espace administration globale
            </p>
            <h1 className="font-['Bodoni_Moda',Georgia,serif] text-2xl md:text-3xl font-bold text-[#111111]">
              Tableau de bord administrateur
            </h1>
            <p className="text-xs text-[#52525B]">
              Supervision générale du cabinet, validation des accès et arbitrages de niveau direction.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-[#FFFFFF] border border-[#E4E4E7] px-3.5 py-2 rounded-lg shadow-xs">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
            <div className="text-xs">
              <span className="font-semibold text-[#111111]">Système opérationnel</span>
              <span className="text-[#71717A]"> · Synchronisation active</span>
              <p className="text-[10px] text-[#71717A]">Dernière session : Aujourd'hui à 08:42 (Auth SSO M365)</p>
            </div>
          </div>
        </div>

        {/* =========================================================================
            3. 4 KPI CARDS
           ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1 */}
          <div className="bg-[#FFFFFF] border border-[#E4E4E7] p-4 rounded-xl shadow-xs space-y-2 relative overflow-hidden group">
            <div className="flex items-center justify-between text-[#71717A]">
              <span className="text-xs font-medium uppercase tracking-wider">Actualités publiées (7 jours)</span>
              <FileText className="w-4 h-4 text-[#71717A]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[#111111]">{publishedNewsCount || 6}</span>
            </div>
            <p className="text-[11px] text-[#71717A] pt-1 border-t border-[#F4F4F5]">
              Mis à jour aujourd'hui à 08:30
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-[#FFFFFF] border border-[#E4E4E7] p-4 rounded-xl shadow-xs space-y-2 relative overflow-hidden group">
            <div className="flex items-center justify-between text-[#71717A]">
              <span className="text-xs font-medium uppercase tracking-wider">Demandes en cours</span>
              <Inbox className="w-4 h-4 text-[#71717A]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[#111111]">{pendingSubmissionsCount || 4}</span>
              <span className="bg-[#FCE7F3] text-[#9D174D] text-[10px] font-semibold px-2 py-0.5 rounded">
                Direction requise
              </span>
            </div>
            <p className="text-[11px] text-[#71717A] pt-1 border-t border-[#F4F4F5]">
              Mis à jour il y a 15 min
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-[#FFFFFF] border border-[#E4E4E7] p-4 rounded-xl shadow-xs space-y-2 relative overflow-hidden group">
            <div className="flex items-center justify-between text-[#71717A]">
              <span className="text-xs font-medium uppercase tracking-wider">Demandes validées</span>
              <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[#111111]">{validatedCount}</span>
            </div>
            <p className="text-[11px] text-[#71717A] pt-1 border-t border-[#F4F4F5]">
              Mis à jour hier à 18:45
            </p>
          </div>

          {/* Card 4 */}
          <div className="bg-[#FFFFFF] border border-[#E4E4E7] p-4 rounded-xl shadow-xs space-y-2 relative overflow-hidden group">
            <div className="flex items-center justify-between text-[#71717A]">
              <span className="text-xs font-medium uppercase tracking-wider">Points bloquants ouverts</span>
              <AlertCircle className="w-4 h-4 text-[#EF4444]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[#111111]">{openBlockersCount}</span>
              <span className="bg-[#FEF2F2] text-[#991B1B] text-[10px] font-semibold px-2 py-0.5 rounded">
                Niveau 1 & 2
              </span>
            </div>
            <p className="text-[11px] text-[#71717A] pt-1 border-t border-[#F4F4F5]">
              Mis à jour aujourd'hui à 09:10
            </p>
          </div>
        </div>

        {/* =========================================================================
            4. TWO-COLUMN SECTION (Demandes à traiter & Utilisateurs / Activité)
           ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Demandes à traiter & Indicateurs clés */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#FFFFFF] border border-[#E4E4E7] rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#EAEAE8] pb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-[#111111]">Demandes à traiter</h2>
                  <span className="bg-[#FCE7F3] text-[#9D174D] text-[10px] font-semibold px-2 py-0.5 rounded">
                    {pendingSubmissionsCount || 4} en attente direction
                  </span>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#71717A] bg-[#F4F4F5] px-2 py-1 rounded">
                  Arbitrage N+2 requis
                </span>
              </div>

              <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-3 rounded-lg text-xs text-[#475569] flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-[#3B82F6] shrink-0 mt-0.5" />
                <p>
                  Les demandes de vos équipes sont traitées par leur manager. Seules les demandes transversales ou requérant une dérogation direction apparaissent ici.
                </p>
              </div>

              <div className="space-y-3">
                {pendingAdminSubmissions.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#71717A] bg-[#FAFAFA] border border-dashed border-[#E4E4E7] rounded-lg">
                    Toutes les demandes ont été traitées !
                  </div>
                ) : (
                  pendingAdminSubmissions.slice(0, 3).map((sub) => (
                  <div
                    key={sub.id}
                    className="border border-[#E4E4E7] bg-[#FFFFFF] p-4 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-[#CBD5E1] transition-colors"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="bg-[#F4F4F5] text-[#52525B] text-[10px] font-bold px-2 py-0.5 rounded tracking-wider">
                          {sub.badge}
                        </span>
                        <span className="text-[11px] text-[#71717A]">{sub.meta}</span>
                      </div>
                      <h3 className="text-sm font-bold text-[#111111]">{sub.title}</h3>
                      <p className="text-xs text-[#52525B] leading-relaxed">{sub.desc}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => reviewMutation.mutate({ id: sub.id, status: "validée" })}
                        className="px-4 py-1.5 bg-[#111111] text-[#FFFFFF] text-xs font-semibold rounded hover:bg-[#27272A] transition-colors"
                      >
                        Valider
                      </button>
                      <button
                        onClick={() => {
                          const reason = prompt("Motif du refus :");
                          if (reason) {
                            reviewMutation.mutate({
                              id: sub.id,
                              status: "refusée",
                              rejection_category: "autre",
                              rejection_note: reason,
                            });
                          }
                        }}
                        className="px-4 py-1.5 bg-[#E4E4E7] text-[#111111] text-xs font-semibold rounded hover:bg-[#D4D4D8] transition-colors"
                      >
                        Refuser
                      </button>
                    </div>
                  </div>
                ))
              )}
              </div>
            </div>

            {/* Indicateurs clés · Cabinet & Recrutement */}
            <div className="bg-[#FFFFFF] border border-[#E4E4E7] rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#EAEAE8] pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#111111]" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-[#111111]">
                    Indicateurs clés · Cabinet & Recrutement
                  </h2>
                </div>
                <span className="bg-[#F4F4F5] text-[#52525B] text-[10px] font-semibold px-2 py-0.5 tracking-wider uppercase border border-[#E4E4E7]">
                  HEBDO · S22
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-[#FAFAFA] border border-[#EEEEEE] p-3 space-y-1 rounded-lg">
                  <p className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider">
                    MANDATS EN COURS
                  </p>
                  <p className="text-xl font-bold text-[#111111] leading-none">
                    14 <span className="text-xs font-normal text-[#71717A]">postes</span>
                  </p>
                  <p className="text-[11px] text-[#71717A] flex items-center gap-1.5 pt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E06D53]" />
                    3 en phase finale
                  </p>
                </div>

                <div className="bg-[#FAFAFA] border border-[#EEEEEE] p-3 space-y-1 rounded-lg">
                  <p className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider">
                    TIME-TO-HIRE
                  </p>
                  <p className="text-xl font-bold text-[#111111] leading-none">
                    28 <span className="text-xs font-normal text-[#71717A]">jours</span>
                  </p>
                  <p className="text-[10px] pt-0.5">
                    <span className="bg-[#FDECEC] text-[#7A2E22] font-semibold px-1.5 py-0.5 rounded-xs">
                      -4j vs cible
                    </span>
                  </p>
                </div>

                <div className="bg-[#FAFAFA] border border-[#EEEEEE] p-3 space-y-1 rounded-lg">
                  <p className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider">
                    TAUX CONVERSION
                  </p>
                  <p className="text-xl font-bold text-[#111111] leading-none">
                    68% <span className="text-xs font-normal text-[#71717A]">acceptés</span>
                  </p>
                  <p className="text-[11px] text-[#71717A] pt-0.5">
                    Shortlists présentées
                  </p>
                </div>

                <div className="bg-[#FAFAFA] border border-[#EEEEEE] p-3 space-y-1 rounded-lg">
                  <p className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider">
                    EFFECTIF CABINET
                  </p>
                  <p className="text-xl font-bold text-[#111111] leading-none">
                    220 <span className="text-xs font-normal text-[#71717A]">collaborateurs</span>
                  </p>
                  <p className="text-[11px] text-[#71717A] pt-0.5">
                    48 actifs connectés
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Col: Utilisateurs & Activité globale */}
          <div className="space-y-6">
            {/* Utilisateurs & accès */}
            <div className="bg-[#FFFFFF] border border-[#E4E4E7] rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#EAEAE8] pb-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-[#111111]">Utilisateurs & accès</h2>
                <Link to="/manage/users" className="text-xs font-semibold text-[#2563EB] hover:underline">
                  Gérer l'annuaire
                </Link>
              </div>
              <p className="text-[11px] text-[#71717A]">
                Dernières attributions de rôles et modifications d'habilitations.
              </p>

              <div className="space-y-2.5">
                {[
                  { name: "Claire Valette", email: "c.valette@happyplace.example", role: "Admin", dept: "Pôle Systèmes & Réseaux" },
                  { name: "Marc Delorme", email: "m.delorme@happyplace.example", role: "Manager", dept: "Équipe Conseil & Strat" },
                  { name: "Inès Benali", email: "i.benali@happyplace.example", role: "Collaborateur", dept: "Pôle Recrutement IT" },
                ].map((u, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#111111]">{u.name}</span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-[#E2E8F0] text-[#334155]">
                          {u.role}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#71717A]">{u.email}</p>
                    </div>
                    <Link
                      to="/manage/users"
                      className="text-[10px] font-semibold px-2.5 py-1 bg-[#FFFFFF] border border-[#CBD5E1] text-[#334155] rounded hover:bg-[#F1F5F9]"
                    >
                      Modifier le rôle
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            {/* Activité globale & Indicateurs clés */}
            <div className="space-y-6">
              <div className="bg-[#FFFFFF] border border-[#E4E4E7] rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-[#EAEAE8] pb-3">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-[#111111]">Activité globale</h2>
                  <span className="text-[11px] text-[#71717A]">Cabinet 2024</span>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#52525B]">Utilisateurs actifs</span>
                      <span className="font-bold text-[#111111]">48/220</span>
                    </div>
                    <div className="w-full bg-[#E4E4E7] h-2 rounded-full overflow-hidden">
                      <div className="bg-[#111111] h-full w-[21.8%]"></div>
                    </div>
                    <p className="text-[10px] text-[#71717A]">Semaine 21 · 24 Mai (220 employés)</p>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
                    <div>
                      <p className="text-xs text-[#52525B]">Actus publiées</p>
                      <p className="text-lg font-bold text-[#111111]">14 ce mois</p>
                    </div>
                    <span className="text-xs font-semibold text-[#10B981]">+3 vs N-1</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
                    <div>
                      <p className="text-xs text-[#52525B]">Demandes traitées</p>
                      <p className="text-lg font-bold text-[#111111]">31</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-[#10B981]">100% clôturées SLA</p>
                      <p className="text-[10px] text-[#71717A]">Délai moyen : 1.4 j</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            5. SUIVI TRANSVERSE DU CABINET (Actus & Points bloquants)
           ========================================================================= */}
        <div className="bg-[#FFFFFF] border border-[#E4E4E7] rounded-xl p-6 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#EAEAE8] pb-4">
            <div>
              <h2 className="font-['Bodoni_Moda',Georgia,serif] text-xl font-bold text-[#111111]">
                Suivi transverse du cabinet
              </h2>
              <p className="text-xs text-[#52525B]">Flux éditorial interne et monitoring de la résolution des points d'achoppement.</p>
            </div>
            <Link
              to="/manage/news"
              className="px-3 py-1.5 bg-[#F4F4F5] border border-[#E4E4E7] text-[#111111] text-xs font-semibold rounded hover:bg-[#E4E4E7] self-start"
            >
              Vue consolidée
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left table: Actus publiées */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111]">Actus publiées</h3>
                  <span className="text-[10px] text-[#71717A] bg-[#F4F4F5] px-2 py-0.5 rounded">6 récentes</span>
                </div>
                <button
                  onClick={onOpenWriteNews}
                  className="px-3 py-1 bg-[#111111] text-[#FFFFFF] text-xs font-semibold rounded hover:bg-[#27272A] flex items-center gap-1 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Publier une actualité
                </button>
              </div>

              <div className="border border-[#E4E4E7] rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] border-b border-[#E4E4E7] text-[#71717A] uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="p-3">Titre de l'article</th>
                      <th className="p-3">Équipe</th>
                      <th className="p-3 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E4E7] text-[#111111]">
                    {(newsList.length > 0
                      ? newsList.slice(0, 4).map((n) => ({
                          id: n.id,
                          title: n.title,
                          category: n.category || "Direction",
                          date: timeAgo(n.created_at),
                        }))
                      : [
                          { id: "1", title: "Clôture annuelle du bilan RSE & inclusion", category: "Comité Dir.", date: "24 Mai 2024" },
                          { id: "2", title: "Nouveau guide d'onboarding Q3 disponible", category: "Ressources Humaines", date: "22 Mai 2024" },
                          { id: "3", title: "Sécurisation MFA & renouvellement certificats", category: "Systèmes IT", date: "19 Mai 2024" },
                          { id: "4", title: "Ouverture des candidatures pour le séminaire d'automne", category: "Communication", date: "17 Mai 2024" },
                        ]
                    ).map((n) => (
                      <tr key={n.id} className="hover:bg-[#F8FAFC]">
                        <td className="p-3 font-medium text-[#111111] truncate max-w-[220px]">{n.title}</td>
                        <td className="p-3">
                          <span className="bg-[#FCE7F3] text-[#9D174D] text-[10px] px-2 py-0.5 rounded font-medium">
                            {n.category}
                          </span>
                        </td>
                        <td className="p-3 text-right text-[#71717A]">{n.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right table: Points bloquants */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111]">Points bloquants</h3>
                  <span className="text-[10px] text-[#71717A]">Monitoring cabinet</span>
                </div>
                <span className="text-[11px] text-[#71717A] flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" /> Lecture seule
                </span>
              </div>

              <div className="border border-[#E4E4E7] rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] border-b border-[#E4E4E7] text-[#71717A] uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="p-3">Incident / Sujet</th>
                      <th className="p-3">Équipe</th>
                      <th className="p-3 text-right">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E4E7] text-[#111111]">
                    {[
                      { title: "Latence d'accès au VPN filiale Lyon", sub: "Ticket #INC-4102 · Impact 12 consultants", team: "Infra & Réseau", status: "OUVERT", statusColor: "bg-[#FEF2F2] text-[#991B1B]" },
                      { title: "Interruption connecteur bancaire note de frais", sub: "Ticket #INC-4098 · Patch éditeur en cours", team: "Finance / Compta", status: "EN COURS", statusColor: "bg-[#FEF3C7] text-[#92400E]" },
                      { title: "Synchronisation agendas Outlook / Salle Neptune", sub: "Ticket #INC-4089 · En observation post-redémarrage", team: "Services Généraux", status: "SURVEILLANCE", statusColor: "bg-[#F3F4F6] text-[#374151]" },
                      { title: "Export ATS vers ERP compta mensuel", sub: "Ticket #INC-4071 · Corrigé le 21 Mai", team: "Équipe IT Ops", status: "RÉSOLU", statusColor: "bg-[#ECFDF5] text-[#065F46]" },
                    ].map((b, i) => (
                      <tr key={i} className="hover:bg-[#F8FAFC]">
                        <td className="p-3">
                          <p className="font-medium text-[#111111]">{b.title}</p>
                          <p className="text-[10px] text-[#71717A]">{b.sub}</p>
                        </td>
                        <td className="p-3 text-[#52525B]">{b.team}</td>
                        <td className="p-3 text-right">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${b.statusColor}`}>
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-3 rounded-lg text-xs text-[#64748B] flex items-center justify-between">
            <span>Consultation en lecture seule · Résolution opérée par les équipes support et lead managers.</span>
            <Lock className="w-4 h-4 text-[#94A3B8]" />
          </div>
        </div>
      </main>

      {/* =========================================================================
          6. FOOTER
         ========================================================================= */}
      <footer className="bg-[#FFFFFF] border-t border-[#EAEAE8] py-4 px-4 md:px-8 mt-auto">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#71717A]">
          <span>INTRA.COLAB · Happy Place Architecture v2.4</span>
          <span>Supervision & Gouvernance interne</span>
        </div>
      </footer>
    </div>
  );
}
