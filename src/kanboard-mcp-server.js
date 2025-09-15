const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// Kanboard Configuration
const KANBOARD_URL = process.env.KANBOARD_URL || 'http://kanboard';
const KANBOARD_API_URL = `${KANBOARD_URL}/jsonrpc.php`;
const KANBOARD_USERNAME = process.env.KANBOARD_USERNAME || 'admin';
const KANBOARD_PASSWORD = process.env.KANBOARD_PASSWORD || 'admin';

// Helper function to make Kanboard JSON-RPC API requests
async function kanboardRequest(method, params = {}) {
    try {
        const payload = {
            jsonrpc: '2.0',
            method: method,
            id: Date.now(),
            params: params
        };

        const response = await axios.post(KANBOARD_API_URL, payload, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + Buffer.from(`${KANBOARD_USERNAME}:${KANBOARD_PASSWORD}`).toString('base64')
            },
            timeout: 15000
        });

        if (response.data.error) {
            return {
                success: false,
                error: response.data.error.message || 'Unknown Kanboard API error'
            };
        }

        return {
            success: true,
            data: response.data.result
        };
    } catch (error) {
        return {
            success: false,
            error: error.response?.data?.error?.message || error.message
        };
    }
}

// Helper function to format dates
function formatDate(timestamp) {
    if (!timestamp || timestamp === '0') return 'Not set';
    return new Date(parseInt(timestamp) * 1000).toLocaleString();
}

// Helper function to get color for priority/category
function getPriorityColor(priority) {
    const colors = {
        0: '⚪ None',
        1: '🟢 Low',
        2: '🟡 Medium',
        3: '🟠 High',
        4: '🔴 Urgent'
    };
    return colors[priority] || '⚪ Unknown';
}

