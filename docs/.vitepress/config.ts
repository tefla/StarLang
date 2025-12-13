import { defineConfig } from 'vitepress'
import starlangGrammar from './starlang.tmLanguage.json'

export default defineConfig({
  title: 'StarLang',
  description: 'A survival/discovery game where the ship is the programming language',

  base: '/StarLang/docs/',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/StarLang/docs/logo.svg' }]
  ],

  markdown: {
    languages: [starlangGrammar as any]
  },

  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Game Design', link: '/game/01-concept' },
      { text: 'Language', link: '/language/01-syntax' },
      { text: 'Runtime', link: '/runtime/01-architecture' },
      { text: 'Technical', link: '/technical/01-implementation' }
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
          text: 'Language Specification',
          collapsed: false,
          items: [
            { text: 'Syntax', link: '/language/01-syntax' },
            { text: 'Ship Structure', link: '/language/02-ship-structure' },
            { text: 'Permissions', link: '/language/03-permissions' },
            { text: 'Node Types', link: '/language/04-node-types' },
            { text: 'Signals', link: '/language/05-signals' },
            { text: 'Examples', link: '/language/06-examples' }
          ]
        },
        {
          text: 'Runtime Architecture',
          collapsed: false,
          items: [
            { text: 'Architecture', link: '/runtime/01-architecture' },
            { text: 'State Management', link: '/runtime/02-state-management' },
            { text: 'Reactive Updates', link: '/runtime/03-reactive-updates' },
            { text: 'Reconciliation', link: '/runtime/04-reconciliation' },
            { text: 'Version Control', link: '/runtime/05-version-control' }
          ]
        },
        {
          text: 'Technical Implementation',
          collapsed: false,
          items: [
            { text: 'Implementation', link: '/technical/01-implementation' },
            { text: 'UI Binding', link: '/technical/02-ui-binding' },
            { text: 'Terminal Types', link: '/technical/03-terminal-types' },
            { text: 'Parser', link: '/technical/04-parser' },
            { text: 'Compiler', link: '/technical/05-compiler' }
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
})
