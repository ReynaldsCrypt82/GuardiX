import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

const eslintConfig = [
  ...compat.extends('next/core-web-vitals'),
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/lib/supabase/admin', '@/lib/supabase/admin'],
              message:
                "admin client uses service_role. Import only from files with 'use server' or in src/app/api/. Never client-side.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/app/api/**/*', 'src/lib/actions/**/*'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
]

export default eslintConfig