// MCP Tools Definition
const tools = [
    {
        name: 'get_all_projects',
        description: 'Get all projects from Kanboard',
        inputSchema: {
            type: 'object',
            properties: {},
            required: []
        }
    },
    {
        name: 'get_project',
        description: 'Get details of a specific project',
        inputSchema: {
            type: 'object',
            properties: {
                project_id: {
                    type: 'number',
                    description: 'Project ID'
                }
            },
            required: ['project_id']
        }
    },
    {
        name: 'create_project',
        description: 'Create a new project',
        inputSchema: {
            type: 'object',
            properties: {
                name: {
                    type: 'string',
                    description: 'Project name'
                },
                description: {
                    type: 'string',
                    description: 'Project description'
                }
            },
            required: ['name']
        }
    },
    {
        name: 'get_board',
        description: 'Get board view of a project with all columns and tasks',
        inputSchema: {
            type: 'object',
            properties: {
                project_id: {
                    type: 'number',
                    description: 'Project ID'
                }
            },
            required: ['project_id']
        }
    },
    {
        name: 'get_all_tasks',
        description: 'Get all tasks for a project',
        inputSchema: {
            type: 'object',
            properties: {
                project_id: {
                    type: 'number',
                    description: 'Project ID'
                },
                status_id: {
                    type: 'number',
                    description: 'Task status (1=open, 0=closed)',
                    default: 1
                }
            },
            required: ['project_id']
        }
    },
    {
        name: 'get_task',
        description: 'Get detailed information about a specific task',
        inputSchema: {
            type: 'object',
            properties: {
                task_id: {
                    type: 'number',
                    description: 'Task ID'
                }
            },
            required: ['task_id']
        }
    },
    {
        name: 'create_task',
        description: 'Create a new task',
        inputSchema: {
            type: 'object',
            properties: {
                project_id: {
                    type: 'number',
                    description: 'Project ID'
                },
                title: {
                    type: 'string',
                    description: 'Task title'
                },
                description: {
                    type: 'string',
                    description: 'Task description'
                },
                owner_id: {
                    type: 'number',
                    description: 'User ID of the task owner'
                },
                column_id: {
                    type: 'number',
                    description: 'Column ID where to place the task'
                },
                priority: {
                    type: 'number',
                    description: 'Priority (0=none, 1=low, 2=medium, 3=high, 4=urgent)',
                    default: 0
                }
            },
            required: ['project_id', 'title']
        }
    },
    {
        name: 'update_task',
        description: 'Update an existing task',
        inputSchema: {
            type: 'object',
            properties: {
                task_id: {
                    type: 'number',
                    description: 'Task ID'
                },
                title: {
                    type: 'string',
                    description: 'New task title'
                },
                description: {
                    type: 'string',
                    description: 'New task description'
                },
                owner_id: {
                    type: 'number',
                    description: 'New owner user ID'
                },
                priority: {
                    type: 'number',
                    description: 'New priority (0-4)'
                }
            },
            required: ['task_id']
        }
    },
    {
        name: 'move_task',
        description: 'Move a task to a different column',
        inputSchema: {
            type: 'object',
            properties: {
                task_id: {
                    type: 'number',
                    description: 'Task ID'
                },
                column_id: {
                    type: 'number',
                    description: 'Target column ID'
                },
                position: {
                    type: 'number',
                    description: 'Position in the column (optional)',
                    default: 1
                }
            },
            required: ['task_id', 'column_id']
        }
    },
    {
        name: 'close_task',
        description: 'Close/complete a task',
        inputSchema: {
            type: 'object',
            properties: {
                task_id: {
                    type: 'number',
                    description: 'Task ID'
                }
            },
            required: ['task_id']
        }
    },
    {
        name: 'get_columns',
        description: 'Get all columns for a project',
        inputSchema: {
            type: 'object',
            properties: {
                project_id: {
                    type: 'number',
                    description: 'Project ID'
                }
            },
            required: ['project_id']
        }
    },
    {
        name: 'get_users',
        description: 'Get all users in the system',
        inputSchema: {
            type: 'object',
            properties: {},
            required: []
        }
    },
    {
        name: 'get_my_dashboard',
        description: 'Get dashboard view with user\'s tasks and projects',
        inputSchema: {
            type: 'object',
            properties: {},
            required: []
        }
    },
    {
        name: 'get_overdue_tasks',
        description: 'Get all overdue tasks across projects',
        inputSchema: {
            type: 'object',
            properties: {},
            required: []
        }
    },
    {
        name: 'search_tasks',
        description: 'Search for tasks by query',
        inputSchema: {
            type: 'object',
            properties: {
                project_id: {
                    type: 'number',
                    description: 'Project ID (optional, searches all projects if not specified)'
                },
                query: {
                    type: 'string',
                    description: 'Search query'
                }
            },
            required: ['query']
        }
    },
    {
        name: 'add_comment',
        description: 'Add a comment to a task',
        inputSchema: {
            type: 'object',
            properties: {
                task_id: {
                    type: 'number',
                    description: 'Task ID'
                },
                comment: {
                    type: 'string',
                    description: 'Comment text'
                }
            },
            required: ['task_id', 'comment']
        }
    },
    {
        name: 'get_task_comments',
        description: 'Get all comments for a task',
        inputSchema: {
            type: 'object',
            properties: {
                task_id: {
                    type: 'number',
                    description: 'Task ID'
                }
            },
            required: ['task_id']
        }
    }
];

