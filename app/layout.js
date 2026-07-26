import './globals.css'
import { Providers } from './providers'
import { CartProvider } from '@/components/CartProvider'
import { Toaster } from '@/components/ui/sonner'

export const metadata = {
  title: 'Nevermore DTF · Custom Direct-to-Film Transfers',
  description: 'Design and order custom gang sheet DTF transfers. Vivid color, bulletproof wash, 48hr turnaround.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <head>
        <script dangerouslySetInnerHTML={{__html:'window.addEventListener("error",function(e){if(e.error instanceof DOMException&&e.error.name==="DataCloneError"&&e.message&&e.message.includes("PerformanceServerTiming")){e.stopImmediatePropagation();e.preventDefault()}},true);'}} />
      </head>
      <body className="bg-black text-white antialiased">
        <Providers>
          <CartProvider>
            {children}
            <Toaster theme="dark" position="bottom-right" richColors />
          </CartProvider>
        </Providers>
      </body>
    </html>
  )
}
