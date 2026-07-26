import { Suspense } from 'react'
import ContactClient from './ContactClient'

export const metadata = {
  title: 'Contact · Nevermore DTF',
  description: 'Questions about DTF gang sheets, merch, bulk orders, or custom art? Send us a message.',
}

export default function ContactPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <ContactClient />
    </Suspense>
  )
}
