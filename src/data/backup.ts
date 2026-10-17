import { classicToPlan, looksClassic } from './classic';
import { normalizeData } from './normalize';
import { DATA_VERSION, type AppData } from './types';

export interface BackupSummary {
  plans: number;
  facts: number;
  checkIns: number;
  activePlanName: string;
}

export type ParsedBackup = { ok: true; data: AppData; summary: BackupSummary; fromClassic: boolean } | { ok: false; error: string };

export function summarize(data: AppData): BackupSummary {
  return {
    plans: data.plans.length,
    facts: data.facts.length + data.factLumps.length,
    checkIns: data.checkIns.length,
    activePlanName: data.plans.find((p) => p.id === data.activePlanId)?.name ?? data.plans[0].name,
  };
}

export function backupJson(data: AppData): string {
  return JSON.stringify({ ...data, exportedAt: new Date().toISOString(), app: 'Timbertop' }, null, 2);
}

export function backupFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `timbertop-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

/**
 * Reads a backup file from this app, or a settings block copied from the previous site's
 * "Back up or move settings" box. Nothing is changed until the caller applies the result.
 */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That is not a backup file. It should be the .json file this app saves, or the settings block from the previous version.' };
  }
  if (typeof raw === 'object' && raw !== null && 'version' in raw) {
    const version = (raw as { version: unknown }).version;
    if (typeof version === 'number' && version > DATA_VERSION) {
      return { ok: false, error: 'This backup was made by a newer version of the app. Open it there, or update this page first.' };
    }
    const data = normalizeData(raw);
    if (!data) return { ok: false, error: 'This backup is damaged or incomplete, so nothing was changed.' };
    return { ok: true, data, summary: summarize(data), fromClassic: false };
  }
  if (looksClassic(raw)) {
    const plan = classicToPlan(raw, 'Settings from the previous version', 0);
    const data: AppData = { version: DATA_VERSION, plans: [plan], activePlanId: plan.id, facts: [], factLumps: [], checkIns: [] };
    return { ok: true, data, summary: summarize(data), fromClassic: true };
  }
  return { ok: false, error: 'This file does not contain loan plans, so nothing was changed.' };
}
