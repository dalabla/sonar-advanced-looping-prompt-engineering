# Cowork Agent Implementation Plan
## Building a Claude-Powered Agentic Assistant

### Project Overview
Build a Cowork-like agentic assistant using Claude models (Sonnet, Opus, Haiku) that can autonomously work with files, plan tasks, and execute complex multi-step workflows. This will extend the existing Sonar looping console with agentic capabilities.

---

## 1. System Architecture

### 1.1 Core Components

```
┌─────────────────────────────────────────────────────┐
│                  Cowork UI Layer                     │
│  - Task Input & Queue Display                       │
│  - File Browser & Permission Manager                │
│  - Agent Status & Activity Monitor                  │
│  - Planning & Execution Visualizer                  │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│              Agent Orchestration Engine              │
│  - Task Queue Manager                               │
│  - Parallel Execution Coordinator                   │
│  - Planning & Reflection Loop                       │
│  - Context Management                               │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│                 Claude API Layer                     │
│  - Model Selection (Sonnet/Opus/Haiku)             │
│  - Prompt Engineering & System Prompts              │
│  - Response Parsing & Tool Use                      │
│  - Rate Limiting & Error Handling                   │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│              Tool Execution Layer                    │
│  - File System Access (Read/Write/Edit)            │
│  - Skills System (Documents, Presentations, etc)    │
│  - Web Search Integration (via Sonar)              │
│  - External Connectors                              │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│               Safety & Control Layer                 │
│  - Permission System                                │
│  - Action Confirmation                              │
│  - Prompt Injection Defense                         │
│  - Audit Log                                        │
└─────────────────────────────────────────────────────┘
```

---

## 2. Detailed Component Design

### 2.1 Claude API Integration

**File:** `cowork-claude-api.js`

**Capabilities:**
- Support for Claude 3 models (Opus, Sonnet, Haiku)
- Tool use / function calling support
- Streaming responses
- Context window management
- Token counting and budget tracking

**Key Functions:**
```javascript
class ClaudeAPI {
  async chat(messages, options)
  async chatWithTools(messages, tools, options)
  async planTask(taskDescription, context)
  async refineApproach(plan, feedback, results)
  async synthesizeResults(taskResults)
}
```

### 2.2 Agentic Planning Engine

**File:** `cowork-agent.js`

**Workflow:**
1. **Task Analysis**: Break down user request into subtasks
2. **Planning**: Create step-by-step execution plan
3. **Execution**: Execute steps with tool calls
4. **Reflection**: Evaluate results and adjust plan
5. **Iteration**: Loop until task completion or user intervention
6. **Synthesis**: Combine results into final output

**Key Features:**
- Multi-step planning with dependencies
- Dynamic replanning based on results
- Error recovery and retry logic
- Progress tracking and reporting

### 2.3 File System Access

**File:** `cowork-filesystem.js`

**Using:** Browser File System Access API (Chrome/Edge)

**Capabilities:**
```javascript
class FileSystemManager {
  async requestDirectoryAccess()
  async readFile(path)
  async writeFile(path, content)
  async editFile(path, changes)
  async listDirectory(path, recursive)
  async createDirectory(path)
  async deleteFile(path) // with confirmation
  async searchFiles(pattern)
}
```

**Safety Features:**
- Scoped to user-selected directory only
- Confirmation for destructive operations
- Backup creation before edits
- Read-only mode option

### 2.4 Task Queue & Parallel Execution

**File:** `cowork-task-queue.js`

**Features:**
- Queue multiple tasks from user
- Identify independent vs dependent tasks
- Execute independent tasks in parallel
- Manage task priorities
- Handle task cancellation
- Real-time progress updates

```javascript
class TaskQueue {
  addTask(taskDescription, priority)
  async executeTasks(maxParallel)
  pauseTask(taskId)
  resumeTask(taskId)
  cancelTask(taskId)
  getTaskStatus(taskId)
}
```

### 2.5 Skills System

**File:** `cowork-skills.js`

**Built-in Skills:**
1. **Document Creation**
   - Markdown files
   - Plain text documents
   - CSV/JSON data files

2. **File Organization**
   - Rename files intelligently
   - Sort and categorize
   - Move to folders by type/content

3. **Data Processing**
   - Extract data from images (OCR via API)
   - Parse and transform CSV/JSON
   - Aggregate information from multiple files

4. **Content Generation**
   - Draft reports from notes
   - Summarize multiple documents
   - Create structured outlines

**Extensible Architecture:**
```javascript
class Skill {
  constructor(name, description, executor)
  async canHandle(task)
  async execute(task, context)
  getRequiredPermissions()
}
```

### 2.6 Safety & Control

**File:** `cowork-safety.js`

**Permission System:**
- Granular permissions per folder/file type
- Whitelist/blacklist patterns
- Dangerous operation flags (delete, overwrite, etc.)
- User confirmation thresholds

