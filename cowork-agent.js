/**
 * Cowork Agent - Main Orchestration Engine
 * Implements the agentic planning and execution loop
 * Inspired by the Sonar console's iteration pattern: Plan → Execute → Reflect → Refine
 */

class CoworkAgent {
    constructor(claudeAPI, fileSystem, taskQueue) {
        this.claude = claudeAPI;
        this.fs = fileSystem;
        this.queue = taskQueue;
        this.maxIterations = 5;
        this.currentTask = null;
        this.isRunning = false;
        this.eventHandlers = new Map();
    }

    /**
     * Execute a task with full planning and iteration loop
     * @param {string} taskId - Task ID to execute
     * @returns {Promise<Object>} Execution result
     */
    async executeTask(taskId) {
        const task = this.queue.getTask(taskId);
        if (!task) {
            return { success: false, error: 'Task not found' };
        }

        if (!this.queue.canExecute(taskId)) {
            return { success: false, error: 'Task cannot be executed (dependencies or capacity)' };
        }

        this.currentTask = task;
        this.isRunning = true;
        this.queue.markAsRunning(taskId);
        this.queue.updateTask(taskId, 'planning');

        this.emit('executionStarted', { taskId, task });

        try {
            // Phase 1: Planning
            const planResult = await this.planTask(task);
            if (!planResult.success) {
                this.queue.updateTask(taskId, 'failed', { error: planResult.error });
                return planResult;
            }

            this.queue.setPlan(taskId, planResult.plan);
            this.queue.updateTask(taskId, 'executing');

            // Phase 2: Execution Loop (with potential replanning)
            let iteration = 0;
            let executionResults = [];
            let currentPlan = planResult.plan;

            while (iteration < this.maxIterations) {
                this.emit('iterationStarted', { taskId, iteration, plan: currentPlan });

                const iterationResult = await this.executeIteration(task, currentPlan, iteration);
                executionResults.push(iterationResult);

                // Check if task is complete
                if (iterationResult.complete) {
                    this.emit('taskComplete', { taskId, results: executionResults });
                    break;
                }

                // Check if we need to replan
                if (iterationResult.needsReplanning) {
                    this.emit('replanning', { taskId, iteration, reason: iterationResult.reason });

                    const replanResult = await this.replanTask(task, currentPlan, executionResults);
                    if (replanResult.success) {
                        currentPlan = replanResult.plan;
                        this.queue.setPlan(taskId, currentPlan);
                    } else {
                        // If replanning fails, we stop
                        this.queue.updateTask(taskId, 'failed', { error: 'Replanning failed' });
                        return { success: false, error: 'Replanning failed', results: executionResults };
                    }
                }

                iteration++;
            }

            // Phase 3: Synthesis
            const synthesisResult = await this.synthesizeResults(task, executionResults);

            this.queue.updateTask(taskId, 'completed', {
                results: executionResults,
                synthesis: synthesisResult.summary
            });

            this.emit('executionComplete', { taskId, results: executionResults, synthesis: synthesisResult });

            return {
                success: true,
                results: executionResults,
                synthesis: synthesisResult.summary,
                iterations: iteration + 1
            };

        } catch (error) {
            console.error('Task execution error:', error);
            this.queue.updateTask(taskId, 'failed', { error: error.message });
            this.emit('executionFailed', { taskId, error: error.message });

            return {
                success: false,
                error: error.message
            };
        } finally {
            this.isRunning = false;
            this.currentTask = null;
        }
    }

    /**
     * Plan a task using Claude
     * @param {Object} task - Task object
     * @returns {Promise<Object>} Plan result
     */
    async planTask(task) {
        this.emit('planningStarted', { task });

        // Get workspace context
        const context = await this.getWorkspaceContext();

        // Use Claude to create a plan
        const planResult = await this.claude.planTask(task.description, context);

        if (!planResult.success) {
            this.emit('planningFailed', { task, error: planResult.error });
            return planResult;
        }

        this.emit('planningComplete', { task, plan: planResult.plan });

        return planResult;
    }

