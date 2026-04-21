import { NextResponse } from 'next/server'
import { validateCNPJ, stripCNPJ } from '@/lib/validations/cnpj'

// Next.js ISR cache — CDN caches the route response for 1 hour
export const revalidate = 3600

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ cnpj: string }> },
) {
  const { cnpj } = await ctx.params
  const digits = stripCNPJ(cnpj)

  // Validate CNPJ digit-verifier BEFORE hitting BrasilAPI
  if (!validateCNPJ(digits)) {
    return NextResponse.json({ error: 'CNPJ inválido' }, { status: 400 })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3000)

  try {
    const res = await fetch(
      `https://brasilapi.com.br/api/cnpj/v1/${digits}`,
      {
        signal: controller.signal,
        next: { revalidate: 3600 },
      },
    )
    clearTimeout(timeout)

    if (!res.ok) {
      return NextResponse.json(
        {
          error:
            'CNPJ não encontrado na Receita Federal. Preencha a razão social manualmente.',
        },
        { status: res.status },
      )
    }

    const data = await res.json()

    // Only echo whitelisted fields — never raw-pass BrasilAPI response (T-01-03-07)
    return NextResponse.json(
      {
        razao_social: data.razao_social ?? null,
        nome_fantasia: data.nome_fantasia ?? null,
        situacao_cadastral: data.descricao_situacao_cadastral ?? null,
      },
      {
        headers: {
          'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
        },
      },
    )
  } catch (err) {
    clearTimeout(timeout)
    const isTimeout =
      err instanceof Error &&
      (err.name === 'AbortError' || err.name === 'TimeoutError')
    const detail = isTimeout ? 'timeout' : String(err)

    return NextResponse.json(
      {
        error:
          'CNPJ não encontrado na Receita Federal. Preencha a razão social manualmente.',
        detail,
      },
      { status: 504 },
    )
  }
}
