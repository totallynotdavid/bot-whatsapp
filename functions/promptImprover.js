// Enhancement categories - keeping English only for final output
const ENHANCEMENT_CATEGORIES = {
  QUALITY: "quality",
  LIGHTING: "lighting",
  STYLE: "style",
  SHOT: "shot",
};

// Spanish command mappings and English enhancements
const LANGUAGES = {
  // Spanish commands and their translations
  commands: {
    mejorar: "improve",
    calidad: "quality",
    luz: "lighting",
    estilo: "style",
    toma: "shot",
  },
  // English-only enhancements for final output
  enhancements: {
    quality: [
      "high definition",
      "high resolution",
      "fine detail",
      "sharp",
      "crystal clear",
    ],
    lighting: [
      "well lit",
      "soft lighting",
      "dramatic lighting",
      "natural light",
      "balanced contrast",
    ],
    style: [
      "photographic style",
      "cinematic style",
      "artistic style",
      "realistic style",
      "professional style",
    ],
    shot: [
      "close-up",
      "medium shot",
      "full shot",
      "front angle",
      "detailed view",
    ],
  },
};

class SmartPromptImprover {
  constructor() {
    this.usedEnhancements = new Map();
  }

  /**
   * Gets a random enhancement avoiding recent usage
   */
  getRandomEnhancement(category) {
    const enhancements = LANGUAGES.enhancements[category];
    const recentlyUsed = this.usedEnhancements.get(category) || new Set();

    const availableEnhancements = enhancements.filter(
      (e) => !recentlyUsed.has(e)
    );
    if (availableEnhancements.length === 0) {
      recentlyUsed.clear();
      return enhancements[Math.floor(Math.random() * enhancements.length)];
    }

    const selected =
      availableEnhancements[
        Math.floor(Math.random() * availableEnhancements.length)
      ];
    recentlyUsed.add(selected);
    if (recentlyUsed.size > 3) {
      recentlyUsed.delete([...recentlyUsed][0]);
    }
    this.usedEnhancements.set(category, recentlyUsed);

    return selected;
  }

  /**
   * Parse Spanish commands and return English options
   */
  parseCommand(command) {
    // Match Spanish command variants
    const improveRegex = /--mejorar=(true|false)/i;
    const categoriesRegex = /--(?:calidad|luz|estilo|toma)/g;

    const improveMatch = command.match(improveRegex);
    const categoriesMatches = command.match(categoriesRegex);

    const options = {
      enhance: improveMatch ? improveMatch[1].toLowerCase() === "true" : true,
      categories: categoriesMatches
        ? categoriesMatches.map((cat) => {
            const spanishCategory = cat.replace("--", "");
            return (
              Object.keys(ENHANCEMENT_CATEGORIES).find(
                (key) =>
                  LANGUAGES.commands[spanishCategory] === key.toLowerCase()
              ) || LANGUAGES.commands[spanishCategory]
            );
          })
        : Object.values(ENHANCEMENT_CATEGORIES),
    };

    // Clean command by removing option flags
    const cleanCommand = command
      .replace(improveRegex, "")
      .replace(categoriesRegex, "")
      .trim();

    return { options, cleanCommand };
  }

  /**
   * Analyzes translated English prompt to avoid redundancy
   */
  analyzePrompt(translatedPrompt) {
    const lowerPrompt = translatedPrompt.toLowerCase();

    return Object.keys(LANGUAGES.enhancements).reduce((analysis, category) => {
      analysis[category] = !LANGUAGES.enhancements[category].some((desc) =>
        lowerPrompt.includes(desc.toLowerCase())
      );
      return analysis;
    }, {});
  }

  /**
   * Improves the translated English prompt
   */
  improvePrompt(translatedPrompt, options = {}) {
    const {
      enhance = true,
      categories = Object.values(ENHANCEMENT_CATEGORIES),
    } = options;

    if (!enhance) return translatedPrompt;

    const analysis = this.analyzePrompt(translatedPrompt);
    const enhancements = [];

    categories.forEach((category) => {
      if (analysis[category.toLowerCase()] && categories.includes(category)) {
        enhancements.push(this.getRandomEnhancement(category.toLowerCase()));
      }
    });

    if (enhancements.length === 0) return translatedPrompt;
    return `${translatedPrompt}, in ${enhancements.join(", ")}`;
  }
}

module.exports = {
  SmartPromptImprover,
};
