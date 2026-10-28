'use client';

/**
 * RATBV Cashier Portal - Next.js App Router Page
 * File: src/app/cashier/page.tsx
 *
 * Dedicated Cashier Portal page for RATBV ticket desk personnel to scan
 * and validate passenger QR codes for 3 free trips.
 *
 * Requirements satisfied:
 * 1. Clean, touch-optimized kiosk layout for phones & tablets
 * 2. Method A: Camera viewfinder using html5-qrcode
 * 3. Method B: Large manual input fallback with search button
 * 4. Supabase validation against 'responses' table on 'qr_code_id':
 *    - Scenario 1 (Invalid): RED screen "❌ COD INVALID sau inexistent!"
 *    - Scenario 2 (Already redeemed): YELLOW screen "⚠️ ATENȚIE: Cod deja folosit..."
 *    - Scenario 3 (Pending): Update to REDEEMED + NOW() and GREEN screen "✅ VALID! DĂ 3 BILETE" + phone number
 * 5. Automatic 4-second reset back to scan mode
 */

import { CashierPortal } from '@/src/components/CashierPortal';

export default function CashierPage() {
  return <CashierPortal />;
}
