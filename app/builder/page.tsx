import BuilderClient from './BuilderClient'

export const metadata = {
  title: 'Gang Sheet Builder · Nevermore DTF',
  description: 'Design your DTF gang sheet: upload, position, resize, and rotate artwork on any of our stock sheet sizes.',
}

export default function Page() {
  return <BuilderClient />
}
