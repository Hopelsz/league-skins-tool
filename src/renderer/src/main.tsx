import React from 'react'
import ReactDOM from 'react-dom/client'

import './assets/styles/index.css'
import App from './App'
import Providers from './components/providers/Main'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Providers>
      <App />
    </Providers>
  </React.StrictMode>
)
