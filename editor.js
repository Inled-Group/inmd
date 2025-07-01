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

        // Mejorar el pegado para mantener formato
        this.visualEditor.addEventListener('paste', (e) => {
            e.preventDefault();
            this.handlePaste(e);
        });

        // Synchronize scrolling between editors
        this.visualEditor.addEventListener('scroll', this.syncScroll.bind(this));
        this.markdownOutput.addEventListener('scroll', this.syncScroll.bind(this));
    }

    // Mejorar el manejo del pegado
    handlePaste(e) {
        const clipboardData = e.clipboardData || window.clipboardData;
        
        // Intentar obtener HTML formateado primero
        const htmlData = clipboardData.getData('text/html');
        const textData = clipboardData.getData('text/plain');
        
        if (htmlData && htmlData.trim() !== '') {
            // Limpiar y procesar HTML pegado
            const cleanHtml = this.cleanPastedHtml(htmlData);
            this.insertHtmlAtCursor(cleanHtml);
        } else if (textData) {
            // Si solo hay texto plano, mantener saltos de línea
            const formattedText = this.formatPlainTextPaste(textData);
            this.insertHtmlAtCursor(formattedText);
        }
        
        this.updateMarkdown();
    }

    // Limpiar HTML pegado de otras fuentes
    cleanPastedHtml(html) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Remover elementos no deseados
        const unwantedElements = tempDiv.querySelectorAll('script, style, meta, link');
        unwantedElements.forEach(el => el.remove());
        
        // Limpiar atributos innecesarios pero mantener href, src, alt
        const allElements = tempDiv.querySelectorAll('*');
        allElements.forEach(el => {
            const allowedAttrs = ['href', 'src', 'alt', 'type', 'checked'];
            const attrs = Array.from(el.attributes);
            attrs.forEach(attr => {
                if (!allowedAttrs.includes(attr.name)) {
                    el.removeAttribute(attr.name);
                }
            });
        });
        
        // Convertir elementos comunes
        this.normalizeHtmlElements(tempDiv);
        
        return tempDiv.innerHTML;
    }

    // Normalizar elementos HTML a versiones estándar
    normalizeHtmlElements(container) {
        // Convertir <div> a <p> cuando sea apropiado
        const divs = container.querySelectorAll('div');
        divs.forEach(div => {
            if (!div.querySelector('div, p, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, pre')) {
                const p = document.createElement('p');
                p.innerHTML = div.innerHTML;
                div.parentNode.replaceChild(p, div);
            }
        });

        // Convertir elementos de formato
        const replacements = {
            'span[style*="font-weight: bold"], span[style*="font-weight:bold"]': 'strong',
            'span[style*="font-style: italic"], span[style*="font-style:italic"]': 'em',
            'span[style*="text-decoration: underline"], span[style*="text-decoration:underline"]': 'u',
            'span[style*="text-decoration: line-through"], span[style*="text-decoration:line-through"]': 's'
        };

        Object.keys(replacements).forEach(selector => {
            const elements = container.querySelectorAll(selector);
            elements.forEach(el => {
                const newElement = document.createElement(replacements[selector]);
                newElement.innerHTML = el.innerHTML;
                el.parentNode.replaceChild(newElement, el);
            });
        });
    }

    // Formatear texto plano manteniendo párrafos
    formatPlainTextPaste(text) {
        // Dividir por párrafos (doble salto de línea)
        const paragraphs = text.split(/\n\s*\n/);
        
        return paragraphs
            .map(paragraph => {
                // Limpiar espacios extras pero mantener saltos de línea simples
                const cleanParagraph = paragraph.trim().replace(/\n/g, '<br>');
                return cleanParagraph ? `<p>${cleanParagraph}</p>` : '';
            })
            .filter(p => p)
            .join('');
    }

    // Insertar HTML en la posición del cursor
    insertHtmlAtCursor(html) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            
            // Convertir a un fragmento de documento para mantener el orden
            const fragment = document.createDocumentFragment();
            while (tempDiv.firstChild) {
                fragment.appendChild(tempDiv.firstChild);
            }
            
            // Insertar el fragmento completo
            range.insertNode(fragment);
            
            // Mover cursor al final del contenido insertado
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
        }
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
        setTimeout(() => {
            this.isScrolling = false;
        }, 50);
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

        for (let i = 0; i < rows - 1; i++) {
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

    // Permite insertar texto o HTML en la posición del cursor desde fuera del editor
    insertAtCursor(content, isHtml = false) {
        this.visualEditor.focus();
        if (isHtml) {
            this.insertHtmlAtCursor(content);
        } else {
            document.execCommand('insertText', false, content);
        }
        this.updateMarkdown();
        this.saveToHistory();
    }

    updateMarkdown() {
        const markdown = this.htmlToMarkdown(this.visualEditor.innerHTML);
        this.markdownOutput.value = markdown;
    }

    htmlToMarkdown(html) {
        // Crear un elemento temporal para procesar el HTML
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Limpiar el HTML antes de convertir
        this.cleanupHtml(temp);

        return this.processNode(temp).trim();
    }

    // Limpiar HTML para evitar conflictos en markdown
    cleanupHtml(container) {
        // Remover elementos vacíos
        const emptyElements = container.querySelectorAll('p:empty, div:empty, span:empty');
        emptyElements.forEach(el => el.remove());

        // Consolidar elementos anidados del mismo tipo
        this.consolidateNestedElements(container, 'strong');
        this.consolidateNestedElements(container, 'em');
        this.consolidateNestedElements(container, 's');

        // Limpiar espacios extra
        const textNodes = this.getTextNodes(container);
        textNodes.forEach(node => {
            node.textContent = node.textContent.replace(/\s+/g, ' ');
        });
    }

    // Consolidar elementos anidados del mismo tipo (ej: <strong><strong>texto</strong></strong>)
    consolidateNestedElements(container, tagName) {
        const elements = container.querySelectorAll(tagName);
        elements.forEach(el => {
            const parent = el.parentElement;
            if (parent && parent.tagName.toLowerCase() === tagName) {
                // Mover el contenido al padre y eliminar el elemento hijo
                while (el.firstChild) {
                    parent.insertBefore(el.firstChild, el);
                }
                el.remove();
            }
        });
    }

    // Obtener todos los nodos de texto
    getTextNodes(node) {
        const textNodes = [];
        const walker = document.createTreeWalker(
            node,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        let textNode;
        while (textNode = walker.nextNode()) {
            textNodes.push(textNode);
        }
        
        return textNodes;
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
            case 'h1': return `# ${content.trim()}\n\n`;
            case 'h2': return `## ${content.trim()}\n\n`;
            case 'h3': return `### ${content.trim()}\n\n`;
            case 'h4': return `#### ${content.trim()}\n\n`;
            case 'h5': return `##### ${content.trim()}\n\n`;
            case 'h6': return `###### ${content.trim()}\n\n`;
            case 'p': 
                const trimmedContent = content.trim();
                return trimmedContent ? `${trimmedContent}\n\n` : '';
            case 'strong':
            case 'b': 
                return content.trim() ? `**${content.trim()}**` : '';
            case 'em':
            case 'i': 
                return content.trim() ? `*${content.trim()}*` : '';
            case 'u': 
                return content.trim() ? `<u>${content.trim()}</u>` : '';
            case 's':
            case 'strike': 
                return content.trim() ? `~~${content.trim()}~~` : '';
            case 'code': 
                return content ? `\`${content}\`` : '';
            case 'pre': 
                const codeContent = element.querySelector('code') ? 
                    element.querySelector('code').textContent : content;
                return `\n\`\`\`\n${codeContent}\n\`\`\`\n\n`;
            case 'blockquote': 
                const quoteContent = content.trim().split('\n').map(line => `> ${line}`).join('\n');
                return `${quoteContent}\n\n`;
            case 'a': 
                return content.trim() ? `[${content.trim()}](${element.href || '#'})` : '';
            case 'img': 
                return `![${element.alt || 'imagen'}](${element.src || ''})`;
            case 'hr': 
                return `\n---\n\n`;
            case 'br': 
                return '\n';
            case 'ul': 
                return this.processListItems(element, '- ') + '\n';
            case 'ol': 
                return this.processListItems(element, null, true) + '\n';
            case 'li':
                if (element.querySelector('input[type="checkbox"]')) {
                    const checkbox = element.querySelector('input[type="checkbox"]');
                    const checked = checkbox.checked ? 'x' : ' ';
                    const text = element.textContent.replace(/^\s*/, '').trim();
                    return `- [${checked}] ${text}`;
                }
                return content.trim();
            case 'table': 
                return this.tableToMarkdown(element) + '\n';
            case 'div':
                // Tratar divs como párrafos si no contienen elementos de bloque
                if (!element.querySelector('div, p, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, pre, table')) {
                    return content.trim() ? `${content.trim()}\n\n` : '';
                }
                return content;
            default: 
                return content;
        }
    }

    processListItems(listElement, prefix, numbered = false) {
        let result = '';
        let counter = 1;

        for (let li of listElement.children) {
            if (li.tagName.toLowerCase() === 'li') {
                const itemPrefix = numbered ? `${counter}. ` : prefix;
                const itemContent = this.elementToMarkdown(li).trim();
                if (itemContent) {
                    result += `${itemPrefix}${itemContent}\n`;
                    if (numbered) counter++;
                }
            }
        }

        return result;
    }

    tableToMarkdown(table) {
        let markdown = '\n';
        const rows = table.querySelectorAll('tr');

        if (rows.length === 0) return '';

        rows.forEach((row, index) => {
            const cells = row.querySelectorAll('th, td');
            const cellTexts = Array.from(cells).map(cell => cell.textContent.trim());
            
            if (cellTexts.length > 0) {
                markdown += '| ' + cellTexts.join(' | ') + ' |\n';

                // Agregar separador después del header
                if (index === 0) {
                    markdown += '|' + cellTexts.map(() => ' --- |').join('') + '\n';
                }
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
            const markdown = e.target.result;
            this.markdownToHtml(markdown);
            this.saveToHistory();
            this.showNotification('Archivo cargado');
        };
        reader.readAsText(file);
    }

    markdownToHtml(markdown) {
        // Conversión mejorada de markdown a HTML
        let html = markdown
            // Headers
            .replace(/^#{6}\s+(.*)$/gm, '<h6>$1</h6>')
            .replace(/^#{5}\s+(.*)$/gm, '<h5>$1</h5>')
            .replace(/^#{4}\s+(.*)$/gm, '<h4>$1</h4>')
            .replace(/^#{3}\s+(.*)$/gm, '<h3>$1</h3>')
            .replace(/^#{2}\s+(.*)$/gm, '<h2>$1</h2>')
            .replace(/^#{1}\s+(.*)$/gm, '<h1>$1</h1>')
            
            // Formato inline
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            .replace(/~~([^~]+)~~/g, '<s>$1</s>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            
            // Links e imágenes
            .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
            
            // Citas
            .replace(/^>\s*(.*)$/gm, '<blockquote>$1</blockquote>')
            
            // Líneas horizontales
            .replace(/^---+$/gm, '<hr>')
            
            // Listas de tareas
            .replace(/^-\s*\[x\]\s*(.*)$/gm, '<li><input type="checkbox" checked> $1</li>')
            .replace(/^-\s*\[\s\]\s*(.*)$/gm, '<li><input type="checkbox"> $1</li>')
            
            // Listas no ordenadas
            .replace(/^-\s+(.*)$/gm, '<li>$1</li>')
            
            // Listas ordenadas
            .replace(/^\d+\.\s+(.*)$/gm, '<li>$1</li>');

        // Envolver listas consecutivas
        html = html.replace(/(<li>.*<\/li>\s*)+/gs, (match) => {
            if (match.includes('checkbox')) {
                return `<ul>${match}</ul>`;
            }
            return `<ul>${match}</ul>`;
        });

        // Convertir párrafos
        const lines = html.split('\n');
        const processedLines = [];
        let inCodeBlock = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('```')) {
                inCodeBlock = !inCodeBlock;
                if (inCodeBlock) {
                    processedLines.push('<pre><code>');
                } else {
                    processedLines.push('</code></pre>');
                }
                continue;
            }

            if (inCodeBlock) {
                processedLines.push(line);
                continue;
            }

            if (line === '') {
                processedLines.push('</p><p>');
            } else if (!line.match(/^<(h[1-6]|ul|ol|li|blockquote|hr|table|pre)/)) {
                processedLines.push(line);
            } else {
                processedLines.push(line);
            }
        }

        html = processedLines.join('\n');

        // Limpiar párrafos vacíos y envolver contenido
        html = html
            .replace(/<p><\/p>/g, '')
            .replace(/^([^<][^>]*)/gm, '<p>$1</p>')
            .replace(/<p>(<[^>]+>)/g, '$1')
            .replace(/(<\/[^>]+>)<\/p>/g, '$1');

        this.visualEditor.innerHTML = html;
        this.updateMarkdown();
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
    const editorInstance = new MarkdownEditor();
    // Expón el método globalmente para otros scripts (como ai.js)
    window.insertInVisualEditor = (content, isHtml = false) => {
        editorInstance.insertAtCursor(content, isHtml);
    };
});