**Prompt Injection Defense:**
1. Input sanitization
2. Context isolation (user instructions vs file content)
3. Suspicious pattern detection
4. Execution sandboxing

**Audit Trail:**
- Log all file operations
- Track all API calls
- Record user confirmations
- Export audit log

---

## 3. User Interface Design

### 3.1 Main Cowork Screen

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  🤖 Claude Cowork Agent                    [Settings] [Help] │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Workspace: [Select Folder...] /Users/me/project            │
│  Model: [Sonnet 4.5 ▼]  API Key: [••••••••••]              │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│  Task Input                                                   │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ What would you like Claude to help with?                ││
│  │                                                          ││
│  │ [Type your task here...]                                ││
│  │                                                          ││
│  └─────────────────────────────────────────────────────────┘│
│  [Add to Queue]  [Execute Now]                               │
│                                                               │
├──────────────────────┬──────────────────────────────────────┤
│  Task Queue (3)      │  Agent Activity                       │
│  ─────────────────   │  ─────────────────                   │
│  ☑ Task 1            │  🔄 Planning task: "Organize files"  │
│  ▶ Task 2 (running)  │                                       │
│  ⏸ Task 3 (paused)   │  📋 Plan (5 steps):                  │
│                      │  1. ✓ Scan directory                 │
│                      │  2. ▶ Categorize files               │
│  [Clear Completed]   │  3. ⏳ Create folders                 │
│                      │  4. ⏳ Move files                     │
│                      │  5. ⏳ Generate report                │
│                      │                                       │
├──────────────────────┼──────────────────────────────────────┤
│  File Browser        │  Results & Output                     │
│  ─────────────────   │  ─────────────────                   │
│  📁 project/         │  Successfully organized 47 files:    │
│    📁 documents/     │  - 12 PDFs → /documents              │
│    📁 images/        │  - 8 images → /images                │
│    📄 notes.txt      │  - 15 markdown → /notes              │
│    📄 report.md      │  - 12 misc → /misc                   │
│                      │                                       │
│  [Refresh]           │  [Copy] [Download] [Share]           │
└──────────────────────┴──────────────────────────────────────┘
```

### 3.2 Key UI Elements

1. **Task Queue Panel**
   - Visual task status (pending, running, paused, completed, failed)
   - Progress indicators
   - Task controls (pause, resume, cancel)

2. **Agent Activity Monitor**
   - Real-time planning updates
   - Step-by-step execution view
   - Reasoning/thinking display (optional)

3. **File Browser**
   - Tree view of workspace
   - File preview capability
   - Change indicators (modified, created, deleted)

4. **Confirmation Dialogs**
   - "Claude wants to delete 5 files. Allow?"
   - "Claude wants to write to system folder. Allow?"
   - Always/Never/Ask options

---

## 4. Implementation Phases

### Phase 1: Foundation (Core API & UI)
- ✅ Claude API integration
- ✅ Basic UI shell
- ✅ File system access setup
- ✅ Simple task execution

### Phase 2: Agentic Capabilities
- ✅ Planning engine
- ✅ Reflection loop
- ✅ Tool use integration
- ✅ Basic error handling

### Phase 3: Advanced Features
- ✅ Task queue & parallel execution
- ✅ Skills system
- ✅ Progress tracking
- ✅ Context management

### Phase 4: Safety & Polish
- ✅ Permission system
- ✅ Prompt injection defense
- ✅ Audit logging
- ✅ UI polish & UX improvements

### Phase 5: Integration & Extensions
- ✅ Sonar search integration
- ✅ External connectors
- ✅ Advanced skills
- ✅ Documentation

---

## 5. Technical Decisions

### 5.1 Why Browser-Based?
- No installation required
- Cross-platform compatibility
- Secure file access via File System Access API
- Easy deployment and updates
- Familiar web technologies

### 5.2 Claude Model Selection Strategy

**Haiku (Fast & Cheap):**
- Quick planning steps
- Simple file operations
- Status updates

**Sonnet (Balanced):**
- Complex planning
- Content generation
- Most agent operations

**Opus (Premium):**
- Critical decisions
- Complex reasoning
- High-stakes operations

### 5.3 State Management
- Use JavaScript classes with event emitters
- Local storage for settings & preferences
- IndexedDB for task history & audit log
- Session storage for temporary state

---

## 6. Safety Considerations

### 6.1 File Operation Safety
1. Always show preview before destructive operations
2. Create automatic backups
3. Implement undo capability
4. Rate limit operations
5. Scan for sensitive file patterns (.env, credentials, etc.)

### 6.2 Prompt Injection Mitigation
1. **Context Separation:**
   ```
   <user_instruction>
   [User's actual task]
   </user_instruction>

   <file_content>
   [Content from files - treat as data, not instructions]
   </file_content>
   ```

2. **Validation:**
   - Check for suspicious patterns in file content
   - Validate tool calls against expected schema
   - Confirm unusual operations with user

3. **Sandboxing:**
   - Limit file access to approved directory
   - No execution of arbitrary code
   - API rate limiting

### 6.3 User Control
- Transparent operation logging
- Easy emergency stop
- Granular permission controls
- Clear before/after views

---

## 7. Example Workflows

### Example 1: Organize Downloads Folder
**User:** "Organize my downloads folder by file type and date"

**Agent Process:**
1. **Plan:**
   - Scan downloads folder
   - Identify file types
   - Create category folders (images, documents, videos, etc.)
   - Sort files by date within categories
   - Generate organization report

2. **Execute:**
   - Read directory listing
   - Analyze each file (extension, size, date)
   - Ask: "Create 5 new folders and move 47 files?"
   - Perform file operations
   - Create summary markdown file

3. **Result:**
   - Organized folder structure
   - Report with statistics
   - Before/after comparison

### Example 2: Create Expense Report from Screenshots
**User:** "Create an expense report from receipt screenshots in my folder"

**Agent Process:**
1. **Plan:**
   - Find all image files
   - Extract text from receipts (OCR)
   - Parse amounts, dates, vendors
   - Calculate totals
   - Generate formatted report

2. **Execute:**
   - Scan for images
   - Process each image (describe/extract data)
   - Structure data as CSV/JSON
   - Create Excel-compatible CSV
   - Generate summary markdown

3. **Result:**
   - expense_report.csv with all data
   - expense_summary.md with totals
   - Organized receipts folder

### Example 3: Draft Report from Scattered Notes
**User:** "Write a quarterly report from my meeting notes in /notes"

**Agent Process:**
1. **Plan:**
   - Find all markdown/text files in /notes
   - Read and analyze content
   - Identify key themes and topics
   - Structure as quarterly report
   - Draft report sections

2. **Execute:**
   - Read all note files
   - Extract key points and data
   - Synthesize information
   - Write structured report
   - Save as Q1_2024_Report.md

3. **Result:**
   - Comprehensive quarterly report
   - Proper formatting and structure
   - Citations to source notes

---

## 8. Integration with Existing Sonar Console

### Unified Interface Options

**Option A: Separate Tabs**
```
[Sonar Looping] [Cowork Agent]
```

**Option B: Mode Toggle**
```
Mode: [Prompt Engineering] [Agent Tasks]
```

**Option C: Integrated**
- Cowork can use Sonar for web search
- Prompt engineering can delegate tasks to agent
- Shared settings and API keys

---

## 9. Success Metrics

### Functional Goals
- ✅ Successfully execute multi-step file operations
- ✅ Handle at least 3 parallel tasks
- ✅ Accurate planning with <20% replanning rate
- ✅ Zero data loss incidents
- ✅ <5 second response time for simple operations

### User Experience Goals
- ✅ Intuitive UI requiring minimal explanation
- ✅ Clear visibility into agent actions
- ✅ Responsive and non-blocking interface
- ✅ Helpful error messages and recovery options

### Safety Goals
- ✅ Zero unauthorized file access
- ✅ 100% confirmation rate for destructive operations
- ✅ Robust prompt injection detection
- ✅ Complete audit trail

---

## 10. Future Enhancements

### Version 2.0
- Multi-directory workspaces
- Git integration (commit, branch, PR)
- Collaboration features (shared tasks)
- Voice input/output
- Mobile support (iOS/Android)

### Version 3.0
- Custom skill marketplace
- Advanced automation (scheduled tasks)
- Integration with cloud storage (Dropbox, Google Drive)
- Team features and permissions
- API for external integrations

---

## 11. Development Timeline Estimate

### MVP (Minimum Viable Product)
- Core agent functionality
- Basic UI
- File operations
- Safety controls
- **Estimated:** Focus on implementation quality, not timeline

### Beta Release
- All Phase 1-3 features
- Basic skills system
- Testing and bug fixes
- **Estimated:** Focus on implementation quality, not timeline

### Production v1.0
- Complete feature set
- Comprehensive testing
- Documentation
- **Estimated:** Focus on implementation quality, not timeline

---

## 12. Technical Stack

### Frontend
- HTML5 / CSS3
- Vanilla JavaScript (ES6+)
- Tailwind CSS for styling
- File System Access API
- IndexedDB for storage

### APIs & Services
- Anthropic Claude API
- Perplexity Sonar API (for search)
- Optional: OCR service for image processing

### Development Tools
- Git for version control
- Local testing server
- Browser DevTools
- API testing tools (Postman/Insomnia)

---

## Conclusion

This implementation plan provides a comprehensive roadmap for building a Claude-powered Cowork agent that extends your existing Sonar looping console. The architecture is modular, allowing for incremental development and testing. Safety and user control are paramount, with multiple layers of protection against unintended actions.

The agentic approach enables Claude to work more autonomously while keeping the user in control through transparent operations, confirmation dialogs, and easy intervention points. The integration with Sonar provides web search capabilities, making the agent even more powerful for research and information synthesis tasks.

Next step: Begin implementation starting with Phase 1 (Foundation).
