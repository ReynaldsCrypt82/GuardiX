// src/emails/financial-overdue.tsx
// Phase 07 Plan 01 — React Email template para inadimplencia financeira (D-07)
import { Html, Head, Body, Container, Text, Section, Hr } from '@react-email/components'

interface FinancialOverdueEmailProps {
  nome_cliente: string
  descricao: string
  valor: string
  vencimento: string
  corretor: string
}

export function FinancialOverdueEmail({
  nome_cliente,
  descricao,
  valor,
  vencimento,
  corretor,
}: FinancialOverdueEmailProps) {
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
          <Text style={{ fontSize: '20px', fontWeight: 'bold', color: '#c0392b' }}>
            Lancamento financeiro vencido
          </Text>
          <Hr />
          <Section>
            <Text>Ola, {nome_cliente}.</Text>
            <Text>
              Existe um lancamento <strong>{descricao}</strong> vencido em{' '}
              <strong>{vencimento}</strong>, no valor de <strong>R$ {valor}</strong>.
            </Text>
            <Text>Corretor responsavel: {corretor}</Text>
          </Section>
          <Hr />
          <Text style={{ fontSize: '12px', color: '#666666' }}>
            Procure sua corretora para regularizar a situacao.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
