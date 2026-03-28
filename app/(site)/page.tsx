'use client'

import Hero from '@/components/sections/Hero'
import Marquee from '@/components/ui/Marquee'
import PainSection from '@/components/sections/PainSection'
import Scripture from '@/components/sections/Scripture'
import Pricing from '@/components/sections/Pricing'
import Testimonial from '@/components/sections/Testimonial'
import Newsletter from '@/components/sections/Newsletter'
import FinalCTA from '@/components/sections/FinalCTA'

export default function HomePage() {
  return (
    <>
      <Hero />
      <Marquee />
      <PainSection />
      <Scripture />
      <Pricing />
      <Testimonial />
      <Newsletter />
      <FinalCTA />
    </>
  )
}
