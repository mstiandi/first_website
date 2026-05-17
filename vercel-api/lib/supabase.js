import { createClient } from '@supabase/supabase-js';

var supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default supabase;
