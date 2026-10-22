
import { createClient } from "@supabase/supabase-js";
import {
  PUBLIC_SUPABASE_URL,
} from "$env/static/public";
import { SUPABASE_SECRET_KEY } from "$env/static/private";

export const supabase = createClient(
  PUBLIC_SUPABASE_URL,
  SUPABASE_SECRET_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
