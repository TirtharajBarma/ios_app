import AsyncStorage from '@/utils/storage';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useExpenseStore } from '@/store/useExpenseStore';
import { createPendingTransactionFromText } from '@/utils/financialParser';
import { autoApproveTransaction, findMatchingExistingTransaction, resolvePendingAccount } from '@/services/expense/autoTrackService';
import { PendingTransaction } from '@/types/expense';

const GMAIL_SESSION_KEY = '@cashveil_gmail_session_v1';
const PROCESSED_IDS_KEY = '@cashveil_gmail_processed_ids_v1';

export interface GmailSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  userEmail: string;
  connectedAt: number;
}

export interface GmailSyncResult {
  success: boolean;
  syncedCount: number;
  error?: string;
}

/**
 * Stores the active Gmail OAuth session.
 */
export async function saveGmailSession(
  sessionData: GmailSession | string,
  userEmail?: string,
  refreshToken?: string,
  expiresAt?: number
): Promise<void> {
  let session: GmailSession;
  if (typeof sessionData === 'string') {
    session = {
      accessToken: sessionData,
      userEmail: userEmail || 'Bank Gmail',
      refreshToken,
      expiresAt,
      connectedAt: Date.now(),
    };
  } else {
    session = sessionData;
  }
  await AsyncStorage.setItem(GMAIL_SESSION_KEY, JSON.stringify(session));
}

/**
 * Retrieves the stored Gmail OAuth session.
 */
export async function getGmailSession(): Promise<GmailSession | null> {
  try {
    const raw = await AsyncStorage.getItem(GMAIL_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GmailSession;
  } catch {
    return null;
  }
}

/**
 * Disconnects Gmail account and clears stored tokens.
 */
export async function disconnectGmail(): Promise<void> {
  await AsyncStorage.removeItem(GMAIL_SESSION_KEY);
}

/**
 * Refreshes an expired Google access token using the stored refresh token.
 */
export async function refreshGmailAccessToken(session: GmailSession): Promise<string | null> {
  if (!session.refreshToken) return null;
  const clientId =
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    '';

  try {
    const bodyParams: Record<string, string> = {
      client_id: clientId,
      grant_type: 'refresh_token',
      refresh_token: session.refreshToken,
    };

    const formBody = Object.keys(bodyParams)
      .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(bodyParams[k]))
      .join('&');

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody,
    });

    if (!res.ok) {
      console.warn('[GmailSync] Token refresh HTTP status:', res.status);
      return null;
    }

    const data = await res.json();
    if (data.access_token) {
      const updated: GmailSession = {
        ...session,
        accessToken: data.access_token,
        expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      };
      await AsyncStorage.setItem(GMAIL_SESSION_KEY, JSON.stringify(updated));
      return data.access_token;
    }
  } catch (err) {
    console.warn('[GmailSync] Refresh request failed:', err);
  }
  return null;
}

/**
 * Fetches user profile email from Google API using access token.
 */
export async function fetchGoogleUserEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.email || null;
  } catch {
    return null;
  }
}

/**
 * Decodes Gmail's URL-safe base64 string to plain text.
 */
