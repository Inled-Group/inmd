class QuillScribeAI {
    constructor() {
        this.chatEngine = null;
        this.isLoading = false;
        this.lastResponse = '';
        
        // Espera a que el DOM esté listo antes de asignar listeners
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
        } else {
            this.setupEventListeners();
        }
    }

    setupEventListeners() {
        // Botones del toolbar principal
        document.getElementById('toggle-chat').addEventListener('click', () => this.toggleChat());

        // Controles del chat
        document.getElementById('chat-close').addEventListener('click', () => this.closeChat());
        document.getElementById('send-message').addEventListener('click', () => this.sendMessage());
        document.getElementById('insert-response').addEventListener('click', () => this.insertResponse());
        document.getElementById('copy-response').addEventListener('click', () => this.copyResponse());

        // Input del chat
        const chatInput = document.getElementById('chat-input');
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Atajos de teclado
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey) {
                switch(e.key) {
                    case 'n':
                        e.preventDefault();
                        this.newDocument();
                        break;
                    case 's':
                        e.preventDefault();
                        this.saveToLocalStorage();
                        break;
                    case 'o':
                        e.preventDefault();
                        this.showOpenDialog();
                        break;
                    case 'e':
                        if (e.shiftKey) {
                            e.preventDefault();
                            this.exportToPDF();
                        }
                        break;
                }
            }
        });
    }

    async initializeWebLLM() {
        try {
            console.log('Inicializando WebLLM...');
            
            // Verificar que el elemento de estado existe
            const statusEl = document.getElementById('chat-status');
            if (!statusEl) {
                console.error('Elemento chat-status no encontrado');
                return;
            }
            
            statusEl.classList.remove('hidden');
            this.updateChatStatus('Cargando librerías de IA...', true);
            
            // Importar WebLLM con manejo de errores mejorado
            let CreateMLCEngine;
            try {
                const webllmModule = await import('https://esm.run/@mlc-ai/web-llm');
                CreateMLCEngine = webllmModule.CreateMLCEngine;
                console.log('WebLLM module cargado correctamente');
            } catch (importError) {
                console.error('Error importando WebLLM:', importError);
                // Intentar con CDN alternativo
                try {
                    const webllmModule = await import('https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.46/+esm');
                    CreateMLCEngine = webllmModule.CreateMLCEngine;
                    console.log('WebLLM cargado desde CDN alternativo');
                } catch (altError) {
                    throw new Error('No se pudo cargar WebLLM desde ningún CDN');
                }
            }
            
            // Usar un modelo más pequeño y confiable
            const selectedModel = "Llama-3.2-1B-Instruct-q4f32_1-MLC";
            
            this.updateChatStatus('Iniciando descarga del modelo de IA...', true);
            
            // Configurar callbacks de progreso más detallados
            const initProgressCallback = (progress) => {
                console.log('Progress update:', progress);
                
                if (progress.progress !== undefined) {
                    const percentage = Math.round(progress.progress * 100);
                    this.updateChatStatus(`Descargando modelo: ${percentage}%`, true);
                } else if (progress.text) {
                    this.updateChatStatus(progress.text, true);
                } else {
                    this.updateChatStatus('Procesando modelo de IA...', true);
                }
            };
            
            // Crear el engine con configuración mejorada
            this.chatEngine = await CreateMLCEngine(selectedModel, {
                initProgressCallback: initProgressCallback,
                logLevel: "DEBUG" // Para mejor debugging
            });

            console.log('WebLLM inicializado correctamente');
            this.updateChatStatus('¡IA lista para usar!', false);
            this.enableChatControls();
            
            // Ocultar el status después de un momento
            setTimeout(() => {
                statusEl.classList.add('hidden');
            }, 3000);
            
        } catch (error) {
            console.error('Error inicializando WebLLM:', error);
            
            let errorMessage = 'Error al cargar la IA.';
            if (error.message.includes('network') || error.message.includes('fetch')) {
                errorMessage = 'Error de conexión. Verifica tu internet.';
            } else if (error.message.includes('memory') || error.message.includes('storage')) {
                errorMessage = 'Para usar la IA necesitamos más memoria disponible. Cierra otras pestañas.';
            } else if (error.message.includes('CDN')) {
                errorMessage = 'Error cargando librerías. Intenta recargar.';
            }
            
            this.updateChatStatus(errorMessage, false);
            
            // Ocultar el status de error después de 5 segundos
            setTimeout(() => {
                const statusEl = document.getElementById('chat-status');
                if (statusEl) statusEl.classList.add('hidden');
            }, 5000);
        }
    }

    updateChatStatus(message, showSpinner) {
        const statusEl = document.getElementById('chat-status');
        if (!statusEl) return;
        
        const spinner = statusEl.querySelector('.loading-spinner');
        const text = statusEl.querySelector('span');
        
        if (text) text.textContent = message;
        if (spinner) spinner.style.display = showSpinner ? 'block' : 'none';
        
        // Asegurar que el elemento esté visible cuando se muestra estado
        statusEl.classList.remove('hidden');
        
        console.log('Status update:', message, 'Spinner:', showSpinner);
    }

    enableChatControls() {
        const chatInput = document.getElementById('chat-input');
        const sendButton = document.getElementById('send-message');
        
        if (chatInput) {
            chatInput.disabled = false;
            chatInput.placeholder = 'Escribe tu mensaje aquí...';
        }
        if (sendButton) {
            sendButton.disabled = false;
        }
    }

    toggleChat() {
        const chatPanel = document.getElementById('chat-panel');
        const toolbar = document.getElementById('toolbar');
        
        if (!chatPanel) return;
        
        chatPanel.classList.toggle('open');
        if (toolbar) {
            toolbar.style.display = chatPanel.classList.contains('open') ? 'none' : '';
        }
        
        if (chatPanel.classList.contains('open')) {
            document.body.classList.add('chat-open');
            
            // Inicializar WebLLM solo cuando se abre el chat por primera vez
            if (!this.chatEngine && !this.isInitializing) {
                this.isInitializing = true;
                this.initializeWebLLM();
            }
            
            const chatInput = document.getElementById('chat-input');
            if (chatInput && !chatInput.disabled) {
                chatInput.focus();
            }
        } else {
            document.body.classList.remove('chat-open');
        }
    }

    closeChat() {
        const chatPanel = document.getElementById('chat-panel');
        const toolbar = document.getElementById('toolbar');
        
        if (chatPanel) chatPanel.classList.remove('open');
        if (toolbar) toolbar.style.display = '';
        
        document.body.classList.remove('chat-open');
    }

    async sendMessage() {
        if (!this.chatEngine || this.isLoading) {
            if (!this.chatEngine) {
                this.updateChatStatus('La IA aún se está cargando...', true);
            }
            return;
        }
        
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        
        if (!message) return;
        
        this.isLoading = true;
        input.value = '';
        input.disabled = true;
        document.getElementById('send-message').disabled = true;
        
        // Agregar mensaje del usuario
        this.addMessage(message, 'user');
        
        // Mostrar indicador de "pensando"
        const thinkingEl = this.addThinkingIndicator();
        
        try {
            // Enviar mensaje a la IA
            const response = await this.chatEngine.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: "Eres un asistente de escritura útil y amigable llamado Inled AI. Tu creador es Inled Group. Ayudas a los usuarios con sus documentos, proporcionas sugerencias de escritura, corriges gramática y respondes preguntas de manera clara y concisa. Responde siempre en español. Puedes usar Markdown para formatear tu respuesta (negrita **texto**, cursiva *texto*, listas, etc.)."
                    },
                    {
                        role: "user",
                        content: message
                    }
                ],
                temperature: 0.7,
                max_tokens: 512
            });
            
            const aiResponse = response.choices[0].message.content;
            this.lastResponse = aiResponse;
            
            // Remover indicador de "pensando" y agregar respuesta
            thinkingEl.remove();
            this.addMessage(aiResponse, 'assistant');
            
            // Habilitar botones de acción
            document.getElementById('insert-response').disabled = false;
            document.getElementById('copy-response').disabled = false;
            
        } catch (error) {
            console.error('Error en chat:', error);
            thinkingEl.remove();
            this.addMessage('Lo siento, hubo un error al procesar tu mensaje. Inténtalo de nuevo.', 'assistant');
        }
        
        this.isLoading = false;
        input.disabled = false;
        document.getElementById('send-message').disabled = false;
        input.focus();
    }

    // Función utilitaria para convertir Markdown a HTML
    markdownToHtml(markdown) {
        if (typeof marked !== 'undefined') {
            return marked.parse(markdown);
        }
        // Fallback simple para negrita y cursiva si marked no está disponible
        let html = markdown
            .replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>')
            .replace(/(\*|_)(.*?)\1/g, '<em>$2</em>')
            .replace(/\n/g, '<br>');
        return html;
    }

    addMessage(content, sender) {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;
        
        const messageEl = document.createElement('div');
        messageEl.className = `message ${sender}`;
        
        if (sender === 'assistant') {
            messageEl.innerHTML = this.markdownToHtml(content);
        } else {
            messageEl.textContent = content;
        }
        
        messagesContainer.appendChild(messageEl);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return messageEl;
    }

    addThinkingIndicator() {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return document.createElement('div');
        
        const thinkingEl = document.createElement('div');
        thinkingEl.className = 'chat-thinking';
        thinkingEl.innerHTML = `
            <span>Pensando</span>
            <div class="thinking-dots">
                <div class="thinking-dot"></div>
                <div class="thinking-dot"></div>
                <div class="thinking-dot"></div>
            </div>
        `;
        
        messagesContainer.appendChild(thinkingEl);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        return thinkingEl;
    }

    insertResponse() {
        if (this.lastResponse) {
            // Convierte el markdown a HTML y lo inserta como HTML en el visual-editor
            if (window.insertInVisualEditor) {
                let html = this.markdownToHtml(this.lastResponse);
                // Elimina los <p> envolventes si existen, para evitar dobles saltos
                if (html.startsWith('<p>') && html.endsWith('</p>')) {
                    html = html.slice(3, -4);
                }
                window.insertInVisualEditor(html, true); // Inserta como HTML
            } else {
                alert('No se puede insertar en el editor visual.');
            }
        }
    }

    parseMarkdownToQuill(markdown) {
        // Convertir Markdown básico a formato Quill
        const lines = markdown.split('\n');
        const content = [];
        
        lines.forEach(line => {
            if (line.trim() === '') {
                content.push({ type: 'text', content: '\n' });
                return;
            }
            
            // Headers
            if (line.startsWith('### ')) {
                content.push({ type: 'header', level: 3, content: line.substring(4) });
            } else if (line.startsWith('## ')) {
                content.push({ type: 'header', level: 2, content: line.substring(3) });
            } else if (line.startsWith('# ')) {
                content.push({ type: 'header', level: 1, content: line.substring(2) });
            }
            // Listas
            else if (line.match(/^\d+\.\s/)) {
                content.push({ type: 'list', ordered: true, content: line.replace(/^\d+\.\s/, '') });
            } else if (line.startsWith('- ') || line.startsWith('* ')) {
                content.push({ type: 'list', ordered: false, content: line.substring(2) });
            }
            // Texto normal con formato inline
            else {
                content.push({ type: 'paragraph', content: line });
            }
        });
        
        return content;
    }

    insertFormattedContent(content, startIndex) {
        let currentIndex = startIndex;
        
        content.forEach(item => {
            switch (item.type) {
                case 'header':
                    this.quill.insertText(currentIndex, item.content + '\n');
                    this.quill.formatText(currentIndex, item.content.length, 'header', item.level);
                    currentIndex += item.content.length + 1;
                    break;
                    
                case 'list':
                    this.quill.insertText(currentIndex, item.content + '\n');
                    this.quill.formatLine(currentIndex, 1, 'list', item.ordered ? 'ordered' : 'bullet');
                    currentIndex += item.content.length + 1;
                    break;
                    
                case 'paragraph':
                    const formattedText = this.processInlineFormatting(item.content);
                    this.insertTextWithFormatting(formattedText, currentIndex);
                    currentIndex += item.content.length + 1;
                    this.quill.insertText(currentIndex - 1, '\n');
                    break;
                    
                case 'text':
                    this.quill.insertText(currentIndex, item.content);
                    currentIndex += item.content.length;
                    break;
            }
        });
        
        this.quill.setSelection(currentIndex);
    }

    processInlineFormatting(text) {
        const segments = [];
        let currentPos = 0;
        
        // Procesar negritas **texto**
        text.replace(/\*\*(.*?)\*\*/g, (match, content, offset) => {
            if (offset > currentPos) {
                segments.push({ text: text.substring(currentPos, offset), bold: false });
            }
            segments.push({ text: content, bold: true });
            currentPos = offset + match.length;
            return match;
        });
        
        // Agregar texto restante
        if (currentPos < text.length) {
            const remaining = text.substring(currentPos);
            // Procesar cursivas *texto*
            const italicSegments = [];
            let italicPos = 0;
            
            remaining.replace(/\*(.*?)\*/g, (match, content, offset) => {
                if (offset > italicPos) {
                    italicSegments.push({ text: remaining.substring(italicPos, offset), italic: false });
                }
                italicSegments.push({ text: content, italic: true });
                italicPos = offset + match.length;
                return match;
            });
            
            if (italicPos < remaining.length) {
                italicSegments.push({ text: remaining.substring(italicPos), italic: false });
            }
            
            segments.push(...italicSegments);
        }
        
        return segments.length > 0 ? segments : [{ text: text, bold: false, italic: false }];
    }

    insertTextWithFormatting(segments, startIndex) {
        let currentIndex = startIndex;
        
        segments.forEach(segment => {
            this.quill.insertText(currentIndex, segment.text);
            
            if (segment.bold) {
                this.quill.formatText(currentIndex, segment.text.length, 'bold', true);
            }
            if (segment.italic) {
                this.quill.formatText(currentIndex, segment.text.length, 'italic', true);
            }
            
            currentIndex += segment.text.length;
        });
    }

    async copyResponse() {
        if (this.lastResponse) {
            try {
                await navigator.clipboard.writeText(this.lastResponse);
                
                // Feedback visual
                const btn = document.getElementById('copy-response');
                if (btn) {
                    const originalText = btn.innerHTML;
                    btn.innerHTML = '<i class="fas fa-check"></i> Copiado';
                    btn.style.background = '#28a745';
                    btn.style.color = 'white';
                    
                    setTimeout(() => {
                        btn.innerHTML = originalText;
                        btn.style.background = '';
                        btn.style.color = '';
                    }, 2000);
                }
                
            } catch (error) {
                console.error('Error copiando:', error);
                alert('Error al copiar el texto');
            }
        }
    }
}

// Hacer disponible globalmente
window.QuillScribeAI = QuillScribeAI;

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    // Solo crea una instancia si no existe
    if (!window.quillApp) {
        window.quillApp = new window.QuillScribeAI();
    }
});