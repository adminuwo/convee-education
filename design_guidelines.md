{
  "brand_attributes": {
    "tone": ["premium", "calm-dense", "trustworthy", "keyboard-first", "enterprise-serious"],
    "visual_metaphor": "Quiet surfaces + crisp typography + one confident accent (blue-teal) + subtle elevation. Think Linear density + Notion clarity + Slack collaboration affordances.",
    "anti_goals": [
      "No transparent/glass backgrounds with light text (must work in both modes)",
      "No playful gradients or neon accents",
      "No purple for AI surfaces",
      "No centered app container layouts"
    ]
  },
  "design_tokens": {
    "notes": "Use CSS variables (HSL) compatible with shadcn/ui. Keep neutrals cool (slate/ink) and reserve accent for focus/active/primary actions. Validate contrast in both themes.",
    "css_variables": {
      "light": {
        "--background": "210 20% 98%",
        "--foreground": "222 47% 11%",
        "--card": "0 0% 100%",
        "--card-foreground": "222 47% 11%",
        "--popover": "0 0% 100%",
        "--popover-foreground": "222 47% 11%",
        "--primary": "213 94% 45%",
        "--primary-foreground": "210 40% 98%",
        "--secondary": "210 20% 96%",
        "--secondary-foreground": "222 47% 11%",
        "--muted": "210 16% 94%",
        "--muted-foreground": "215 16% 40%",
        "--accent": "186 85% 35%",
        "--accent-foreground": "210 40% 98%",
        "--destructive": "0 84% 55%",
        "--destructive-foreground": "210 40% 98%",
        "--border": "214 20% 88%",
        "--input": "214 20% 88%",
        "--ring": "213 94% 45%",
        "--radius": "0.75rem",
        "--chart-1": "213 94% 45%",
        "--chart-2": "186 85% 35%",
        "--chart-3": "24 90% 55%",
        "--chart-4": "142 60% 35%",
        "--chart-5": "262 45% 55%"
      },
      "dark": {
        "--background": "222 47% 7%",
        "--foreground": "210 40% 98%",
        "--card": "222 47% 10%",
        "--card-foreground": "210 40% 98%",
        "--popover": "222 47% 10%",
        "--popover-foreground": "210 40% 98%",
        "--primary": "213 94% 60%",
        "--primary-foreground": "222 47% 7%",
        "--secondary": "222 30% 14%",
        "--secondary-foreground": "210 40% 98%",
        "--muted": "222 30% 14%",
        "--muted-foreground": "215 20% 70%",
        "--accent": "186 85% 45%",
        "--accent-foreground": "222 47% 7%",
        "--destructive": "0 62% 35%",
        "--destructive-foreground": "210 40% 98%",
        "--border": "222 25% 18%",
        "--input": "222 25% 18%",
        "--ring": "213 94% 60%",
        "--radius": "0.75rem",
        "--chart-1": "213 94% 60%",
        "--chart-2": "186 85% 45%",
        "--chart-3": "24 90% 60%",
        "--chart-4": "142 55% 45%",
        "--chart-5": "262 45% 65%"
      },
      "extended_semantic_tokens": {
        "--surface-1": "var(--card)",
        "--surface-2": "210 20% 96%",
        "--surface-3": "210 16% 94%",
        "--sidebar": "220 20% 97%",
        "--sidebar-foreground": "222 47% 11%",
        "--sidebar-active": "213 94% 45%",
        "--sidebar-active-bg": "213 94% 95%",
        "--focus-ring": "213 94% 45%",
        "--success": "142 60% 35%",
        "--warning": "38 92% 50%",
        "--info": "186 85% 35%"
      },
      "hex_reference": {
        "ink-950": "#0B1220",
        "slate-900": "#0F172A",
        "slate-700": "#334155",
        "slate-500": "#64748B",
        "slate-200": "#E2E8F0",
        "slate-100": "#F1F5F9",
        "paper": "#FFFFFF",
        "primary-blue": "#0B5FFF",
        "accent-teal": "#0F9BA8",
        "success": "#16A34A",
        "warning": "#F59E0B",
        "danger": "#EF4444"
      }
    },
    "spacing_scale_px": {
      "0": 0,
      "1": 4,
      "2": 8,
      "3": 12,
      "4": 16,
      "5": 20,
      "6": 24,
      "8": 32,
      "10": 40,
      "12": 48,
      "16": 64,
      "20": 80,
      "24": 96
    },
    "radii": {
      "sm": "0.5rem",
      "md": "0.75rem",
      "lg": "1rem",
      "xl": "1.25rem"
    },
    "shadows": {
      "light": {
        "sm": "0 1px 2px rgba(15, 23, 42, 0.06)",
        "md": "0 8px 24px rgba(15, 23, 42, 0.10)",
        "focus": "0 0 0 3px rgba(11, 95, 255, 0.25)"
      },
      "dark": {
        "sm": "0 1px 2px rgba(0, 0, 0, 0.35)",
        "md": "0 10px 28px rgba(0, 0, 0, 0.45)",
        "focus": "0 0 0 3px rgba(11, 95, 255, 0.35)"
      }
    }
  },
  "typography": {
    "font_pairing": {
      "display": {
        "name": "Space Grotesk",
        "google_fonts": "https://fonts.google.com/specimen/Space+Grotesk",
        "usage": "App shell headings, page titles, KPI numbers"
      },
      "body": {
        "name": "Inter",
        "google_fonts": "https://fonts.google.com/specimen/Inter",
        "usage": "Body, tables, forms, chat messages"
      },
      "mono": {
        "name": "IBM Plex Mono",
        "google_fonts": "https://fonts.google.com/specimen/IBM+Plex+Mono",
        "usage": "IDs, code blocks, logs, timestamps (optional)"
      }
    },
    "tailwind_usage": {
      "base": "font-sans text-sm md:text-base",
      "h1": "text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight",
      "h2": "text-base md:text-lg font-medium text-muted-foreground",
      "section_title": "text-lg font-semibold tracking-tight",
      "kpi": "text-2xl md:text-3xl font-semibold tabular-nums",
      "table": "text-sm leading-5",
      "meta": "text-xs text-muted-foreground"
    },
    "density_rules": [
      "Default body text: 14px (text-sm) for app surfaces; 16px (text-base) for reading-heavy pages like notes.",
      "Use tabular-nums for KPIs, timestamps, counts.",
      "Keep line-height tight in tables (leading-5) and relaxed in docs (leading-7)."
    ]
  },
  "layout_and_grid": {
    "app_shell": {
      "structure": "Left sidebar (collapsible) + Top bar + Main content + Optional right pane (AI/Details).",
      "grid": {
        "desktop": "Sidebar 280px (collapsed 72px) | Content fluid | Right pane 360-420px",
        "tablet": "Sidebar 260px (overlay sheet) | Content fluid | Right pane as drawer",
        "mobile": "Sidebar as Sheet, Top bar sticky, Right pane as full-screen Drawer"
      },
      "content_max_width": "Do not hard-cap main content; instead use internal max widths per page (e.g., notes max-w-3xl).",
      "page_padding": "px-4 sm:px-6 lg:px-8 py-4",
      "borders": "Use 1px borders for separation instead of heavy shadows; shadows only for overlays (dialogs, popovers)."
    },
    "sidebar": {
      "sections": [
        "Workspace switcher (org + workspace + plan badge)",
        "Primary nav (Home, Channels, Tasks, AI, Meetings, Files, Analytics)",
        "Tree: Departments/Teams/Projects with collapsible groups",
        "Channels list with unread badges + mentions",
        "Footer: user menu + status + theme toggle"
      ],
      "interaction": [
        "Collapsed mode shows icons + tooltips (Tooltip component).",
        "Unread state uses subtle accent dot + bold label.",
        "Active item uses left accent bar (2px) + soft background tint (no gradients)."
      ]
    },
    "topbar": {
      "elements": [
        "Breadcrumb (optional)",
        "Global search trigger (Ctrl+K) as Input-like button",
        "Quick create (+) dropdown",
        "Notifications bell",
        "User avatar menu"
      ],
      "sticky": "Top bar sticky with border-b; avoid drop shadows unless scrolled (add shadow-sm on scroll)."
    }
  },
  "component_path": {
    "primary_shadcn_components": [
      "/app/frontend/src/components/ui/button.jsx",
      "/app/frontend/src/components/ui/input.jsx",
      "/app/frontend/src/components/ui/textarea.jsx",
      "/app/frontend/src/components/ui/card.jsx",
      "/app/frontend/src/components/ui/tabs.jsx",
      "/app/frontend/src/components/ui/badge.jsx",
      "/app/frontend/src/components/ui/avatar.jsx",
      "/app/frontend/src/components/ui/command.jsx",
      "/app/frontend/src/components/ui/dialog.jsx",
      "/app/frontend/src/components/ui/drawer.jsx",
      "/app/frontend/src/components/ui/sheet.jsx",
      "/app/frontend/src/components/ui/dropdown-menu.jsx",
      "/app/frontend/src/components/ui/scroll-area.jsx",
      "/app/frontend/src/components/ui/resizable.jsx",
      "/app/frontend/src/components/ui/separator.jsx",
      "/app/frontend/src/components/ui/skeleton.jsx",
      "/app/frontend/src/components/ui/table.jsx",
      "/app/frontend/src/components/ui/tooltip.jsx",
      "/app/frontend/src/components/ui/calendar.jsx",
      "/app/frontend/src/components/ui/sonner.jsx"
    ],
    "recommended_additions": {
      "virtualization": {
        "library": "react-virtuoso",
        "why": "Chat message stream + large lists (channels, files) need virtualization for performance.",
        "install": "npm i react-virtuoso",
        "usage": "Use <Virtuoso /> for message list; keep message row height flexible; render date separators as group headers."
      },
      "drag_drop": {
        "library": "@dnd-kit/core @dnd-kit/sortable @dnd-kit/modifiers",
        "why": "Kanban drag/drop with keyboard accessibility.",
        "install": "npm i @dnd-kit/core @dnd-kit/sortable @dnd-kit/modifiers"
      }
    }
  },
  "key_page_blueprints": {
    "login_register": {
      "layout": "Two-column on desktop: left brand panel (solid surface) + right auth card. On mobile: single column.",
      "details": [
        "Left panel: product name, 3 bullet benefits, security/compliance microcopy.",
        "Right: Card with tabs (Login/Register) or separate routes.",
        "Google OAuth as secondary button with icon.",
        "Include password rules + show/hide toggle."
      ],
      "testids": [
        "login-email-input",
        "login-password-input",
        "login-submit-button",
        "login-google-button",
        "register-submit-button"
      ]
    },
    "app_home_dashboard": {
      "layout": "Role-based dashboard with 12-col grid; dense cards; quick actions row; charts below.",
      "sections": [
        "Top: Page title + role badge + date range selector",
        "Row 1: KPI cards (4 across desktop, 2 tablet, 1 mobile)",
        "Row 2: Activity feed (table) + My tasks (list)",
        "Row 3: Charts (Recharts) with segmented controls"
      ],
      "components": ["Card", "Tabs", "Table", "Badge", "DropdownMenu", "Skeleton"],
      "testids": ["dashboard-date-range", "dashboard-kpi-card", "dashboard-activity-table"]
    },
    "channels_chat": {
      "layout": "3-column inside main content: channel header + message stream + thread drawer/pane.",
      "structure": [
        "Header: channel name, topic, members, search in channel, pinned, settings",
        "Message list: virtualized; date separators; unread marker; reactions row",
        "Composer: textarea autosize + attachment + emoji/reaction (use lucide icons) + send"
      ],
      "ai_in_channel": [
        "Inline AI actions bar appears when selecting messages: Summarize / Extract tasks / Draft reply.",
        "@AI mention chip in composer with autocomplete (Command component)."
      ],
      "testids": [
        "chat-message-list",
        "chat-message-composer",
        "chat-send-button",
        "chat-thread-toggle",
        "chat-search-button"
      ]
    },
    "tasks": {
      "tabs": ["Kanban", "List", "Calendar"],
      "kanban": {
        "layout": "Horizontal scroll columns with sticky column headers; each column is a ScrollArea.",
        "card": "Task card shows title, priority badge, assignees avatars, due date, comment count.",
        "drag": "Use dnd-kit; show drop indicator line; on drag overlay use shadow-md."
      },
      "list": {
        "layout": "Table with sticky header; row actions on hover; bulk select checkbox.",
        "density": "Use compact row height (h-10) with clear separators."
      },
      "calendar": {
        "component": "Use shadcn Calendar for month view; for schedule list use Table/List.",
        "interaction": "Click day opens Drawer with tasks for that day."
      },
      "testids": ["tasks-tabs", "kanban-column", "task-card", "task-create-button"]
    },
    "task_detail": {
      "container": "Prefer Drawer on desktop right side; full-screen Drawer on mobile.",
      "sections": [
        "Header: title inline edit + status select + priority",
        "Body: description (rich text later), checklist/subtasks, dependencies",
        "Right rail inside drawer: assignees, due date, labels, attachments",
        "Bottom: comments thread"
      ],
      "testids": ["task-detail-drawer", "task-title-input", "task-status-select", "task-save-button"]
    },
    "ai_assistant": {
      "layout": "Dedicated page with split: left conversation list (saved prompts) + main chat + right context panel.",
      "tone": "AI surfaces use teal accent (not purple).",
      "features": [
        "Prompt templates as cards",
        "Context chips (project, sprint, channel) removable",
        "Output blocks with copy button + 'Create tasks' CTA"
      ],
      "testids": ["ai-chat-input", "ai-send-button", "ai-create-tasks-button"]
    },
    "analytics": {
      "layout": "Filters row + KPI strip + charts grid + table.",
      "charts": [
        "Line chart for throughput",
        "Stacked bar for workload",
        "Donut for status distribution"
      ],
      "recharts_style": {
        "grid": "stroke=hsl(var(--border))",
        "axis": "tick fill=hsl(var(--muted-foreground))",
        "series": "use --chart-1..5 tokens"
      },
      "testids": ["analytics-filters", "analytics-chart", "analytics-table"]
    }
  },
  "interaction_and_motion": {
    "principles": [
      "Fast, subtle, purposeful. No bouncy easing.",
      "Prefer opacity + translateY(2-6px) entrance; avoid scaling large surfaces.",
      "Respect prefers-reduced-motion."
    ],
    "framer_motion_recipes": {
      "page_enter": "initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}",
      "drawer_dialog": "Use opacity fade for overlay + slide for panel (x or y).",
      "hover": "Buttons: transition-colors duration-150; Cards: hover:bg-muted/60 + hover:border-foreground/10"
    },
    "micro_interactions": [
      "Sidebar items: on hover show subtle background tint; on active show accent bar.",
      "Message reactions: hover reveals reaction bar; click animates opacity in 120ms.",
      "Kanban drag: column header highlights on valid drop; drop indicator line animates height."
    ]
  },
  "states": {
    "loading": {
      "use": "Skeleton component for cards, tables, message rows; keep layout stable.",
      "patterns": [
        "Dashboard: skeleton KPI cards + chart blocks",
        "Chat: skeleton message rows with avatar circle + 2 lines",
        "Tasks: skeleton columns with 3 cards"
      ]
    },
    "empty": {
      "tone": "Actionable, not cute. Provide 1 primary action + 1 secondary link.",
      "examples": [
        "No messages: 'Start the conversation' + 'Invite teammates'",
        "No tasks: 'Create your first task' + 'Import from Jira'",
        "No files: 'Upload a file' + 'Connect Google Drive'"
      ]
    },
    "errors": {
      "pattern": "Inline Alert for recoverable errors; full-page error boundary for route failures; toast for transient.",
      "toast": "Use sonner for success/error confirmations."
    }
  },
  "accessibility": {
    "requirements": [
      "WCAG AA contrast for text and interactive controls.",
      "Visible focus ring using --ring; never remove outline without replacement.",
      "Keyboard navigation: sidebar, command palette, kanban drag (dnd-kit supports keyboard).",
      "ARIA labels for icon-only buttons; tooltips for collapsed sidebar icons."
    ],
    "focus_styles": {
      "tailwind": "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    }
  },
  "image_urls": {
    "auth_left_panel_background": {
      "category": "auth",
      "description": "Optional subtle abstract texture for login/register left panel (use as background image with low opacity; ensure readability).",
      "urls": [
        "https://images.unsplash.com/photo-1638191490002-731b813e8a72?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85",
        "https://images.unsplash.com/photo-1626123080782-10b336a160b4?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85"
      ]
    },
    "marketing_optional_team_photo": {
      "category": "optional",
      "description": "If you add an onboarding welcome screen or about modal, use a neutral office collaboration photo.",
      "urls": [
        "https://images.unsplash.com/photo-1653669485546-7389365ca840?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85",
        "https://images.unsplash.com/photo-1601383496802-dfaa02f6ae6e?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85"
      ]
    }
  },
  "instructions_to_main_agent": {
    "theme_system": [
      "Replace current default shadcn tokens in /app/frontend/src/index.css with the provided light/dark values (keep structure).",
      "Add semantic sidebar tokens if needed (sidebar bg/fg/active) as additional CSS vars; map them in Tailwind via arbitrary values (e.g., bg-[hsl(var(--sidebar))]).",
      "Do not use gradients except small decorative overlays in hero/auth panels; keep under 20% viewport."
    ],
    "js_file_conventions": [
      "All new components should be .jsx (not .tsx).",
      "Use named exports for components; pages default export.",
      "Every interactive element and key info element must include data-testid in kebab-case."
    ],
    "shell_implementation": [
      "Use Resizable for sidebar/content/right-pane on desktop.",
      "Use Sheet for sidebar on mobile.",
      "Use Command component for Ctrl+K palette; include search + actions + recent.",
      "Use ScrollArea for sidebar trees and message list container (virtualized list inside)."
    ],
    "performance": [
      "Virtualize chat messages and large lists (react-virtuoso).",
      "Memoize message rows; avoid re-rendering entire list on typing indicator updates.",
      "Use skeletons to avoid layout shift."
    ]
  },
  "general_ui_ux_design_guidelines_appendix": "<General UI UX Design Guidelines>  \n    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms\n    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text\n   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json\n\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**\n\n</Font Guidelines>\n\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. \n   \n- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n\n- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   \n- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n\n**Component Reuse:**\n\t- Prioritize using pre-existing components from src/components/ui when applicable\n\t- Create new components that match the style and conventions of existing components when needed\n\t- Examine existing components to understand the project's component patterns before creating new ones\n\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n\n**Best Practices:**\n\t- Use Shadcn/UI as the primary component library for consistency and accessibility\n\t- Import path: ./components/[component-name]\n\n**Export Conventions:**\n\t- Components MUST use named exports (export const ComponentName = ...)\n\t- Pages MUST use default exports (export default function PageName() {...})\n\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals.\n</General UI UX Design Guidelines>"
}
