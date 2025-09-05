---
title: CodeCraft Widget System
tags: [widgets, game-mechanics, interactive, components]
created: 2025-01-09
updated: 2025-01-09
---

# 🎯 CodeCraft Widget System

> **Interactive Magic at Your Fingertips**

Widgets are the heart of CodeCraft - transforming traditional coding interfaces into interactive game mechanics. Each widget is a mini-game that generates real code while providing engaging gameplay.

## 📊 Widget Categories

### ⚔️ Combat Widgets (Interactive Input)
Widgets that require player action and decision-making.

### 📜 Lore Widgets (Display & Visualization)
Widgets that present information and tell the story.

### 🛠️ Craft Widgets (System & Tools)
Widgets that provide tools and system functionality.

## 🎮 Current Widget Arsenal (14 Implemented)

### 1. ⚡ **Code Editor Widget** - *The Spell Forge*
**Type**: Combat Widget
**Purpose**: Craft magical code spells
**Game Mechanics**:
- Each successful run grants 10-50 XP
- Syntax errors spawn bug enemies
- Clean code unlocks achievements
- Language mastery tracks progress

```javascript
// Current Implementation
{
  type: "code_editor",
  language: "javascript",
  content: "// Your spell here",
  actions: ["run", "save", "copy"]
}

// Gamified Enhancement (Coming)
{
  type: "code_editor",
  language: "javascript",
  content: "// Your spell here",
  xpReward: 25,
  bugCount: 0,
  powerLevel: "intermediate",
  achievements: ["First Spell", "Bug Slayer"]
}
```

### 2. 📝 **Form Widget** - *The Decision Altar*
**Type**: Combat Widget
**Purpose**: Make strategic choices that shape your quest
**Game Mechanics**:
- Each choice has consequences
- Options show stat impacts
- Unlock paths based on decisions
- Track decision history

```javascript
// Current Implementation
{
  type: "form",
  fields: [{
    name: "framework",
    type: "select",
    options: ["React", "Vue", "Angular"]
  }]
}

// Gamified Enhancement (Coming)
{
  type: "form",
  title: "Choose Your Weapon",
  fields: [{
    name: "framework",
    type: "select",
    options: [
      { value: "React", stats: "+10 Speed, +5 Community" },
      { value: "Vue", stats: "+15 Simplicity, +8 Joy" },
      { value: "Angular", stats: "+20 Power, +12 Structure" }
    ]
  }],
  consequence: "This choice will affect your entire quest line"
}
```

### 3. 🎯 **Quiz Widget** - *The Trial of Knowledge*
**Type**: Combat Widget
**Purpose**: Test your skills and earn rewards
**Game Mechanics**:
- XP scaled by score percentage
- Time bonuses for quick answers
- Unlock hints with earned gold
- Achievement for perfect scores

```javascript
// Current Implementation
{
  type: "quiz",
  questions: [/* questions */],
  multipleChoice: true
}

// Gamified Enhancement (Coming)
{
  type: "quiz",
  title: "The JavaScript Gauntlet",
  questions: [/* questions */],
  xpPerQuestion: 15,
  timeBonus: true,
  powerUps: ["50/50", "Ask the Oracle"],
  achievement: "JavaScript Master"
}
```

### 4. 📊 **Chart Widget** - *The Progress Crystal*
**Type**: Lore Widget
**Purpose**: Visualize your journey and achievements
**Game Mechanics**:
- Show XP progression over time
- Display quest completion rates
- Track skill improvements
- Compare with guild members

```javascript
// Gamified Usage
{
  type: "chart",
  chartType: "line",
  title: "Your Power Growth",
  data: {
    labels: ["Week 1", "Week 2", "Week 3"],
    datasets: [{
      label: "XP Gained",
      data: [100, 350, 750],
      borderColor: "#FFD700"
    }]
  }
}
```

### 5. 📋 **Table Widget** - *The Leaderboard Scroll*
**Type**: Lore Widget
**Purpose**: Display rankings, stats, and comparisons
**Game Mechanics**:
- Show player rankings
- Display achievement lists
- Track quest completions
- Compare stats with others

### 6. 📖 **Markdown Widget** - *The Codex*
**Type**: Lore Widget
**Purpose**: Present lore, instructions, and documentation
**Game Mechanics**:
- Quest descriptions
- Spell documentation
- Achievement details
- Story progression

### 7. 🎨 **Alert Widget** - *The Herald*
**Type**: Lore Widget
**Purpose**: Announce achievements, warnings, and events
**Game Mechanics**:
- Level up notifications
- Achievement unlocks
- Quest completions
- Combat results

```javascript
// Gamified Usage
{
  type: "alert",
  variant: "achievement",
  title: "🏆 Achievement Unlocked!",
  message: "Bug Slayer - Defeated 100 bugs",
  xpReward: 500,
  autoClose: 5000
}
```

### 8. 💪 **Progress Widget** - *The Power Bar*
**Type**: Lore Widget
**Purpose**: Show progress toward goals
**Game Mechanics**:
- XP to next level
- Quest completion
- Skill progression
- Daily challenges

### 9. 🗺️ **Diagram Widget** - *The Strategy Map*
**Type**: Lore Widget
**Purpose**: Visualize system architecture and flow
**Game Mechanics**:
- Quest flow diagrams
- Skill trees
- System maps
- Battle strategies

