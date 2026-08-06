import { cookies } from "next/headers";

export async function requireAdmin() {
  const cookieStore = await cookies();
  const adminToken = cookieStore.get("admin_token")?.value;

  if (process.env.ADMIN_TOKEN && adminToken !== process.env.ADMIN_TOKEN) {
    throw new Error("Unauthorized: Invalid admin token.");
  }
  
  if (!process.env.ADMIN_TOKEN) {
    if (process.env.NODE_ENV === 'production') {
       throw new Error("Unauthorized: ADMIN_TOKEN is not configured on the server.");
    } else {
       console.warn("ADMIN_TOKEN is not set in environment variables. Bypassing auth check for development.");
    }
  }
}
