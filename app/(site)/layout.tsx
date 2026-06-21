import Navbar from '@/components/ui/Navbar'
import Footer from '@/components/ui/Footer'
import { SITE_URL } from '@/lib/blog'

// Entity-level structured data — tells search + answer engines who AJM Fit is.
const organizationLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'AJM Fit',
  url: SITE_URL,
  logo: `${SITE_URL}/AJMfit.png`,
  description: 'Personal training and online coaching by ISSA-certified coach Anthony Martin.',
  email: 'anthony@ajmfit.com',
  founder: { '@type': 'Person', name: 'Anthony Martin', jobTitle: 'Personal Trainer & Coach' },
  sameAs: ['https://www.instagram.com/anthony.j.martin'],
}

const websiteLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'AJM Fit',
  url: SITE_URL,
  publisher: { '@type': 'Organization', name: 'AJM Fit' },
}

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteLd) }} />
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  )
}
