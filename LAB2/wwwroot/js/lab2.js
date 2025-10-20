
const api = '/api/Tasks';
let tasks = [];
const STORAGE_KEY = 'todoTasks';
let connection = null;

window.addEventListener('DOMContentLoaded', initializeApp);

async function initializeApp() {
    await initSignalR();
    await loadTasks();

    
    

    const container = document.getElementById('tasks');
    if (container) {
        new Sortable(container, {
            animation: 200,
            ghostClass: 'task-ghost',
            chosenClass: 'task-chosen',
            dragClass: 'task-drag',
            fallbackOnBody: true,
            swapThreshold: 0.65,
            onEnd: () => {
                saveOrder();
            }
        });
    }
}


async function loadTasks() {
    try {
        const res = await fetch(api);
        const serverTasks = res.ok ? await res.json() : [];
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            let storedTasks;
            try { storedTasks = JSON.parse(stored); } catch { storedTasks = []; }
            const order = storedTasks.map(t => String(t.id));
            const map = new Map(serverTasks.map(t => [String(t.id), t]));
            const merged = [];
            order.forEach(id => {
                if (map.has(id)) { merged.push(map.get(id)); map.delete(id); }
            });
            map.forEach(t => merged.push(t)); 
            tasks = merged;
        } else {
            tasks = serverTasks;
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (e) {
        console.error("Failed to fetch tasks from API", e);
        const stored = localStorage.getItem(STORAGE_KEY);
        tasks = stored ? JSON.parse(stored) : [];
    }

    renderTasks();
}

function renderTasks() {
    const container = document.getElementById('tasks');
    if (!container) return;
    container.innerHTML = '';

    const filtered = tasks.filter(t =>
        t.status !== 'Done' &&
        (window.currentPriorityFilter === 'all' ||
            t.priority === +window.currentPriorityFilter)
    );

    if (filtered.length === 0) { container.innerText = 'No tasks found'; return; }

    filtered.forEach(t => {
        const card = document.createElement('div');
        card.className = 'task-card';
        card.dataset.id = t.id;
        card.draggable = true;

        card.innerHTML = `
      <div class="card-header">
        <span class="card-title">${escapeHtml(t.name)}</span>
        <div>
          <button class="complete-btn" data-id="${t.id}">✔</button>
          <button class="delete-btn" data-id="${t.id}">×</button>
        </div>
      </div>
      <div class="card-body"><p>${escapeHtml(t.description)}</p></div>
      <div class="card-footer">
        <small>Priority: ${t.priority}</small>
        <small>Due: ${new Date(t.dueDate).toLocaleDateString()}</small>
        <button class="edit-btn" data-id="${t.id}">Edit</button>
      </div>
    `;
        container.appendChild(card);
    });

    
    container.querySelectorAll('.complete-btn').forEach(b => b.addEventListener('click', (e) => {
        const id = +e.currentTarget.dataset.id;
        completeTask(id);
    }));
    container.querySelectorAll('.delete-btn').forEach(b => b.addEventListener('click', (e) => {
        const id = +e.currentTarget.dataset.id;
        deleteTask(id);
    }));
    container.querySelectorAll('.edit-btn').forEach(b => b.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        location.href = `edit.html?id=${id}`;
    }));
}


