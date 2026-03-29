/**
 * Task Queue Manager for Cowork Agent
 * Manages multiple tasks, dependencies, and parallel execution
 */

class TaskQueue {
    constructor() {
        this.tasks = new Map();
        this.taskCounter = 0;
        this.maxParallel = 3;
        this.runningTasks = new Set();
        this.eventHandlers = new Map();
    }

    /**
     * Add a new task to the queue
     * @param {string} description - Task description
     * @param {number} priority - Priority (higher = more important)
     * @param {Object} metadata - Additional task metadata
     * @returns {string} Task ID
     */
    addTask(description, priority = 5, metadata = {}) {
        const taskId = `task_${++this.taskCounter}`;
        const task = {
            id: taskId,
            description,
            priority,
            status: 'pending', // pending, planning, executing, paused, completed, failed, cancelled
            progress: 0,
            plan: null,
            results: [],
            error: null,
            createdAt: Date.now(),
            startedAt: null,
            completedAt: null,
            currentStep: 0,
            totalSteps: 0,
            metadata: metadata,
            dependencies: []
        };

        this.tasks.set(taskId, task);
        this.emit('taskAdded', task);

        return taskId;
    }

    /**
     * Get task by ID
     * @param {string} taskId - Task ID
     * @returns {Object|null} Task object
     */
    getTask(taskId) {
        return this.tasks.get(taskId) || null;
    }

    /**
     * Get all tasks
     * @param {string} status - Filter by status (optional)
     * @returns {Array} Array of tasks
     */
    getAllTasks(status = null) {
        const tasks = Array.from(this.tasks.values());
        if (status) {
            return tasks.filter(t => t.status === status);
        }
        return tasks.sort((a, b) => {
            // Sort by priority (desc) then by creation time (asc)
            if (b.priority !== a.priority) {
                return b.priority - a.priority;
            }
            return a.createdAt - b.createdAt;
        });
    }

    /**
     * Update task status
     * @param {string} taskId - Task ID
     * @param {string} status - New status
     * @param {Object} updates - Additional updates
     */
    updateTask(taskId, status, updates = {}) {
        const task = this.tasks.get(taskId);
        if (!task) return false;

        const oldStatus = task.status;
        task.status = status;

        if (status === 'executing' && !task.startedAt) {
            task.startedAt = Date.now();
        }

        if (status === 'completed' || status === 'failed' || status === 'cancelled') {
            task.completedAt = Date.now();
            this.runningTasks.delete(taskId);
        }

        Object.assign(task, updates);

        this.emit('taskUpdated', { task, oldStatus, newStatus: status });

        return true;
    }

    /**
     * Set task plan
     * @param {string} taskId - Task ID
     * @param {Object} plan - Execution plan
     */
    setPlan(taskId, plan) {
        const task = this.tasks.get(taskId);
        if (!task) return false;

        task.plan = plan;
        task.totalSteps = plan.steps ? plan.steps.length : 0;
        task.currentStep = 0;

        this.emit('taskPlanSet', { task, plan });

        return true;
    }

    /**
     * Update task progress
     * @param {string} taskId - Task ID
     * @param {number} currentStep - Current step number
     * @param {Object} stepResult - Result of the step
     */
    updateProgress(taskId, currentStep, stepResult = null) {
        const task = this.tasks.get(taskId);
        if (!task) return false;

        task.currentStep = currentStep;
        task.progress = task.totalSteps > 0 ? (currentStep / task.totalSteps) * 100 : 0;

        if (stepResult) {
            task.results.push(stepResult);
        }

        this.emit('taskProgress', { task, currentStep, stepResult });

        return true;
    }

