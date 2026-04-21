import { config } from 'dotenv'
import '@testing-library/jest-dom/vitest'

config({ path: '.env.local' })

// Fail fast if integration test env missing — but allow unit tests to run
export function getAdminEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key)
    throw new Error(
      'Integration tests require NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local'
    )
  return { url, key }
}
