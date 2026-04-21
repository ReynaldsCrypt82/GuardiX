import { create } from 'zustand'

interface EmpresaData {
  cnpj: string
  companyName: string
  segment: 'seguros' | 'consorcio' | 'ambos'
}

interface AdminData {
  adminName: string
  email: string
  // Passwords are intentionally NOT stored here — kept in local React state only
  // to avoid exposing credentials in global client-side store (browser extensions,
  // React DevTools). See WizardPasswordContext in wizard.tsx.
}

interface WizardState {
  step: 1 | 2 | 3
  empresaData: EmpresaData | null
  adminData: AdminData | null
  setStep: (step: 1 | 2 | 3) => void
  setEmpresaData: (data: EmpresaData) => void
  setAdminData: (data: AdminData) => void
  reset: () => void
}

export const useRegisterWizard = create<WizardState>((set) => ({
  step: 1,
  empresaData: null,
  adminData: null,
  setStep: (step) => set({ step }),
  setEmpresaData: (empresaData) => set({ empresaData }),
  setAdminData: (adminData) => set({ adminData }),
  reset: () => set({ step: 1, empresaData: null, adminData: null }),
}))
