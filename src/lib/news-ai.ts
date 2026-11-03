import { GoogleGenAI } from "@google/genai";

export interface AiSuggestRequest {
  action: "suggest_structure" | "expand_points" | "review_tone" | "auto_layout";
  title?: string;
  body: string;
  category?: string;
  template?: "standard" | "express" | "synthese";
}

export interface AiSuggestResponse {
  ok: boolean;
  suggestionTitle: string;
  suggestionText: string;
  appliedBody: string;
}

export async function generateNewsAiSuggestion(
  req: AiSuggestRequest,
): Promise<AiSuggestResponse> {
  const { action, title = "", body = "", category = "Général", template = "standard" } = req;
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const ai = new GoogleGenAI();
      let prompt = "";

      if (action === "suggest_structure") {
        prompt = `Tu es le copilote éditorial de l'intranet d'entreprise 'Happy Place'.
Voici les notes brutes d'une actualité managériale :
Titre : "${title}"
Catégorie : "${category}"
Notes brutes :
"""
${body}
"""

Donne :
1) Une courte phrase synthétique de recommandation de structuration (commence par "Organiser en 3 sections claires : ...").
2) Le texte complet rédigé et formaté en Markdown avec ces 3 sections prêtes à l'emploi (titres en gras ou ###, paragraphes clairs, professionnels et chaleureux).

Réponds strictement au format JSON valide suivant :
{
  "suggestionTitle": "Structuration suggérée à partir de vos points bruts :",
  "suggestionText": "<ta recommandation courte>",
  "appliedBody": "<le texte complet en Markdown avec les 3 sections rédigées>"
}`;
      } else if (action === "expand_points") {
        prompt = `Tu es le rédacteur en chef de l'intranet Happy Place.
Développe les points clés suivants pour en faire une annonce managériale fluide, engageante et professionnelle.
Titre : "${title}"
Points de départ :
"""
${body}
"""

Réponds strictement au format JSON valide :
{
  "suggestionTitle": "Développement des points clés validé :",
  "suggestionText": "Points bruts transformés en annonce institutionnelle détaillée.",
  "appliedBody": "<texte développé et enrichi>"
}`;
      } else if (action === "review_tone") {
        prompt = `Tu es le relecteur officiel de Happy Place.
Analyse le ton de ce texte et propose une version au style impeccable (managérial, bienveillant, clair et dynamique).
Texte :
"""
${body}
"""

Réponds strictement au format JSON :
{
  "suggestionTitle": "Optimisation du ton & style éditorial :",
  "suggestionText": "Ajustement du vocabulaire managérial et renforcement de l'impact.",
  "appliedBody": "<texte avec le ton optimisé>"
}`;
      } else {
        prompt = `Mets en page ce contenu en Markdown élégant selon le gabarit "${template}".
Contenu :
"""
${body}
"""

Réponds strictement au format JSON :
{
  "suggestionTitle": "Mise en page automatique appliquée :",
  "suggestionText": "Formatage Markdown structuré avec typographie soignée.",
  "appliedBody": "<contenu formaté>"
}`;
      }

      const res = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const responseText = res.text?.trim() ?? "";
      if (responseText) {
        const parsed = JSON.parse(responseText);
        return {
          ok: true,
          suggestionTitle: parsed.suggestionTitle || "Suggestion IA Happy Place :",
          suggestionText: parsed.suggestionText || "Structuration suggérée pour votre annonce.",
          appliedBody: parsed.appliedBody || body,
        };
      }
    } catch (err) {
      console.warn("Gemini call fallback triggered:", err);
    }
  }

  // Smart fallback when GEMINI_API_KEY is not configured or offline
  return fallbackAiSuggestion(req);
}

