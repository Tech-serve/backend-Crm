export const DEPARTMENTS = [
  "Gambling",
  "Search",
  "Admin",
  "Sweeps",
  "Vitehi",
  "Tech",
] as const;
export type Department = typeof DEPARTMENTS[number];

export const POSITIONS = {
  Sweeps: ["Head", "TeamLead", "Buyer", "Designer"],
  Search: ["Head", "TeamLead", "Buyer", "Designer"],
  Gambling: ["Head", "TeamLead", "Buyer", "Designer"],
  Admin: ["Accountant", "Administrator"],
  Vitehi: [],
  Tech: ["CTO", "Translator", "Frontend"], // ← ДОБАВЛЕНО
} as const;

export type Position = typeof POSITIONS[keyof typeof POSITIONS][number];

export function isValidPosition(department?: Department, position?: string) {
  if (!position) return true;
  if (!department) return true;
  const allowed = (POSITIONS as any)[department] as string[];
  return Array.isArray(allowed) ? allowed.includes(position) : false;
}