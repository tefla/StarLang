import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'
import starlangGrammar from './starlang.tmLanguage.json'
import forgeGrammar from './forge.tmLanguage.json'

// Support dynamic base path for branch deployments
// Default: /StarLang/docs/ (master branch)
// Branch: /StarLang/branches/{branch}/docs/
const basePath = process.env.VITEPRESS_BASE || '/StarLang/docs/'

export default withMermaid(defineConfig({
  title: 'StarLang',
  description: 'A survival/discovery game where the ship is the programming language',

  base: basePath,

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${basePath}logo.svg` }]
  ],

  markdown: {
    languages: [starlangGrammar as any, forgeGrammar as any]
  },

  // Mermaid configuration
  mermaid: {
    theme: 'dark',
  },

  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Game Design', link: '/game/01-concept' },
      { text: 'StarLang', link: '/language/01-syntax' },
      { text: 'Forge DSL', link: '/forge/01-overview' },
      { text: 'Technical', link: '/technical/00-architecture' }
    ],

    sidebar: {
      '/': [
        {
          text: 'Game Design',
          collapsed: false,
          items: [
            { text: 'Concept', link: '/game/01-concept' },
            { text: 'Narrative', link: '/game/02-narrative' },
            { text: 'Puzzles', link: '/game/03-puzzles' },
            { text: 'UI Layout', link: '/game/04-ui-layout' },
            { text: 'Progression', link: '/game/05-progression' }
          ]
        },
        {
          text: 'StarLang (Ship Code)',
          collapsed: false,
          items: [
            { text: 'Syntax', link: '/language/01-syntax' },
            { text: 'Ship Structure', link: '/language/02-ship-structure' },
            { text: 'Permissions', link: '/language/03-permissions' },
            { text: 'Node Types', link: '/language/04-node-types' },
            { text: 'Signals', link: '/language/05-signals' },
            { text: 'Examples', link: '/language/06-examples' },
            { text: 'Layout Files', link: '/language/07-layout-files' }
          ]
        },
        {
          text: 'Forge DSL',
          collapsed: false,
          items: [
            { text: 'Overview', link: '/forge/01-overview' },
            { text: 'Syntax Reference', link: '/forge/02-syntax' },
            { text: 'Assets', link: '/forge/03-assets' },
            { text: 'Configuration', link: '/forge/04-config' },
            { text: 'Scripting', link: '/forge/05-scripting' },
            { text: 'Layouts', link: '/forge/06-layouts' },
            { text: 'Game Definition', link: '/forge/07-game-definition' },
            { text: 'Entities', link: '/forge/08-entities' }
          ]
        },
        {
          text: 'Runtime Architecture',
          collapsed: true,
          items: [
            { text: 'Architecture', link: '/runtime/01-architecture' },
            { text: 'State Management', link: '/runtime/02-state-management' },
            { text: 'Reactive Updates', link: '/runtime/03-reactive-updates' },
            { text: 'Reconciliation', link: '/runtime/04-reconciliation' },
            { text: 'Version Control', link: '/runtime/05-version-control' }
          ]
        },
        {
          text: 'Technical',
          collapsed: false,
          items: [
            { text: 'Three-Layer Architecture', link: '/technical/00-architecture' },
            { text: 'Implementation', link: '/technical/01-implementation' },
            { text: 'UI Binding', link: '/technical/02-ui-binding' },
            { text: 'Terminal Types', link: '/technical/03-terminal-types' },
            { text: 'Parser', link: '/technical/04-parser' },
            { text: 'Compiler', link: '/technical/05-compiler' },
            { text: 'Voxel System', link: '/technical/06-voxel-system' },
            { text: 'Engine / Game Separation', link: '/technical/07-engine-game-separation' }
          ]
        },
        {
          text: 'Appendices',
          collapsed: true,
          items: [
            { text: 'Glossary', link: '/appendices/A-glossary' },
            { text: 'Ship Manifest', link: '/appendices/B-ship-manifest' },
            { text: 'Timeline', link: '/appendices/C-timeline' },
            { text: 'Art Direction', link: '/appendices/D-art-direction' },
            { text: 'Audio Direction', link: '/appendices/E-audio-direction' },
            { text: 'Scope Cuts', link: '/appendices/F-scope-cuts' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/tefla/StarLang' }
    ],

    search: {
      provider: 'local'
    },

    footer: {
      message: 'A LangJam Entry',
      copyright: 'StarLang - A survival/discovery game'
    }
  }
}))
