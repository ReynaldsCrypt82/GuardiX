import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.104.0'

type HookRequest = {
  user_id: string
  claims: Record<string, unknown> & {
    app_metadata?: Record<string, unknown>
    raw_app_meta_data?: Record<string, unknown>
  }
}

Deno.serve(async (req) => {
  try {
    const body = (await req.json()) as HookRequest
    const { user_id: _user_id, claims } = body

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // raw_app_meta_data is the mirror of app_metadata available to the hook payload
    const rawApp = (claims.raw_app_meta_data ?? {}) as {
      tenant_id?: string
      role?: string
      slug?: string
    }

    let trial_ends_at: string | null = null
    let plan = 'trial'
    if (rawApp.tenant_id) {
      const { data } = await supabase
        .from('tenants')
        .select('trial_ends_at, plan')
        .eq('id', rawApp.tenant_id)
        .is('deleted_at', null)
        .single()
      if (data) {
        trial_ends_at = data.trial_ends_at
        plan = data.plan
      }
    }

    // Inject into app_metadata on the JWT
    claims.app_metadata = {
      ...(claims.app_metadata as object ?? {}),
      tenant_id: rawApp.tenant_id ?? null,
      role: rawApp.role ?? 'visualizador',
      slug: rawApp.slug ?? null,
      trial_ends_at,
      plan,
    }

    return new Response(JSON.stringify({ claims }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('custom-access-token hook error:', err)
    return new Response(
      JSON.stringify({ error: { http_code: 500, message: String(err) } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
