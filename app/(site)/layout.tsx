import Navbar from '@/components/ui/Navbar'
import Footer from '@/components/ui/Footer'

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  )
}
