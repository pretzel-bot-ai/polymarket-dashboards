// Data fetching is handled directly in src/app/api/data/route.ts via Polymarket public APIs.
// This file is kept as a placeholder.

export function autoCategorize(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('openai') || t.includes('claude') || t.includes('deepseek') || t.includes('gpt')) return 'AI & Tech';
  if (t.includes('bitcoin') || t.includes('btc') || t.includes('crypto') || t.includes('solana')) return 'Crypto & Finance';
  if (t.includes('election') || t.includes('president') || t.includes('nomination')) return 'Politics';
  if (t.includes('nba') || t.includes('nfl') || t.includes('championship') || t.includes('super bowl')) return 'Sports';
  return 'Other';
}
