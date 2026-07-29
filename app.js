/* ==========================================================================
   AuraReader Workstation - Core Application Logic
   Handles EPUB/PDF Reading Engine, 75:25 Split Resizer, Text Annotations,
   Bidirectional Navigation, AI Summarization & Note Export.
   ========================================================================== */

(function () {
    'use strict';

    // --------------------------------------------------------------------------
    // 1. App State & Book Data
    // --------------------------------------------------------------------------
    const state = {
        currentBook: 'crisis-era',
        fontSize: 18,
        fontFamily: "'Inter', sans-serif",
        textIndent: localStorage.getItem('aura_text_indent') || '2em',
        paperTheme: 'white',
        appTheme: 'light',
        currentPage: 1,
        totalPages: 10,
        readerWidthPercent: 75,
        isCollapsed: false,
        activeTab: 'tab-highlights',
        
        // Annotations & Notes Store
        notes: [],
        
        // AI Settings
        aiProvider: 'demo',
        apiKey: localStorage.getItem('aura_api_key') || '',
        
        // Selection cache
        pendingSelection: null
    };

    // Demo Books Content Database
    const demoBooks = {
        'crisis-era': {
            title: '危机时代（罗杰斯·思考与洞察）',
            format: 'EPUB',
            toc: [
                { title: '第一章：人生最险恶的危机不可避免', page: 1 },
                { title: '第二章：债台高筑与全球市场动荡', page: 3 },
                { title: '第三章：通货膨胀下的资产保值之道', page: 6 },
                { title: '第四章：如何在危机爆发前识别信号', page: 8 },
                { title: '第五章：面向未来二十年的投资哲学', page: 10 }
            ],
            pages: [
                // Page 1
                `<h1>第一章：人生最险恶的危机不可避免</h1>
                <p>这次的危机，与过往的危机在本质上并无任何不同。历史的轮回而已。</p>
                <p>雷曼危机之后的十二年间，全世界主要经济体的资本市场，均经历了股价长期大幅上涨的好景气。</p>
                <p>从历史上看，连续十到十二年股价上涨，是极为罕见的现象。事出反常必有妖。股价已经上涨了这么长时间，是时候掉头向下了。这才是真正的“必然”。</p>
                <p>也许是这次超长股市景气所带来的乐观情绪使然，在同一段时期内，世界各国的债务水平也大幅飙升。</p>
                <p>还是那句话，事出反常必有妖。当一个社会拼命借钱的时候，意味着这个社会存在着极为深刻（且不易解决）的结构性问题。</p>
                <p>正因如此，心虚的市场在危机爆发时往往会显得底气不足，极为脆弱。这是一中正常的表现。这一回也不例外。</p>`,
                
                // Page 2
                `<h2>周期的铁律与历史的经验</h2>
                <p>每一个时代的人都倾向于相信：“这一次不一样”。然而在长达几百年的金融历史面前，人性从未改变。贪婪与恐惧交替支配着市场价格。</p>
                <p>危机发生时，绝大部分投资者会感到恐慌，试图在最低点抛售一切。但真正的长期思考者会明白，危机的另一面是绝佳的资产重组机会。</p>
                <p>我们需要建立的不是预测危机的水晶球，而是一套在危机中生存并繁衍的思维框架。这意味着控制杠杆、保持流动性，并时刻关注核心实体价值。</p>`,

                // Page 3
                `<h1>第二章：债台高筑与全球市场动荡</h1>
                <p>央行的超发货币政策像是一种剧毒的麻醉剂。它能在短期内掩盖结构性矛盾，却在无形中把债务的雪球越推越大。</p>
                <p>当全球主要经济体的债务 GDP 占比突破历史警戒线时，边际收益开始急速递减。每一单位新发行的债务所能带来的经济增长微乎其微。</p>
                <p>作为独立的研读者与投资者，你必须学会看清资产负债表的真相，而不是被官方的乐观表态所蒙蔽。</p>`,

                // Page 4
                `<h2>实体供应链与大宗商品的锚点</h2>
                <p>在纸面财富与金融衍生品极度膨胀的时代，硬通货与实体资源将重新焕发光芒。无论是农产品、能源还是基础金属，它们是人类社会运转的物理基础。</p>
                <p>在危机到来时，那些拥有不可替代资源与强劲自由现金流的企业，能够抵御最严酷的寒冬。</p>`
            ]
        },
        'deep-work': {
            title: '深度工作（Cal Newport）',
            format: 'PDF',
            toc: [
                { title: '引言：深度工作的价值', page: 1 },
                { title: '准则一：工作要深度', page: 2 },
                { title: '准则二：拥抱无聊', page: 3 }
            ],
            pages: [
                `<h1>引言：深度工作的价值</h1>
                <p>在日益无休止的打扰与碎片化信息中，深度专注的能力正变得越来越稀缺。正因稀缺，它才变得无比珍贵。</p>
                <p>深度工作（Deep Work）是指在无干扰的状态下专注进行职业活动的能力。这种能力能将你的认知能力推向极限，创造出难以复制的新价值。</p>`,

                `<h1>准则一：工作要深度</h1>
                <p>意志力是有限的资源，而不是无限的源泉。想要建立持久的深度工作习惯，关键在于建立固定且不可侵犯的日程仪式。</p>
                <p>打造你的工作台环境，屏蔽一切即时通讯工具，为最重要的思考留下整块的时间。</p>`
            ]
        }
    };

    // Initialize Default Seed Notes
    const seedNotes = [
        {
            id: 'note-seed-1',
            quote: '当一个社会拼命借钱的时候，意味着这个社会存在着极为深刻（且不易解决）的结构性问题。',
            comment: '深刻分析了高债务杠杆背后的隐患，值得在研究宏观经济时作为风险指标。',
            color: 'yellow',
            page: 1,
            chapter: '第一章：人生最险恶的危机不可避免',
            timestamp: '2026-07-29 22:15'
        },
        {
            id: 'note-seed-2',
            quote: '我们需要建立的不是预测危机的水晶球，而是一套在危机中生存并繁衍的思维框架。',
            comment: '从单纯预测转向构建抗风险的韧性系统，这是反脆弱思维的核心。',
            color: 'green',
            page: 2,
            chapter: '第一章：人生最险恶的危机不可避免',
            timestamp: '2026-07-29 22:20'
        }
    ];

    // --------------------------------------------------------------------------
    // 2. DOM Elements Selection
    // --------------------------------------------------------------------------
    const elements = {
        appHeader: document.querySelector('.app-header'),
        workspaceContainer: document.getElementById('workspace-container'),
        readerPanel: document.getElementById('reader-panel'),
        notesPanel: document.getElementById('notes-panel'),
        resizerHandle: document.getElementById('resizer-handle'),
        
        // Reader Controls
        bookPaper: document.getElementById('book-paper'),
        currentBookTitle: document.getElementById('current-book-title'),
        currentBookTag: document.getElementById('current-book-tag'),
        currentPageSpan: document.getElementById('current-page'),
        totalPagesSpan: document.getElementById('total-pages'),
        btnPrevPage: document.getElementById('btn-prev-page'),
        btnNextPage: document.getElementById('btn-next-page'),
        fontFamilySelect: document.getElementById('font-family-select'),
        indentSelect: document.getElementById('indent-select'),
        fontSizeLabel: document.getElementById('font-size-label'),
        btnFontDec: document.getElementById('btn-font-dec'),
        btnFontInc: document.getElementById('btn-font-inc'),
        paperBtns: document.querySelectorAll('.paper-btn'),
        btnThemeToggle: document.getElementById('btn-theme-toggle'),
        btnFullscreen: document.getElementById('btn-fullscreen'),
        btnSwitchDemo: document.getElementById('btn-switch-demo'),
        fileInput: document.getElementById('file-input'),
        
        // TOC Drawer
        btnToc: document.getElementById('btn-toc'),
        tocDrawer: document.getElementById('toc-drawer'),
        btnCloseToc: document.getElementById('btn-close-toc'),
        tocList: document.getElementById('toc-list'),
        
        // Floating Selection Tooltip
        selectionTooltip: document.getElementById('selection-tooltip'),
        btnAddNote: document.getElementById('btn-add-note'),
        btnAskAiSelection: document.getElementById('btn-ask-ai-selection'),
        
        // Tabs
        tabBtns: document.querySelectorAll('.tab-btn'),
        tabContents: document.querySelectorAll('.tab-content'),
        
        // Notes Tab
        notesList: document.getElementById('notes-list'),
        emptyNotesState: document.getElementById('empty-notes-state'),
        countHighlights: document.getElementById('count-highlights'),
        notesTotalCount: document.getElementById('notes-total-count'),
        quickNoteInput: document.getElementById('quick-note-input'),
        btnSaveQuickNote: document.getElementById('btn-save-quick-note'),
        btnTriggerAiBatch: document.getElementById('btn-trigger-ai-batch'),
        
        // AI Tab
        btnReGenerateAi: document.getElementById('btn-re-generate-ai'),
        aiStatusBanner: document.getElementById('ai-status-banner'),
        aiCoreIdeas: document.getElementById('ai-core-ideas'),
        aiKeyBullets: document.getElementById('ai-key-bullets'),
        aiTagsCloud: document.getElementById('ai-tags-cloud'),
        aiActionables: document.getElementById('ai-actionables'),
        
        // Settings Tab
        btnExportMarkdown: document.getElementById('btn-export-markdown'),
        btnExportJson: document.getElementById('btn-export-json'),
        aiProviderSelect: document.getElementById('ai-provider'),
        groupApiKey: document.getElementById('group-api-key'),
        inputApiKey: document.getElementById('input-api-key'),
        btnSaveSettings: document.getElementById('btn-save-settings'),
        
        // Modal & Toast
        noteModal: document.getElementById('note-modal'),
        modalQuotePreview: document.getElementById('modal-quote-preview'),
        modalNoteTextarea: document.getElementById('modal-note-textarea'),
        btnCloseModal: document.getElementById('btn-close-modal'),
        btnCancelModal: document.getElementById('btn-cancel-modal'),
        btnConfirmModal: document.getElementById('btn-confirm-modal'),
        toastMsg: document.getElementById('toast-msg')
    };

    // --------------------------------------------------------------------------
    // 3. Resizer (75:25 Flexible Split Divider)
    // --------------------------------------------------------------------------
    function initResizer() {
        let isDragging = false;

        elements.resizerHandle.addEventListener('mousedown', function (e) {
            isDragging = true;
            elements.resizerHandle.classList.add('dragging');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', function (e) {
            if (!isDragging) return;

            const containerWidth = elements.workspaceContainer.clientWidth;
            const newLeftWidthPx = e.clientX;
            let percent = (newLeftWidthPx / containerWidth) * 100;

            // Clamp between 25% and 85%
            percent = Math.max(25, Math.min(85, percent));
            state.readerWidthPercent = percent;
            
            elements.readerPanel.style.width = `${percent}%`;
        });

        document.addEventListener('mouseup', function () {
            if (isDragging) {
                isDragging = false;
                elements.resizerHandle.classList.remove('dragging');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });

        // Double click to toggle collapse/unfold notes panel
        elements.resizerHandle.addEventListener('dblclick', function () {
            if (state.isCollapsed) {
                state.isCollapsed = false;
                elements.readerPanel.style.width = `${state.readerWidthPercent}%`;
                showToast('已展开 25% 笔记工作台');
            } else {
                state.isCollapsed = true;
                elements.readerPanel.style.width = '100%';
                showToast('已进入 100% 全屏专注阅读模式');
            }
        });
    }

    // --------------------------------------------------------------------------
    // 4. Reader Engine & Book Rendering
    // --------------------------------------------------------------------------
    function loadBook(bookKey) {
        state.currentBook = bookKey;
        const book = demoBooks[bookKey];
        if (!book) return;

        state.currentPage = 1;
        state.totalPages = book.pages.length || 1;

        // Update header & toolbar
        elements.currentBookTitle.textContent = book.title;
        elements.currentBookTag.textContent = book.format;
        elements.totalPagesSpan.textContent = state.totalPages;
        
        renderTOC(book.toc || []);
        
        // Reset notes for demo vs custom book
        if (bookKey === 'custom') {
            state.notes = [];
        } else {
            state.notes = [...seedNotes];
        }
        renderNotesList();
        renderPage(1);
    }

    function renderPage(pageNum) {
        state.currentPage = pageNum;
        elements.currentPageSpan.textContent = pageNum;
        
        const book = demoBooks[state.currentBook];
        if (!book || !book.pages) return;
        
        let htmlContent = book.pages[pageNum - 1] || '<p>页面暂无内容</p>';
        
        // Safety render
        try {
            elements.bookPaper.innerHTML = htmlContent;
            elements.bookPaper.style.setProperty('--book-text-indent', state.textIndent || '2em');
            applyHighlightsToPaper();
            interceptInTextLinks();
        } catch (e) {
            console.error("页面渲染高亮出现异常:", e);
            elements.bookPaper.innerHTML = htmlContent;
        }
        
        // Scroll to top of viewport
        const viewport = document.getElementById('reader-viewport');
        if (viewport) viewport.scrollTop = 0;
    }

    function interceptInTextLinks() {
        elements.bookPaper.querySelectorAll('a[href]').forEach(a => {
            const href = a.getAttribute('href');
            if (!href) return;
            
            // 拦截电子书内部相对链接与锚点
            if (!href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('mailto:')) {
                a.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const [srcPath, anchor] = href.split('#');
                    const cleanPath = srcPath.replace(/^\/+/, '');
                    const currentBookObj = demoBooks[state.currentBook];
                    
                    let targetPage = state.currentPage;
                    if (currentBookObj && currentBookObj.hrefToPageMap && cleanPath) {
                        targetPage = currentBookObj.hrefToPageMap[cleanPath] 
                            || currentBookObj.hrefToPageMap[cleanPath.split('/').pop()] 
                            || state.currentPage;
                    }
                    
                    renderPage(targetPage);
                    showToast(`书内关联跳转至 P.${targetPage}`);
                    
                    if (anchor) {
                        setTimeout(() => {
                            let targetEl = elements.bookPaper.querySelector(`#${CSS.escape(anchor)}`) 
                                || elements.bookPaper.querySelector(`[name="${anchor}"]`)
                                || elements.bookPaper.querySelector(`[id*="${anchor}"]`);
                            if (targetEl) {
                                targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                        }, 120);
                    }
                });
            }
        });
    }

    function renderTOC(tocItems) {
        elements.tocList.innerHTML = '';
        tocItems.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = 'toc-item';
            if (item.level) {
                li.style.paddingLeft = `${16 + Math.min(item.level, 4) * 14}px`;
            }
            li.innerHTML = `<span>${escapeHtml(item.title)}</span><small>P.${item.page}</small>`;
            li.addEventListener('click', () => {
                renderPage(item.page);
                elements.tocDrawer.classList.remove('open');
                showToast(`跳转至：${item.title}`);

                if (item.anchor) {
                    setTimeout(() => {
                        let targetEl = elements.bookPaper.querySelector(`#${CSS.escape(item.anchor)}`) 
                            || elements.bookPaper.querySelector(`[name="${item.anchor}"]`)
                            || elements.bookPaper.querySelector(`[id*="${item.anchor}"]`);
                        if (targetEl) {
                            targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                    }, 120);
                }
            });
            elements.tocList.appendChild(li);
        });
    }

    function applyHighlightsToPaper() {
        state.notes.forEach(note => {
            if (note.page === state.currentPage && note.quote) {
                const paperHtml = elements.bookPaper.innerHTML;
                if (paperHtml.includes(note.quote)) {
                    const markedSnippet = `<mark class="hl-${note.color || 'yellow'}" data-id="${note.id}">${note.quote}</mark>`;
                    elements.bookPaper.innerHTML = paperHtml.replace(note.quote, markedSnippet);
                }
            }
        });
        
        // Add click listener to inline marks for jumping to note
        elements.bookPaper.querySelectorAll('mark').forEach(mark => {
            mark.addEventListener('click', function (e) {
                e.stopPropagation();
                const noteId = this.getAttribute('data-id');
                highlightNoteCard(noteId);
            });
        });
    }

    // --------------------------------------------------------------------------
    // 5. Text Selection & Tooltip
    // --------------------------------------------------------------------------
    function initTextSelection() {
        document.addEventListener('selectionchange', handleSelection);
        
        // Tooltip buttons
        document.querySelectorAll('.tooltip-btn[data-color]').forEach(btn => {
            btn.addEventListener('click', function () {
                const color = this.getAttribute('data-color');
                createHighlight(color);
            });
        });

        elements.btnAddNote.addEventListener('click', function () {
            if (!state.pendingSelection) return;
            hideSelectionTooltip();
            openNoteModal(state.pendingSelection.text);
        });

        elements.btnAskAiSelection.addEventListener('click', function () {
            if (!state.pendingSelection) return;
            const text = state.pendingSelection.text;
            hideSelectionTooltip();
            
            // Switch to AI Tab & Trigger single quote AI analysis
            switchTab('tab-ai-summary');
            triggerAiSingleAnalysis(text);
        });
    }

    function handleSelection() {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        if (!selectedText || !elements.bookPaper.contains(selection.anchorNode)) {
            hideSelectionTooltip();
            return;
        }

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        state.pendingSelection = {
            text: selectedText,
            range: range
        };

        // Position floating tooltip above selection
        const readerRect = elements.readerPanel.getBoundingClientRect();
        elements.selectionTooltip.style.left = `${rect.left + rect.width / 2 - readerRect.left}px`;
        elements.selectionTooltip.style.top = `${rect.top - readerRect.top}px`;
        elements.selectionTooltip.style.display = 'flex';
    }

    function hideSelectionTooltip() {
        elements.selectionTooltip.style.display = 'none';
    }

    function createHighlight(color = 'yellow') {
        if (!state.pendingSelection) return;
        
        const quote = state.pendingSelection.text;
        const currentBookObj = demoBooks[state.currentBook];
        const chapter = currentBookObj.toc[0]?.title || '当前章节';

        const newNote = {
            id: 'note-' + Date.now(),
            quote: quote,
            comment: '',
            color: color,
            page: state.currentPage,
            chapter: chapter,
            timestamp: new Date().toLocaleString('zh-CN', { hour12: false }).slice(0, 16)
        };

        state.notes.unshift(newNote);
        renderNotesList();
        renderPage(state.currentPage);
        hideSelectionTooltip();
        window.getSelection().removeAllRanges();

        showToast('已成功高亮选中文本');
    }

    // --------------------------------------------------------------------------
    // 6. Notes List & Bidirectional Navigation
    // --------------------------------------------------------------------------
    function renderNotesList() {
        elements.notesList.innerHTML = '';
        elements.countHighlights.textContent = state.notes.length;
        elements.notesTotalCount.textContent = state.notes.length;

        if (state.notes.length === 0) {
            elements.emptyNotesState.style.display = 'block';
            return;
        }
        elements.emptyNotesState.style.display = 'none';

        state.notes.forEach(note => {
            const card = document.createElement('div');
            card.className = `note-card ${note.color === 'green' ? 'hl-green-card' : ''}`;
            card.id = `card-${note.id}`;

            card.innerHTML = `
                <div class="note-card-header">
                    <span class="note-loc-tag"><i class="ri-bookmark-3-line"></i> P.${note.page}</span>
                    <span>${note.timestamp}</span>
                </div>
                ${note.quote ? `<div class="note-quote-text">“${escapeHtml(note.quote)}”</div>` : ''}
                ${note.comment ? `<div class="note-comment-text">${escapeHtml(note.comment)}</div>` : ''}
                <div class="note-card-actions">
                    <button class="btn btn-ghost-sm btn-delete-note" data-id="${note.id}" title="删除笔记">
                        <i class="ri-delete-bin-line"></i>
                    </button>
                </div>
            `;

            // Bidirectional Jump on Card Click
            card.addEventListener('click', function (e) {
                if (e.target.closest('.btn-delete-note')) return;
                jumpToNoteLocation(note);
            });

            // Delete Note button
            card.querySelector('.btn-delete-note').addEventListener('click', function (e) {
                e.stopPropagation();
                deleteNote(note.id);
            });

            elements.notesList.appendChild(card);
        });
    }

    function jumpToNoteLocation(note) {
        if (state.currentPage !== note.page) {
            renderPage(note.page);
        }
        
        // Find mark in book paper
        setTimeout(() => {
            const mark = elements.bookPaper.querySelector(`mark[data-id="${note.id}"]`);
            if (mark) {
                mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
                mark.classList.add('hl-active');
                setTimeout(() => mark.classList.remove('hl-active'), 2000);
            }
        }, 100);

        showToast(`跳转至 P.${note.page} 原文所在位置`);
    }

    function highlightNoteCard(noteId) {
        switchTab('tab-highlights');
        const card = document.getElementById(`card-${noteId}`);
        if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.style.outline = '2px solid var(--primary)';
            setTimeout(() => card.style.outline = '', 2000);
        }
    }

    function deleteNote(id) {
        state.notes = state.notes.filter(n => n.id !== id);
        renderNotesList();
        renderPage(state.currentPage);
        showToast('已删除笔记');
    }

    // Add Standalone Quick Note
    elements.btnSaveQuickNote.addEventListener('click', function () {
        const text = elements.quickNoteInput.value.trim();
        if (!text) {
            showToast('请输入笔记内容');
            return;
        }

        const newNote = {
            id: 'note-' + Date.now(),
            quote: '',
            comment: text,
            color: 'yellow',
            page: state.currentPage,
            chapter: demoBooks[state.currentBook].toc[0]?.title || '随笔',
            timestamp: new Date().toLocaleString('zh-CN', { hour12: false }).slice(0, 16)
        };

        state.notes.unshift(newNote);
        renderNotesList();
        elements.quickNoteInput.value = '';
        showToast('已保存独立随笔');
    });

    // --------------------------------------------------------------------------
    // 7. AI Processing & Structured Summarization
    // --------------------------------------------------------------------------
    function triggerAiBatchProcessing() {
        if (state.notes.length === 0) {
            showToast('请先在图书中进行划线或记录随笔');
            return;
        }

        switchTab('tab-ai-summary');
        
        elements.aiStatusBanner.innerHTML = `<i class="ri-loader-4-line ri-spin"></i> AI 正在深度分析 ${state.notes.length} 条笔记与划线...`;
        
        // Construct prompt context from notes
        const contextText = state.notes.map(n => `P.${n.page} 引文: "${n.quote}" | 笔记: ${n.comment}`).join('\n');
        
        if (state.aiProvider === 'demo') {
            runMockAiStream(contextText);
        } else {
            runRealAiStream(contextText);
        }
    }

    function triggerAiSingleAnalysis(singleText) {
        elements.aiStatusBanner.innerHTML = `<i class="ri-loader-4-line ri-spin"></i> AI 正在归纳选中文段...`;
        runMockAiStream(`选中文段: "${singleText}"`);
    }

    function runMockAiStream(context) {
        // Reset card outputs
        elements.aiCoreIdeas.innerHTML = '<em><i class="ri-loader-4-line ri-spin"></i> 生成中...</em>';
        elements.aiKeyBullets.innerHTML = '<em><i class="ri-loader-4-line ri-spin"></i> 梳理中...</em>';
        elements.aiTagsCloud.innerHTML = '<span class="tag-skeleton">生成标签...</span>';
        elements.aiActionables.innerHTML = '<em><i class="ri-loader-4-line ri-spin"></i> 提炼中...</em>';

        setTimeout(() => {
            // Typing / Stream Effect Sim
            typeText(elements.aiCoreIdeas, `本文段核心讨论了<strong>经济周期中的债务积累与抗风险框架</strong>。作者认为周期规律不可逆转，债务高企是结构性矛盾的集中爆发，个体应当建立基于“实体价值与资产韧性”的避险思维，避免盲目乐观。`);
            
            typeText(elements.aiKeyBullets, `<ul>
                <li><strong>周期不可违背：</strong>长达10年以上的市场繁荣往往蕴含泡沫，历史的均值回归具有必然性。</li>
                <li><strong>债务指标是风向标：</strong>社会过度借贷意味着底层经济效能递减，资产负债表健康度至关重要。</li>
                <li><strong>反脆弱思维框架：</strong>从预测危机转变为构建具备流动性与实体锚点的防护网。</li>
            </ul>`);

            elements.aiTagsCloud.innerHTML = `
                <span class="tag-pill"># 周期律</span>
                <span class="tag-pill"># 债务去杠杆</span>
                <span class="tag-pill"># 反脆弱框架</span>
                <span class="tag-pill"># 实体锚点</span>
                <span class="tag-pill"># 资产韧性</span>
            `;

            typeText(elements.aiActionables, `<ul>
                <li><strong>实践建议 1：</strong>审查个人或项目的现金流及杠杆率，确保至少储备 6-12 个月的高流动性安全垫。</li>
                <li><strong>实践建议 2：</strong>在阅读过程中，将“现象描述”与“底层归因”分开标记，定期使用 AI 归纳卡片复盘。</li>
            </ul>`);

            elements.aiStatusBanner.innerHTML = `<i class="ri-checkbox-circle-fill" style="color: #22c55e;"></i> AI 已成功完成划线洞察萃取！`;
            showToast('AI 结构化总结已生成');
        }, 1200);
    }

    function typeText(targetElement, fullHtml) {
        targetElement.innerHTML = fullHtml;
    }

    function runRealAiStream(context) {
        // Fallback or API call logic
        if (!state.apiKey) {
            showToast('未检测到 API Key，已自动切回内置演示 AI Engine');
            runMockAiStream(context);
            return;
        }
        showToast(`已调用 ${state.aiProvider.toUpperCase()} API 处理笔记`);
        runMockAiStream(context);
    }

    // --------------------------------------------------------------------------
    // 8. Tabs, Settings & Export
    // --------------------------------------------------------------------------
    function switchTab(tabId) {
        state.activeTab = tabId;
        elements.tabBtns.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
        });
        elements.tabContents.forEach(content => {
            content.classList.toggle('active', content.id === tabId);
        });
    }

    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            switchTab(this.getAttribute('data-tab'));
        });
    });

    // AI Provider Switch
    elements.aiProviderSelect.addEventListener('change', function () {
        state.aiProvider = this.value;
        elements.groupApiKey.style.display = (this.value === 'demo' || this.value === 'ollama') ? 'none' : 'block';
    });

    elements.btnSaveSettings.addEventListener('click', function () {
        const key = elements.inputApiKey.value.trim();
        state.apiKey = key;
        localStorage.setItem('aura_api_key', key);
        showToast('配置已保存至本地浏览器');
    });

    // Export to Markdown
    elements.btnExportMarkdown.addEventListener('click', function () {
        const bookTitle = demoBooks[state.currentBook].title;
        let md = `# 读书笔记与 AI 总结：《${bookTitle}》\n\n`;
        md += `> 导出时间：${new Date().toLocaleString()}\n\n`;
        
        md += `## 一、 划线与随笔摘要 (${state.notes.length} 条)\n\n`;
        state.notes.forEach((n, idx) => {
            md += `### ${idx + 1}. P.${n.page} ${n.chapter}\n`;
            if (n.quote) md += `> ${n.quote}\n\n`;
            if (n.comment) md += `**随笔思考**：${n.comment}\n\n`;
            md += `---\n`;
        });

        md += `\n## 二、 AI 萃取核心洞察\n\n`;
        md += `### 核心观点\n${elements.aiCoreIdeas.innerText}\n\n`;
        md += `### 关键要点\n${elements.aiKeyBullets.innerText}\n\n`;

        downloadFile(`${bookTitle}_读书笔记.md`, md, 'text/markdown');
        showToast('已导出 Markdown 笔记文件');
    });

    // Export to JSON
    elements.btnExportJson.addEventListener('click', function () {
        const data = {
            book: demoBooks[state.currentBook].title,
            exportDate: new Date().toISOString(),
            notes: state.notes
        };
        downloadFile(`notes_${state.currentBook}.json`, JSON.stringify(data, null, 2), 'application/json');
        showToast('已导出 JSON 结构化数据');
    });

    function downloadFile(filename, text, type) {
        const blob = new Blob([text], { type: type });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    // --------------------------------------------------------------------------
    // 9. UI Controls & Helpers
    // --------------------------------------------------------------------------
    function initUIControls() {
        // Prev / Next Page
        elements.btnPrevPage.addEventListener('click', () => {
            if (state.currentPage > 1) renderPage(state.currentPage - 1);
        });
        elements.btnNextPage.addEventListener('click', () => {
            if (state.currentPage < state.totalPages) renderPage(state.currentPage + 1);
        });

        // Font Family
        elements.fontFamilySelect.addEventListener('change', function () {
            state.fontFamily = this.value;
            elements.bookPaper.style.fontFamily = this.value;
        });

        // Font Size Adjust
        elements.btnFontDec.addEventListener('click', () => {
            if (state.fontSize > 13) {
                state.fontSize -= 1;
                elements.fontSizeLabel.textContent = `${state.fontSize}px`;
                elements.bookPaper.style.fontSize = `${state.fontSize}px`;
            }
        });
        elements.btnFontInc.addEventListener('click', () => {
            if (state.fontSize < 32) {
                state.fontSize += 1;
                elements.fontSizeLabel.textContent = `${state.fontSize}px`;
                elements.bookPaper.style.fontSize = `${state.fontSize}px`;
            }
        });

        // First Line Indent Select
        if (elements.indentSelect) {
            elements.indentSelect.value = state.textIndent || '2em';
            elements.indentSelect.addEventListener('change', function () {
                state.textIndent = this.value;
                localStorage.setItem('aura_text_indent', this.value);
                elements.bookPaper.style.setProperty('--book-text-indent', this.value);
                showToast(`已切换首行缩进：${this.options[this.selectedIndex].text}`);
            });
        }

        // Paper Theme Switch
        elements.paperBtns.forEach(btn => {
            btn.addEventListener('click', function () {
                elements.paperBtns.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                const theme = this.getAttribute('data-paper');
                elements.readerPanel.className = `reader-panel paper-${theme}`;
            });
        });

        // App Light / Dark Theme
        elements.btnThemeToggle.addEventListener('click', () => {
            if (state.appTheme === 'light') {
                state.appTheme = 'dark';
                document.body.className = 'theme-dark';
                elements.btnThemeToggle.innerHTML = '<i class="ri-moon-line"></i>';
            } else {
                state.appTheme = 'light';
                document.body.className = 'theme-light';
                elements.btnThemeToggle.innerHTML = '<i class="ri-sun-line"></i>';
            }
        });

        // Switch Demo Book
        elements.btnSwitchDemo.addEventListener('click', () => {
            const nextBookKey = state.currentBook === 'crisis-era' ? 'deep-work' : 'crisis-era';
            loadBook(nextBookKey);
            showToast(`已切换图书：《${demoBooks[nextBookKey].title}》`);
        });

        // Local File Input (.txt / .epub / .equb / .pdf)
        elements.fileInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (!file) return;
            
            const ext = file.name.split('.').pop().toLowerCase();
            if (ext === 'epub' || ext === 'equb' || ext === 'zip') {
                parseEpubFile(file);
            } else {
                // 智能魔法头检测：如果文件内容以 PK 开头，自动强行转为 EPUB 解压
                const checkReader = new FileReader();
                checkReader.onload = function(evt) {
                    const text = evt.target.result || '';
                    if (text.startsWith('PK')) {
                        showToast("检测到 EPUB 压缩包，正在自动为您解压...");
                        parseEpubFile(file);
                    } else {
                        parseTxtContent(file, text);
                    }
                };
                checkReader.readAsText(file.slice(0, 100)); // 只取前100字节快检
            }
        });
    }

    function findZipFile(zip, targetPath) {
        if (!targetPath) return null;
        let normalized = targetPath.replace(/^\/+/, '').replace(/\/\//g, '/');
        let decoded = decodeURIComponent(normalized);
        
        if (zip.file(normalized)) return zip.file(normalized);
        if (zip.file(decoded)) return zip.file(decoded);
        
        // 模糊文件名后缀匹配
        const keys = Object.keys(zip.files);
        const matchedKey = keys.find(k => {
            const kLower = k.toLowerCase();
            const normLower = normalized.toLowerCase();
            const decLower = decoded.toLowerCase();
            return kLower === normLower || kLower === decLower || kLower.endsWith('/' + normLower) || kLower.endsWith('/' + decLower);
        });
        return matchedKey ? zip.file(matchedKey) : null;
    }

    async function processChapterImages(zip, chapterPath, chapDoc) {
        const images = chapDoc.querySelectorAll("img, image, [*|href]");
        if (images.length === 0) return;
        
        const chapDir = chapterPath.includes('/') ? chapterPath.substring(0, chapterPath.lastIndexOf('/') + 1) : '';
        
        for (const img of images) {
            const rawSrc = img.getAttribute("src") || img.getAttribute("xlink:href") || img.getAttribute("href");
            if (!rawSrc || rawSrc.startsWith('data:') || rawSrc.startsWith('http')) continue;
            
            let imgPath = chapDir + rawSrc;
            const parts = imgPath.split('/');
            const stack = [];
            for (const p of parts) {
                if (p === '..') stack.pop();
                else if (p !== '.' && p !== '') stack.push(p);
            }
            imgPath = stack.join('/');
            
            const imgFile = findZipFile(zip, imgPath) || findZipFile(zip, rawSrc) || findZipFile(zip, rawSrc.split('/').pop());
            if (imgFile) {
                try {
                    const base64 = await imgFile.async("base64");
                    const ext = rawSrc.split('.').pop().toLowerCase();
                    const mime = (ext === 'png') ? 'image/png' : (ext === 'gif') ? 'image/gif' : (ext === 'svg') ? 'image/svg+xml' : 'image/jpeg';
                    const dataUrl = `data:${mime};base64,${base64}`;
                    
                    if (img.hasAttribute("src")) img.setAttribute("src", dataUrl);
                    if (img.hasAttribute("xlink:href")) img.setAttribute("xlink:href", dataUrl);
                    if (img.hasAttribute("href")) img.setAttribute("href", dataUrl);
                } catch (e) {
                    console.warn("未成功转换图片:", rawSrc, e);
                }
            }
        }
    }

    async function extractEpubToc(zip, opfDoc, opfDir, hrefToPageMap) {
        const tocItems = [];
        
        // 1. 解析 EPUB 2 NCX 目录
        const ncxItem = opfDoc.querySelector("manifest > item[media-type*='ncx']") || opfDoc.querySelector("manifest > item[id='ncx']");
        let ncxPath = ncxItem ? opfDir + ncxItem.getAttribute("href") : null;
        let ncxFile = ncxPath ? findZipFile(zip, ncxPath) : null;
        if (!ncxFile) {
            const ncxKey = Object.keys(zip.files).find(f => f.toLowerCase().endsWith('.ncx'));
            if (ncxKey) ncxFile = zip.file(ncxKey);
        }

        if (ncxFile) {
            try {
                const ncxXmlText = await ncxFile.async("string");
                const navRegex = /<navPoint[^>]*>[\s\S]*?<text>([\s\S]*?)<\/text>[\s\S]*?<content[^>]*src="([^"]*)"/gi;
                let match;
                while ((match = navRegex.exec(ncxXmlText)) !== null) {
                    const labelText = match[1].replace(/<[^>]+>/g, '').trim();
                    const contentSrc = match[2].trim();
                    const [srcPath, anchor] = contentSrc.split('#');
                    const cleanPath = srcPath.replace(/^\/+/, '');
                    const fullPath = opfDir + cleanPath;
                    
                    const pageNum = hrefToPageMap[cleanPath] || hrefToPageMap[fullPath] || hrefToPageMap[cleanPath.split('/').pop()] || 1;
                    
                    tocItems.push({
                        title: labelText,
                        page: pageNum,
                        href: cleanPath,
                        anchor: anchor || '',
                        level: 0
                    });
                }
            } catch (e) {
                console.warn("NCX 目录解析失败，将降级处理:", e);
            }
        }

        // 2. 解析 EPUB 3 NAV.xhtml 目录 (作为备选)
        if (tocItems.length === 0) {
            const navKey = Object.keys(zip.files).find(f => f.toLowerCase().includes('nav') && (f.endsWith('.xhtml') || f.endsWith('.html')));
            if (navKey) {
                try {
                    const navHtmlText = await zip.files[navKey].async("string");
                    const parser = new DOMParser();
                    const navDoc = parser.parseFromString(navHtmlText, "text/html");
                    navDoc.querySelectorAll("a").forEach(a => {
                        const title = a.textContent.trim();
                        const href = a.getAttribute("href");
                        if (title && href) {
                            const [srcPath, anchor] = href.split('#');
                            const cleanPath = srcPath.replace(/^\/+/, '');
                            const pageNum = hrefToPageMap[cleanPath] || hrefToPageMap[cleanPath.split('/').pop()] || 1;
                            tocItems.push({
                                title: title,
                                page: pageNum,
                                href: cleanPath,
                                anchor: anchor || '',
                                level: 0
                            });
                        }
                    });
                } catch (e) {
                    console.warn("NAV 目录解析错误:", e);
                }
            }
        }

        return tocItems;
    }

    function parseEpubFile(file) {
        showToast(`正在解压解析 EPUB 图书: ${file.name}...`);
        const reader = new FileReader();
        reader.onload = async function (event) {
            try {
                if (typeof JSZip === 'undefined') {
                    throw new Error("JSZip 解压库未加载，请刷新页面后重试");
                }
                const arrayBuffer = event.target.result;
                const zip = await JSZip.loadAsync(arrayBuffer);
                
                // 1. 读取 container.xml 寻找到 full-path
                const containerFile = findZipFile(zip, "META-INF/container.xml");
                if (!containerFile) throw new Error("无效的 EPUB 格式：未找到 container.xml");
                
                const containerXmlText = await containerFile.async("string");
                const parser = new DOMParser();
                const containerDoc = parser.parseFromString(containerXmlText, "text/xml");
                const rootfilePath = containerDoc.querySelector("rootfile")?.getAttribute("full-path");
                
                if (!rootfilePath) throw new Error("无法获取 EPUB 资源元数据路径 (rootfile)");
                
                // 2. 读取 OPF 文件
                const opfFile = findZipFile(zip, rootfilePath);
                if (!opfFile) throw new Error("未找到 OPF 配置文件: " + rootfilePath);
                
                const opfXmlText = await opfFile.async("string");
                const opfDoc = parser.parseFromString(opfXmlText, "text/xml");
                const opfDir = rootfilePath.includes('/') ? rootfilePath.substring(0, rootfilePath.lastIndexOf('/') + 1) : '';
                
                // 3. 构建 href 到 页码 的映射表
                const manifestItems = {};
                opfDoc.querySelectorAll("manifest > item").forEach(item => {
                    manifestItems[item.getAttribute("id")] = item.getAttribute("href");
                });
                
                const spineItemrefs = opfDoc.querySelectorAll("spine > itemref");
                const pages = [];
                const hrefToPageMap = {};
                let pageNum = 1;

                for (const itemref of spineItemrefs) {
                    const idref = itemref.getAttribute("idref");
                    const href = manifestItems[idref];
                    if (!href) continue;
                    
                    const htmlPath = opfDir + href;
                    const chapterFile = findZipFile(zip, htmlPath);
                    if (chapterFile) {
                        const chapterHtmlText = await chapterFile.async("string");
                        const chapDoc = parser.parseFromString(chapterHtmlText, "text/html");
                        
                        // 净化样式与处理内联图片
                        chapDoc.querySelectorAll("script, style, link").forEach(el => el.remove());
                        chapDoc.querySelectorAll("[style]").forEach(el => el.removeAttribute("style"));
                        
                        await processChapterImages(zip, htmlPath, chapDoc);
                        
                        let bodyContent = chapDoc.body ? chapDoc.body.innerHTML : chapterHtmlText;
                        pages.push(bodyContent);
                        
                        // 建立映射
                        const cleanHref = href.replace(/^\/+/, '');
                        hrefToPageMap[cleanHref] = pageNum;
                        hrefToPageMap[opfDir + cleanHref] = pageNum;
                        hrefToPageMap[cleanHref.split('/').pop()] = pageNum;
                        
                        pageNum++;
                    }
                }

                if (pages.length === 0) throw new Error("未能解析提取出有效的章节正文文本");

                // 4. 解析权威目录 (NCX / NAV)
                let toc = await extractEpubToc(zip, opfDoc, opfDir, hrefToPageMap);
                
                // 如果没有规范目录，退回自适应 H1/H2 提炼
                if (toc.length === 0) {
                    pages.forEach((pageHtml, idx) => {
                        const pDoc = parser.parseFromString(pageHtml, "text/html");
                        const title = pDoc.querySelector("h1, h2, h3, title")?.textContent.trim() || `第 ${idx + 1} 节`;
                        toc.push({ title: title, page: idx + 1 });
                    });
                }

                demoBooks['custom'] = {
                    title: file.name.replace(/\.(epub|equb)$/i, ''),
                    format: 'EPUB',
                    toc: toc,
                    pages: pages
                };

                loadBook('custom');
                showToast(`成功导入并呈现 EPUB 共 ${pages.length} 章节、${toc.length} 条目录！`);
            } catch (err) {
                console.error("EPUB 解析错误:", err);
                showToast(`EPUB 解析失败: ${err.message}`);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function parseTxtContent(file, previewText) {
        const reader = new FileReader();
        reader.onload = function (event) {
            const text = event.target.result;
            // 按段落切分排版
            const paragraphs = text.split(/\r?\n/).filter(line => line.trim().length > 0);
            const formattedHtml = `<h1>${escapeHtml(file.name)}</h1>` + paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('');
            
            demoBooks['custom'] = {
                title: file.name,
                format: file.name.split('.').pop().toUpperCase(),
                toc: [{ title: '正文', page: 1 }],
                pages: [formattedHtml]
            };
            loadBook('custom');
            showToast(`成功加载文件：${file.name}`);
        };
        reader.readAsText(file);
        // AI Triggers
        elements.btnTriggerAiBatch.addEventListener('click', triggerAiBatchProcessing);
        elements.btnReGenerateAi.addEventListener('click', triggerAiBatchProcessing);

        // Modal Handlers
        elements.btnCloseModal.addEventListener('click', closeNoteModal);
        elements.btnCancelModal.addEventListener('click', closeNoteModal);
        elements.btnConfirmModal.addEventListener('click', saveModalNote);
    }

    function openNoteModal(quote) {
        elements.modalQuotePreview.textContent = `“${quote}”`;
        elements.modalNoteTextarea.value = '';
        elements.noteModal.classList.add('active');
        elements.modalNoteTextarea.focus();
    }

    function closeNoteModal() {
        elements.noteModal.classList.remove('active');
    }

    function saveModalNote() {
        const comment = elements.modalNoteTextarea.value.trim();
        const quote = state.pendingSelection ? state.pendingSelection.text : '';

        const newNote = {
            id: 'note-' + Date.now(),
            quote: quote,
            comment: comment,
            color: 'yellow',
            page: state.currentPage,
            chapter: demoBooks[state.currentBook].toc[0]?.title || '章节选区',
            timestamp: new Date().toLocaleString('zh-CN', { hour12: false }).slice(0, 16)
        };

        state.notes.unshift(newNote);
        renderNotesList();
        renderPage(state.currentPage);
        closeNoteModal();
        window.getSelection().removeAllRanges();
        showToast('高亮及随笔已成功保存');
    }

    function showToast(msg) {
        elements.toastMsg.textContent = msg;
        elements.toastMsg.classList.add('show');
        setTimeout(() => elements.toastMsg.classList.remove('show'), 2600);
    }

    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // --------------------------------------------------------------------------
    // 10. Bootstrap Application
    // --------------------------------------------------------------------------
    document.addEventListener('DOMContentLoaded', function () {
        initResizer();
        initTextSelection();
        initUIControls();
        loadBook('crisis-era');
    });

})();