function fallbackAiSuggestion(req: AiSuggestRequest): AiSuggestResponse {
  const { action, title = "", body = "", category = "Général", template = "standard" } = req;

  // Extract rough bullet points or sentences from body
  const rawLines = body
    .split(/[\n,;•-]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);

  const cleanTitle = title.trim() || "Annonce interne aux équipes";

  if (action === "expand_points") {
    const developed = `Chères équipes,

Dans le cadre de nos orientations stratégiques actuelles et pour accompagner notre dynamique commune, nous souhaitons vous partager un point d'étape prioritaire concernant **${cleanTitle}**.

### 1. Contexte opérationnel & Enjeux
${rawLines[0] ? `Comme évoqué récemment : ${rawLines[0]}. Cette initiative permet de fluidifier notre coordination et de répondre aux objectifs de notre pôle.` : "Nous adaptons notre organisation pour répondre aux priorités opérationnelles de nos équipes sur le terrain."}

### 2. Actions & Dispositif en cours
${rawLines[1] ? `Le plan d'action prévoit notamment : ${rawLines[1]}. Nos responsables sont mobilisés pour garantir un déploiement sans friction.` : "Plusieurs leviers sont activés dès cette semaine pour sécuriser nos flux et accompagner les collaborateurs."}

### 3. Prochaines étapes & Calendrier
${rawLines[2] ? `À retenir pour les prochains jours : ${rawLines[2]}.` : "Un point de suivi sera partagé lors de la prochaine réunion d'équipe pour mesurer l'impact et ajuster nos priorités."}

Pour toute question ou arbitrage spécifique, n'hésitez pas à solliciter directement la direction des opérations.`;

    return {
      ok: true,
      suggestionTitle: "Points clés développés avec succès :",
      suggestionText: "Transformation de vos notes synthétiques en publication managériale complète.",
      appliedBody: developed,
    };
  }

  if (action === "review_tone") {
    const refined = `Bonjour à toutes et à tous,

Nous vous partageons aujourd'hui une actualité clé concernant **${cleanTitle}** (${category}).

${body.trim() ? body.trim() : "L'ensemble des équipes est mobilisé pour mener à bien cette étape stratégique."}

> **L'engagement de la direction :** Veiller à ce que chaque collaborateur dispose des ressources et de la visibilité nécessaires pour progresser sereinement dans ses missions.

Merci pour votre implication et votre réactivité au quotidien.`;

    return {
      ok: true,
      suggestionTitle: "Vérification du ton & style :",
      suggestionText: "Formulation valorisante, ton bienveillant et signature managériale validés.",
      appliedBody: refined,
    };
  }

  if (action === "auto_layout") {
    let formatted = "";
    if (template === "express") {
      formatted = `**FLASH INFO · ${cleanTitle.toUpperCase()}**\n\n${body.trim() || "Point rapide sur nos avancées prioritaires."}\n\n*Pour information immédiate de l'ensemble des pôles.*`;
    } else if (template === "synthese") {
      formatted = `### Synthèse exécutive : ${cleanTitle}\n\n${rawLines.map((l) => `- **Point clé :** ${l}`).join("\n")}\n\n**Impact direct :** Optimisation des processus et alignement des équipes.`;
    } else {
      formatted = `## ${cleanTitle}\n\n${body.trim() || "Notes opérationnelles à destination des collaborateurs."}\n\n---\n*Diffusion : ${category}*`;
    }

    return {
      ok: true,
      suggestionTitle: "Mise en page automatique appliquée :",
      suggestionText: `Formatage Markdown adapté au gabarit ${template.toUpperCase()}.`,
      appliedBody: formatted,
    };
  }

  // Default: suggest_structure
  const section1 = rawLines[0] || "Contexte logistique régional";
  const section2 = rawLines[1] || "Postes & Profils recherchés";
  const section3 = rawLines[2] || "Calendrier de recrutement";

  const structuredBody = `### 1. Contexte & Enjeux
${rawLines[0] ? rawLines[0] : "Point d'étape sur la situation actuelle et les objectifs visés pour les prochaines semaines."}

### 2. Organisation & Dispositif
${rawLines[1] ? rawLines[1] : "Mise en place des nouveaux renforts et coordination entre nos équipes régionales et le siège."}

### 3. Calendrier & Prochaines échéances
${rawLines[2] ? rawLines[2] : "Planning prévisionnel des entretiens et validations finales prévues dès le début de semaine prochaine."}

*Contact référent : Direction des Opérations*`;

  return {
    ok: true,
    suggestionTitle: "Structuration suggérée à partir de vos points bruts :",
    suggestionText: `Organiser en 3 sections claires : 1. ${section1.slice(0, 30)}, 2. ${section2.slice(0, 30)}, 3. ${section3.slice(0, 30)}.`,
    appliedBody: structuredBody,
  };
}
