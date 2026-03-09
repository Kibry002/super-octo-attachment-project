
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.4/+esm';

const SUPABASE_URL = 'https://ngtshjsoaufwpnekaxyy.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndHNoanNvYXVmd3BuZWtheHl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5Mzc3NTYsImV4cCI6MjA2OTUxMzc1Nn0.bDmxKvRGe5iMMQhMqvfS8JX04lMsrsadKj-zJy1UtOc'; 

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default supabase;

