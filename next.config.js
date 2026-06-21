/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async redirects() {
    return [
      // Newsletter merged into the blog (single Brains & Gains hub).
      { source: '/newsletter', destination: '/blog', permanent: true },
    ]
  },
}

module.exports = nextConfig
