import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "N8N-Work",
  description: "Open-source workflow automation platform built for developers",
  lang: 'en-US',
  
  head: [
    ['meta', { name: 'theme-color', content: '#5f67ee' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:locale', content: 'en' }],
    ['meta', { name: 'og:site_name', content: 'N8N-Work Documentation' }],
    ['meta', { name: 'og:image', content: '/logo-og.png' }],
    ['link', { rel: 'icon', href: '/favicon.ico' }],
  ],

  // Theme configuration
  themeConfig: {
    logo: '/logo.svg',
    
    nav: [
      { text: 'Guide', link: '/guide/' },
      { text: 'API Reference', link: '/api/' },
      { text: 'Examples', link: '/examples/' },
      { 
        text: 'Resources',
        items: [
          { text: 'Node SDK', link: '/sdk/' },
          { text: 'Architecture', link: '/architecture/' },
          { text: 'Deployment', link: '/deployment/' },
          { text: 'Contributing', link: '/contributing/' }
        ]
      },
      {
        text: 'v1.0.0',
        items: [
          { text: 'Changelog', link: '/changelog' },
          { text: 'GitHub', link: 'https://github.com/n8n-work/n8n-work' }
        ]
      }
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          collapsed: false,
          items: [
            { text: 'Introduction', link: '/guide/' },
            { text: 'Quick Start', link: '/guide/quick-start' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Configuration', link: '/guide/configuration' }
          ]
        },
        {
          text: 'Core Concepts',
          collapsed: false,
          items: [
            { text: 'Workflows', link: '/guide/concepts/workflows' },
            { text: 'Nodes', link: '/guide/concepts/nodes' },
            { text: 'Executions', link: '/guide/concepts/executions' },
            { text: 'Credentials', link: '/guide/concepts/credentials' },
            { text: 'Triggers', link: '/guide/concepts/triggers' }
          ]
        },
        {
          text: 'Building Workflows',
          collapsed: false,
          items: [
            { text: 'Creating Workflows', link: '/guide/workflows/creating' },
            { text: 'Connecting Nodes', link: '/guide/workflows/connecting' },
            { text: 'Data Transformation', link: '/guide/workflows/data-transformation' },
            { text: 'Error Handling', link: '/guide/workflows/error-handling' },
            { text: 'Testing Workflows', link: '/guide/workflows/testing' }
          ]
        }
      ],
      '/sdk/': [
        {
          text: 'Node SDK',
          collapsed: false,
          items: [
            { text: 'Introduction', link: '/sdk/' },
            { text: 'Installation', link: '/sdk/installation' },
            { text: 'Quick Start', link: '/sdk/quick-start' },
            { text: 'CLI Reference', link: '/sdk/cli' }
          ]
        },
        {
          text: 'Node Development',
          collapsed: false,
          items: [
            { text: 'Node Types', link: '/sdk/node-types' },
            { text: 'Parameters', link: '/sdk/parameters' },
            { text: 'Credentials', link: '/sdk/credentials' },
            { text: 'HTTP Nodes', link: '/sdk/http-nodes' },
            { text: 'Trigger Nodes', link: '/sdk/trigger-nodes' }
          ]
        },
        {
          text: 'Advanced Topics',
          collapsed: false,
          items: [
            { text: 'Testing Nodes', link: '/sdk/testing' },
            { text: 'Publishing Nodes', link: '/sdk/publishing' },
            { text: 'Best Practices', link: '/sdk/best-practices' },
            { text: 'Troubleshooting', link: '/sdk/troubleshooting' }
          ]
        }
      ],
      '/api/': [
        {
          text: 'REST API',
          collapsed: false,
          items: [
            { text: 'Overview', link: '/api/' },
            { text: 'Authentication', link: '/api/authentication' },
            { text: 'Workflows', link: '/api/workflows' },
            { text: 'Executions', link: '/api/executions' },
            { text: 'Nodes', link: '/api/nodes' },
            { text: 'Credentials', link: '/api/credentials' }
          ]
        },
        {
          text: 'gRPC API',
          collapsed: false,
          items: [
            { text: 'Overview', link: '/api/grpc/' },
            { text: 'Execution Service', link: '/api/grpc/execution' },
            { text: 'Workflow Service', link: '/api/grpc/workflow' },
            { text: 'Node Service', link: '/api/grpc/node' }
          ]
        }
      ],
      '/architecture/': [
        {
          text: 'Platform Architecture',
          collapsed: false,
          items: [
            { text: 'Overview', link: '/architecture/' },
            { text: 'Components', link: '/architecture/components' },
            { text: 'Data Flow', link: '/architecture/data-flow' },
            { text: 'Security', link: '/architecture/security' },
            { text: 'Scalability', link: '/architecture/scalability' }
          ]
        },
        {
          text: 'Technical Details',
          collapsed: false,
          items: [
            { text: 'Orchestrator API', link: '/architecture/orchestrator' },
            { text: 'Execution Engine', link: '/architecture/engine' },
            { text: 'Node Runner', link: '/architecture/node-runner' },
            { text: 'Message Queue', link: '/architecture/message-queue' },
            { text: 'Database Schema', link: '/architecture/database' }
          ]
        }
      ],
      '/deployment/': [
        {
          text: 'Deployment Guide',
          collapsed: false,
          items: [
            { text: 'Overview', link: '/deployment/' },
            { text: 'Docker Compose', link: '/deployment/docker-compose' },
            { text: 'Kubernetes', link: '/deployment/kubernetes' },
            { text: 'Cloud Providers', link: '/deployment/cloud' }
          ]
        },
        {
          text: 'Operations',
          collapsed: false,
          items: [
            { text: 'Monitoring', link: '/deployment/monitoring' },
            { text: 'Logging', link: '/deployment/logging' },
            { text: 'Backup & Recovery', link: '/deployment/backup' },
            { text: 'Troubleshooting', link: '/deployment/troubleshooting' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/n8n-work/n8n-work' },
      { icon: 'discord', link: 'https://discord.gg/n8n-work' },
      { icon: 'twitter', link: 'https://twitter.com/n8nwork' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2023-present N8N-Work Team'
    },

    search: {
      provider: 'local'
    },

    editLink: {
      pattern: 'https://github.com/n8n-work/n8n-work/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    },

    lastUpdated: {
      text: 'Last updated',
      formatOptions: {
        dateStyle: 'full',
        timeStyle: 'medium'
      }
    }
  },

  // Markdown configuration
  markdown: {
    lineNumbers: true,
    theme: {
      light: 'github-light',
      dark: 'github-dark'
    },
    config: (md) => {
      // Add mermaid support
      md.use(require('markdown-it-mermaid'))
    }
  },

  // Build configuration
  vite: {
    define: {
      __VUE_OPTIONS_API__: false
    }
  },

  // Clean URLs
  cleanUrls: true,

  // Generate sitemap
  sitemap: {
    hostname: 'https://docs.n8n-work.com'
  }
})
