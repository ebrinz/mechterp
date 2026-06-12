import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Embeddings from './routes/Embeddings'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Embeddings />
  </StrictMode>,
)
