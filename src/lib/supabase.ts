import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mqjnsvglvrpdmtgzmidl.supabase.co';

const supabaseKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xam5zdmdsdnJwZG10Z3ptaWRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2Mjc4MDksImV4cCI6MjA5ODIwMzgwOX0.O0nmU9w62Epdw9hTN1GRov8iuoujXbnvBX-EAMZ2jXc';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseKey
);

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);