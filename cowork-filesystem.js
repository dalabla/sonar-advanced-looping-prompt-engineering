/**
 * File System Manager for Cowork Agent
 * Uses the File System Access API for secure, sandboxed file operations
 * Requires user permission and operates only within selected directory
 */

class FileSystemManager {
    constructor() {
        this.directoryHandle = null;
        this.workspacePath = null;
        this.fileCache = new Map();
        this.operationLog = [];
        this.permissions = {
            read: true,
            write: false,
            delete: false
        };
    }

    /**
     * Check if File System Access API is supported
     */
    static isSupported() {
        return 'showDirectoryPicker' in window;
    }

    /**
     * Request access to a directory from the user
     * @returns {Promise<Object>} Directory info
     */
    async requestDirectoryAccess() {
        if (!FileSystemManager.isSupported()) {
            throw new Error('File System Access API is not supported in this browser. Please use Chrome, Edge, or Opera.');
        }

        try {
            this.directoryHandle = await window.showDirectoryPicker({
                mode: 'readwrite'
            });

            this.workspacePath = this.directoryHandle.name;
            this.permissions.write = true;
            this.permissions.delete = false; // Require explicit permission for delete

            return {
                success: true,
                path: this.workspacePath,
                name: this.directoryHandle.name
            };
        } catch (error) {
            if (error.name === 'AbortError') {
                return {
                    success: false,
                    error: 'User cancelled directory selection'
                };
            }
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Check if workspace is accessible
     */
    isWorkspaceReady() {
        return this.directoryHandle !== null;
    }

    /**
     * Read a file from the workspace
     * @param {string} path - Relative path to file
     * @returns {Promise<Object>} File content
     */
    async readFile(path) {
        if (!this.isWorkspaceReady()) {
            return { success: false, error: 'No workspace selected' };
        }

        try {
            const fileHandle = await this.getFileHandle(path);
            const file = await fileHandle.getFile();
            const content = await file.text();

            this.logOperation('read', path, true);

            return {
                success: true,
                content: content,
                name: file.name,
                size: file.size,
                modified: file.lastModified,
                type: file.type
            };
        } catch (error) {
            this.logOperation('read', path, false, error.message);
            return {
                success: false,
                error: error.message,
                path: path
            };
        }
    }

    /**
     * Write content to a file (creates if doesn't exist)
     * @param {string} path - Relative path to file
     * @param {string} content - Content to write
     * @returns {Promise<Object>} Write result
     */
    async writeFile(path, content) {
        if (!this.isWorkspaceReady()) {
            return { success: false, error: 'No workspace selected' };
        }

        if (!this.permissions.write) {
            return { success: false, error: 'Write permission not granted' };
        }

        try {
            const fileHandle = await this.getFileHandle(path, true);
            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();

            this.logOperation('write', path, true, `Wrote ${content.length} bytes`);

            return {
                success: true,
                path: path,
                size: content.length
            };
        } catch (error) {
            this.logOperation('write', path, false, error.message);
            return {
                success: false,
                error: error.message,
                path: path
            };
        }
    }

    /**
     * Edit a file by applying changes
     * @param {string} path - Relative path to file
     * @param {Object} changes - Changes to apply {find: string, replace: string} or {append: string}
     * @returns {Promise<Object>} Edit result
     */
    async editFile(path, changes) {
        const readResult = await this.readFile(path);
        if (!readResult.success) {
            return readResult;
        }

        let newContent = readResult.content;

        if (changes.find !== undefined && changes.replace !== undefined) {
            // Find and replace
            if (!newContent.includes(changes.find)) {
                return {
                    success: false,
                    error: `Text to replace not found in file: "${changes.find.substring(0, 50)}..."`
                };
            }
            newContent = newContent.replace(changes.find, changes.replace);
        } else if (changes.append !== undefined) {
            // Append to file
            newContent += changes.append;
        } else if (changes.prepend !== undefined) {
            // Prepend to file
            newContent = changes.prepend + newContent;
        } else {
            return {
                success: false,
                error: 'Invalid edit operation. Use find/replace, append, or prepend.'
            };
        }

        const writeResult = await this.writeFile(path, newContent);
        if (writeResult.success) {
            this.logOperation('edit', path, true);
        }

        return writeResult;
    }

    /**
     * List files in a directory
     * @param {string} path - Directory path (empty string for root)
     * @param {boolean} recursive - List recursively
     * @returns {Promise<Object>} File list
     */
    async listDirectory(path = '', recursive = false) {
        if (!this.isWorkspaceReady()) {
            return { success: false, error: 'No workspace selected' };
        }

        try {
            const dirHandle = path ? await this.getDirectoryHandle(path) : this.directoryHandle;
            const files = await this.listDirectoryRecursive(dirHandle, '', recursive);

            this.logOperation('list', path || 'root', true);

            return {
                success: true,
                files: files,
                count: files.length
            };
        } catch (error) {
            this.logOperation('list', path, false, error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Helper for recursive directory listing
     */
    async listDirectoryRecursive(dirHandle, basePath, recursive) {
        const files = [];

        for await (const entry of dirHandle.values()) {
            const fullPath = basePath ? `${basePath}/${entry.name}` : entry.name;

            if (entry.kind === 'file') {
                const file = await entry.getFile();
                files.push({
                    name: entry.name,
                    path: fullPath,
                    type: 'file',
                    size: file.size,
                    modified: file.lastModified,
                    extension: this.getFileExtension(entry.name)
                });
            } else if (entry.kind === 'directory') {
                files.push({
                    name: entry.name,
                    path: fullPath,
                    type: 'directory'
                });

                if (recursive) {
                    const subFiles = await this.listDirectoryRecursive(entry, fullPath, true);
                    files.push(...subFiles);
                }
            }
        }

        return files;
    }

    /**
     * Create a new directory
     * @param {string} path - Directory path to create
     * @returns {Promise<Object>} Creation result
     */
    async createDirectory(path) {
        if (!this.isWorkspaceReady()) {
            return { success: false, error: 'No workspace selected' };
        }

        if (!this.permissions.write) {
            return { success: false, error: 'Write permission not granted' };
        }

        try {
            await this.getDirectoryHandle(path, true);
            this.logOperation('create_dir', path, true);

            return {
                success: true,
                path: path
            };
        } catch (error) {
            this.logOperation('create_dir', path, false, error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Delete a file (requires explicit permission)
     * @param {string} path - File path to delete
     * @param {boolean} confirmed - User confirmation
     * @returns {Promise<Object>} Deletion result
     */
    async deleteFile(path, confirmed = false) {
        if (!this.isWorkspaceReady()) {
            return { success: false, error: 'No workspace selected' };
        }

        if (!this.permissions.delete && !confirmed) {
            return {
                success: false,
                error: 'Delete operation requires user confirmation',
                requiresConfirmation: true
            };
        }

        try {
            const pathParts = path.split('/');
            const fileName = pathParts.pop();
            const dirPath = pathParts.join('/');

            const dirHandle = dirPath ? await this.getDirectoryHandle(dirPath) : this.directoryHandle;
            await dirHandle.removeEntry(fileName);

            this.logOperation('delete', path, true);

            return {
                success: true,
                path: path
            };
        } catch (error) {
            this.logOperation('delete', path, false, error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Search for files matching a pattern
     * @param {string} pattern - Search pattern (name or extension)
     * @returns {Promise<Object>} Search results
     */
    async searchFiles(pattern) {
        const listResult = await this.listDirectory('', true);
        if (!listResult.success) {
            return listResult;
        }

        const regex = new RegExp(pattern, 'i');
        const matches = listResult.files.filter(file =>
            file.type === 'file' && (regex.test(file.name) || regex.test(file.path))
        );

        return {
            success: true,
            matches: matches,
            count: matches.length
        };
    }

    /**
     * Get file handle (creates if needed and create=true)
     */
    async getFileHandle(path, create = false) {
        const pathParts = path.split('/').filter(p => p);
        const fileName = pathParts.pop();
        const dirHandle = pathParts.length > 0
            ? await this.getDirectoryHandle(pathParts.join('/'), create)
            : this.directoryHandle;

        return await dirHandle.getFileHandle(fileName, { create });
    }

    /**
     * Get directory handle (creates if needed and create=true)
     */
    async getDirectoryHandle(path, create = false) {
        if (!path) return this.directoryHandle;

        const pathParts = path.split('/').filter(p => p);
        let currentHandle = this.directoryHandle;

        for (const part of pathParts) {
            currentHandle = await currentHandle.getDirectoryHandle(part, { create });
        }

        return currentHandle;
    }

    /**
     * Get file extension
     */
    getFileExtension(filename) {
        const parts = filename.split('.');
        return parts.length > 1 ? parts.pop().toLowerCase() : '';
    }

    /**
     * Log an operation
     */
    logOperation(action, path, success, details = '') {
        this.operationLog.push({
            timestamp: new Date().toISOString(),
            action,
            path,
            success,
            details
        });

        // Keep last 100 operations
        if (this.operationLog.length > 100) {
            this.operationLog.shift();
        }
    }

    /**
     * Get operation log
     */
    getOperationLog() {
        return [...this.operationLog];
    }

    /**
     * Clear operation log
     */
    clearOperationLog() {
        this.operationLog = [];
    }

    /**
     * Enable delete permission (requires user confirmation)
     */
    enableDeletePermission(confirmed = false) {
        if (confirmed) {
            this.permissions.delete = true;
            return { success: true };
        }
        return {
            success: false,
            requiresConfirmation: true,
            message: 'Delete permission requires user confirmation'
        };
    }

    /**
     * Get current permissions
     */
    getPermissions() {
        return { ...this.permissions };
    }

    /**
     * Get workspace info
     */
    getWorkspaceInfo() {
        return {
            isReady: this.isWorkspaceReady(),
            path: this.workspacePath,
            permissions: this.getPermissions(),
            operationCount: this.operationLog.length
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FileSystemManager;
}
