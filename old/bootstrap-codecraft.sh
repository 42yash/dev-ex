#!/bin/bash

# CodeCraft Bootstrap Script
# Transform Claude Code into an interactive game development platform

echo "════════════════════════════════════════════════════════════"
echo "   🎮 CodeCraft Bootstrap Protocol v1.0.0 🎮"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Initializing the transformation of Claude Code into CodeCraft..."
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[*]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "backend" ]; then
    print_error "This script must be run from the Dev-Ex project root directory"
    exit 1
fi

# Create backup of existing configuration
print_status "Creating backup of existing configuration..."
if [ -d ".claude" ]; then
    timestamp=$(date +%Y%m%d_%H%M%S)
    backup_dir=".claude_backup_${timestamp}"
    cp -r .claude "$backup_dir"
    print_success "Backup created: $backup_dir"
fi

# Ensure .claude directory structure exists
print_status "Creating CodeCraft directory structure..."
mkdir -p .claude/agents
mkdir -p .claude/commands
mkdir -p .claude/widgets
mkdir -p .claude/quests
mkdir -p .claude/gamestate
print_success "Directory structure created"

# Check if configuration files exist
print_status "Checking configuration files..."

configs=(
    ".claude/CLAUDE.md:CodeCraft Game Master personality"
    ".claude/settings.json:Game permissions and settings"
    ".claude/mcp.json:MCP server configurations"
    ".claude/agents/architect.json:The Architect agent"
    ".claude/agents/validator.json:The Validator agent"
    ".claude/agents/optimizer.json:The Optimizer agent"
    ".claude/commands/quest.md:Quest command"
    ".claude/commands/widget.md:Widget command"
    ".claude/commands/status.md:Status command"
)

missing=0
for config in "${configs[@]}"; do
    IFS=':' read -r file description <<< "$config"
    if [ -f "$file" ]; then
        print_success "$description configured"
    else
        print_warning "$description missing"
        missing=$((missing + 1))
    fi
done

if [ $missing -gt 0 ]; then
    print_warning "$missing configuration files missing. Some features may not work."
fi

# Initialize game state
print_status "Initializing game state..."
if [ ! -f ".claude/gamestate/player.json" ]; then
    cat > .claude/gamestate/player.json << 'EOF'
{
  "profile": {
    "name": "Code Architect",
    "level": 1,
    "experience": 0,
    "class": "Full-Stack Paladin",
    "joinDate": "2024-01-01"
  },
  "resources": {
    "codeCoins": 100,
    "architectureGems": 5,
    "knowledgePoints": 0
  },
  "stats": {
    "questsCompleted": 0,
    "linesGenerated": 0,
    "bugsFixed": 0,
    "testsWritten": 0
  },
  "achievements": [],
  "activeQuests": [],
  "bootstrapProgress": 35
}
EOF
    print_success "Game state initialized"
else
    print_success "Game state already exists"
fi

# Set up Git for quest management
print_status "Configuring Git for quest management..."
if command -v git &> /dev/null; then
    # Check if we're in a git repo
    if git rev-parse --git-dir > /dev/null 2>&1; then
        # Add .claude/gamestate to .gitignore
        if ! grep -q ".claude/gamestate" .gitignore 2>/dev/null; then
            echo ".claude/gamestate/" >> .gitignore
            print_success "Added gamestate to .gitignore"
        fi
        
        # Create quest branch if it doesn't exist
        if ! git show-ref --verify --quiet refs/heads/quest/main; then
            git checkout -b quest/main 2>/dev/null
            git checkout - 2>/dev/null
            print_success "Created quest/main branch"
        fi
    else
        print_warning "Not a Git repository. Quest branching disabled."
    fi
else
    print_warning "Git not found. Quest branching will be limited."
fi

# Check for Node.js and npm
print_status "Checking development environment..."
if command -v node &> /dev/null; then
    node_version=$(node --version)
    print_success "Node.js $node_version detected"
else
    print_warning "Node.js not found. Some features may be limited."
fi

if command -v npm &> /dev/null; then
    npm_version=$(npm --version)
    print_success "npm $npm_version detected"
else
    print_warning "npm not found. Package management disabled."
fi

# Install MCP servers (optional)
print_status "Checking MCP server availability..."
echo -e "${CYAN}Note: MCP servers are optional but enhance CodeCraft features${NC}"
echo -e "${CYAN}You can install them later with: npm install -g @modelcontextprotocol/server-*${NC}"

# Create activation script
print_status "Creating CodeCraft activation script..."
cat > .claude/activate.sh << 'EOF'
#!/bin/bash
echo "🎮 CodeCraft Mode Activated!"
echo "Level 1 Code Architect ready for quests!"
echo ""
echo "Quick Commands:"
echo "  /quest    - Start a new development quest"
echo "  /widget   - Summon an interactive widget"
echo "  /status   - Check your game statistics"
echo ""
echo "Agents Available:"
echo "  🏛️ The Architect - System design guidance"
echo "  🛡️ The Validator - Code quality assurance"
echo "  ⚡ The Optimizer - Performance enhancement"
echo ""
echo "May your code compile and your tests pass!"
EOF
chmod +x .claude/activate.sh
print_success "Activation script created"

# Display summary
echo ""
echo "════════════════════════════════════════════════════════════"
echo -e "${GREEN}   🎉 CodeCraft Bootstrap Complete! 🎉${NC}"
echo "════════════════════════════════════════════════════════════"
echo ""
echo -e "${PURPLE}Current Bootstrap Stage:${NC} HYBRID (35% self-building capability)"
echo ""
echo -e "${CYAN}What's been configured:${NC}"
echo "  ✅ CodeCraft personality and game master mode"
echo "  ✅ Three AI agent companions with unique abilities"
echo "  ✅ Slash commands for game actions"
echo "  ✅ Game state persistence"
echo "  ✅ Quest branching system"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Restart Claude Code to load the new configuration"
echo "  2. The AI will greet you as CodeCraft"
echo "  3. Type /quest to begin your first adventure"
echo "  4. Use /status to track your progress"
echo ""
echo -e "${GREEN}Optional Enhancements:${NC}"
echo "  • Install MCP servers for extended features"
echo "  • Configure GitHub integration for collaboration"
echo "  • Set up PostgreSQL for persistent game state"
echo ""
echo -e "${PURPLE}Remember:${NC} Every interaction helps CodeCraft evolve!"
echo "Together, we're building the builder that builds itself! 🔄"
echo ""
echo "════════════════════════════════════════════════════════════"
echo -e "${GREEN}Welcome to CodeCraft - Where Developers Become Legends!${NC} 🏆"
echo "════════════════════════════════════════════════════════════"