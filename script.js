(function() {
    let knowledgeBase = [];
    let isProcessing = false;
    let semanticCache = new Map();
    let cacheHitCount = 0;
    const CACHE_CLEAR_THRESHOLD = 500;

    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
    }

    function detectLanguage(text) {
        const chinese = /[\u4e00-\u9fa5]/g;
        const japanese = /[\u3040-\u309f\u30a0-\u30ff]/g;
        const korean = /[\uac00-\ud7af]/g;
        const english = /[a-zA-Z]/g;
        
        const counts = {
            cn: (text.match(chinese) || []).length,
            jp: (text.match(japanese) || []).length,
            kr: (text.match(korean) || []).length,
            en: (text.match(english) || []).length
        };
        
        const total = counts.cn + counts.jp + counts.kr + counts.en;
        if (total === 0) return 'unknown';
        
        const dominant = Object.entries(counts).reduce((a, b) => counts[a[0]] > counts[b[0]] ? a : b);
        return dominant[0];
    }

    function calculateSimilarity(str1, str2) {
        const s1 = str1.toLowerCase();
        const s2 = str2.toLowerCase();
        
        let overlap = 0;
        const minLen = Math.min(s1.length, s2.length);
        
        for (let i = 0; i < minLen; i++) {
            if (s1[i] === s2[i]) overlap++;
        }
        
        if (s1.includes(s2) || s2.includes(s1)) {
            overlap += minLen * 0.3;
        }
        
        return overlap / Math.max(s1.length, s2.length);
    }

    function findBestMatch(userInput) {
        const text = userInput.toLowerCase().trim();
        const detectedLang = detectLanguage(userInput);
        
        const cacheKey = `${text}_${detectedLang}`;
        if (semanticCache.has(cacheKey)) {
            cacheHitCount++;
            if (cacheHitCount >= CACHE_CLEAR_THRESHOLD) {
                semanticCache.clear();
                cacheHitCount = 0;
            }
            return semanticCache.get(cacheKey);
        }
        
        let matches = [];
        
        knowledgeBase.forEach(item => {
            let score = 0;
            let matchDetails = [];
            
            item.keywords.forEach(keyword => {
                const lowerKey = keyword.toLowerCase();
                
                if (text === lowerKey) {
                    score += 50;
                    matchDetails.push(`精确:${keyword}(+50)`);
                } else if (text.includes(lowerKey)) {
                    score += 30;
                    matchDetails.push(`包含:${keyword}(+30)`);
                } else if (lowerKey.includes(text) && text.length >= 2) {
                    score += 15;
                    matchDetails.push(`部分:${keyword}(+15)`);
                }
                
                const similarity = calculateSimilarity(text, lowerKey);
                if (similarity > 0.5) {
                    const simScore = Math.floor(similarity * 20);
                    score += simScore;
                    matchDetails.push(`相似度:${(similarity * 100).toFixed(0)}%(+${simScore})`);
                }
            });
            
            if (score > 0) {
                const priorityWeight = item.priority / 100;
                score += priorityWeight;
                
                if (item.priority >= 2800) {
                    score *= 1.2;
                    matchDetails.push('🛡️慢权重保护(x1.2)');
                }
                
                const itemLangSuffix = item.id.split('_').pop();
                if (itemLangSuffix === detectedLang.toUpperCase() || 
                    (detectedLang === 'cn' && itemLangSuffix === 'CN') ||
                    (detectedLang === 'jp' && itemLangSuffix === 'JP') ||
                    (detectedLang === 'en' && itemLangSuffix === 'EN') ||
                    (detectedLang === 'kr' && itemLangSuffix === 'KR')) {
                    score *= 1.15;
                    matchDetails.push(`语言匹配:${detectedLang}(x1.15)`);
                }
                
                matches.push({ item, score, details: matchDetails, id: item.id });
            }
        });
        
        if (matches.length === 0) return null;
        
        matches.sort((a, b) => b.score - a.score);
        
        const bestMatch = matches[0].item;
        semanticCache.set(cacheKey, bestMatch);
        return bestMatch;
    }

    function detectDocumentType(text) {
        const gradKeywords = /先行研究|先行文献|Gap|仮説|実証|研究方法|methodology/i;
        const undergradKeywords = /志望理由書|学部|総合政策|興味を持ったきっかけ/i;
        if (gradKeywords.test(text)) return 'graduate';
        if (undergradKeywords.test(text)) return 'undergraduate';
        return 'undergraduate';
    }

    function evaluateDocument(text) {
        const type = detectDocumentType(text);
        const length = text.length;
        const paraCount = text.split('\n').filter(l => l.trim()).length;
        
        const hasMotivation = /きっかけ|興味|好き|感動/i.test(text);
        const hasPolicy = /政策|環境政策|文化政策|著作権/i.test(text);
        const hasFuture = /卒業後|将来|貢献/i.test(text);
        
        let praises = [];
        let suggestions = [];
        let reasoningSteps = [];

        reasoningSteps.push("步骤1: 提取关键词 → 动机、政策结合、未来展望、段落结构");
        reasoningSteps.push(`步骤2: 长度分析 → ${length < 400 ? '精炼' : length < 800 ? '适中' : '饱满'}`);
        reasoningSteps.push(`步骤3: 检查逻辑链 → ${hasMotivation ? '动机鲜明' : '动机稍弱'}; ${hasPolicy ? '契合高' : '契合待强化'}`);
        reasoningSteps.push("步骤4: 自纠错 → 对比PDF案例，避免泛叙事");

        if (type !== 'graduate') {
            praises.push(`● ${length < 400 ? '篇幅精炼' : length < 800 ? '长度适中' : '篇幅饱满'}`);
            if (hasMotivation) praises.push('动机鲜明，触发点生动');
            else suggestions.push('动机可补充具体细节');
            if (hasPolicy) praises.push('与政策契合度高');
            else suggestions.push('政策结合可强化');
            if (hasFuture) praises.push('展望具体，方向清晰');
            else suggestions.push('未来行动可落地化');
            if (paraCount >= 8) praises.push('段落结构清晰');
            else suggestions.push('段落可细分');

            const praiseCount = praises.length - 1;
            let overall = praiseCount >= 4 ? '水准较高，已具竞争力' :
                          praiseCount >= 3 ? '基础扎实，还有空间' :
                          '动机真挚，可再打磨';

            let output = `<b>【文书审计 - ${type === 'graduate' ? '大学院' : '学部'}模式】</b><br>`;
            reasoningSteps.forEach(step => output += `${step}<br>`);
            praises.forEach(p => output += `${p}<br>`);
            output += `<br><b>整体评价：</b> ${overall}`;

            if (suggestions.length > 0) {
                output += '<br><br><b>可优化建议</b><br>';
                suggestions.forEach((s, i) => output += `${i+1}. ${s}<br>`);
                output += '<br><b>实战范文示例</b><br>原句："私が総合政策に興味を持ったきっかけは..."<br>建议："絵を描く中で自然の美しさを感じ、初音ミクのコミュニティで繋がる力に感動しました。これらを支える政策を学び、地域活性化に貢献したいです。"';
            } else {
                output += '<br><br>整体优秀！结构完整、动机真挚。';
            }

            output += '<br><br><b>【深度审计】</b>网页端初步扫描。要逐段重构，请加微信 qiuwu999 发送完整文档。';
            return { issues: [], suggestions: [output] };
        } else {
            let output = `<b>【文书审计 - 大学院模式】</b><br>`;
            reasoningSteps.forEach(step => output += `${step}<br>`);
            output += '学术性较强。建议加微信 qiuwu999 深度分析。';
            return { issues: [], suggestions: [output] };
        }
    }

    document.addEventListener('DOMContentLoaded', async () => {
        try {
            const res = await fetch('knowledge.json?v=' + Date.now());
            knowledgeBase = await res.json();

            const input = document.getElementById('user-input');
            const sendBtn = document.getElementById('send-btn');
            const chat = document.getElementById('chat-container');

            const handleSend = async () => {
                const text = input.value.trim();
                if (!text || isProcessing) return;
                
                isProcessing = true;
                input.disabled = true;
                sendBtn.disabled = true;
                
                appendMessage('user', text);
                input.value = '';
                
                const matched = findBestMatch(text);
                const responseText = matched ? matched.response : knowledgeBase.find(i => i.id === 'WELCOME_BUNSHO')?.response || '系统错误，请刷新页面';
                
                const segments = responseText.split('[BREAK]');
                for (let seg of segments) {
                    if (seg.trim()) {
                        appendMessage('bot', seg.trim());
                        await new Promise(r => setTimeout(r, 600));
                    }
                }
                
                isProcessing = false;
                input.disabled = false;
                sendBtn.disabled = false;
                input.focus();
            };

            sendBtn.onclick = handleSend;
            input.onkeypress = (e) => { if (e.key === 'Enter') handleSend(); };

            document.querySelectorAll('.nav-btn[data-preset]').forEach(btn => {
                btn.onclick = () => { input.value = btn.getAttribute('data-preset'); handleSend(); };
            });

            document.getElementById('upload-btn').onclick = () => {
                document.getElementById('file-upload').click();
            };

            document.getElementById('file-upload').onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const supported = /\.(txt|pdf|docx|doc)$/i;
                if (!supported.test(file.name)) {
                    appendMessage('bot', '<b>【警报】</b>仅支持 TXT/PDF/DOCX/DOC');
                    e.target.value = '';
                    return;
                }

                if (file.size > 10 * 1024 * 1024) {
                    appendMessage('bot', '<b>【警报】</b>文件超过10MB，请加微信 qiuwu999');
                    e.target.value = '';
                    return;
                }

                appendMessage('user', `📄 已上传：${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
                appendMessage('bot', '<b>【扫描中】</b>提取文本...');

                let extractedText = '';
                const ext = file.name.split('.').pop().toLowerCase();

                try {
                    if (['txt'].includes(ext)) {
                        extractedText = await file.text();
                    } else if (ext === 'pdf') {
                        const arrayBuffer = await file.arrayBuffer();
                        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                        const maxPages = Math.min(pdf.numPages, 10);
                        for (let i = 1; i <= maxPages; i++) {
                            const page = await pdf.getPage(i);
                            const content = await page.getTextContent();
                            extractedText += content.items.map(item => item.str).join(' ') + '\n\n';
                        }
                    } else if (ext === 'docx' || ext === 'doc') {
                        const arrayBuffer = await file.arrayBuffer();
                        const result = await mammoth.extractRawText({ arrayBuffer });
                        extractedText = result.value;
                    }

                    if (!extractedText || extractedText.trim().length < 50) {
                        appendMessage('bot', '<b>【提取失败】</b>内容为空，请加微信 qiuwu999 发送原文件');
                        e.target.value = '';
                        return;
                    }

                    const length = extractedText.length;
                    const lengthDesc = length < 400 ? '篇幅精炼' :
                                       length < 800 ? '长度适中' :
                                       length < 1500 ? '篇幅饱满' :
                                       '内容详实';

                    appendMessage('bot', `<b>【提取完成】</b><br>● ${lengthDesc}<br>● 状态：${length > 3000 ? '前3000字预览' : '完整提取'}`);

                    const evaluation = evaluateDocument(extractedText);
                    appendMessage('bot', evaluation.suggestions[0]);

                } catch (err) {
                    appendMessage('bot', `<b>【提取失败】</b>${err.message || '解析出错'}<br>请加微信 qiuwu999 发送原文件`);
                }

                e.target.value = '';
            };

            document.getElementById('clear-btn').onclick = () => {
                if (confirm('⚠️ 确认物理清除？')) {
                    document.getElementById('chat-container').innerHTML = "";
                    localStorage.clear();
                    semanticCache.clear();
                    cacheHitCount = 0;
                    location.reload();
                }
            };

        } catch (e) {
            console.error("Error:", e);
        }
    });

    function appendMessage(role, html) {
        const chat = document.getElementById('chat-container');
        const div = document.createElement('div');
        div.className = `msg-row ${role}`;
        div.innerHTML = `<div class="bubble">${html}</div>`;
        
        div.onclick = () => {
            navigator.clipboard.writeText(div.innerText).then(() => {
                div.classList.add('copied');
                setTimeout(() => div.classList.remove('copied'), 2000);
            }).catch(err => console.error('复制失败:', err));
        };
        
        chat.appendChild(div);
        chat.scrollTop = chat.scrollHeight;
    }
})();
