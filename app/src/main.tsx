import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'
import './index.css'
import { Layout, Orb } from '@/components/site'
import Home from '@/pages/Home'

const Markets = lazy(() => import('@/pages/Markets'))
const Market = lazy(() => import('@/pages/Market'))
const Portfolio = lazy(() => import('@/pages/Portfolio'))
const Status = lazy(() => import('@/pages/Status'))
const Docs = lazy(() => import('@/pages/Docs'))

try {
  const saved = localStorage.getItem('theme')
  if (saved === 'dark' || saved === 'light') document.documentElement.dataset.theme = saved
} catch {
  /* storage blocked: default light */
}

const fallback = (
  <div className="grid min-h-[60vh] place-items-center">
    <Orb state="breathing" label="Loading page" />
  </div>
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense fallback={fallback}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="markets" element={<Markets />} />
            <Route path="market/:id" element={<Market />} />
            <Route path="portfolio" element={<Portfolio />} />
            <Route path="status" element={<Status />} />
            <Route path="docs" element={<Docs />} />
            <Route path="*" element={<Home />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
)
