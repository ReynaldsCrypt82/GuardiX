import { create } from 'zustand'

interface EmpresaData {
  cnpj: string
  companyName: string
  segment: 'seguros' | 'consorcio' | 'ambos'
}

interface AdminData {
  adminName: string
  email: string
  password: string
  passwordConfirm: string
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
