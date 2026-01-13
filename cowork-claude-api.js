/**
 * Claude API Integration for Cowork Agent
 * Handles communication with Anthropic's Claude API
 * Supports tool use, streaming, and context management
 */

class ClaudeAPI {
    constructor(apiKey, model = 'claude-sonnet-4-5-20250929') {
        this.apiKey = apiKey;
        this.model = model;
        this.baseURL = 'https://api.anthropic.com/v1/messages';
        this.version = '2023-06-01';
        this.maxTokens = 4096;
        this.temperature = 1.0;
    }

    /**
     * Send a message to Claude
     * @param {Array} messages - Array of message objects with role and content
     * @param {Object} options - Optional parameters (system, temperature, max_tokens, etc.)
     * @returns {Promise<Object>} Response object
     */
    async chat(messages, options = {}) {
        const payload = {
            model: this.model,
            max_tokens: options.max_tokens || this.maxTokens,
            temperature: options.temperature !== undefined ? options.temperature : this.temperature,
            messages: messages
        };

        if (options.system) {
            payload.system = options.system;
        }

        if (options.tools) {
            payload.tools = options.tools;
        }

        if (options.stream) {
            return this.streamChat(payload);
        }

        try {
            const response = await fetch(this.baseURL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': this.version
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
            }

            const result = await response.json();
            return {
                success: true,
                content: result.content,
                stopReason: result.stop_reason,
                usage: result.usage,
                model: result.model
            };
        } catch (error) {
            console.error('Claude API Error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Chat with tool use capability
     * @param {Array} messages - Conversation messages
     * @param {Array} tools - Available tools
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Response with potential tool calls
     */
    async chatWithTools(messages, tools, options = {}) {
        const response = await this.chat(messages, { ...options, tools });

        if (!response.success) {
            return response;
        }

        // Parse tool use from response
        const toolUses = response.content.filter(block => block.type === 'tool_use');
        const textContent = response.content.filter(block => block.type === 'text')
            .map(block => block.text).join('\n');

        return {
            ...response,
            text: textContent,
            toolUses: toolUses,
            hasToolUse: toolUses.length > 0
        };
    }

    /**
     * Plan a task by breaking it down into steps
     * @param {string} taskDescription - Description of the task to plan
     * @param {Object} context - Context information (files, permissions, etc.)
     * @returns {Promise<Object>} Plan object with steps
     */
    async planTask(taskDescription, context = {}) {
        const systemPrompt = `You are an expert task planning assistant for the Cowork agent. Your role is to break down user tasks into clear, executable steps.

Guidelines:
1. Analyze the task and available context (files, permissions, workspace)
2. Break down the task into 3-10 specific, actionable steps
3. Identify dependencies between steps
4. Consider safety and user confirmations for destructive operations
5. Be specific about what files to read/write and what operations to perform

Response format (JSON):
{
  "summary": "Brief task summary",
  "steps": [
    {
      "id": 1,
      "action": "read_file" | "write_file" | "edit_file" | "list_directory" | "create_directory" | "search_files" | "analyze_content" | "synthesize_results",
      "description": "Human-readable step description",
      "target": "File path or directory",
      "parameters": {},
      "requires_confirmation": boolean,
      "depends_on": [step_ids]
    }
  ],
  "risks": ["Any potential risks or things to watch out for"],
  "estimated_complexity": "low" | "medium" | "high"
}`;

        const contextInfo = this.formatContext(context);
        const userMessage = `Task: ${taskDescription}\n\nContext:\n${contextInfo}\n\nCreate a detailed execution plan for this task.`;

        const response = await this.chat(
            [{ role: 'user', content: userMessage }],
            {
                system: systemPrompt,
                temperature: 0.7,
                max_tokens: 2048
            }
        );

        if (!response.success) {
            return { success: false, error: response.error };
        }

        try {
            // Extract JSON from response
            const text = response.content.find(block => block.type === 'text')?.text || '';
            const jsonMatch = text.match(/\{[\s\S]*\}/);

            if (!jsonMatch) {
                throw new Error('No JSON plan found in response');
            }

            const plan = JSON.parse(jsonMatch[0]);
            return {
                success: true,
                plan: plan,
                rawResponse: text
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to parse plan: ${error.message}`,
                rawResponse: response.content
            };
        }
    }

    /**
     * Refine an approach based on execution results
     * @param {Object} originalPlan - The original plan
     * @param {Array} executionResults - Results from executing steps
     * @param {string} feedback - Optional user feedback
     * @returns {Promise<Object>} Refined plan
     */
    async refineApproach(originalPlan, executionResults, feedback = null) {
        const systemPrompt = `You are an expert at analyzing task execution results and refining plans. Review what has been done, identify issues or improvements needed, and create an updated plan.

Focus on:
1. What worked well and should be kept
2. What failed or had issues and needs adjustment
3. Missing steps that should be added
4. Better approaches based on actual results

Provide a refined plan in the same JSON format.`;

        const resultsText = executionResults.map((result, idx) =>
            `Step ${idx + 1}: ${result.success ? '✓' : '✗'} ${result.description}\n  Result: ${result.message || result.error}`
        ).join('\n\n');

        const userMessage = `Original Plan:\n${JSON.stringify(originalPlan, null, 2)}\n\nExecution Results:\n${resultsText}${feedback ? `\n\nUser Feedback: ${feedback}` : ''}\n\nCreate a refined plan to complete or improve the task.`;

        const response = await this.chat(
            [{ role: 'user', content: userMessage }],
            {
                system: systemPrompt,
                temperature: 0.7,
                max_tokens: 2048
            }
        );

        if (!response.success) {
            return { success: false, error: response.error };
        }

        try {
            const text = response.content.find(block => block.type === 'text')?.text || '';
            const jsonMatch = text.match(/\{[\s\S]*\}/);

            if (!jsonMatch) {
                throw new Error('No JSON plan found in response');
            }

            const refinedPlan = JSON.parse(jsonMatch[0]);
            return {
                success: true,
                plan: refinedPlan,
                rawResponse: text
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to parse refined plan: ${error.message}`,
                rawResponse: response.content
            };
        }
    }

    /**
     * Synthesize results from multiple task executions
     * @param {string} originalTask - The original task description
     * @param {Array} results - All execution results
     * @returns {Promise<Object>} Synthesized summary
     */
    async synthesizeResults(originalTask, results) {
        const systemPrompt = `You are an expert at synthesizing task execution results into clear, actionable summaries. Create a comprehensive summary that tells the user:
1. What was accomplished
2. What files were created/modified
3. Any issues encountered
4. Next steps or recommendations

Be specific and include file paths, statistics, and concrete outcomes.`;

        const resultsText = results.map(r =>
            `${r.action}: ${r.description}\nOutcome: ${r.success ? 'Success' : 'Failed'}\nDetails: ${r.message || r.error}`
        ).join('\n\n---\n\n');

        const userMessage = `Original Task: ${originalTask}\n\nExecution Results:\n${resultsText}\n\nProvide a clear summary of what was accomplished.`;

        const response = await this.chat(
            [{ role: 'user', content: userMessage }],
            {
                system: systemPrompt,
                temperature: 0.7,
                max_tokens: 1024
            }
        );

        if (!response.success) {
            return { success: false, error: response.error };
        }

        const summary = response.content.find(block => block.type === 'text')?.text || '';
        return {
            success: true,
            summary: summary
        };
    }

    /**
     * Format context information for Claude
     */
    formatContext(context) {
        const parts = [];

        if (context.workspace) {
            parts.push(`Workspace: ${context.workspace}`);
        }

        if (context.files && context.files.length > 0) {
            parts.push(`Files in workspace: ${context.files.length} files`);
            if (context.files.length <= 20) {
                parts.push(`File list:\n${context.files.map(f => `  - ${f}`).join('\n')}`);
            }
        }

        if (context.permissions) {
            parts.push(`Permissions: ${JSON.stringify(context.permissions)}`);
        }

        if (context.currentFiles) {
            parts.push(`Currently selected files:\n${context.currentFiles.map(f => `  - ${f}`).join('\n')}`);
        }

        return parts.join('\n\n');
    }

    /**
     * Test API connection
     * @returns {Promise<Object>} Test result
     */
    async testConnection() {
        const response = await this.chat(
            [{ role: 'user', content: 'Hello! This is a connection test. Please respond with "Connection successful."' }],
            { max_tokens: 100, temperature: 0.5 }
        );

        return response;
    }

    /**
     * Get available models info
     */
    static getAvailableModels() {
        return [
            {
                id: 'claude-opus-4-5-20251101',
                name: 'Claude Opus 4.5',
                description: 'Most capable model, best for complex reasoning',
                contextWindow: 200000,
                costTier: 'premium'
            },
            {
                id: 'claude-sonnet-4-5-20250929',
                name: 'Claude Sonnet 4.5',
                description: 'Balanced performance and speed',
                contextWindow: 200000,
                costTier: 'standard'
            },
            {
                id: 'claude-sonnet-4-20250514',
                name: 'Claude Sonnet 4',
                description: 'Fast and efficient',
                contextWindow: 200000,
                costTier: 'standard'
            },
            {
                id: 'claude-3-5-haiku-20241022',
                name: 'Claude 3.5 Haiku',
                description: 'Fastest model, best for simple tasks',
                contextWindow: 200000,
                costTier: 'budget'
            }
        ];
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ClaudeAPI;
}