    /**
     * Execute one iteration of the plan
     * @param {Object} task - Task object
     * @param {Object} plan - Execution plan
     * @param {number} iteration - Iteration number
     * @returns {Promise<Object>} Iteration result
     */
    async executeIteration(task, plan, iteration) {
        const stepResults = [];
        let needsReplanning = false;
        let replanReason = '';

        for (let i = 0; i < plan.steps.length; i++) {
            const step = plan.steps[i];

            // Check if task was paused or cancelled
            const currentTask = this.queue.getTask(task.id);
            if (currentTask.status === 'paused' || currentTask.status === 'cancelled') {
                return {
                    complete: false,
                    stepResults,
                    interrupted: true
                };
            }

            this.emit('stepStarted', { taskId: task.id, step, stepNumber: i + 1, total: plan.steps.length });
            this.queue.updateProgress(task.id, i + 1);

            // Execute the step
            const stepResult = await this.executeStep(step, task);
            stepResults.push(stepResult);

            this.emit('stepComplete', { taskId: task.id, step, stepNumber: i + 1, result: stepResult });

            // If step failed, determine if we need to replan
            if (!stepResult.success) {
                if (stepResult.error.includes('not found') || stepResult.error.includes('permission')) {
                    needsReplanning = true;
                    replanReason = `Step ${i + 1} failed: ${stepResult.error}`;
                    break;
                }
            }
        }

        // Determine if task is complete
        const allStepsSuccessful = stepResults.every(r => r.success);
        const complete = allStepsSuccessful && !needsReplanning;

        return {
            iteration,
            complete,
            needsReplanning,
            reason: replanReason,
            stepResults,
            successRate: stepResults.filter(r => r.success).length / stepResults.length
        };
    }

    /**
     * Execute a single step
     * @param {Object} step - Step object from plan
     * @param {Object} task - Task object
     * @returns {Promise<Object>} Step result
     */
    async executeStep(step, task) {
        const { action, target, parameters, requires_confirmation } = step;

        // Check if user confirmation is required
        if (requires_confirmation) {
            const confirmed = await this.requestConfirmation(step, task);
            if (!confirmed) {
                return {
                    success: false,
                    error: 'User denied confirmation',
                    step: step
                };
            }
        }

        let result;

        try {
            switch (action) {
                case 'read_file':
                    result = await this.fs.readFile(target);
                    break;

                case 'write_file':
                    result = await this.fs.writeFile(target, parameters.content || '');
                    break;

                case 'edit_file':
                    result = await this.fs.editFile(target, parameters);
                    break;

                case 'list_directory':
                    result = await this.fs.listDirectory(target || '', parameters.recursive || false);
                    break;

                case 'create_directory':
                    result = await this.fs.createDirectory(target);
                    break;

                case 'search_files':
                    result = await this.fs.searchFiles(parameters.pattern || target);
                    break;

                case 'delete_file':
                    result = await this.fs.deleteFile(target, true); // confirmed = true since we checked above
                    break;

                case 'analyze_content':
                    // Use Claude to analyze file content
                    result = await this.analyzeContent(target, parameters);
                    break;

                case 'synthesize_results':
                    // Use Claude to synthesize multiple files/results
                    result = await this.synthesizeContent(parameters);
                    break;

                default:
                    result = {
                        success: false,
                        error: `Unknown action: ${action}`
                    };
            }

            return {
                success: result.success,
                action,
                target,
                message: result.success ? 'Step completed successfully' : result.error,
                error: result.error,
                data: result,
                step: step
            };

        } catch (error) {
            return {
                success: false,
                action,
                target,
                error: error.message,
                step: step
            };
        }
    }

    /**
     * Replan task based on execution results (inspired by Sonar's refinePrompt)
     * @param {Object} task - Task object
     * @param {Object} currentPlan - Current plan
     * @param {Array} executionResults - Results from previous iterations
     * @returns {Promise<Object>} Refined plan
     */
    async replanTask(task, currentPlan, executionResults) {
        this.emit('replanningStarted', { task, currentPlan, executionResults });

        // Use Claude to refine the approach
        const refinedResult = await this.claude.refineApproach(
            currentPlan,
            executionResults.flatMap(r => r.stepResults)
        );

        if (refinedResult.success) {
            this.emit('replanningComplete', { task, newPlan: refinedResult.plan });
        } else {
            this.emit('replanningFailed', { task, error: refinedResult.error });
        }

        return refinedResult;
    }

    /**
     * Synthesize results (inspired by Sonar's determineBestResponse)
     * @param {Object} task - Task object
     * @param {Array} executionResults - All execution results
     * @returns {Promise<Object>} Synthesis result
     */
    async synthesizeResults(task, executionResults) {
        this.emit('synthesisStarted', { task, executionResults });

        const allStepResults = executionResults.flatMap(r => r.stepResults);

        const synthesisResult = await this.claude.synthesizeResults(
            task.description,
            allStepResults
        );

        this.emit('synthesisComplete', { task, synthesis: synthesisResult });

        return synthesisResult;
    }

