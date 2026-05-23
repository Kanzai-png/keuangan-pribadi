import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://heuqbytnhgidaqzcxcry.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_mJ9SScZw_pAlPtJL67BjUw_U6k1knur';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
