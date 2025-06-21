class MarkdownEditor {
    constructor() {
        this.visualEditor = document.getElementById('visual-editor');
        this.markdownOutput = document.getElementById('markdown-output');
        this.history = [];
        this.historyIndex = -1;
        this.isScrolling = false; // Flag to prevent infinite scroll loop

        this.init();
    }

    init() {
        // Configurar eventos
        this.setupEventListeners();

        // Contenido inicial
        this.visualEditor.innerHTML = `
            <h1>Bienvenido al Editor WYSIWYG de Markdown</h1>
            <p>Este es un <strong>editor visual</strong> de Markdown. Puedes escribir y formatear texto como en Word, y ver el código Markdown generado en tiempo real.</p>

            <h2>Características</h2>
            <ul>
                <li><strong>Negrita</strong> y <em>cursiva</em></li>
                <li><s>Texto tachado</s></li>
                <li><code>código inline</code></li>
                <li><a href="https://google.com">Enlaces</a></li>
            </ul>

            <h3>Lista de tareas</h3>
            <ul>
                <li><input type="checkbox" checked> Tarea completada</li>
                <li><input type="checkbox"> Tarea pendiente</li>
            </ul>

            <blockquote>
                Esta es una cita en markdown que se puede editar visualmente
            </blockquote>

            <p>¡Comienza a editar y ve el código Markdown generado automáticamente!</p>
        `;

        this.updateMarkdown();
        this.saveToHistory();
    }

    setupEventListeners() {
        // Actualizar markdown cuando cambie el contenido visual
        this.visualEditor.addEventListener('input', () => {
            this.updateMarkdown();
        });

        // Guardar en historial después de cambios
        this.visualEditor.addEventListener('input', this.debounce(() => {
            this.saveToHistory();
        }, 1000));

        // Atajos de teclado
        this.visualEditor.addEventListener('keydown', (e) => {
            this.handleKeyboard(e);
        });

        // Botones de la barra de herramientas
        this.setupToolbarButtons();

        // Botones de acción
        this.setupActionButtons();

        // Prevenir algunos comportamientos por defecto
        this.visualEditor.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = e.clipboardData.getData('text/plain');
            document.execCommand('insertText', false, text);
        });

        // Synchronize scrolling between editors
        this.visualEditor.addEventListener('scroll', this.syncScroll.bind(this));
        this.markdownOutput.addEventListener('scroll', this.syncScroll.bind(this));
    }

    // New: Sync scroll positions
    syncScroll(event) {
        if (this.isScrolling) {
            return;
        }

        this.isScrolling = true;

        const target = event.target;
        const otherEditor = (target === this.visualEditor) ? this.markdownOutput : this.visualEditor;

        // Calculate scroll percentage
        const scrollPercentage = target.scrollTop / (target.scrollHeight - target.clientHeight);

        // Apply scroll to the other editor
        otherEditor.scrollTop = scrollPercentage * (otherEditor.scrollHeight - otherEditor.clientHeight);

        // Also sync horizontal scroll if applicable
        const scrollXPercentage = target.scrollLeft / (target.scrollWidth - target.clientWidth);
        otherEditor.scrollLeft = scrollXPercentage * (otherEditor.scrollWidth - otherEditor.clientWidth);


        // Debounce the setting of isScrolling to false
        // This ensures the other editor finishes its scroll operation
        // without immediately triggering a reverse scroll
        setTimeout(() => {
            this.isScrolling = false;
        }, 50); // A small delay to allow the other scroll to complete
    }

    setupToolbarButtons() {
        const buttons = {
            'bold': () => this.execCommand('bold'),
            'italic': () => this.execCommand('italic'),
            'underline': () => this.execCommand('underline'),
            'strikethrough': () => this.execCommand('strikeThrough'),
            'h1': () => this.formatBlock('h1'),
            'h2': () => this.formatBlock('h2'),
            'h3': () => this.formatBlock('h3'),
            'h4': () => this.formatBlock('h4'),
            'h5': () => this.formatBlock('h5'),
            'h6': () => this.formatBlock('h6'),
            'ul': () => this.execCommand('insertUnorderedList'),
            'ol': () => this.execCommand('insertOrderedList'),
            'checkbox': () => this.insertCheckboxList(),
            'link': () => this.insertLink(),
            'image': () => this.insertImage(),
            'code': () => this.wrapWithTag('code'),
            'codeblock': () => this.insertCodeBlock(),
            'quote': () => this.formatBlock('blockquote'),
            'table': () => this.insertTable(),
            'hr': () => this.execCommand('insertHorizontalRule'),
            'undo': () => this.undo(),
            'redo': () => this.redo()
        };

        Object.keys(buttons).forEach(id => {
            const button = document.getElementById(id);
            if (button) {
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    buttons[id]();
                    this.visualEditor.focus();
                });
            }
        });
    }

    setupActionButtons() {
        document.getElementById('copy-markdown').addEventListener('click', () => {
            this.copyToClipboard(this.markdownOutput.value);
        });

        document.getElementById('copy-html').addEventListener('click', () => {
            this.copyToClipboard(this.visualEditor.innerHTML);
        });

        document.getElementById('download-md').addEventListener('click', () => {
            this.downloadFile(this.markdownOutput.value, 'documento.md', 'text/markdown');
        });

        document.getElementById('load-file').addEventListener('click', () => {
            document.getElementById('file-input').click();
        });

        document.getElementById('file-input').addEventListener('change', (e) => {
            this.loadFile(e.target.files[0]);
        });
    }

    handleKeyboard(e) {
        if (e.ctrlKey || e.metaKey) {
            switch(e.key) {
                case 'b':
                    e.preventDefault();
                    this.execCommand('bold');
                    break;
                case 'i':
                    e.preventDefault();
                    this.execCommand('italic');
                    break;
                case 'z':
                    e.preventDefault();
                    if (e.shiftKey) {
                        this.redo();
                    } else {
                        this.undo();
                    }
                    break;
                case 'y':
                    e.preventDefault();
                    this.redo();
                    break;
            }
        }
    }

    execCommand(command, value = null) {
        document.execCommand(command, false, value);
        this.updateMarkdown();
    }

    formatBlock(tag) {
        document.execCommand('formatBlock', false, tag);
        this.updateMarkdown();
    }

    wrapWithTag(tag) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const selectedText = range.toString();

            if (selectedText) {
                const element = document.createElement(tag);
                element.textContent = selectedText;
                range.deleteContents();
                range.insertNode(element);

                selection.removeAllRanges();
                this.updateMarkdown();
            }
        }
    }

    insertCheckboxList() {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';

        const li = document.createElement('li');
        li.appendChild(checkbox);
        li.appendChild(document.createTextNode(' Nueva tarea'));

        const ul = document.createElement('ul');
        ul.appendChild(li);

        this.insertElementAtCursor(ul);
    }

    insertLink() {
        const url = prompt('Introduce la URL:', 'https://');
        if (url) {
            document.execCommand('createLink', false, url);
            this.updateMarkdown();
        }
    }

    insertImage() {
        const url = prompt('URL de la imagen:', 'https://');
        const alt = prompt('Texto alternativo:', 'descripción');

        if (url) {
            const img = document.createElement('img');
            img.src = url;
            img.alt = alt || 'imagen';
            img.style.maxWidth = '100%';

            this.insertElementAtCursor(img);
        }
    }

    insertCodeBlock() {
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        code.textContent = '// Tu código aquí';
        pre.appendChild(code);

        this.insertElementAtCursor(pre);
    }

    insertTable() {
        const rows = prompt('Número de filas:', '3');
        const cols = prompt('Número de columnas:', '3');

        if (rows === null || cols === null || isNaN(rows) || isNaN(cols) || rows <= 0 || cols <= 0) {
            this.showNotification('Valores de filas/columnas no válidos.');
            return;
        }

        let tableHTML = '<thead><tr>';
        for (let i = 0; i < cols; i++) {
            tableHTML += `<th>Columna ${i + 1}</th>`;
        }
        tableHTML += '</tr></thead><tbody>';

        for (let i = 0; i < rows - 1; i++) { // -1 because header row is already counted
            tableHTML += '<tr>';
            for (let j = 0; j < cols; j++) {
                tableHTML += `<td>Fila ${i + 1}, Dato ${j + 1}</td>`;
            }
            tableHTML += '</tr>';
        }
        tableHTML += '</tbody>';

        const table = document.createElement('table');
        table.innerHTML = tableHTML;

        this.insertElementAtCursor(table);
    }

    insertElementAtCursor(element) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.insertNode(element);

            // Mover el cursor después del elemento insertado
            range.setStartAfter(element);
            range.setEndAfter(element);
            selection.removeAllRanges();
            selection.addRange(range);

            this.updateMarkdown();
        }
    }

    updateMarkdown() {
        const markdown = this.htmlToMarkdown(this.visualEditor.innerHTML);
        this.markdownOutput.value = markdown;
    }

    htmlToMarkdown(html) {
        // Crear un elemento temporal para procesar el HTML
        const temp = document.createElement('div');
        temp.innerHTML = html;

        return this.processNode(temp);
    }

    processNode(node) {
        let markdown = '';

        for (let child of node.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
                markdown += child.textContent;
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                markdown += this.elementToMarkdown(child);
            }
        }

        return markdown;
    }

    elementToMarkdown(element) {
        const tag = element.tagName.toLowerCase();
        const content = this.processNode(element);

        switch (tag) {
            case 'h1': return `# ${content}\n\n`;
            case 'h2': return `## ${content}\n\n`;
            case 'h3': return `### ${content}\n\n`;
            case 'h4': return `#### ${content}\n\n`;
            case 'h5': return `##### ${content}\n\n`;
            case 'h6': return `###### ${content}\n\n`;
            case 'p': return `${content}\n\n`;
            case 'strong':
            case 'b': return `**${content}**`;
            case 'em':
            case 'i': return `*${content}*`;
            case 'u': return `<u>${content}</u>`;
            case 's':
            case 'strike': return `~~${content}~~`;
            case 'code': return `\`${content}\``;
            case 'pre': return `\n\`\`\`\n${content}\n\`\`\`\n\n`;
            case 'blockquote': return `> ${content}\n\n`;
            case 'a': return `[${content}](${element.href})`;
            case 'img': return `![${element.alt || 'imagen'}](${element.src})`;
            case 'hr': return `\n---\n\n`;
            case 'br': return '\n';
            case 'ul': return this.processListItems(element, '- ') + '\n';
            case 'ol': return this.processListItems(element, null, true) + '\n';
            case 'li':
                if (element.querySelector('input[type="checkbox"]')) {
                    const checkbox = element.querySelector('input[type="checkbox"]');
                    const checked = checkbox.checked ? 'x' : ' ';
                    const text = element.textContent.replace(/^\s*/, '');
                    return `- [${checked}] ${text}`;
                }
                return content;
            case 'table': return this.tableToMarkdown(element) + '\n';
            default: return content;
        }
    }

    processListItems(listElement, prefix, numbered = false) {
        let result = '';
        let counter = 1;

        for (let li of listElement.children) {
            if (li.tagName.toLowerCase() === 'li') {
                const itemPrefix = numbered ? `${counter}. ` : prefix;
                result += `${itemPrefix}${this.elementToMarkdown(li)}\n`;
                if (numbered) counter++;
            }
        }

        return result;
    }

    tableToMarkdown(table) {
        let markdown = '\n';
        const rows = table.querySelectorAll('tr');

        rows.forEach((row, index) => {
            const cells = row.querySelectorAll('th, td');
            const cellTexts = Array.from(cells).map(cell => cell.textContent.trim());
            markdown += '| ' + cellTexts.join(' | ') + ' |\n';

            // Agregar separador después del header
            if (index === 0) {
                markdown += '|' + cellTexts.map(() => '-----------|').join('') + '\n';
            }
        });

        return markdown;
    }

    saveToHistory() {
        const currentValue = this.visualEditor.innerHTML;

        if (this.history[this.historyIndex] === currentValue) {
            return;
        }

        this.history.splice(this.historyIndex + 1);
        this.history.push(currentValue);
        this.historyIndex = this.history.length - 1;

        if (this.history.length > 50) {
            this.history.shift();
            this.historyIndex--;
        }
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.visualEditor.innerHTML = this.history[this.historyIndex];
            this.updateMarkdown();
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.visualEditor.innerHTML = this.history[this.historyIndex];
            this.updateMarkdown();
        }
    }

    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showNotification('Copiado al portapapeles');
        }).catch(() => {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showNotification('Copiado al portapapeles');
        });
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showNotification('Archivo descargado');
    }

    loadFile(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            // Convertir markdown a HTML básico para el editor visual
            const markdown = e.target.result;
            this.markdownToHtml(markdown);
            this.saveToHistory();
            this.showNotification('Archivo cargado');
        };
        reader.readAsText(file);
    }

    markdownToHtml(markdown) {
        // Conversión básica de markdown a HTML para el editor
        let html = markdown
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/~~(.*?)~~/g, '<s>$1</s>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
            .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
            .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
            // Handle lists for markdown input. This is a very basic conversion.
            // For proper list conversion, a full markdown parser (like markdown-it) is needed.
            .replace(/^- (.*)$/gm, '<li><input type="checkbox"> $1</li>') // Basic checkbox list
            .replace(/^[0-9]\. (.*)$/gm, '<li>$1</li>') // Basic ordered list
            // General paragraphing for remaining lines
            .replace(/([^\n]\n)(?=[^\n])/g, '$1<br>') // Convert single newlines to <br> for soft breaks
            .replace(/(\n{2,})/g, '</p><p>'); // Convert multiple newlines to paragraphs

        // Wrap initial and final content in a paragraph if not already
        if (!html.startsWith('<p>') && !html.startsWith('<h') && !html.startsWith('<ul') && !html.startsWith('<ol') && !html.startsWith('<blockquote') && !html.startsWith('<pre') && !html.startsWith('<table>')) {
            html = '<p>' + html;
        }
        if (!html.endsWith('</p>') && !html.endsWith('</h1>') && !html.endsWith('</h2>') && !html.endsWith('</h3>') && !html.endsWith('</ul>') && !html.endsWith('</ol>') && !html.endsWith('</blockquote>') && !html.endsWith('</pre>') && !html.endsWith('</table>')) {
            html = html + '</p>';
        }

        // Clean up empty paragraphs that might appear from multiple newlines
        html = html.replace(/<p><\/p>/g, '');

        this.visualEditor.innerHTML = html;
        this.updateMarkdown(); // Update markdown output after loading HTML
    }


    showNotification(message) {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            z-index: 1000;
            transition: opacity 0.3s;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 2000);
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Inicializar el editor cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
    new MarkdownEditor();
});