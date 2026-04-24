import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PlaygroundApp } from './PlaygroundApp'

const el = document.getElementById('root')
if (el) {
  createRoot(el).render(
    <StrictMode>
      <PlaygroundApp />
    </StrictMode>,
  )
}
