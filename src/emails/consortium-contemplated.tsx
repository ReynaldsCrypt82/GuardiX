// src/emails/consortium-contemplated.tsx
// Phase 07 Plan 01 — React Email template para contemplacao de consorcio (D-07)
import { Html, Head, Body, Container, Text, Section, Hr } from '@react-email/components'

interface ConsortiumContemplatedEmailProps {
  nome_cliente: string
  nome_grupo: string
  valor: string
  corretor: string
}

export function ConsortiumContemplatedEmail({
  nome_cliente,
  nome_grupo,
  valor,
  corretor,
}: ConsortiumContemplatedEmailProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f9f9f9' }}>
        <Container
          style={{
            maxWidth: '600px',
            margin: '0 auto',
            backgroundColor: '#ffffff',
            padding: '24px',
            borderRadius: '8px',
          }}
        >
          <Text style={{ fontSize: '20px', fontWeight: 'bold', color: '#27ae60' }}>
            Parabens! Voce foi contemplado.
          </Text>
          <Hr />
          <Section>
            <Text>Ola, {nome_cliente}!</Text>
            <Text>
              Sua cota do grupo <strong>{nome_grupo}</strong> foi contemplada. Valor:{' '}
              <strong>R$ {valor}</strong>.
            </Text>
            <Text>
              Seu corretor <strong>{corretor}</strong> entrara em contato em breve para os proximos
              passos.
            </Text>
          </Section>
          <Hr />
          <Text style={{ fontSize: '12px', color: '#666666' }}>
            NEXUS AGENT — Plataforma de gestao para corretoras.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
