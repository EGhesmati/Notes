const LEVELS = [
  { fraction: 1, title: "Summit" },
  { fraction: 0.75, title: "High Ridge" },
  { fraction: 0.5, title: "Snow Line" },
  { fraction: 0.25, title: "Cliff Path" },
];

export function ascentLevel(height: number, totalPoints: number): { title: string } {
  const fraction = totalPoints > 0 ? height / totalPoints : 0;
  return LEVELS.find((level) => fraction >= level.fraction) ?? { title: "Lighthouse" };
}

export function stepsToNextCheckpoint(height: number, totalPoints: number): number {
  return Math.max(0, Math.ceil(Math.max(0, totalPoints - height)));
}
