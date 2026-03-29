# Advanced AI Console - Sonar & Cowork

A powerful web-based AI console with two modes:

1. **🔍 Sonar Looping**: Iterative prompt engineering with Perplexity's web search models
2. **🤖 Cowork Agent**: Agentic file operations powered by Claude (our implementation inspired by Anthropic's announcement)

## Quick Start

### Sonar Mode (Prompt Engineering)
Open `index.html` - Refine prompts iteratively using Perplexity's Sonar models with real-time web search.

**Use Cases:**
- Research current information
- Iteratively improve prompt quality
- Web-enhanced content generation

### Cowork Mode (Agentic Assistant)
Open `cowork-standalone.html` - Let Claude autonomously work with your files through multi-step planning and execution.

**Note:** Use `cowork-standalone.html` (recommended) for direct browser access, or `cowork.html` with a local server for development.

**Use Cases:**
- Organize files and folders
- Analyze and synthesize content
- Create reports from multiple files
- Automate file-based workflows

## Features

### Sonar Looping (Original)
- ✅ Iterative prompt refinement loop
- ✅ Real-time web search via Perplexity Sonar
- ✅ Multiple model options (Sonar, Sonar Pro, Reasoning models)
- ✅ Goal-driven optimization
- ✅ History tracking and synthesis

### Cowork Agent (New)
- ✅ Autonomous task planning with Claude
- ✅ Plan → Execute → Reflect → Refine loop
- ✅ Secure file system access (Browser File System API)
- ✅ Multi-step workflows with replanning
- ✅ Task queue and parallel execution
- ✅ Safety controls and confirmations
- ✅ Audit logging
- ✅ Prompt injection protection

## Documentation

- **[Cowork Implementation Plan](COWORK_IMPLEMENTATION_PLAN.md)** - Technical architecture and design
- **[Cowork User Guide](COWORK_GUIDE.md)** - Complete usage guide with examples
- **Sonar Documentation** - See inline help in `index.html`

## Requirements

### For Sonar Mode
- Modern web browser
- Perplexity API key ([get one here](https://docs.perplexity.ai))

### For Cowork Mode
- Chrome, Edge, or Opera (File System Access API support)
- Claude API key ([get one here](https://console.anthropic.com))
- Local files to work with

## Architecture

```
project/
├── index.html                      # Sonar looping interface
├── cowork-standalone.html          # Cowork agent (single-file, recommended)
├── cowork.html                     # Cowork agent (multi-file, for dev)
├── cowork-claude-api.js           # Claude API integration module
├── cowork-filesystem.js           # File system access wrapper
├── cowork-task-queue.js           # Task management and scheduling
├── cowork-agent.js                # Main orchestration engine
├── cowork-safety.js               # Security and safety controls
├── start-server.sh                # Local development server launcher
├── COWORK_IMPLEMENTATION_PLAN.md  # Technical documentation
├── COWORK_GUIDE.md                # User guide
└── README.md                      # This file
```

**For End Users:** Use `cowork-standalone.html` - it's a single file with everything embedded.

**For Developers:** Use the multi-file version (`cowork.html` + modules) with a local server for easier debugging and modification.

## Key Concepts

### Sonar: Iterative Loop Pattern
```
Initial Prompt → Response → Analyze → Refine Prompt → Better Response → ... → Best Response
```

### Cowork: Agentic Execution Pattern
```
Task → Plan → Execute Steps → Check Results → Replan if needed → Synthesize → Complete
```

Both modes leverage iterative refinement, but Sonar focuses on prompts while Cowork focuses on actions.

## Safety & Privacy

### Sonar Mode
- API calls to Perplexity
- No file access
- Data not stored locally

### Cowork Mode
- API calls to Claude (Anthropic)
- File access only to selected folder (explicit permission)
- Browser-based sandboxing
- Destructive operations require confirmation
- Complete audit trail
- Prompt injection defenses

## Getting Started

### Quick Start (No Installation)

1. **Download** or clone this repository
2. Choose your mode:
   - **Prompt Engineering**: Open `index.html`, add Perplexity API key
   - **File Operations**: Open `cowork-standalone.html`, add Claude API key, select workspace
3. Follow the in-app instructions

### Development Setup (Multi-File Version)

If you want to modify the code:

```bash
# Start local server
./start-server.sh

# Then open:
# http://localhost:8000/cowork.html (Cowork Agent)
# http://localhost:8000/index.html (Sonar Looping)
```

For detailed Cowork usage, see [COWORK_GUIDE.md](COWORK_GUIDE.md).

## Examples

### Sonar Example
**Goal**: "Generate catchy taglines for a sparkling water brand targeting millennials"
**Process**: Iteratively refines prompts, uses web search for trends, synthesizes best tagline

### Cowork Example
**Task**: "Organize my downloads by file type and create a summary report"
**Process**: Plans steps, scans files, creates folders, moves files, generates report

## Technical Details

- **Frontend**: HTML5, CSS3 (Tailwind), Vanilla JavaScript
- **APIs**: Perplexity Sonar, Anthropic Claude
- **File Access**: Browser File System Access API
- **Architecture**: Event-driven, modular components

## Contributing

This is a research implementation. Feel free to:
- Report issues
- Suggest improvements
- Fork and extend
- Share your use cases

## License

See repository license.

## Acknowledgments

- **Perplexity AI** for Sonar search models
- **Anthropic** for Claude API and Cowork inspiration
- Built with love for the AI community

---

**Ready to try it?** Open `cowork-standalone.html` for agentic file operations or `index.html` for prompt engineering!