async function completeTask(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.status = 'Done';
        saveAndRerender();
    }

    try {
        const res = await fetch(`${api}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(task)
        });
        if (!res.ok) {
            console.error('Complete failed', await res.text());
            if (task) { task.status = 'Active'; saveAndRerender(); }
        }
    } catch (e) {
        console.error("Failed to complete task on server", e);
        if (task) { task.status = 'Active'; saveAndRerender(); }
    }
}

async function deleteTask(id) {
    const index = tasks.findIndex(t => t.id === id);
    if (index !== -1) tasks.splice(index, 1);
    saveAndRerender();

    try {
        const res = await fetch(`${api}/${id}`, { method: 'DELETE' });
        if (!res.ok) console.error('Delete failed', await res.text());
    } catch (e) {
        console.error("Failed to delete task on server", e);
    }
}


function saveOrder() {
    const visibleTaskElements = document.querySelectorAll('#tasks .task-card');
    const visibleIds = Array.from(visibleTaskElements).map(el => String(el.dataset.id));
    const taskMap = new Map(tasks.map(t => [String(t.id), t]));
    const reorderedTasks = [];

    visibleIds.forEach(id => {
        if (taskMap.has(id)) { reorderedTasks.push(taskMap.get(id)); taskMap.delete(id); }
    });
    taskMap.forEach(t => reorderedTasks.push(t));

    tasks = reorderedTasks;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));


    if (connection && connection.state === signalR.HubConnectionState.Connected) {
        const ids = tasks.map(t => String(t.id));
        connection.invoke('BroadcastTasksReordered', ids).catch(e => console.error(e));
    }
}


function saveAndRerender() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    renderTasks();
}


async function initSignalR() {
    try {
        connection = new signalR.HubConnectionBuilder()
            .withUrl('/tasksHub')
            .withAutomaticReconnect()
            .build();
    } catch (e) {
        console.error('SignalR builder failed', e);
        return;
    }

    connection.on('TaskCreated', (task) => {
        if (!tasks.find(t => t.id === task.id)) {
            tasks.push(task);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
            animateInsert(task);
        }
    });

    connection.on('TaskUpdated', (task) => {
        const idx = tasks.findIndex(t => t.id === task.id);
        if (idx !== -1) tasks[idx] = task;
        else tasks.push(task);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
        renderTasksWithHighlight(task.id);
    });

    connection.on('TaskDeleted', (id) => {
        const idx = tasks.findIndex(t => t.id === id);
        if (idx !== -1) {
            tasks.splice(idx, 1);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
            animateRemoval(id);
        }
    });

    connection.on('TasksReordered', (orderedIds) => {
        applyRemoteReorder(orderedIds);
    });

    connection.onreconnecting((error) => {
        console.warn('SignalR reconnecting', error);
    });

    connection.onreconnected(async (connectionId) => {
        console.log('SignalR reconnected, syncing tasks from server');
        try {
            await loadTasks();
        } catch (e) {
            console.error('Reload after reconnect failed', e);
        }
    });

    connection.onclose((error) => {
        console.warn('SignalR closed', error);
    });

    try {
        await connection.start();
        console.log('SignalR connected');
    } catch (e) {
        console.error('SignalR start failed', e);
    }
}

function renderTasksWithHighlight(id) {
    renderTasks();
    const el = document.querySelector(`#tasks .task-card[data-id="${id}"]`);
    if (!el) return;
    el.classList.add('task-chosen');
    setTimeout(() => el.classList.remove('task-chosen'), 700);
}

function animateInsert(task) {
    renderTasks();
    const el = document.querySelector(`#tasks .task-card[data-id="${task.id}"]`);
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'scale(0.96) translateY(-8px)';
    requestAnimationFrame(() => {
        el.style.transition = 'transform 280ms ease, opacity 280ms ease';
        el.style.opacity = '1';
        el.style.transform = 'none';
    });
    setTimeout(() => { el.style.transition = ''; }, 350);
}

function animateRemoval(id) {
    const el = document.querySelector(`#tasks .task-card[data-id="${id}"]`);
    if (!el) { renderTasks(); return; }
    el.style.transition = 'opacity 250ms ease, transform 250ms ease';
    el.style.opacity = '0';
    el.style.transform = 'scale(0.96)';
    setTimeout(() => renderTasks(), 260);
}


function applyRemoteReorder(orderedIds) {
    const container = document.getElementById('tasks');
    if (!container) return;

    const nodes = Array.from(container.children);
    const oldRects = new Map();
    nodes.forEach(n => oldRects.set(n.dataset.id, n.getBoundingClientRect()));

    orderedIds.forEach(id => {
        const node = container.querySelector(`.task-card[data-id="${id}"]`);
        if (node) container.appendChild(node);
    });

    const newNodes = Array.from(container.children);
    newNodes.forEach(n => {
        const oldRect = oldRects.get(n.dataset.id);
        const newRect = n.getBoundingClientRect();
        if (!oldRect) return;
        const dx = oldRect.left - newRect.left;
        const dy = oldRect.top - newRect.top;
        if (dx === 0 && dy === 0) return;
        n.style.transition = 'transform 0s';
        n.style.transform = `translate(${dx}px, ${dy}px)`;
        requestAnimationFrame(() => {
            n.style.transition = 'transform 300ms cubic-bezier(.2,.8,.2,1)';
            n.style.transform = '';
        });
        n.addEventListener('transitionend', function te() {
            n.style.transition = '';
            n.style.transform = '';
            n.removeEventListener('transitionend', te);
        });
    });

  
    const map = new Map(tasks.map(t => [String(t.id), t]));
    const newOrder = [];
    orderedIds.forEach(id => { if (map.has(id)) { newOrder.push(map.get(id)); map.delete(id); } });
    map.forEach(t => newOrder.push(t));
    tasks = newOrder;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
