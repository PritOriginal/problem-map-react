import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.scss'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom'
import { registerServiceWorker } from './pwa.ts'
import { ensureDict, getLang } from './i18n'

/* The English dictionary is a chunk of its own, so the first paint has to wait for it
   when English is the stored choice -- otherwise the whole interface would render in
   the Russian fallback and repaint in English a moment later. For everyone on Russian
   (the default, and the majority) `ensureDict` resolves on the spot without a request,
   and the dictionary never enters the entry chunk at all. */
ensureDict(getLang()).then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
})

registerServiceWorker();
