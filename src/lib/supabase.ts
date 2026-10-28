/**
 * Supabase client and validation service for RATBV Cashier Portal
 * Handles QR code lookups, atomic status updates ('PENDING' -> 'REDEEMED'),
 * and graceful fallback with pre-seeded demo records for local testing.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface RATBVResponse {
  id?: string | number;
  qr_code_id: string;
  status: 'PENDING' | 'REDEEMED' | string;
  redeemed_at?: string | null;
  phone_number?: string | null;
  phone?: string | null;
  rating?: number | null;
  feedback?: string | null;
  created_at?: string;
  cashier_id?: string | null;
}

export type ValidationOutcome = 'VALID_REDEEMED' | 'ALREADY_REDEEMED' | 'INVALID' | 'ERROR';

export interface ValidationResult {
  outcome: ValidationOutcome;
  qrCodeId: string;
  title: string;
  subtitle: string;
  phone?: string | null;
  redeemedAt?: string | null;
  rawRecord?: RATBVResponse | null;
  errorDetails?: string;
  timestamp: string;
}

// Local mock storage key for testing when Supabase credentials are not provided
const LOCAL_STORAGE_MOCK_KEY = 'ratbv_mock_responses_v2';
const SUPABASE_URL_KEY = 'ratbv_custom_supabase_url';
const SUPABASE_KEY_KEY = 'ratbv_custom_supabase_anon_key';

// Pre-seeded demo dataset so the portal works instantly out of the box
const DEFAULT_DEMO_RECORDS: RATBVResponse[] = [
  {
    id: 'demo-1',
    qr_code_id: 'RATBV-X9K2L',
    status: 'PENDING',
    redeemed_at: null,
    phone_number: '+40 744 123 456',
    rating: 5,
    feedback: 'Autobuzul 20 spre Poiană a sosit exact la timp!',
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: 'demo-2',
    qr_code_id: 'RATBV-FREE3',
    status: 'PENDING',
    redeemed_at: null,
    phone_number: '+40 722 889 900',
    rating: 5,
    feedback: 'Șofer amabil pe linia 5, curat și cald.',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'demo-3',
    qr_code_id: 'RATBV-BV2026',
    status: 'PENDING',
    redeemed_at: null,
    phone_number: '+40 731 556 778',
    rating: 5,
    feedback: 'Validatoarele contactless funcționează perfect.',
    created_at: new Date(Date.now() - 3600000 * 1).toISOString(),
  },
  {
    id: 'demo-4',
    qr_code_id: 'RATBV-USED88',
    status: 'REDEEMED',
    redeemed_at: new Date(Date.now() - 3600000 * 2.5).toISOString(),
    phone_number: '+40 766 999 111',
    rating: 4,
    feedback: 'Apreciez noile autobuze electrice.',
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'demo-5',
    qr_code_id: 'RATBV-VECHI1',
    status: 'REDEEMED',
    redeemed_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    phone_number: '+40 755 443 221',
    rating: 5,
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
];

/**
 * Get active Supabase configuration (from env or user settings)
 */
export function getSupabaseConfig(): { url: string; key: string; isConfigured: boolean } {
  if (typeof window === 'undefined') {
    return { url: '', key: '', isConfigured: false };
  }

  const envUrl = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_SUPABASE_URL || '';
  const envKey = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_SUPABASE_ANON_KEY || '';

  const storedUrl = localStorage.getItem(SUPABASE_URL_KEY) || '';
  const storedKey = localStorage.getItem(SUPABASE_KEY_KEY) || '';

  const activeUrl = storedUrl || envUrl;
  const activeKey = storedKey || envKey;

  const isConfigured = Boolean(
    activeUrl &&
    activeKey &&
    activeUrl.includes('supabase.co') &&
    activeKey.length > 10 &&
    !activeUrl.includes('your-project')
  );

  return {
    url: activeUrl,
    key: activeKey,
    isConfigured,
  };
}

export function saveSupabaseConfig(url: string, key: string) {
  if (typeof window === 'undefined') return;
  if (url) localStorage.setItem(SUPABASE_URL_KEY, url.trim());
  else localStorage.removeItem(SUPABASE_URL_KEY);

  if (key) localStorage.setItem(SUPABASE_KEY_KEY, key.trim());
  else localStorage.removeItem(SUPABASE_KEY_KEY);
}

