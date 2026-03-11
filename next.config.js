/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
       {
         protocol: 'https',
         hostname: '**',
       },
       {
         protocol: 'http',
         hostname: '**',
       }
    ],
  },
  async rewrites() {
    return [
      {
        source: '/sitemap-video:page.xml',
        destination: '/api/sitemap-video/:page',
      },
    ];
  },
}

module.exports = nextConfig

