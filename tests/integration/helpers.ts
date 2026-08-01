import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/database.types";
import { DEMO_PASSWORD } from "../../lib/demo-accounts";

export function anonClient() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export async function signInAs(email: string) {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
  if (error) throw error;
  return client;
}