    /**
     * Analyze content using Claude
     * @param {string} filePath - File to analyze
     * @param {Object} parameters - Analysis parameters
     * @returns {Promise<Object>} Analysis result
     */
    async analyzeContent(filePath, parameters) {
        const readResult = await this.fs.readFile(filePath);
        if (!readResult.success) {
            return readResult;
        }

        const analysisPrompt = parameters.prompt || 'Analyze this file and extract key information.';
        const systemPrompt = 'You are a helpful assistant analyzing file content. Provide clear, structured analysis.';

        const response = await this.claude.chat(
            [{ role: 'user', content: `${analysisPrompt}\n\nFile: ${filePath}\n\nContent:\n${readResult.content}` }],
            { system: systemPrompt, max_tokens: 2048 }
        );

        if (!response.success) {
            return response;
        }

        const analysis = response.content.find(block => block.type === 'text')?.text || '';

        return {
            success: true,
            analysis,
            filePath
        };
    }

    /**
     * Synthesize multiple contents
     * @param {Object} parameters - Synthesis parameters
     * @returns {Promise<Object>} Synthesis result
     */
    async synthesizeContent(parameters) {
        const { files, prompt } = parameters;

        if (!files || files.length === 0) {
            return { success: false, error: 'No files provided for synthesis' };
        }

        // Read all files
        const fileContents = [];
        for (const filePath of files) {
            const readResult = await this.fs.readFile(filePath);
            if (readResult.success) {
                fileContents.push({
                    path: filePath,
                    content: readResult.content
                });
            }
        }

        const combinedContent = fileContents.map(f =>
            `=== ${f.path} ===\n${f.content}`
        ).join('\n\n');

        const systemPrompt = 'You are a helpful assistant synthesizing information from multiple files. Create a coherent, comprehensive output.';
        const userPrompt = `${prompt || 'Synthesize the following files:'}\n\n${combinedContent}`;

        const response = await this.claude.chat(
            [{ role: 'user', content: userPrompt }],
            { system: systemPrompt, max_tokens: 4096 }
        );

        if (!response.success) {
            return response;
        }

        const synthesis = response.content.find(block => block.type === 'text')?.text || '';

        return {
            success: true,
            synthesis,
            filesProcessed: fileContents.length
        };
    }

    /**
     * Get workspace context for planning
     * @returns {Promise<Object>} Context object
     */
    async getWorkspaceContext() {
        const context = {
            workspace: this.fs.workspacePath,
            permissions: this.fs.getPermissions(),
            files: []
        };

        // Get file list if workspace is ready
        if (this.fs.isWorkspaceReady()) {
            const listResult = await this.fs.listDirectory('', false);
            if (listResult.success) {
                context.files = listResult.files.map(f => f.path);
            }
        }

        return context;
    }

    /**
     * Request user confirmation for a step
     * @param {Object} step - Step requiring confirmation
     * @param {Object} task - Task object
     * @returns {Promise<boolean>} User confirmation
     */
    async requestConfirmation(step, task) {
        return new Promise((resolve) => {
            this.emit('confirmationRequired', {
                step,
                task,
                callback: (confirmed) => resolve(confirmed)
            });

            // Auto-deny after 60 seconds if no response
            setTimeout(() => resolve(false), 60000);
        });
    }

    /**
     * Stop current execution
     */
    stop() {
        if (this.currentTask && this.isRunning) {
            this.queue.pauseTask(this.currentTask.id);
            this.isRunning = false;
            this.emit('executionStopped', { taskId: this.currentTask.id });
        }
    }

    /**
     * Event handling
     */
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }

    off(event, handler) {
        if (!this.eventHandlers.has(event)) return;
        const handlers = this.eventHandlers.get(event);
        const index = handlers.indexOf(handler);
        if (index > -1) {
            handlers.splice(index, 1);
        }
    }

    emit(event, data) {
        if (!this.eventHandlers.has(event)) return;
        const handlers = this.eventHandlers.get(event);
        handlers.forEach(handler => {
            try {
                handler(data);
            } catch (error) {
                console.error(`Error in event handler for ${event}:`, error);
            }
        });
    }

    /**
     * Get agent status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            currentTask: this.currentTask,
            queueStatus: this.queue.getStatus()
        };
    }

    /**
     * Set max iterations for execution loop
     */
    setMaxIterations(max) {
        this.maxIterations = Math.max(1, Math.min(10, max));
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CoworkAgent;
}
