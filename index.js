(function() {
    'use strict';

    const extensionName = 'chat-exporter';
    
    // 配置参数
    const config = {
        separator: '\n\n',
        fileNameMaxLength: 30
    };

    console.log('Chat Exporter: Script loaded');

    // 添加扩展设置UI
    function addExtensionSettings() {
        console.log('Chat Exporter: Adding extension settings');
        
        // 检查是否已经存在，防止重复添加
        if (document.getElementById('chat-exporter-export-all')) {
            console.log('Chat Exporter: Settings already exists, skipping');
            return;
        }
        
        const settingsHtml = `
            <div class="extension-settings" id="chat-exporter-settings">
                <div class="inline-drawer">
                    <div class="inline-drawer-toggle inline-drawer-header">
                        <b>📚 对话导出器</b>
                        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                    </div>
                    <div class="inline-drawer-content">
                        <div class="flex-container">
                            <div class="flex1">
                                <input type="button" id="chat-exporter-export-all" class="menu_button" value="导出当前对话">
                            </div>
                        </div>
                        
                        <small class="notes">
                            将导出3个文件：完整对话、用户对话、角色对话
                        </small>
                    </div>
                </div>
            </div>
        `;

        const container = document.querySelector('#extensions_settings2') || 
                         document.querySelector('#extensions_settings') ||
                         document.querySelector('.extensions_settings');

        if (container) {
            container.insertAdjacentHTML('beforeend', settingsHtml);
            console.log('Chat Exporter: Settings UI added successfully');
            bindEventListeners();
        } else {
            console.error('Chat Exporter: No suitable container found');
        }
    }

    // 绑定事件监听器
    function bindEventListeners() {
        console.log('Chat Exporter: Binding event listeners');

        const exportAllButton = document.getElementById('chat-exporter-export-all');

        if (exportAllButton) {
            exportAllButton.addEventListener('click', function() {
                console.log('Chat Exporter: Export button clicked');
                exportChat();
            });
        }
    }

    // 主要导出函数
    async function exportChat() {
        console.log('Chat Exporter: Starting export');
        
        try {
            setButtonDisabled(true);
            
            const messages = getMessages();
            console.log(`Chat Exporter: Found ${messages.length} messages`);
            
            if (messages.length === 0) {
                showToast('没有找到对话消息');
                return;
            }

            const processedData = processMessages(messages);
            console.log(`Chat Exporter: Processed data for ${Object.keys(processedData.roleContents).length} roles`);
            
            if (Object.keys(processedData.roleContents).length === 0) {
                showToast('没有找到有效的对话内容');
                return;
            }

            downloadFiles(processedData);
            showToast('导出成功！已生成3个文件');
            
        } catch (error) {
            console.error('Chat Exporter: Export failed:', error);
            showToast('导出失败: ' + error.message);
        } finally {
            setButtonDisabled(false);
        }
    }

    // 获取消息
    function getMessages() {
        console.log('Chat Exporter: Getting messages from chat');
        
        const messages = [];
        const chatContainer = document.querySelector('#chat');
        
        if (!chatContainer) {
            console.warn('Chat Exporter: Chat container not found');
            return messages;
        }
        
        const messageElements = chatContainer.querySelectorAll('.mes');
        console.log(`Chat Exporter: Found ${messageElements.length} message elements`);
        
        messageElements.forEach((msgElement, index) => {
            const isUser = msgElement.classList.contains('is_user');
            const isSystem = msgElement.classList.contains('is_system');
            
            // 跳过系统消息
            if (isSystem) {
                return;
            }
            
            const nameElement = msgElement.querySelector('.name_text');
            const contentElement = msgElement.querySelector('.mes_text');
            
            if (contentElement) {
                const name = nameElement ? nameElement.textContent.trim() : (isUser ? 'User' : 'Assistant');
                const content = extractTextContent(contentElement);
                
                if (content) {
                    messages.push({
                        name: name,
                        content: content,
                        isUser: isUser,
                        isSystem: isSystem
                    });
                    console.log(`Chat Exporter: Message ${index + 1}: ${name} (${content.length} chars)`);
                }
            }
        });
        
        return messages;
    }

    // 提取文本内容
    function extractTextContent(element) {
    // 克隆元素以避免修改原始DOM
    const clone = element.cloneNode(true);
    
    // 移除不需要的元素
    const unwantedSelectors = [
        'script', 'style', 'noscript',
        '.timestamp', '.message-id',
        '.edit-controls', '.swipe-controls',
        '.mes_edit_buttons', '.avatar',
        '.mes_buttons', '.mes_edit_cancel',
        '.mes_edit_save', '.mes_edit_delete',
        'StatusBlock','details'
    ];
    
    unwantedSelectors.forEach(selector => {
        clone.querySelectorAll(selector).forEach(el => el.remove());
    });
    
    // 处理HTML内容
    let text = clone.innerHTML;
    
    // 替换HTML标签和内容
    text = text
        //.replace(/<details\s*[^>]*>[\s\S]*?(?:<\/details>|$)/gi, '') // 移除<details>及其内容，处理未闭合情况
        .replace(/```yaml[\s\S]*?```/gi, '') 
        .replace(/<StatusBlock\s*[^>]*>[\s\S]*?(?:<\/StatusBlock>|$)/gi, '') // 移除<StatusBlock>及其内容，处理未闭合情况
        .replace(/<StatusBlock>\s*```yaml[\s\S]*?```[\s\S]*?<\/StatusBlock>/gi, '')
        .replace(/<StatusBlock>[\s\S]*?<\/StatusBlock>/gi, '')
        .replace(/```yaml[\s\S]*?```/gi, '') 
        .replace(/<br\s*\/?>/gi, '\n')           // br标签转换为换行
        .replace(/<\/p>/gi, '\n\n')              // p标签结束转换为双换行
        .replace(/<p[^>]*>/gi, '')               // 移除p标签开始
        .replace(/<\/div>/gi, '\n')              // div结束转换为换行
        .replace(/<div[^>]*>/gi, '')             // 移除div标签开始
        .replace(/<[^>]+>/g, '')                 // 移除所有其他HTML标签
        .replace(/&nbsp;/g, ' ')                 // 替换非断行空格
        .replace(/&lt;/g, '<')                   // 替换HTML实体
        .replace(/&gt;/g, '>')                   //
        .replace(/&amp;/g, '&')                  //
        .replace(/&quot;/g, '"')                 //
        .replace(/&apos;/g, "'")                 //
        .replace(/\n{3,}/g, '\n\n')              // 多个换行符合并为双换行
        .replace(/^\s+|\s+$/g, '');              // 移除首尾空白
    
    return text;
}

    // 处理消息内容
    function processMessages(messages) {
        const roleContents = {};
        let fullContent = '';
        
        messages.forEach(message => {
            const roleName = message.name;
            const content = message.content;
            
            if (content) {
                // 构建完整对话内容，始终包含用户名
                fullContent += `${roleName}:\n${content}${config.separator}`;
                
                // 构建角色分离内容
                if (!roleContents[roleName]) {
                    roleContents[roleName] = '';
                }
                roleContents[roleName] += `${content}${config.separator}`;
            }
        });
        
        return { fullContent, roleContents };
    }

    // 下载文件
    function downloadFiles(processedData) {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    
    const roleNames = Object.keys(processedData.roleContents); // 保存用户和角色卡的名称
    const [userName, cardName] = roleNames; // 假设只有两个角色：用户和角色卡

    console.log('Chat Exporter: Starting file downloads');

    // 1. 下载各角色对话（用户和角色卡）
    roleNames.forEach(roleName => {
        downloadFile(`${safeName(roleName)}_dialog_${timestamp}.txt`, processedData.roleContents[roleName].trim());
    });

    // 2. 下载完整对话，使用用户和角色卡名称
    const fullFileName = `${safeName(userName)}_and_${safeName(cardName)}_full_dialog_${timestamp}.txt`;
    downloadFile(fullFileName, processedData.fullContent.trim());

    console.log('Chat Exporter: All files downloaded');
}

    // 安全文件名处理
    function safeName(name) {
        return name
            .replace(/[\\/*?:"<>|]/g, '_')
            .substring(0, config.fileNameMaxLength)
            .trim();
    }

    // 下载文件
    function downloadFile(filename, content) {
        console.log(`Chat Exporter: Downloading file: ${filename}`);
        
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // 设置按钮状态
    function setButtonDisabled(disabled) {
        const button = document.getElementById('chat-exporter-export-all');
        
        if (button) {
            button.disabled = disabled;
            if (disabled) {
                button.setAttribute('data-original-value', button.value);
                button.value = '处理中...';
            } else {
                const originalValue = button.getAttribute('data-original-value');
                if (originalValue) {
                    button.value = originalValue;
                }
            }
        }
    }

    // 显示Toast通知
    function showToast(message) {
        console.log(`Chat Exporter: Toast: ${message}`);
        
        // 尝试使用SillyTavern的toast系统
        if (typeof toastr !== 'undefined') {
            toastr.info(message);
        } else {
            // fallback到alert
            alert(message);
        }
    }

    // 初始化函数
    function init() {
        console.log('Chat Exporter: Initializing...');
        
        // 延迟执行，确保页面元素已加载
        setTimeout(() => {
            addExtensionSettings();
        }, 1000);
    }

    // 等待 SillyTavern 加载完成
    function waitForLoad() {
        console.log('Chat Exporter: Waiting for SillyTavern to load...');
        
        const checkInterval = setInterval(() => {
            const isLoaded = document.querySelector('#extensions_settings2') || 
                           document.querySelector('#extensions_settings');
            
            if (isLoaded) {
                clearInterval(checkInterval);
                console.log('Chat Exporter: SillyTavern loaded, initializing extension');
                init();
            }
        }, 500);
        
        // 30秒后强制尝试加载
        setTimeout(() => {
            clearInterval(checkInterval);
            console.log('Chat Exporter: Timeout reached, force initializing');
            init();
        }, 30000);
    }

    // 启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitForLoad);
    } else {
        waitForLoad();
    }

})();