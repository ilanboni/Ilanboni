# Real Estate CRM Design Guidelines

## Design Approach
**Selected System**: Linear-inspired modern dashboard with Carbon Design data-density principles

**Justification**: Professional CRM tools require exceptional clarity, scannable information architecture, and sophisticated data visualization. Linear's refined typography and spatial system combined with Carbon's enterprise-grade data handling creates the ideal foundation for trust and efficiency.

**Key Principles**:
- Information clarity over decoration
- Purposeful negative space for cognitive breathing room
- Systematic hierarchy through typography and spacing
- Professional restraint with strategic visual emphasis

---

## Typography System

**Font Families** (Google Fonts):
- Primary: Inter (UI, body, data) - weights 400, 500, 600
- Display: Cal Sans or similar geometric sans for dashboard headers - weight 600

**Hierarchy**:
- Dashboard titles: 32px/2rem, semibold, tight tracking
- Section headers: 24px/1.5rem, semibold
- Card titles: 16px/1rem, medium
- Body/data: 14px/0.875rem, regular
- Labels/meta: 12px/0.75rem, medium, slight letter-spacing
- Small data: 11px, medium

---

## Layout & Spacing System

**Tailwind Units**: Consistently use 2, 3, 4, 6, 8, 12, 16 units
- Micro spacing: 2, 3 (tight elements)
- Component padding: 4, 6 (cards, inputs)
- Section spacing: 8, 12 (major divisions)
- Page margins: 16 (outer containers)

**Grid System**:
- Main layout: Sidebar (256px fixed) + fluid content area
- Dashboard cards: 2-3 column grid (grid-cols-2 lg:grid-cols-3)
- Data tables: Full-width with horizontal scroll
- Property listings: 3-4 column masonry grid

**Container Strategy**:
- Max-width: 1600px for dashboard content
- Cards: Consistent 6-8 padding, 12-16 gap between
- Sidebar: Fixed positioning, full-height, 6 padding

---

## Component Library

### Navigation
**Sidebar Navigation**:
- Logo at top with 8 padding
- Grouped menu items with 3 vertical spacing
- Icons (24px) + labels, 3 gap
- Active state: Subtle background treatment
- Sections: Dashboard, Properties, Clients, Tasks, Analytics, Settings

**Top Bar**:
- Search (prominent, 1/3 width), notifications, user profile
- Height: 64px, 4-6 horizontal padding
- Breadcrumb navigation for deep pages

### Dashboard Cards
**Metric Cards**:
- KPI number: 36px, semibold
- Label: 12px, medium
- Trend indicator: Small arrow icon + percentage
- Sparkline chart integration (subtle)
- 6 padding, rounded-lg borders

**Chart Cards**:
- Header with title + date range selector
- Chart area with 4 padding
- Legend positioned strategically
- Responsive height: min-h-80

### Data Tables
**Structure**:
- Sticky header row, 3 vertical padding
- Alternating row treatment (not striped, subtle hover)
- Column alignment: Numbers right, text left
- Action column (rightmost): Icon buttons 2 gap
- Pagination: Bottom center, 4 padding
- Filters: Top toolbar with dropdowns, search

**Property Listings Grid**:
- Card-based with property image (aspect-ratio 4/3)
- Property details overlay on image
- Price: Large, prominent (20px)
- Key specs: Bedrooms, bathrooms, sqft (icon + number)
- Status badge: Top-right corner
- Card hover: Subtle elevation change

### Forms & Inputs
**Input Fields**:
- Height: 40px (10 Tailwind)
- Padding: 3 horizontal, 2 vertical
- Label above: 12px, medium, 2 margin-bottom
- Focused state: Clear border emphasis
- Error state: Red accent with message below

**Select Dropdowns**:
- Match input height
- Chevron icon right-aligned
- Custom styling for consistency

**Buttons**:
- Primary: 10 height, 6 horizontal padding, medium weight
- Secondary: Similar sizing, different treatment
- Icon buttons: 10x10 square, centered icon
- Button groups: 2 gap, rounded-lg container

### Client Management
**Client Cards**:
- Avatar (48px) + name + contact info
- Recent activity timeline
- Quick actions (call, email, schedule)
- 6 padding, hover elevation

**Client Detail View**:
- Two-column layout: Profile left (320px), activity feed right
- Tabbed sections: Overview, Properties, Documents, Notes
- Activity feed with timestamps, icons

### Task Tracking
**Kanban Board**:
- Columns: To Do, In Progress, Completed
- Card-based tasks with drag capability placeholder
- Priority indicators (high/medium/low visual markers)
- Due date badges
- Assignee avatars (32px)

**Task List View**:
- Checkbox + task name + metadata row
- Grouped by date/priority
- Inline editing capability
- Filter/sort toolbar

---

## Images Section

**Hero Section**: NO large hero image - This is a dashboard application that loads directly into the main interface.

**Property Images**:
- Listing cards: High-quality property photos, aspect-ratio 4/3
- Detail view: Image gallery with 5-7 photos, primary large (16/9), thumbnails below
- Map integration: Interactive property location maps

**Client Avatars**:
- Profile photos: 48px circles in lists, 96px in detail views
- Placeholder avatars: Initials on gradient backgrounds when no photo

**Dashboard Visualizations**:
- Chart/graph renderings (via Chart.js or similar)
- No decorative images in analytics sections

**Empty States**:
- Illustration-based empty states for zero-data scenarios
- Simple line art style (not photos)

---

## Dashboard Layout Specifics

**Main Dashboard Page**:
- Top row: 4 metric cards (properties, clients, revenue, tasks) - grid-cols-4
- Second row: Revenue chart (col-span-2) + Recent activity feed (col-span-1)
- Third row: Property performance table (full-width)
- Consistent 6 gap between all elements

**Analytics Page**:
- Date range selector: Top-right
- Large chart: Performance over time (full-width, min-h-96)
- Metric breakdown: 3-column grid below
- Geographic heat map: Property distribution
- Comparison tables: Month-over-month, year-over-year

**Properties Page**:
- Filter sidebar: Left (240px), sticky
- Grid view default: 3-4 columns responsive
- List view toggle option
- Sort controls: Top-right (price, date, size)
- Pagination: Bottom

---

## Accessibility & Polish

- Consistent focus indicators across all interactive elements
- Form inputs maintain 44px minimum touch target
- ARIA labels for icon-only buttons
- Keyboard navigation support throughout
- Loading states: Skeleton screens for data-heavy sections
- Error boundaries with graceful fallbacks

**Micro-interactions** (minimal):
- Smooth page transitions (150ms)
- Hover elevations on cards (subtle shadow)
- Button state transitions (100ms)
- No gratuitous animations