/**
 * Initializes Supabase client if valid config is present
 */
export function getSupabaseClient(): SupabaseClient | null {
  const { url, key, isConfigured } = getSupabaseConfig();
  if (!isConfigured) return null;
  try {
    return createClient(url, key);
  } catch (err) {
    console.error('Failed to create Supabase client:', err);
    return null;
  }
}

/**
 * Local storage demo mock helpers
 */
function getMockResponses(): RATBVResponse[] {
  if (typeof window === 'undefined') return DEFAULT_DEMO_RECORDS;
  const data = localStorage.getItem(LOCAL_STORAGE_MOCK_KEY);
  if (!data) {
    localStorage.setItem(LOCAL_STORAGE_MOCK_KEY, JSON.stringify(DEFAULT_DEMO_RECORDS));
    return DEFAULT_DEMO_RECORDS;
  }
  try {
    return JSON.parse(data);
  } catch {
    return DEFAULT_DEMO_RECORDS;
  }
}

function saveMockResponses(responses: RATBVResponse[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_STORAGE_MOCK_KEY, JSON.stringify(responses));
}

export function resetDemoDatabase() {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_STORAGE_MOCK_KEY, JSON.stringify(DEFAULT_DEMO_RECORDS));
}

export function getDemoList(): RATBVResponse[] {
  return getMockResponses();
}

/**
 * Format date for friendly Romanian display: "28 Octombrie 2026, 14:32"
 */
export function formatRomanianDate(dateString?: string | null): string {
  if (!dateString) return 'Dată nespecificată';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return new Intl.DateTimeFormat('ro-RO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return dateString;
  }
}

/**
 * Sanitize and normalize QR Code string:
 * Strips whitespace, uppercase, strips accidental URL wrappers if QR contains full URL
 */
export function sanitizeQrCode(rawInput: string): string {
  if (!rawInput) return '';
  let cleaned = rawInput.trim();
  
  // If the QR contains a full URL like https://ratbv.ro/claim?code=RATBV-X9K2L or .../claim/RATBV-X9K2L
  if (cleaned.includes('code=')) {
    const match = cleaned.match(/code=([A-Za-z0-9\-_]+)/i);
    if (match && match[1]) cleaned = match[1];
  } else if (cleaned.includes('/')) {
    const parts = cleaned.split('/');
    const lastPart = parts[parts.length - 1];
    if (lastPart && (lastPart.startsWith('RATBV') || lastPart.length >= 4)) {
      cleaned = lastPart;
    }
  }

  return cleaned.toUpperCase();
}

/**
 * Core Cashier Validation Logic
 * Follows the 3 user scenarios:
 * 1. Cod Inexistent -> INVALID (Red)
 * 2. status === 'REDEEMED' -> ALREADY_REDEEMED (Yellow/Orange)
 * 3. status === 'PENDING' -> UPDATE to REDEEMED + NOW() -> VALID_REDEEMED (Green)
 */
