import { createRoot } from 'react-dom/client'
import App from './app/App'
import './index.css'


if (import.meta.env.DEV) {
    console.log(
      'GOOGLE MAPS BROWSER KEY:',
      import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY
    );
  }
  

createRoot(document.getElementById("root")!).render(<App />);
