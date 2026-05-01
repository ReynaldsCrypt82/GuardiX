// src/emails/policy-expiring.tsx
// Phase 07 Plan 01 — React Email template para vencimento de apolice (D-07)
import { Html, Head, Body, Container, Text, Section, Hr } from '@react-email/components'

interface PolicyExpiringEmailProps {
  nome_cliente: string
  nome_apolice: string
  vencimento: string
  corretor: string
  valor: string
}

export function PolicyExpiringEmail({
  nome_cliente,
  nome_apolice,
  vencimento,
  corretor,
  valor,
}: PolicyExpiringEmailProps) {
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
          <Text style={{ fontSize: '20px', fontWeight: 'bold', color: '#1a1a1a' }}>
            Apolice vencendo em breve
          </Text>
          <Hr />
          <Section>
            <Text>Ola, {nome_cliente}.</Text>
            <Text>
              Sua apolice <strong>{nome_apolice}</strong> vence em{' '}
              <strong>{vencimento}</strong>.
            </Text>
            <Text>
              Valor: <strong>R$ {valor}</strong>
            </Text>
            <Text>Corretor responsavel: {corretor}</Text>
          </Section>
          <Hr />
          <Text style={{ fontSize: '12px', color: '#666666' }}>
            Entre em contato com sua corretora para renovacao.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