### 10. 🎬 **Media Widget** - *The Vision Orb*
**Type**: Lore Widget
**Purpose**: Display visual content and cutscenes
**Game Mechanics**:
- Victory animations
- Tutorial videos
- Achievement showcases
- Story cinematics

### 11. 💻 **Terminal Widget** - *The Command Throne*
**Type**: Craft Widget
**Purpose**: Direct command over your realm
**Game Mechanics**:
- Command combos for bonuses
- Hidden commands unlock secrets
- Speed typing challenges
- Terminal mastery tracking

### 12. 🌳 **File Tree Widget** - *The Code Forest*
**Type**: Craft Widget
**Purpose**: Navigate your kingdom of code
**Game Mechanics**:
- Explore to gain map knowledge
- Hidden treasures in folders
- File count affects realm size
- Organization bonus for structure

### 13. 📁 **File Tree Node** - *Forest Elements*
**Type**: Craft Widget (Component)
**Purpose**: Individual elements of the code forest

### 14. 🎛️ **Widget Manager** - *The Grand Orchestrator*
**Type**: System
**Purpose**: Controls all widget magic
**Game Mechanics**:
- Widget combo bonuses
- Manages widget state
- Tracks widget usage stats
- Unlocks new widgets

## 🚀 Upcoming Widgets (Planned)

### 🎮 Game-Specific Widgets

#### **Decision Tree Widget** - *The Fate Weaver*
Choose your path with visual consequences
```javascript
{
  type: "decision_tree",
  title: "Architecture Choice",
  branches: [
    {
      choice: "Microservices",
      pros: ["Scalability", "Independence"],
      cons: ["Complexity", "Network overhead"],
      xpReward: 100
    }
  ]
}
```

#### **Battle Widget** - *The Debug Arena*
Turn-based combat against bugs
```javascript
{
  type: "battle",
  enemy: {
    name: "NullPointer Dragon",
    hp: 100,
    attacks: ["Undefined Strike", "Memory Leak"]
  },
  playerSpells: ["Type Check", "Try-Catch", "Debugger"]
}
```

#### **Inventory Widget** - *The Artifact Vault*
Manage your collected code snippets and tools
```javascript
{
  type: "inventory",
  items: [
    { name: "React Hook", rarity: "epic", uses: 5 },
    { name: "SQL Query", rarity: "common", uses: 99 }
  ],
  capacity: 50
}
```

#### **Skill Tree Widget** - *The Path of Mastery*
Visual progression system
```javascript
{
  type: "skill_tree",
  trees: ["Frontend Wizardry", "Backend Sorcery", "DevOps Ranger"],
  availablePoints: 5,
  unlockedSkills: ["HTML Basics", "CSS Fundamentals"]
}
```

#### **Quest Journal Widget** - *The Epic Ledger*
Track all active and completed quests
```javascript
{
  type: "quest_journal",
  activeQuests: [/* quests */],
  completedQuests: [/* quests */],
  dailyQuests: [/* quests */],
  totalXP: 1250
}
```

## 🔧 Widget Development Guide

### Creating a New Widget

#### Step 1: Define the Game Mechanic
What gameplay does this widget provide?

#### Step 2: Create Vue Component
```vue
<template>
  <div class="widget-container">
    <!-- Widget content -->
  </div>
</template>

<script setup lang="ts">
import { useWidgetStore } from '@/stores/widgets'

const props = defineProps<{
  widget: WidgetData
}>()

const emit = defineEmits<{
  interact: [action: string, data: any]
  complete: [result: any]
}>()

// Widget logic here
</script>
```

#### Step 3: Register in WidgetManager
```typescript
// In WidgetManager.vue
const widgetComponents = {
  // ... existing widgets
  'new_widget': defineAsyncComponent(() => import('./NewWidget.vue'))
}
```

#### Step 4: Add Game Mechanics
- XP rewards
- Achievement triggers
- Progress tracking
- Visual feedback

## 📈 Widget Analytics

### Usage Statistics
Track which widgets are most engaging:
- Code Editor: 45% usage
- Form: 20% usage
- Quiz: 15% usage
- Others: 20% combined

### Engagement Metrics
- Average interaction time
- Completion rates
- XP generated per widget
- User satisfaction scores

## 🎨 Widget Styling Guide

### Game-Themed Styling
```scss
.widget-container {
  background: linear-gradient(135deg, #1e3c72, #2a5298);
  border: 2px solid #FFD700;
  border-radius: 8px;
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.3);
  
  &.legendary {
    border-color: #E91E63;
    animation: legendary-glow 2s infinite;
  }
  
  &.epic {
    border-color: #9C27B0;
    animation: epic-pulse 1.5s infinite;
  }
}
```

## 🔗 Related Documentation

- [Creating Widgets](./creating-widgets.md) - Developer guide
- [Widget API](../05-api/widget-api.md) - Technical reference
- [Game Mechanics](../00-vision/game-mechanics.md) - How widgets fit the game
- [Current Implementation](../04-implementation/current-state.md) - What exists now

---

*"Every widget is a spell, every interaction is magic, every result is progress."*