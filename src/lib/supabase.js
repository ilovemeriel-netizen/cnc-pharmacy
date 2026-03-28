import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ukzjhiweqezhrtqzpjkf.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrempoaXdlcWV6aHJ0cXpwamtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMzI1MDYsImV4cCI6MjA4OTkwODUwNn0.4ZZdxCkUDwghatETgn355tA9tTawI7FqO5fuj68yOtA'
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)