function decodeBase64Url(data: string): string {
  try {
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    if (typeof atob === 'function') {
      return decodeURIComponent(
        Array.prototype.map
          .call(atob(base64), (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
    }
  } catch {
    try {
      return atob(data.replace(/-/g, '+').replace(/_/g, '/'));
    } catch {
      return '';
    }
  }
  return '';
}

/**
 * Extracts plain text content from a Gmail API message payload.
 */
function extractMessageBody(payload: any): string {
  if (!payload) return '';
  let bodyText = '';

  if (payload.body?.data) {
    bodyText += decodeBase64Url(payload.body.data) + ' ';
  }

  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        bodyText += decodeBase64Url(part.body.data) + ' ';
      } else if (part.parts) {
        bodyText += extractMessageBody(part) + ' ';
      }
    }
  }

  return bodyText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Queries Gmail for recent bank transaction alerts and logs or stages them.
 */
export async function syncGmailTransactions(): Promise<GmailSyncResult> {
  let session = await getGmailSession();
  if (!session || !session.accessToken) {
    return { success: false, syncedCount: 0, error: 'Gmail is not connected' };
  }

  // Pre-emptively refresh access token if within 2 minutes of expiration
  if (session.refreshToken && session.expiresAt && Date.now() > session.expiresAt - 120000) {
    const refreshed = await refreshGmailAccessToken(session);
    if (refreshed) {
      session = (await getGmailSession()) || session;
    }
  }

  const { autoTrackAutoApprove, autoTrackDefaultAccountId, addPendingTransaction } =
    useSettingsStore.getState();
  const { accounts } = useExpenseStore.getState();

  try {
    // 1. Load previously processed message IDs to prevent duplicate work
    const rawProcessed = await AsyncStorage.getItem(PROCESSED_IDS_KEY);
    const processedIds: Set<string> = new Set(rawProcessed ? JSON.parse(rawProcessed) : []);

    // 2. Search Gmail for bank transaction keywords
    const query = encodeURIComponent('debited OR spent OR credited OR "transaction alert" OR "paid to"');
    const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=20`;

    let listRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });

    if (listRes.status === 401 && session.refreshToken) {
      const refreshed = await refreshGmailAccessToken(session);
      if (refreshed) {
        session.accessToken = refreshed;
        listRes = await fetch(searchUrl, {
          headers: { Authorization: `Bearer ${refreshed}` },
        });
      }
    }

    if (listRes.status === 401) {
      await disconnectGmail();
      return { success: false, syncedCount: 0, error: 'Session expired. Please reconnect Gmail.' };
    }

    if (!listRes.ok) {
      let detail = '';
      try {
        const errJson = await listRes.json();
        detail = errJson?.error?.message || '';
      } catch {}
      return {
        success: false,
        syncedCount: 0,
        error: detail
          ? `Gmail API error (${listRes.status}): ${detail}`
          : `Gmail API error (${listRes.status})`,
      };
    }

    const listData = await listRes.json();
    const messages = listData.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return { success: true, syncedCount: 0 };
    }

    let syncedCount = 0;

    // 3. Process each message
    for (const msg of messages) {
      if (!msg.id || processedIds.has(msg.id)) continue;

      try {
        const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`;
        const msgRes = await fetch(msgUrl, {
          headers: { Authorization: `Bearer ${session.accessToken}` },
        });

        if (!msgRes.ok) continue;

        const msgData = await msgRes.json();
        const snippet = msgData.snippet || '';
        const body = extractMessageBody(msgData.payload);
        const fullContent = `${snippet} ${body}`.trim();

        // Extract sender and date headers
        const headers: Array<{ name: string; value: string }> = msgData.payload?.headers || [];
        const fromHeader = headers.find((h) => h.name.toLowerCase() === 'from')?.value || 'Bank Email';
        const dateHeader = headers.find((h) => h.name.toLowerCase() === 'date')?.value;
        const receivedTimestamp = dateHeader ? new Date(dateHeader).getTime() : Number(msgData.internalDate) || Date.now();

        // Parse with local financial parser
        const pendingTx = createPendingTransactionFromText(
          fullContent,
          fromHeader,
          'email',
          receivedTimestamp
        );

        if (pendingTx) {
          const expenseState = useExpenseStore.getState();
          // Check if user already manually entered this or if a split/debt covers it
          const existingMatch = findMatchingExistingTransaction(pendingTx, expenseState.transactions);
          if (existingMatch) {
            console.log(`[GmailSync] Skipped duplicate of existing transaction ${existingMatch.id}`);
            processedIds.add(msg.id);
            continue;
          }

          if (autoTrackAutoApprove) {
            // Intelligently detects account from email content without forcing a single default account
            await autoApproveTransaction(pendingTx, null);
          } else {
            // Pre-resolve suggested account from email text so review screen shows the exact card/bank
            const matchedAcc = resolvePendingAccount(pendingTx, null, expenseState.accounts);
            pendingTx.suggestedAccountId = matchedAcc?.id;
            await addPendingTransaction(pendingTx);
          }
          syncedCount++;
        }

        // Mark this message ID as processed
        processedIds.add(msg.id);
      } catch (err) {
        console.warn(`[GmailSync] Error parsing message ${msg.id}:`, err);
      }
    }

    // 4. Save updated processed message IDs (capped at 500)
    const trimmedIds = Array.from(processedIds).slice(-500);
    await AsyncStorage.setItem(PROCESSED_IDS_KEY, JSON.stringify(trimmedIds));

    return { success: true, syncedCount };
  } catch (err: any) {
    console.error('[GmailSync] Sync error:', err);
    return { success: false, syncedCount: 0, error: err?.message || 'Sync failed' };
  }
}