    /**
     * Pause a task
     * @param {string} taskId - Task ID
     */
    pauseTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task || (task.status !== 'executing' && task.status !== 'planning')) {
            return false;
        }

        this.updateTask(taskId, 'paused');
        this.runningTasks.delete(taskId);

        return true;
    }

    /**
     * Resume a paused task
     * @param {string} taskId - Task ID
     */
    resumeTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task || task.status !== 'paused') {
            return false;
        }

        this.updateTask(taskId, 'pending');

        return true;
    }

    /**
     * Cancel a task
     * @param {string} taskId - Task ID
     */
    cancelTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) return false;

        this.updateTask(taskId, 'cancelled');

        return true;
    }

    /**
     * Remove a task from the queue
     * @param {string} taskId - Task ID
     */
    removeTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) return false;

        if (task.status === 'executing') {
            return false; // Cannot remove running task
        }

        this.tasks.delete(taskId);
        this.emit('taskRemoved', { taskId, task });

        return true;
    }

    /**
     * Clear completed tasks
     */
    clearCompleted() {
        const completedTasks = this.getAllTasks('completed');
        completedTasks.forEach(task => {
            this.tasks.delete(task.id);
        });

        this.emit('completedCleared', { count: completedTasks.length });

        return completedTasks.length;
    }

    /**
     * Get next task to execute
     * Considers dependencies and priority
     * @returns {Object|null} Next task or null
     */
    getNextTask() {
        const pendingTasks = this.getAllTasks('pending');

        for (const task of pendingTasks) {
            // Check if dependencies are met
            if (task.dependencies.length > 0) {
                const allDependenciesMet = task.dependencies.every(depId => {
                    const depTask = this.tasks.get(depId);
                    return depTask && depTask.status === 'completed';
                });

                if (!allDependenciesMet) {
                    continue; // Skip this task, dependencies not met
                }
            }

            // Check if we have capacity
            if (this.runningTasks.size >= this.maxParallel) {
                return null;
            }

            return task;
        }

        return null;
    }

    /**
     * Check if task can run (dependencies met and capacity available)
     * @param {string} taskId - Task ID
     * @returns {boolean}
     */
    canExecute(taskId) {
        const task = this.tasks.get(taskId);
        if (!task || task.status !== 'pending') {
            return false;
        }

        // Check dependencies
        if (task.dependencies.length > 0) {
            const allDependenciesMet = task.dependencies.every(depId => {
                const depTask = this.tasks.get(depId);
                return depTask && depTask.status === 'completed';
            });

            if (!allDependenciesMet) {
                return false;
            }
        }

        // Check capacity
        return this.runningTasks.size < this.maxParallel;
    }

    /**
     * Mark task as running
     * @param {string} taskId - Task ID
     */
    markAsRunning(taskId) {
        this.runningTasks.add(taskId);
    }

    /**
     * Add dependency between tasks
     * @param {string} taskId - Dependent task
     * @param {string} dependsOnId - Task it depends on
     */
    addDependency(taskId, dependsOnId) {
        const task = this.tasks.get(taskId);
        const dependsOnTask = this.tasks.get(dependsOnId);

        if (!task || !dependsOnTask) {
            return false;
        }

        if (!task.dependencies.includes(dependsOnId)) {
            task.dependencies.push(dependsOnId);
        }

        return true;
    }

    /**
     * Get task statistics
     * @returns {Object} Statistics
     */
    getStatistics() {
        const tasks = Array.from(this.tasks.values());

        return {
            total: tasks.length,
            pending: tasks.filter(t => t.status === 'pending').length,
            planning: tasks.filter(t => t.status === 'planning').length,
            executing: tasks.filter(t => t.status === 'executing').length,
            paused: tasks.filter(t => t.status === 'paused').length,
            completed: tasks.filter(t => t.status === 'completed').length,
            failed: tasks.filter(t => t.status === 'failed').length,
            cancelled: tasks.filter(t => t.status === 'cancelled').length,
            running: this.runningTasks.size,
            capacity: this.maxParallel
        };
    }

    /**
     * Get queue status
     * @returns {Object} Queue status
     */
    getStatus() {
        return {
            isActive: this.runningTasks.size > 0,
            runningTasks: Array.from(this.runningTasks),
            pendingCount: this.getAllTasks('pending').length,
            completedCount: this.getAllTasks('completed').length,
            failedCount: this.getAllTasks('failed').length,
            statistics: this.getStatistics()
        };
    }

    /**
     * Set maximum parallel tasks
     * @param {number} max - Maximum parallel tasks
     */
    setMaxParallel(max) {
        this.maxParallel = Math.max(1, Math.min(10, max));
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
     * Export queue state to JSON
     * @returns {Object} Queue state
     */
    exportState() {
        return {
            tasks: Array.from(this.tasks.values()),
            runningTasks: Array.from(this.runningTasks),
            maxParallel: this.maxParallel,
            taskCounter: this.taskCounter
        };
    }

    /**
     * Import queue state from JSON
     * @param {Object} state - Queue state
     */
    importState(state) {
        this.tasks.clear();
        this.runningTasks.clear();

        state.tasks.forEach(task => {
            this.tasks.set(task.id, task);
        });

        state.runningTasks.forEach(taskId => {
            this.runningTasks.add(taskId);
        });

        this.maxParallel = state.maxParallel || 3;
        this.taskCounter = state.taskCounter || 0;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TaskQueue;
}