// MCP JSON-RPC Handler
app.post('/mcp', async (req, res) => {
    const { method, params, id } = req.body;

    console.log(`[Kanboard MCP] ${new Date().toISOString()} - ${method}`);

    const jsonRpcResponse = (result, error = null) => {
        const response = { jsonrpc: '2.0' };
        if (id !== undefined) response.id = id;
        if (error) response.error = error;
        else response.result = result;
        return response;
    };

    try {
        switch (method) {
            case 'initialize':
                console.log('[Kanboard MCP] Initializing server...');
                return res.json(jsonRpcResponse({
                    protocolVersion: '2024-11-05',
                    capabilities: { tools: {}, resources: {}, prompts: {} },
                    serverInfo: {
                        name: 'kanboard-mcp-server',
                        version: '1.0.0',
                        description: 'Kanboard integration for LibreChat'
                    }
                }));

            case 'ping':
                return res.json(jsonRpcResponse({}));

            case 'notifications/initialized':
                return res.json(jsonRpcResponse({}));

            case 'tools/list':
                return res.json(jsonRpcResponse({ tools }));

            case 'tools/call':
                const { name: toolName, arguments: args } = params;
                console.log(`[Kanboard MCP] Executing: ${toolName}`);

                let result;

                switch (toolName) {
                    case 'get_all_projects':
                        try {
                            const response = await kanboardRequest('getAllProjects');

                            if (response.success) {
                                result = {
                                    success: true,
                                    projects: response.data.map(project => ({
                                        id: project.id,
                                        name: project.name,
                                        description: project.description || 'No description',
                                        is_active: project.is_active === '1',
                                        is_public: project.is_public === '1',
                                        created: formatDate(project.created),
                                        modified: formatDate(project.modified),
                                        owner: project.owner_id
                                    })),
                                    total: response.data.length
                                };
                            } else {
                                result = { success: false, error: response.error };
                            }
                        } catch (error) {
                            result = { success: false, error: error.message };
                        }
                        break;

                    case 'get_project':
                        try {
                            const response = await kanboardRequest('getProjectById', {
                                project_id: args.project_id
                            });

                            if (response.success && response.data) {
                                const project = response.data;
                                result = {
                                    success: true,
                                    project: {
                                        id: project.id,
                                        name: project.name,
                                        description: project.description || 'No description',
                                        is_active: project.is_active === '1',
                                        is_public: project.is_public === '1',
                                        created: formatDate(project.created),
                                        modified: formatDate(project.modified),
                                        owner_id: project.owner_id,
                                        start_date: formatDate(project.start_date),
                                        end_date: formatDate(project.end_date),
                                        url: `${KANBOARD_URL}/?controller=BoardViewController&action=show&project_id=${project.id}`
                                    }
                                };
                            } else {
                                result = { success: false, error: response.error || 'Project not found' };
                            }
                        } catch (error) {
                            result = { success: false, error: error.message };
                        }
                        break;

                    case 'create_project':
                        try {
                            const response = await kanboardRequest('createProject', {
                                name: args.name,
                                description: args.description || ''
                            });

                            if (response.success) {
                                result = {
                                    success: true,
                                    project_id: response.data,
                                    message: `Project "${args.name}" created successfully`,
                                    url: `${KANBOARD_URL}/?controller=BoardViewController&action=show&project_id=${response.data}`
                                };
                            } else {
                                result = { success: false, error: response.error };
                            }
                        } catch (error) {
                            result = { success: false, error: error.message };
                        }
                        break;

                    case 'get_board':
                        try {
                            const boardResponse = await kanboardRequest('getBoard', {
                                project_id: args.project_id
                            });

                            if (boardResponse.success) {
                                result = {
                                    success: true,
                                    project_id: args.project_id,
                                    board: boardResponse.data.map(column => ({
                                        id: column.id,
                                        title: column.title,
                                        position: column.position,
                                        task_limit: column.task_limit,
                                        tasks: column.tasks.map(task => ({
                                            id: task.id,
                                            title: task.title,
                                            description: task.description?.substring(0, 100) + (task.description?.length > 100 ? '...' : ''),
                                            priority: getPriorityColor(task.priority),
                                            owner: task.assignee_name || 'Unassigned',
                                            created: formatDate(task.date_creation),
                                            due_date: formatDate(task.date_due),
                                            color: task.color_id,
                                            position: task.position,
                                            url: `${KANBOARD_URL}/?controller=TaskViewController&action=show&task_id=${task.id}&project_id=${args.project_id}`
                                        })),
                                        task_count: column.tasks.length
                                    })),
                                    total_tasks: boardResponse.data.reduce((sum, col) => sum + col.tasks.length, 0)
                                };
                            } else {
                                result = { success: false, error: boardResponse.error };
                            }
                        } catch (error) {
                            result = { success: false, error: error.message };
                        }
                        break;

                    case 'get_all_tasks':
                        try {
                            const response = await kanboardRequest('getAllTasks', {
                                project_id: args.project_id,
                                status_id: args.status_id !== undefined ? args.status_id : 1
                            });

                            if (response.success) {
                                result = {
                                    success: true,
                                    project_id: args.project_id,
                                    status: args.status_id === 1 ? 'Open' : 'Closed',
                                    tasks: response.data.map(task => ({
                                        id: task.id,
                                        title: task.title,
                                        description: task.description?.substring(0, 150) + (task.description?.length > 150 ? '...' : ''),
                                        column: task.column_title,
                                        priority: getPriorityColor(task.priority),
                                        owner: task.assignee_name || 'Unassigned',
                                        creator: task.creator_name,
                                        created: formatDate(task.date_creation),
                                        modified: formatDate(task.date_modification),
                                        due_date: formatDate(task.date_due),
                                        completed: formatDate(task.date_completed),
                                        url: `${KANBOARD_URL}/?controller=TaskViewController&action=show&task_id=${task.id}&project_id=${args.project_id}`
                                    })),
                                    total: response.data.length
                                };
                            } else {
                                result = { success: false, error: response.error };
                            }
                        } catch (error) {
                            result = { success: false, error: error.message };
                        }
                        break;

                    case 'get_task':
                        try {
                            const response = await kanboardRequest('getTask', {
                                task_id: args.task_id
                            });

                            if (response.success && response.data) {
                                const task = response.data;
                                result = {
                                    success: true,
                                    task: {
                                        id: task.id,
                                        title: task.title,
                                        description: task.description || 'No description',
                                        project_id: task.project_id,
                                        project_name: task.project_name,
                                        column: task.column_title,
                                        column_id: task.column_id,
                                        priority: getPriorityColor(task.priority),
                                        owner: task.assignee_name || 'Unassigned',
                                        owner_id: task.owner_id,
                                        creator: task.creator_name,
                                        created: formatDate(task.date_creation),
                                        modified: formatDate(task.date_modification),
                                        started: formatDate(task.date_started),
                                        due_date: formatDate(task.date_due),
                                        completed: formatDate(task.date_completed),
                                        time_estimated: task.time_estimated ? `${task.time_estimated}h` : 'Not set',
                                        time_spent: task.time_spent ? `${task.time_spent}h` : '0h',
                                        is_active: task.is_active === '1',
                                        position: task.position,
                                        score: task.score,
                                        url: `${KANBOARD_URL}/?controller=TaskViewController&action=show&task_id=${task.id}&project_id=${task.project_id}`
                                    }
                                };
                            } else {
                                result = { success: false, error: response.error || 'Task not found' };
                            }
                        } catch (error) {
                            result = { success: false, error: error.message };
                        }
                        break;

                    case 'create_task':
                        try {
                            const taskData = {
                                project_id: args.project_id,
                                title: args.title,
                                description: args.description || '',
                                priority: args.priority || 0
                            };

                            if (args.owner_id) taskData.owner_id = args.owner_id;
                            if (args.column_id) taskData.column_id = args.column_id;

                            const response = await kanboardRequest('createTask', taskData);

                            if (response.success) {
                                result = {
                                    success: true,
                                    task_id: response.data,
                                    message: `Task "${args.title}" created successfully`,
                                    url: `${KANBOARD_URL}/?controller=TaskViewController&action=show&task_id=${response.data}&project_id=${args.project_id}`
                                };
                            } else {
                                result = { success: false, error: response.error };
                            }
                        } catch (error) {
                            result = { success: false, error: error.message };
                        }
                        break;

                    case 'update_task':
                        try {
                            const updateData = { task_id: args.task_id };

                            if (args.title !== undefined) updateData.title = args.title;
                            if (args.description !== undefined) updateData.description = args.description;
                            if (args.owner_id !== undefined) updateData.owner_id = args.owner_id;
                            if (args.priority !== undefined) updateData.priority = args.priority;

                            const response = await kanboardRequest('updateTask', updateData);

                            if (response.success) {
                                result = {
                                    success: true,
                                    task_id: args.task_id,
                                    message: 'Task updated successfully'
                                };
                            } else {
                                result = { success: false, error: response.error };
                            }
                        } catch (error) {
                            result = { success: false, error: error.message };
                        }
                        break;

                    case 'move_task':
                        try {
                            const response = await kanboardRequest('moveTaskPosition', {
                                project_id: args.project_id || null,
                                task_id: args.task_id,
                                column_id: args.column_id,
                                position: args.position || 1
                            });

                            if (response.success) {
                                result = {
                                    success: true,
                                    task_id: args.task_id,
                                    new_column_id: args.column_id,
                                    message: 'Task moved successfully'
                                };
                            } else {
                                result = { success: false, error: response.error };
                            }
                        } catch (error) {
                            result = { success: false, error: error.message };
                        }
                        break;

                    case 'close_task':
                        try {
                            const response = await kanboardRequest('closeTask', {
                                task_id: args.task_id
                            });

                            if (response.success) {
                                result = {
                                    success: true,
                                    task_id: args.task_id,
                                    message: 'Task closed successfully'
                                };
                            } else {
                                result = { success: false, error: response.error };
                            }
                        } catch (error) {
                            result = { success: false, error: error.message };
                        }
                        break;

                    case 'get_columns':
                        try {
                            const response = await kanboardRequest('getColumns', {
                                project_id: args.project_id
                            });

                            if (response.success) {
                                result = {
                                    success: true,
                                    project_id: args.project_id,
                                    columns: response.data.map(column => ({
                                        id: column.id,
                                        title: column.title,
                                        position: column.position,
                                        task_limit: column.task_limit,
                                        description: column.description || 'No description'
                                    })),
                                    total: response.data.length
                                };
                            } else {
                                result = { success: false, error: response.error };
                            }
                        } catch (error) {
                            result = { success: false, error: error.message };
                        }
                        break;

                    case 'get_users':
                        try {
                            const response = await kanboardRequest('getAllUsers');

                            if (response.success) {
                                result = {
                                    success: true,
                                    users: response.data.map(user => ({
                                        id: user.id,
                                        username: user.username,
                                        name: user.name || user.username,
                                        email: user.email,
                                        role: user.role,
                                        is_active: user.is_active === '1',
                                        created: formatDate(user.created)
                                    })),
                                    total: response.data.length
                                };
                            } else {
                                result = { success: false, error: response.error };
                            }
                        } catch (error) {
                            result = { success: false, error: error.message };
                        }
                        break;

                    case 'get_my_dashboard':
                        try {
                            const projectsResponse = await kanboardRequest('getAllProjects');
                            const tasksResponse = await kanboardRequest('getMyTasks');

                            if (projectsResponse.success && tasksResponse.success) {
                                result = {
                                    success: true,
                                    dashboard: {
                                        projects: {
                                            total: projectsResponse.data.length,
                                            active: projectsResponse.data.filter(p => p.is_active === '1').length
                                        },
                                        my_tasks: {
                                            total: tasksResponse.data.length,
                                            tasks: tasksResponse.data.slice(0, 10).map(task => ({
                                                id: task.id,
                                                title: task.title,
                                                project: task.project_name,
                                                column: task.column_title,
                                                priority: getPriorityColor(task.priority),
                                                due_date: formatDate(task.date_due),
                                                url: `${KANBOARD_URL}/?controller=TaskViewController&action=show&task_id=${task.id}&project_id=${task.project_id}`
                                            }))
                                        }
                                    }
                                };
                            } else {
                                result = {
                                    success: false,
                                    error: projectsResponse.error || tasksResponse.error
                                };
                            }
                        } catch (error) {
                            result = { success: false, error: error.message };
                        }
                        break;

                    case 'get_overdue_tasks':
                        try {
                            const response = await kanboardRequest('getOverdueTasks');

                            if (response.success) {
                                result = {
                                    success: true,
                                    overdue_tasks: response.data.map(task => ({
                                        id: task.id,
                                        title: task.title,
                                        project: task.project_name,
                                        column: task.column_title,
                                        owner: task.assignee_name || 'Unassigned',
                                        due_date: formatDate(task.date_due),
                                        days_overdue: Math.floor((Date.now() / 1000 - task.date_due) / (24 * 3600)),
                                        priority: getPriorityColor(task.priority),
                                        url: `${KANBOARD_URL}/?controller=TaskViewController&action=show&task_id=${task.id}&project_id=${task.project_id}`
                                    })),
                                    total: response.data.length
                                };
                            } else {
                                result = { success: false, error: response.error };
                            }
                        } catch (error) {
                            result = { success: false, error: error.message };
                        }
                        break;

                    case 'search_tasks':
                        try {
                            const searchParams = { query: args.query };
                            if (args.project_id) searchParams.project_id = args.project_id;

                            const response = await kanboardRequest('searchTasks', searchParams);

                            if (response.success) {
                                result = {
                                    success: true,
                                    query: args.query,
                                    project_id: args.project_id || 'all',
                                    results: response.data.map(task => ({
                                        id: task.id,
                                        title: task.title,
                                        description: task.description?.substring(0, 100) + (task.description?.length > 100 ? '...' : ''),
                                        project: task.project_name,
                                        column: task.column_title,
                                        owner: task.assignee_name || 'Unassigned',
                                        created: formatDate(task.date_creation),
                                        priority: getPriorityColor(task.priority),
                                        url: `${KANBOARD_URL}/?controller=TaskViewController&action=show&task_id=${task.id}&project_id=${task.project_id}`
                                    })),
                                    total: response.data.length
                                };
                            } else {
                                result = { success: false, error: response.error };
                            }
                        } catch (error) {
                            result = { success: false, error: error.message };
                        }
                        break;

                    case 'add_comment':
                        try {
                            const response = await kanboardRequest('createComment', {
                                task_id: args.task_id,
                                comment: args.comment
                            });

                            if (response.success) {
                                result = {
                                    success: true,
                                    comment_id: response.data,
                                    task_id: args.task_id,
                                    message: 'Comment added successfully'
                                };
                            } else {
                                result = { success: false, error: response.error };
                            }
                        } catch (error) {
                            result = { success: false, error: error.message };
                        }
                        break;

                    case 'get_task_comments':
                        try {
                            const response = await kanboardRequest('getAllComments', {
                                task_id: args.task_id
                            });

                            if (response.success) {
                                result = {
                                    success: true,
                                    task_id: args.task_id,
                                    comments: response.data.map(comment => ({
                                        id: comment.id,
                                        comment: comment.comment,
                                        author: comment.username,
                                        created: formatDate(comment.date_creation),
                                        updated: formatDate(comment.date_modification)
                                    })),
                                    total: response.data.length
                                };
                            } else {
                                result = { success: false, error: response.error };
                            }
                        } catch (error) {
                            result = { success: false, error: error.message };
                        }
                        break;

                    default:
                        return res.json(jsonRpcResponse(null, {
                            code: -32601,
                            message: `Tool '${toolName}' not found`
                        }));
                }

                return res.json(jsonRpcResponse({
                    content: [{
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }]
                }));

            case 'resources/list':
                return res.json(jsonRpcResponse({ resources: [] }));

            case 'prompts/list':
                return res.json(jsonRpcResponse({ prompts: [] }));

            default:
                return res.json(jsonRpcResponse(null, {
                    code: -32601,
                    message: `Method '${method}' not found`
                }));
        }
    } catch (error) {
        console.error(`[Kanboard MCP] Error:`, error);
        return res.json(jsonRpcResponse(null, {
            code: -32603,
            message: error.message
        }));
    }
});

