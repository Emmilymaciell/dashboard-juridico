import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AppShell } from '@/app/AppShell'
import { CoverPage } from '@/app/CoverPage'
import { ThemeProvider } from '@/app/ThemeProvider'
import { ExplorerPage } from '@/features/explorer/ExplorerPage'
import { GovernancePage } from '@/features/governance/GovernancePage'
import { OverviewPage } from '@/features/overview/OverviewPage'
import { RoadsPage } from '@/features/roads/RoadsPage'
import { TimelinePage } from '@/features/timeline/TimelinePage'

import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
})

const root = document.getElementById('root')
if (!root) throw new Error('elemento #root nao encontrado')

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            {/* capa: primeira tela do produto, fora do shell */}
            <Route path="/" element={<CoverPage />} />

            <Route element={<AppShell />}>
              <Route path="painel" element={<OverviewPage />} />
              <Route path="linha-do-tempo" element={<TimelinePage />} />
              <Route path="rodovias" element={<RoadsPage />} />

              {/*
                Portfólio e Destinatários deixaram de ser páginas próprias: todo
                o conteúdo dos dois foi para dentro de Visão Geral. As rotas
                continuam respondendo e redirecionam, para não quebrar link
                salvo nem deep-link antigo.
              */}
              <Route path="portfolio" element={<Navigate to="/painel" replace />} />
              <Route path="destinatarios" element={<Navigate to="/painel" replace />} />
              <Route path="documentos" element={<ExplorerPage />} />

              {/*
                Governança saiu do menu executivo por decisão da usuária, mas a
                rota continua acessível: as validações, os achados e o endpoint
                seguem ativos, e a página é útil para conferência técnica.
              */}
              <Route path="governanca" element={<GovernancePage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