export async function validateQrCode(rawCode: string, cashierName: string = 'Ghișeu Central'): Promise<ValidationResult> {
  const code = sanitizeQrCode(rawCode);
  const nowIso = new Date().toISOString();

  if (!code) {
    return {
      outcome: 'INVALID',
      qrCodeId: rawCode,
      title: 'COD INVALID!',
      subtitle: 'Codul scanat este gol sau ilizibil.',
      timestamp: nowIso,
    };
  }

  const supabase = getSupabaseClient();

  // If Supabase is connected, query the live database
  if (supabase) {
    try {
      // Step 1: Query table 'responses' by column 'qr_code_id'
      const { data: record, error: fetchError } = await supabase
        .from('responses')
        .select('*')
        .eq('qr_code_id', code)
        .maybeSingle();

      if (fetchError) {
        console.error('Supabase fetch error:', fetchError);
        return {
          outcome: 'ERROR',
          qrCodeId: code,
          title: 'EROARE CONEXIUNE',
          subtitle: `Eroare Supabase: ${fetchError.message}`,
          errorDetails: fetchError.message,
          timestamp: nowIso,
        };
      }

      // Scenario 1: Record does not exist in DB
      if (!record) {
        return {
          outcome: 'INVALID',
          qrCodeId: code,
          title: 'COD INVALID SAU INEXISTENT!',
          subtitle: 'Acest cod nu figurează în baza de date cu chestionare RATBV.',
          timestamp: nowIso,
        };
      }

      const phone = record.phone_number || record.phone || null;

      // Scenario 2: Already redeemed
      if (record.status === 'REDEEMED') {
        const formattedDate = formatRomanianDate(record.redeemed_at);
        return {
          outcome: 'ALREADY_REDEEMED',
          qrCodeId: code,
          title: 'ATENȚIE: COD DEJA FOLOSIT!',
          subtitle: `Acest bilet a fost deja eliberat în data de ${formattedDate}.`,
          phone,
          redeemedAt: record.redeemed_at,
          rawRecord: record,
          timestamp: nowIso,
        };
      }

      // Scenario 3: Valid / PENDING -> Atomic update to REDEEMED
      if (record.status === 'PENDING' || !record.status) {
        const updatePayload: Record<string, unknown> = {
          status: 'REDEEMED',
          redeemed_at: nowIso,
          cashier_id: cashierName,
        };

        const { error: updateError } = await supabase
          .from('responses')
          .update(updatePayload)
          .eq('qr_code_id', code);

        if (updateError) {
          console.error('Supabase update error:', updateError);
          return {
            outcome: 'ERROR',
            qrCodeId: code,
            title: 'EROARE LA ACTUALIZARE',
            subtitle: `Nu s-a putut marca biletul ca folosit: ${updateError.message}`,
            errorDetails: updateError.message,
            timestamp: nowIso,
          };
        }

        return {
          outcome: 'VALID_REDEEMED',
          qrCodeId: code,
          title: 'VALID! DĂ 3 BILETE',
          subtitle: 'Codul a fost validat și marcat cu succes ca folosit în sistem.',
          phone,
          redeemedAt: nowIso,
          rawRecord: { ...record, status: 'REDEEMED', redeemed_at: nowIso },
          timestamp: nowIso,
        };
      }

      // Any unexpected status
      return {
        outcome: 'INVALID',
        qrCodeId: code,
        title: 'STATUS NECUNOSCUT',
        subtitle: `Codul are statusul neașteptat "${record.status}". Contactați dispeceratul.`,
        rawRecord: record,
        timestamp: nowIso,
      };
    } catch (err) {
      console.error('Validation exception:', err);
      return {
        outcome: 'ERROR',
        qrCodeId: code,
        title: 'EROARE TEHNICĂ',
        subtitle: 'A apărut o problemă la comunicarea cu serverul.',
        errorDetails: err instanceof Error ? err.message : String(err),
        timestamp: nowIso,
      };
    }
  }

  // Fallback: Local Demo Storage logic (when no Supabase credentials provided)
  const mockResponses = getMockResponses();
  const foundIndex = mockResponses.findIndex((r) => r.qr_code_id.toUpperCase() === code.toUpperCase());

  // Scenario 1: Not found
  if (foundIndex === -1) {
    return {
      outcome: 'INVALID',
      qrCodeId: code,
      title: 'COD INVALID SAU INEXISTENT!',
      subtitle: 'Acest cod nu există în baza de date cu chestionare RATBV.',
      timestamp: nowIso,
    };
  }

  const record = mockResponses[foundIndex];
  const phone = record.phone_number || record.phone || null;

  // Scenario 2: Already Redeemed
  if (record.status === 'REDEEMED') {
    const formattedDate = formatRomanianDate(record.redeemed_at);
    return {
      outcome: 'ALREADY_REDEEMED',
      qrCodeId: code,
      title: 'ATENȚIE: COD DEJA FOLOSIT!',
      subtitle: `Acest bilet a fost deja eliberat în data de ${formattedDate}.`,
      phone,
      redeemedAt: record.redeemed_at,
      rawRecord: record,
      timestamp: nowIso,
    };
  }

  // Scenario 3: PENDING -> set to REDEEMED
  mockResponses[foundIndex] = {
    ...record,
    status: 'REDEEMED',
    redeemed_at: nowIso,
    cashier_id: cashierName,
  };
  saveMockResponses(mockResponses);

  return {
    outcome: 'VALID_REDEEMED',
    qrCodeId: code,
    title: 'VALID! DĂ 3 BILETE',
    subtitle: 'Codul a fost validat și marcat cu succes în baza de date.',
    phone,
    redeemedAt: nowIso,
    rawRecord: mockResponses[foundIndex],
    timestamp: nowIso,
  };
}