// Health Check
app.get('/health', async (req, res) => {
    try {
        const response = await kanboardRequest('getVersion');
        res.json({
            status: 'healthy',
            server: 'kanboard-mcp-server',
            version: '1.0.0',
            tools: tools.length,
            kanboard: {
                url: KANBOARD_URL,
                connection: response.success ? 'connected' : 'failed',
                version: response.success ? response.data : null
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            server: 'kanboard-mcp-server',
            version: '1.0.0',
            tools: tools.length,
            kanboard: {
                url: KANBOARD_URL,
                connection: 'failed',
                error: error.message
            },
            timestamp: new Date().toISOString()
        });
    }
});

// Info Endpoint
app.get('/mcp', (req, res) => {
    res.json({
        protocol: 'mcp',
        version: '2024-11-05',
        server: 'kanboard-mcp-server',
        description: 'Kanboard integration for LibreChat - manage projects, tasks, and boards',
        capabilities: { tools: true, resources: false, prompts: false },
        tools: tools.map(tool => ({
            name: tool.name,
            description: tool.description
        })),
        kanboard: {
            url: KANBOARD_URL,
            api_endpoint: KANBOARD_API_URL
        }
    });
});

// Test Endpoint
app.get('/test', async (req, res) => {
    try {
        const versionResponse = await kanboardRequest('getVersion');
        const projectsResponse = await kanboardRequest('getAllProjects');

        res.json({
            test: 'passed',
            kanboard_connection: 'working',
            version: versionResponse.success ? versionResponse.data : 'failed',
            projects_count: projectsResponse.success ? projectsResponse.data.length : 'failed',
            tools: tools.length
        });
    } catch (error) {
        res.status(500).json({
            test: 'failed',
            kanboard_connection: 'failed',
            error: error.message
        });
    }
});

const PORT = process.env.PORT || 8006;
app.listen(PORT, () => {
    console.log('==========================================');
    console.log('  Kanboard MCP Server Started');
    console.log('==========================================');
    console.log(`🚀 Server: http://localhost:${PORT}`);
    console.log(`🏥 Health: http://localhost:${PORT}/health`);
    console.log(`🔧 Test: http://localhost:${PORT}/test`);
    console.log(`📋 Info: http://localhost:${PORT}/mcp`);
    console.log(`📊 Kanboard: ${KANBOARD_URL}`);
    console.log(`🛠️  Tools: ${tools.length} available`);
    console.log(`📡 MCP Endpoint: /mcp`);
    console.log('==========================================');

    if (!KANBOARD_USERNAME || !KANBOARD_PASSWORD) {
        console.log('⚠️  WARNING: Kanboard credentials not properly set!');
        console.log('   Check KANBOARD_USERNAME and KANBOARD_PASSWORD');
    }
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n[Kanboard MCP] Server shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n[Kanboard MCP] Server shutting down gracefully...');
    process.exit(0);
});