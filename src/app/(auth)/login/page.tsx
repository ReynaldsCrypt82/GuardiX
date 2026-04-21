import { LoginForm } from './login-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next: rawNext } = await searchParams
  // Sanitize next at page level — reject protocol-relative (//evil.com) and URLs
  // containing a colon (https: / javascript:) before passing to the form
  const next =
    rawNext &&
    rawNext.startsWith('/') &&
    !rawNext.startsWith('//') &&
    !rawNext.includes(':')
      ? rawNext
      : undefined
  return <LoginForm next={next} />
}
