import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execPromise = promisify(exec);
const POLY_BINARY = path.join(process.cwd(), '..', 'bin', 'polymarket');

export async function fetchPolyData(command: string, address: string) {
  try {
    const { stdout } = await execPromise(`${POLY_BINARY} -o json data ${command} ${address}`);
    return JSON.parse(stdout);
  } catch (error) {
    console.error(`Error fetching ${command}:`, error);
    return null;
  }
}

export function autoCategorize(title: string) {
  const t = title.toLowerCase();
  if (t.includes('ai') || t.includes('google') || t.includes('openai') || t.includes('claude') || t.includes('deepseek')) return 'AI & Tech';
  if (t.includes('insider trading') || t.includes('accused') || t.includes('nominate') || t.includes('fed')) return 'Regulatory & Finance';
  if (t.includes('win') || t.includes('election') || t.includes('nomination') || t.includes('president')) return 'Politics';
  if (t.includes('etf') || t.includes('bitcoin') || t.includes('crypto')) return 'Crypto';
  return 'Other';
}
