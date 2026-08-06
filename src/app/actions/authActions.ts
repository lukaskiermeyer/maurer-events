"use server";

import { db } from "@/db";
import { adminAuth, adminSessions } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { Resend } from "resend";

import { randomInt } from "crypto";

const resend = new Resend(process.env.RESEND_API_KEY || "dummy_key");
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;

// Hilfsfunktion: 6-stelligen Code generieren
function generateOtp() {
  return randomInt(100000, 1000000).toString();
}

export async function requestOtp(email: string) {
  // 1. Whitelist-Prüfung
  const adminEmails = process.env.ADMIN_EMAILS?.split(",").map(e => e.trim().toLowerCase()) || [];
  const normalizedEmail = email.toLowerCase().trim();

  if (!adminEmails.includes(normalizedEmail)) {
    // Fake Success um Enumeration zu verhindern
    return { success: true };
  }

  // 2. Code generieren und in DB speichern
  const otpCode = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 Minuten

  await db.insert(adminAuth).values({
    email: normalizedEmail,
    otpCode,
    expiresAt,
  });

  // 3. E-Mail versenden
  if (process.env.RESEND_API_KEY) {
    try {
      await resend.emails.send({
        from: "Maurer Events Admin <servus@maurer-events.com>",
        to: [normalizedEmail],
        subject: `Dein Admin Login-Code: ${otpCode}`,
        html: `<p>Dein einmaliger Login-Code lautet: <strong>${otpCode}</strong></p><p>Dieser Code ist 10 Minuten lang gültig.</p>`,
      });
    } catch (error) {
      console.error("Failed to send OTP email", error);
      return { success: false, error: "Fehler beim E-Mail-Versand." };
    }
  } else {
    // Fallback für lokale Entwicklung, wenn kein Resend Key vorhanden ist
    console.log(`[DEV MODE] OTP for ${normalizedEmail}: ${otpCode}`);
  }

  return { success: true };
}

export async function verifyOtp(email: string, code: string, turnstileToken: string) {
  const normalizedEmail = email.toLowerCase().trim();

  // 1. Turnstile verifizieren
  if (process.env.NODE_ENV === 'production' && !TURNSTILE_SECRET_KEY) {
    return { success: false, error: "Spam-Schutz ist nicht konfiguriert." };
  }

  if (TURNSTILE_SECRET_KEY) {
    if (!turnstileToken) {
       return { success: false, error: "Bitte bestätige, dass du kein Roboter bist." };
    }
    const verifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
    const verifyData = new URLSearchParams();
    verifyData.append('secret', TURNSTILE_SECRET_KEY);
    verifyData.append('response', turnstileToken);

    try {
      const turnstileResponse = await fetch(verifyUrl, { method: 'POST', body: verifyData });
      const turnstileOutcome = await turnstileResponse.json();
      if (!turnstileOutcome.success) {
        return { success: false, error: "Spam-Schutz fehlgeschlagen." };
      }
    } catch (error) {
      return { success: false, error: "Verbindungsfehler beim Spam-Schutz." };
    }
  }

  // 2. OTP in der Datenbank prüfen
  const [authRecord] = await db.select()
    .from(adminAuth)
    .where(
      and(
        eq(adminAuth.email, normalizedEmail),
        eq(adminAuth.otpCode, code),
        gt(adminAuth.expiresAt, new Date()) // Muss noch gültig sein
      )
    );

  if (!authRecord) {
    return { success: false, error: "Ungültiger oder abgelaufener Code." };
  }

  // 3. Code sofort löschen (Single Use)
  await db.delete(adminAuth).where(eq(adminAuth.id, authRecord.id));

  // 4. Session erstellen (gültig für 7 Tage)
  const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const [session] = await db.insert(adminSessions).values({
    email: normalizedEmail,
    validUntil,
  }).returning();

  // 5. HttpOnly Cookie setzen
  const cookieStore = await cookies();
  cookieStore.set("admin_token", session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    expires: validUntil,
    path: "/",
  });

  return { success: true };
}


export async function bypassLoginForStaging() {
  if (process.env.NODE_ENV === "production") {
    return { success: false, error: "Bypass in production not allowed." };
  }

  const stagingEmail = "staging-admin@maurer-events.com";
  const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 Tage gültig

  // Session in der Datenbank anlegen
  const [session] = await db.insert(adminSessions).values({
    email: stagingEmail,
    validUntil,
  }).returning();

  // Sicheres HttpOnly Cookie setzen
  const cookieStore = await cookies();
  cookieStore.set("admin_token", session.id, {
    httpOnly: true,
    secure: false, // Für lokale Staging-Umgebungen ohne HTTPS
    sameSite: "strict",
    expires: validUntil,
    path: "/",
  });

  return { success: true };
}

export async function logout() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  
  if (token) {
    // Session aus Datenbank löschen
    await db.delete(adminSessions).where(eq(adminSessions.id, token));
  }
  
  // Cookie löschen
  cookieStore.delete("admin_token");
  return { success: true };
}
