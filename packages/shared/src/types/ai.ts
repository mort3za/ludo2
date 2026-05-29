export type BotPersonality = "aggressor" | "defender" | "sprinter";

export const BOT_PERSONALITIES: readonly BotPersonality[] = ["aggressor", "defender", "sprinter"];

export const PERSONALITY_TITLES: Record<BotPersonality, string> = {
  aggressor: "Aggressor",
  defender: "Defender",
  sprinter: "Sprinter",
};
