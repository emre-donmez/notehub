class NoteHub {
    constructor() {
        this.tabs = [];
        this.activeTabId = null;
        this.tabCounter = 0;
        this.draggedTab = null;

        this.initializeElements();
        this.loadFromStorage();
        this.bindEvents();

        // Create first tab if none exist
        if (this.tabs.length === 0) {
            this.createNewTab();
        }
    }

    initializeElements() {
        this.tabsList = document.getElementById('tabs-list');
        this.editorContainer = document.getElementById('editor-container');
        this.newTabBtn = document.getElementById('new-tab-btn');
        this.scrollLeftBtn = document.getElementById('scroll-left');
        this.scrollRightBtn = document.getElementById('scroll-right');
        this.themeToggle = document.getElementById('theme-toggle');
        this.exportBtn = document.getElementById('export-btn');
        this.importBtn = document.getElementById('import-btn');
        this.importFile = document.getElementById('import-file');

        // Load theme
        this.loadTheme();
        this.updateScrollButtons();
    }

    bindEvents() {
        this.newTabBtn.addEventListener('click', () => this.createNewTab());
        this.scrollLeftBtn.addEventListener('click', () => this.scrollTabs('left'));
        this.scrollRightBtn.addEventListener('click', () => this.scrollTabs('right'));
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        this.exportBtn.addEventListener('click', () => this.exportNotes());
        this.importBtn.addEventListener('click', () => this.importFile.click());
        this.importFile.addEventListener('change', (e) => this.importNotes(e));

        // Add scroll event listener to update scroll buttons
        this.tabsList.addEventListener('scroll', () => {
            this.updateScrollButtons();
        });

        // Add dragover and drop events to tabs list for end-of-list dropping
        this.tabsList.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        this.tabsList.addEventListener('drop', (e) => {
            e.preventDefault();
            if (this.draggedTab) {
                const afterElement = this.getDragAfterElement(this.tabsList, e.clientX);
                
                if (afterElement == null) {
                    this.tabsList.appendChild(this.draggedTab);
                    
                    const draggedIndex = this.tabs.findIndex(t => t.id == this.draggedTab.dataset.tabId);
                    const draggedTabData = this.tabs.splice(draggedIndex, 1)[0];
                    this.tabs.push(draggedTabData);
                    
                    this.saveToStorage();
                }
            }
        });
    }

    scrollTabs(direction) {
        const scrollAmount = 200;
        if (direction === 'left') {
            this.tabsList.scrollLeft -= scrollAmount;
        } else {
            this.tabsList.scrollLeft += scrollAmount;
        }
    }

    updateScrollButtons() {
        const canScrollLeft = this.tabsList.scrollLeft > 0;
        const canScrollRight = this.tabsList.scrollLeft < (this.tabsList.scrollWidth - this.tabsList.clientWidth);
        
        this.scrollLeftBtn.style.display = canScrollLeft ? 'block' : 'none';
        this.scrollRightBtn.style.display = canScrollRight ? 'block' : 'none';
    }

    scrollToActiveTab() {
        const activeTab = document.querySelector('.tab.active');
        if (activeTab) {
            const tabsListRect = this.tabsList.getBoundingClientRect();
            const activeTabRect = activeTab.getBoundingClientRect();
            
            if (activeTabRect.left < tabsListRect.left) {
                this.tabsList.scrollLeft -= (tabsListRect.left - activeTabRect.left) + 20;
            } else if (activeTabRect.right > tabsListRect.right) {
                this.tabsList.scrollLeft += (activeTabRect.right - tabsListRect.right) + 20;
            }
        }
    }

    getDragAfterElement(container, x) {
        const draggableElements = [...container.querySelectorAll('.tab:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = x - box.left - box.width / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    createNewTab() {
        const id = ++this.tabCounter;
        const tab = {
            id: id,
            title: `Note ${id}`,
            content: ''
        };

        this.tabs.push(tab);
        this.renderTab(tab);
        this.renderEditor(tab);
        this.switchToTab(id);
        this.saveToStorage();
        
        setTimeout(() => {
            this.updateScrollButtons();
            this.scrollToActiveTab();
        }, 10);
    }

    renderTab(tab) {
        const tabElement = document.createElement('div');
        tabElement.className = 'tab';
        tabElement.dataset.tabId = tab.id;
        tabElement.draggable = true;

        tabElement.innerHTML = `
            <span class="tab-title" data-tab-id="${tab.id}">${tab.title}</span>
            <button class="tab-close" data-tab-id="${tab.id}">×</button>
        `;

        // Event listeners
        tabElement.addEventListener('click', (e) => {
            if (!e.target.classList.contains('tab-close')) {
                this.switchToTab(tab.id);
                this.scrollToActiveTab();
            }
        });

        const closeBtn = tabElement.querySelector('.tab-close');
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeTab(tab.id);
        });

        // Tab title editing
        const titleElement = tabElement.querySelector('.tab-title');
        titleElement.addEventListener('dblclick', () => {
            this.editTabTitle(tab.id);
        });

        // Drag and drop events
        tabElement.addEventListener('dragstart', (e) => {
            this.draggedTab = tabElement;
            tabElement.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        tabElement.addEventListener('dragend', () => {
            tabElement.classList.remove('dragging');
            this.draggedTab = null;
        });

        tabElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        tabElement.addEventListener('drop', (e) => {
            e.preventDefault();
            if (this.draggedTab && this.draggedTab !== tabElement) {
                const draggedIndex = Array.from(this.tabsList.children).indexOf(this.draggedTab);
                const afterElement = this.getDragAfterElement(this.tabsList, e.clientX);
                
                if (afterElement === tabElement) {
                    tabElement.parentNode.insertBefore(this.draggedTab, tabElement);
                } else {
                    tabElement.parentNode.insertBefore(this.draggedTab, tabElement.nextSibling);
                }

                const draggedTabData = this.tabs.splice(draggedIndex, 1)[0];
                const newTargetIndex = Array.from(this.tabsList.children).indexOf(this.draggedTab);
                this.tabs.splice(newTargetIndex, 0, draggedTabData);

                this.saveToStorage();
            }
        });

        this.tabsList.appendChild(tabElement);
    }

    renderEditor(tab) {
        const editor = document.createElement('textarea');
        editor.className = 'editor';
        editor.dataset.tabId = tab.id;
        editor.value = tab.content;
        editor.placeholder = 'Write your note here...';

        editor.addEventListener('input', () => {
            const tabData = this.tabs.find(t => t.id === tab.id);
            if (tabData) {
                tabData.content = editor.value;
                this.saveToStorage();
            }
        });

        this.editorContainer.appendChild(editor);
    }

    switchToTab(tabId) {
        document.querySelectorAll('.tab.active').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.editor.active').forEach(editor => {
            editor.classList.remove('active');
        });

        const tabElement = document.querySelector(`[data-tab-id="${tabId}"]`);
        const editorElement = document.querySelector(`.editor[data-tab-id="${tabId}"]`);

        if (tabElement && editorElement) {
            tabElement.classList.add('active');
            editorElement.classList.add('active');
            editorElement.focus();
            this.activeTabId = tabId;
        }
    }

    closeTab(tabId) {
        if (this.tabs.length <= 1) return;

        const tabIndex = this.tabs.findIndex(t => t.id === tabId);
        if (tabIndex === -1) return;

        document.querySelector(`[data-tab-id="${tabId}"]`).remove();
        document.querySelector(`.editor[data-tab-id="${tabId}"]`).remove();

        this.tabs.splice(tabIndex, 1);

        if (this.activeTabId === tabId) {
            const newActiveIndex = Math.min(tabIndex, this.tabs.length - 1);
            this.switchToTab(this.tabs[newActiveIndex].id);
            this.scrollToActiveTab();
        }

        this.saveToStorage();
        
        setTimeout(() => {
            this.updateScrollButtons();
        }, 10);
    }

    editTabTitle(tabId) {
        const titleElement = document.querySelector(`.tab-title[data-tab-id="${tabId}"]`);
        const currentTitle = titleElement.textContent;

        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentTitle;
        input.className = 'tab-title-input';

        const finishEdit = () => {
            const newTitle = input.value.trim() || currentTitle;
            titleElement.textContent = newTitle;
            titleElement.style.display = 'inline';
            input.remove();

            const tab = this.tabs.find(t => t.id === tabId);
            if (tab) {
                tab.title = newTitle;
                this.saveToStorage();
            }
        };

        input.addEventListener('blur', finishEdit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                finishEdit();
            } else if (e.key === 'Escape') {
                titleElement.style.display = 'inline';
                input.remove();
            }
        });

        titleElement.style.display = 'none';
        titleElement.parentNode.insertBefore(input, titleElement);
        input.focus();
        input.select();
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        document.documentElement.setAttribute('data-theme', newTheme);
        this.themeToggle.textContent = newTheme === 'dark' ? '☀️' : '🌙';

        localStorage.setItem('theme', newTheme);
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
    }

    saveToStorage() {
        try {
            const data = {
                tabs: this.tabs,
                activeTabId: this.activeTabId,
                tabCounter: this.tabCounter
            };
            
            localStorage.setItem('NoteHub', JSON.stringify(data));
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                alert('Storage quota exceeded! Please export your notes.');
            }
        }
    }

    loadFromStorage() {
        const savedData = localStorage.getItem('NoteHub');
        if (savedData) {
            try {
                const data = JSON.parse(savedData);
                this.tabs = data.tabs || [];
                this.activeTabId = data.activeTabId;
                this.tabCounter = data.tabCounter || 0;

                this.tabs.forEach(tab => {
                    this.renderTab(tab);
                    this.renderEditor(tab);
                });

                if (this.activeTabId && this.tabs.find(t => t.id === this.activeTabId)) {
                    this.switchToTab(this.activeTabId);
                }

                setTimeout(() => {
                    this.updateScrollButtons();
                    this.scrollToActiveTab();
                }, 10);
            } catch (error) {
                console.error('Error loading data:', error);
            }
        }
    }

    exportNotes() {
        const data = {
            tabs: this.tabs,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `my-notes-${new Date().toISOString().split('T')[0]}.json`;
        a.click();

        URL.revokeObjectURL(url);
    }

    importNotes(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);

                if (data.tabs && Array.isArray(data.tabs)) {
                    this.tabsList.innerHTML = '';
                    this.editorContainer.innerHTML = '';

                    this.tabs = data.tabs;
                    this.tabCounter = Math.max(...this.tabs.map(t => t.id), 0);

                    this.tabs.forEach(tab => {
                        this.renderTab(tab);
                        this.renderEditor(tab);
                    });

                    if (this.tabs.length > 0) {
                        this.switchToTab(this.tabs[0].id);
                    }

                    this.saveToStorage();
                    
                    setTimeout(() => {
                        this.updateScrollButtons();
                        this.scrollToActiveTab();
                    }, 10);
                    
                    alert('Notes imported successfully!');
                } else {
                    alert('Invalid file format!');
                }
            } catch (error) {
                alert('File reading error: ' + error.message);
            }
        };

        reader.readAsText(file);
        event.target.value = '';
    }
}

// Start the application
document.addEventListener('DOMContentLoaded', () => {
    new NoteHub();

});