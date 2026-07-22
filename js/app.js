/**
 * MusicBox v2 - 婚礼音乐库 & 歌单制作
 * 音频剪辑器、ZIP 导出、拖拽上传、重命名
 */

// ==================== 音频编辑器 ====================

const AudioEditor = {
    _audioCtx: null,
    _audioBuffer: null,
    _song: null,
    _trimStart: 0,
    _trimEnd: 0,
    _duration: 0,
    _isPlaying: false,
    _playSource: null,
    _playStartTime: 0,
    _rafId: null,
    _canvasWidth: 0,
    _canvasHeight: 0,
    _peaks: [],
    _dragging: null, // 'start' | 'end' | 'playhead' | null

    /** 打开编辑器 */
    async open(song) {
        const buf = FileStorage.getBuffer(song.id);
        if (!buf) { App._toast('无法加载音频文件', 'error'); return; }

        this._song = song;
        this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        try {
            this._audioBuffer = await this._audioCtx.decodeAudioData(buf.slice(0));
        } catch (e) {
            App._toast('音频解码失败', 'error');
            this._audioCtx.close();
            return;
        }

        this._duration = this._audioBuffer.duration;
        this._trimStart = 0;
        this._trimEnd = this._duration;
        this._peaks = this._computePeaks(800);

        document.getElementById('editorOriginalName').textContent = song.title;
        document.getElementById('editorNewName').value = song._isTrimmed ? song.title : song.title + ' (剪辑)';
        document.getElementById('editorDuration').textContent = MusicData._formatDuration(this._duration);
        document.getElementById('editorTrimStart').value = '0:00';
        document.getElementById('editorTrimEnd').value = MusicData._formatDuration(this._duration);
        document.getElementById('editorClipDuration').textContent = MusicData._formatDuration(this._duration);

        document.getElementById('editorOverlay').style.display = 'flex';
        document.getElementById('audioEditorModal').style.display = 'flex';
        this._drawWaveform();
        this._updateTrimDisplay();
        this._bindCanvasEvents();
    },

    /** 关闭编辑器 */
    close() {
        this._stopPlayback();
        if (this._audioCtx) { this._audioCtx.close(); this._audioCtx = null; }
        this._audioBuffer = null;
        this._song = null;
        document.getElementById('editorOverlay').style.display = 'none';
        document.getElementById('audioEditorModal').style.display = 'none';
    },

    /** 计算波形峰值 */
    _computePeaks(numPeaks) {
        const data = this._audioBuffer.getChannelData(0);
        const step = Math.floor(data.length / numPeaks);
        const peaks = [];
        for (let i = 0; i < numPeaks; i++) {
            let max = 0;
            const start = i * step;
            const end = Math.min(start + step, data.length);
            for (let j = start; j < end; j++) {
                const abs = Math.abs(data[j]);
                if (abs > max) max = abs;
            }
            peaks.push(max);
        }
        return peaks;
    },

    /** 绘制波形图 */
    _drawWaveform(playheadPos = -1) {
        const canvas = document.getElementById('editorCanvas');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.parentElement.getBoundingClientRect();
        this._canvasWidth = rect.width - 32;
        this._canvasHeight = 160;
        canvas.style.width = this._canvasWidth + 'px';
        canvas.style.height = this._canvasHeight + 'px';
        canvas.width = this._canvasWidth * dpr;
        canvas.height = this._canvasHeight * dpr;

        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        const W = this._canvasWidth;
        const H = this._canvasHeight;
        const dur = this._duration;

        // 背景
        ctx.fillStyle = '#12122a';
        ctx.fillRect(0, 0, W, H);

        // 网格线
        ctx.strokeStyle = '#2a2a45';
        ctx.lineWidth = 0.5;
        for (let t = 0; t <= dur; t += Math.max(1, Math.floor(dur / 10))) {
            const x = (t / dur) * W;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, H);
            ctx.stroke();
        }

        // 中轴线
        ctx.strokeStyle = '#35355a';
        ctx.beginPath();
        ctx.moveTo(0, H / 2);
        ctx.lineTo(W, H / 2);
        ctx.stroke();

        const startX = (this._trimStart / dur) * W;
        const endX = (this._trimEnd / dur) * W;

        // 未选中区域波形（灰色）
        this._drawPeaksRegion(ctx, 0, startX, '#3a3a55', W, H);
        this._drawPeaksRegion(ctx, endX, W, '#3a3a55', W, H);

        // 选中区域背景
        ctx.fillStyle = 'rgba(124, 92, 252, 0.12)';
        ctx.fillRect(startX, 0, endX - startX, H);

        // 选中区域波形（亮色）
        this._drawPeaksRegion(ctx, startX, endX, '#9b7fff', W, H);

        // 播放头
        if (playheadPos >= 0) {
            const px = (playheadPos / dur) * W;
            ctx.strokeStyle = '#f87171';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(px, 0);
            ctx.lineTo(px, H);
            ctx.stroke();
        }

        // 边界线 + 拖拽手柄
        this._drawHandle(ctx, startX, H, '#34d399', '▶');
        this._drawHandle(ctx, endX, H, '#f87171', '⏹');

        // 时间刻度
        ctx.fillStyle = '#6a6a82';
        ctx.font = '10px system-ui';
        for (let t = 0; t <= dur; t += Math.max(1, Math.floor(dur / 8))) {
            const x = (t / dur) * W;
            ctx.fillText(MusicData._formatDuration(t), x + 2, H - 6);
        }
    },

    _drawPeaksRegion(ctx, xStart, xEnd, color, W, H) {
        if (xStart >= xEnd) return;
        const peaks = this._peaks;
        const xMin = Math.max(0, Math.floor((xStart / W) * peaks.length));
        const xMax = Math.min(peaks.length, Math.ceil((xEnd / W) * peaks.length));

        ctx.fillStyle = color;
        const barW = Math.max(1, W / peaks.length);
        for (let i = xMin; i < xMax; i++) {
            const h = peaks[i] * (H / 2 - 8);
            const x = (i / peaks.length) * W;
            ctx.fillRect(x, H / 2 - h, barW + 0.5, h * 2);
        }
    },

    _drawHandle(ctx, x, H, color, label) {
        // 竖线
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.setLineDash([]);

        // 拖拽三角
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, H - 4);
        ctx.lineTo(x - 8, H - 18);
        ctx.lineTo(x + 8, H - 18);
        ctx.closePath();
        ctx.fill();
    },

    _bindCanvasEvents() {
        const canvas = document.getElementById('editorCanvas');
        canvas.onmousedown = (e) => this._onCanvasMouseDown(e);
        canvas.onmousemove = (e) => this._onCanvasMouseMove(e);
        canvas.onmouseup = () => { this._dragging = null; };
        canvas.onmouseleave = () => { this._dragging = null; };
        canvas.addEventListener('wheel', (e) => { e.preventDefault(); });
    },

    _onCanvasMouseDown(e) {
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const dur = this._duration;
        const W = this._canvasWidth;
        const pos = (x / W) * dur;

        const startX = (this._trimStart / dur) * W;
        const endX = (this._trimEnd / dur) * W;
        const threshold = 12;

        if (Math.abs(x - startX) < threshold) {
            this._dragging = 'start';
        } else if (Math.abs(x - endX) < threshold) {
            this._dragging = 'end';
        } else if (pos >= this._trimStart && pos <= this._trimEnd) {
            // 点击选中区域 → 跳转播放头
            this._previewAt(pos);
        }
    },

    _onCanvasMouseMove(e) {
        if (!this._dragging) return;
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const dur = this._duration;
        const W = this._canvasWidth;
        const pos = Math.max(0, Math.min(dur, (x / W) * dur));

        if (this._dragging === 'start') {
            this._trimStart = Math.min(pos, this._trimEnd - 0.1);
        } else if (this._dragging === 'end') {
            this._trimEnd = Math.max(pos, this._trimStart + 0.1);
        }
        this._drawWaveform();
        this._updateTrimDisplay();
    },

    _updateTrimDisplay() {
        document.getElementById('editorTrimStart').value = MusicData._formatDuration(this._trimStart);
        document.getElementById('editorTrimEnd').value = MusicData._formatDuration(this._trimEnd);
        const clipDur = this._trimEnd - this._trimStart;
        document.getElementById('editorClipDuration').textContent = MusicData._formatDuration(clipDur);
    },

    /** 手动输入时间 */
    applyTimeInputs() {
        const startStr = document.getElementById('editorTrimStart').value;
        const endStr = document.getElementById('editorTrimEnd').value;
        const start = this._parseTime(startStr);
        const end = this._parseTime(endStr);
        if (start !== null && end !== null && start < end && end <= this._duration) {
            this._trimStart = start;
            this._trimEnd = end;
            this._drawWaveform();
            this._updateTrimDisplay();
        } else {
            App._toast('时间格式无效', 'error');
            this._updateTrimDisplay();
        }
    },

    _parseTime(str) {
        const parts = str.split(':');
        if (parts.length === 2) {
            const m = parseInt(parts[0]), s = parseFloat(parts[1]);
            if (!isNaN(m) && !isNaN(s)) return m * 60 + s;
        }
        if (parts.length === 1) {
            const s = parseFloat(parts[0]);
            if (!isNaN(s)) return s;
        }
        return null;
    },

    /** 预览剪辑片段 */
    async togglePreview() {
        if (this._isPlaying) {
            this._stopPlayback();
            document.getElementById('btnEditorPlay').textContent = '▶ 预览剪辑';
            return;
        }
        this._isPlaying = true;
        document.getElementById('btnEditorPlay').textContent = '⏸ 停止';

        const source = this._audioCtx.createBufferSource();
        source.buffer = this._audioBuffer;
        source.connect(this._audioCtx.destination);
        source.start(0, this._trimStart, this._trimEnd - this._trimStart);
        this._playSource = source;
        this._playStartTime = this._audioCtx.currentTime;

        source.onended = () => {
            this._isPlaying = false;
            document.getElementById('btnEditorPlay').textContent = '▶ 预览剪辑';
            this._playSource = null;
            cancelAnimationFrame(this._rafId);
            this._drawWaveform();
        };

        this._updatePlayhead();
    },

    _previewAt(time) {
        this._stopPlayback();
        this._isPlaying = true;
        document.getElementById('btnEditorPlay').textContent = '⏸ 停止';

        const source = this._audioCtx.createBufferSource();
        source.buffer = this._audioBuffer;
        source.connect(this._audioCtx.destination);
        const startOffset = Math.max(this._trimStart, time);
        source.start(0, startOffset, this._trimEnd - startOffset);
        this._playSource = source;
        this._playStartTime = this._audioCtx.currentTime - (time - startOffset);

        source.onended = () => {
            this._isPlaying = false;
            document.getElementById('btnEditorPlay').textContent = '▶ 预览剪辑';
            this._playSource = null;
            cancelAnimationFrame(this._rafId);
            this._drawWaveform();
        };
        this._updatePlayhead();
    },

    _updatePlayhead() {
        if (!this._isPlaying) return;
        const elapsed = this._audioCtx.currentTime - this._playStartTime;
        const pos = this._trimStart + elapsed;
        this._drawWaveform(pos);
        if (pos < this._trimEnd) {
            this._rafId = requestAnimationFrame(() => this._updatePlayhead());
        }
    },

    _stopPlayback() {
        this._isPlaying = false;
        if (this._playSource) {
            try { this._playSource.stop(); } catch (e) { /* already stopped */ }
            this._playSource = null;
        }
        cancelAnimationFrame(this._rafId);
    },

    /** 保存剪辑 → 工作区 */
    async saveTrimmed() {
        const newTitle = document.getElementById('editorNewName').value.trim() || (this._song.title + ' (剪辑)');
        const clipDur = this._trimEnd - this._trimStart;
        if (clipDur < 0.5) { App._toast('剪辑片段太短（至少0.5秒）', 'error'); return; }

        const sampleRate = this._audioBuffer.sampleRate;
        const channels = this._audioBuffer.numberOfChannels;
        const length = Math.floor(clipDur * sampleRate);

        const offlineCtx = new OfflineAudioContext(channels, length, sampleRate);
        const source = offlineCtx.createBufferSource();
        source.buffer = this._audioBuffer;
        source.connect(offlineCtx.destination);
        source.start(0, this._trimStart, clipDur);

        const rendered = await offlineCtx.startRendering();

        // 保存到工作区
        const wsItem = App._editingWsItem;
        if (wsItem) {
            Workspace.addTrimmed(wsItem, rendered, newTitle, this._trimStart, this._trimEnd);
            App._editingWsItem = null;
        } else {
            // 向后兼容：如果没有工作区上下文，添加到曲库
            MusicData.addTrimmedSong(this._song, rendered, newTitle, this._trimStart, this._trimEnd);
        }

        this.close();
        App.renderWorkspace();
        App._toast(`剪辑已保存到工作区：${newTitle}`, 'success');
    },
};

// ==================== 主应用 ====================

const App = {
    // 当前编辑上下文（workspace 中的哪个 item）
    _editingWsItem: null,
    _isLoading: false,

    player: {
        audio: null,
        currentIndex: -1,
        playlist: [],
        isPlaying: false,
    },

    // ==================== 初始化 ====================

    async init() {
        // 从 IndexedDB 恢复音频文件
        const restored = await FileStorage.restoreFromDB();
        if (restored > 0) console.log(`从缓存恢复了 ${restored} 个音频文件`);

        // 加载曲库元数据
        const libLoaded = MusicData._loadFromLocal();
        if (!libLoaded) {
            this._isLoading = true;
            this.renderLibrary();
            await MusicData.loadDefaultLibrary();
            this._isLoading = false;
        }
        // 加载工作区
        Workspace._load();

        this.renderLibrary();
        this.renderFilters();
        this.renderWorkspace();
        this.renderSavedPlaylists();
        this._bindEvents();

        this.player.audio = new Audio();
        this.player.audio.addEventListener('timeupdate', () => this._updateProgress());
        this.player.audio.addEventListener('ended', () => this._next());
        this.player.audio.addEventListener('loadedmetadata', () => this._updateProgress());
        this.player.audio.volume = 0.7;
    },

    // ==================== 事件绑定 ====================

    _bindEvents() {
        document.getElementById('searchInput').addEventListener('input', () => this.renderLibrary());
        document.getElementById('filterGenre').addEventListener('change', () => this.renderLibrary());
        document.getElementById('filterArtist').addEventListener('change', () => this.renderLibrary());
        document.getElementById('filterScene').addEventListener('change', () => this.renderLibrary());

        // 上传 MP3（仅管理员）
        document.getElementById('btnUpload').addEventListener('click', () => document.getElementById('fileUploadMp3').click());
        document.getElementById('fileUploadMp3').addEventListener('change', (e) => this._handleUpload(e));

        // 拖拽上传
        const dropZone = document.getElementById('panelLibrary');
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over-zone'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over-zone'));
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over-zone');
            if (e.dataTransfer.files.length > 0) this._handleUploadFiles(e.dataTransfer.files);
        });

        // 导出 ZIP
        document.getElementById('btnExportZip').addEventListener('click', () => this._exportZip());
        // 导出信息
        document.getElementById('btnExportPlaylist').addEventListener('click', () => this._exportWorkspaceInfo());

        // 清空工作区
        document.getElementById('btnClearPlaylist').addEventListener('click', () => {
            if (Workspace.count === 0) return;
            if (confirm('确定要清空工作区吗？（剪辑文件将丢失）')) {
                Workspace.clear();
                this.renderLibrary();
                this.renderWorkspace();
                this._toast('工作区已清空');
            }
        });

        // 保存/加载歌单
        document.getElementById('btnSavePlaylist').addEventListener('click', () => this._savePlaylist());
        document.getElementById('btnLoadPlaylist').addEventListener('click', () => this._loadPlaylist());
        document.getElementById('btnDeleteSaved').addEventListener('click', () => this._deleteSavedPlaylist());

        // 编辑器
        document.getElementById('editorClose').addEventListener('click', () => AudioEditor.close());
        document.getElementById('editorOverlay').addEventListener('click', (e) => { if (e.target === e.currentTarget) AudioEditor.close(); });
        document.getElementById('btnEditorPlay').addEventListener('click', () => AudioEditor.togglePreview());
        document.getElementById('btnEditorSave').addEventListener('click', () => AudioEditor.saveTrimmed());
        document.getElementById('btnEditorApplyTime').addEventListener('click', () => AudioEditor.applyTimeInputs());

        // 播放器
        document.getElementById('btnPlay').addEventListener('click', () => this._togglePlay());
        document.getElementById('btnPrev').addEventListener('click', () => this._prev());
        document.getElementById('btnNext').addEventListener('click', () => this._next());
        document.getElementById('progressBar').addEventListener('input', (e) => this._seek(e.target.value));
        document.getElementById('volumeBar').addEventListener('input', (e) => { this.player.audio.volume = e.target.value / 100; });

        // 键盘
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
            if (e.code === 'Space') { e.preventDefault(); this._togglePlay(); }
            if (e.code === 'Escape') AudioEditor.close();
        });
    },

    // ==================== 渲染：音乐库（浏览，仅 + 按钮） ====================

    renderLibrary() {
        const query = document.getElementById('searchInput').value;
        const genre = document.getElementById('filterGenre').value;
        const artist = document.getElementById('filterArtist').value;
        const scene = document.getElementById('filterScene').value;

        const songs = MusicData.search({ query, genre, artist, scene });
        const container = document.getElementById('libraryList');
        document.getElementById('libraryCount').textContent = `${MusicData.count} 首`;

        if (this._isLoading) {
            container.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div><p>正在加载音乐库...</p></div>`;
            return;
        }
        if (songs.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-icon">🎶</div><p>${MusicData.count === 0 ? '还没有歌曲' : '没有匹配的歌曲'}</p><p class="empty-hint">${MusicData.count === 0 ? '上传 MP3 文件或拖拽文件到此处' : '试试其他搜索条件'}</p></div>`;
            return;
        }

        const wsSourceIds = new Set(Workspace.getAll().map(i => i.sourceId));
        container.innerHTML = songs.map(song => {
            const hasAudio = FileStorage.has(song.id);
            const sceneTag = song.scene ? `<span class="badge badge-scene">${this._esc(song.scene)}</span>` : '';
            const cueTag = song.cue ? `<span class="badge badge-cue">${this._esc(song.cue)}</span>` : '';
            const audioDot = hasAudio ? '<span class="audio-dot" title="音频已加载">🟢</span>' : '<span class="audio-dot dim" title="未加载音频">⚪</span>';

            return `
                <div class="song-card" data-id="${song.id}">
                    <div class="song-cover">${song.cover ? `<img src="${this._esc(song.cover)}" onerror="this.parentElement.textContent='🎵'">` : '🎵'}</div>
                    <div class="song-info">
                        <div class="song-title">${audioDot}${this._esc(song.title)}${cueTag}${sceneTag}</div>
                        <div class="song-meta">${this._esc(song.artist || song.originalTitle || '')}${song.note ? ` · ${this._esc(song.note)}` : ''}</div>
                    </div>
                    <div class="song-duration">${song.durationStr}</div>
                    <div class="song-actions">
                        <button class="btn-add" title="添加到我的工作区" data-action="add" data-id="${song.id}">+</button>
                    </div>
                </div>`;
        }).join('');

        container.querySelectorAll('.song-card').forEach(card => {
            const songId = card.dataset.id;
            card.addEventListener('dblclick', () => this._playLibrarySong(songId));
            card.querySelector('[data-action="add"]')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this._addToWorkspace(songId);
            });
        });
    },

    renderFilters() {
        document.getElementById('filterGenre').innerHTML = '<option value="">全部风格</option>' + MusicData.getGenres().map(g => `<option>${this._esc(g)}</option>`).join('');
        document.getElementById('filterArtist').innerHTML = '<option value="">全部歌手</option>' + MusicData.getArtists().map(a => `<option>${this._esc(a)}</option>`).join('');
        document.getElementById('filterScene').innerHTML = '<option value="">全部环节</option>' + MusicData.getScenes().map(s => `<option>${this._esc(s)}</option>`).join('');
    },

    // ==================== 渲染：我的工作区（可编辑） ====================

    renderWorkspace() {
        const container = document.getElementById('playlistList');
        const items = Workspace.getAll();
        document.getElementById('playlistCount').textContent = `${items.length} 首`;
        document.getElementById('playlistTotalDuration').textContent = MusicData._formatDuration(Workspace.getTotalDuration());

        if (items.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-icon">🛠️</div><p>工作区是空的</p><p class="empty-hint">从左侧音乐库点击 <strong>+</strong> 添加歌曲到工作区</p></div>`;
            return;
        }

        container.innerHTML = items.map((item, index) => {
            const isTrimmed = item.isTrimmed;
            const badge = isTrimmed ? '<span class="badge badge-trim">✂️ 已剪辑</span>' : '';
            const srcSong = MusicData.getSongById(item.sourceId);
            const hasAudio = Workspace.hasAudio(item);

            return `
            <div class="song-card ws-card" data-ws-id="${item.id}" data-index="${index}" draggable="true">
                <span class="song-number">${index + 1}</span>
                <div class="song-cover">🎵</div>
                <div class="song-info">
                    <div class="song-title">${this._esc(item.title)}${badge}</div>
                    <div class="song-meta">${this._esc(item.artist || (srcSong ? srcSong.artist : ''))}${item.scene ? ` · ${this._esc(item.scene)}` : ''}</div>
                </div>
                <div class="song-duration">${item.durationStr}</div>
                <div class="song-actions">
                    ${hasAudio ? `<button class="btn-icon-mini" title="剪辑此歌曲" data-action="edit-ws" data-ws-id="${item.id}">✂️</button>` : ''}
                    <button class="btn-icon-mini" title="重命名" data-action="rename-ws" data-ws-id="${item.id}">✏️</button>
                    <button class="btn-remove" title="从工作区移除" data-action="remove-ws" data-ws-id="${item.id}">✕</button>
                </div>
            </div>`;
        }).join('');

        container.querySelectorAll('.ws-card').forEach(card => {
            const wsId = card.dataset.wsId;
            card.addEventListener('dblclick', () => this._playWorkspaceSong(wsId));
            card.querySelector('[data-action="edit-ws"]')?.addEventListener('click', (e) => { e.stopPropagation(); this._openEditorForWs(wsId); });
            card.querySelector('[data-action="rename-ws"]')?.addEventListener('click', (e) => { e.stopPropagation(); this._renameWsItem(wsId); });
            card.querySelector('[data-action="remove-ws"]')?.addEventListener('click', (e) => { e.stopPropagation(); this._removeFromWorkspace(wsId); });
            card.addEventListener('dragstart', (e) => this._onDragStart(e));
            card.addEventListener('dragover', (e) => this._onDragOver(e));
            card.addEventListener('dragleave', (e) => this._onDragLeave(e));
            card.addEventListener('drop', (e) => this._onDrop(e));
            card.addEventListener('dragend', (e) => this._onDragEnd(e));
        });
    },

    // ==================== 工作区操作 ====================

    _addToWorkspace(songId) {
        const song = MusicData.getSongById(songId);
        if (!song) return;
        const result = Workspace.addFromLibrary(song);
        if (!result) {
            this._toast('这首歌已在工作区中', 'error');
            return;
        }
        this.renderWorkspace();
        this._toast(`已添加到工作区：${song.title}`, 'success');
    },

    _removeFromWorkspace(wsId) {
        const item = Workspace.getById(wsId);
        Workspace.remove(wsId);
        this.renderWorkspace();
        if (item) this._toast(`已移除：${item.title}`);
    },

    _renameWsItem(wsId) {
        const item = Workspace.getById(wsId);
        if (!item) return;
        const newTitle = prompt('重命名：', item.title);
        if (newTitle && newTitle.trim()) {
            Workspace.rename(wsId, newTitle.trim());
            this.renderWorkspace();
            this._toast(`已重命名：${newTitle.trim()}`, 'success');
        }
    },

    _openEditorForWs(wsId) {
        const item = Workspace.getById(wsId);
        if (!item) return;
        const buf = Workspace.getAudioBuffer(item);
        if (!buf) {
            // 音频不在内存中 → 提示重新上传
            this._toast('音频文件不在内存中，请重新上传 MP3 到曲库', 'error');
            // 自动触发上传按钮
            document.getElementById('btnUpload').click();
            return;
        }
        this._editingWsItem = item;

        // 构造一个伪 song 对象给 AudioEditor
        const pseudoSong = {
            id: item.isTrimmed ? (item.trimFileId || item.sourceId) : item.sourceId,
            title: item.title,
            artist: item.artist,
            _isTrimmed: item.isTrimmed,
        };
        // 临时覆盖 getBuffer
        const origGetBuffer = FileStorage.getBuffer;
        FileStorage.getBuffer = (id) => {
            if (id === pseudoSong.id) return buf;
            return origGetBuffer.call(FileStorage, id);
        };
        AudioEditor.open(pseudoSong);
        setTimeout(() => { FileStorage.getBuffer = origGetBuffer; }, 100);
    },

    renderSavedPlaylists() {
        const select = document.getElementById('savedPlaylists');
        const playlists = PlaylistManager.getAll();
        select.innerHTML = '<option value="">-- 已保存的歌单 --</option>' +
            playlists.map(p => `<option value="${this._esc(p.name)}">${this._esc(p.name)} (${p.items ? p.items.length : 0}首)</option>`).join('');
    },

    // ==================== 歌单管理（保存/加载工作区快照） ====================

    _savePlaylist() {
        if (Workspace.count === 0) { this._toast('工作区为空', 'error'); return; }
        const name = document.getElementById('playlistName').value.trim() || '婚礼歌单';
        PlaylistManager.save(name);
        this.renderSavedPlaylists();
        this._toast(`歌单「${name}」已保存`, 'success');
    },

    _loadPlaylist() {
        const name = document.getElementById('savedPlaylists').value;
        if (!name) { this._toast('请先选择一个歌单', 'error'); return; }
        if (!PlaylistManager.loadToWorkspace(name)) { this._toast('歌单不存在', 'error'); return; }
        document.getElementById('playlistName').value = name;
        this.renderWorkspace();
        this._toast(`已加载歌单「${name}」`, 'success');
    },

    _deleteSavedPlaylist() {
        const name = document.getElementById('savedPlaylists').value;
        if (!name) { this._toast('请先选择一个歌单', 'error'); return; }
        if (!confirm(`确定删除「${name}」？`)) return;
        PlaylistManager.delete(name);
        this.renderSavedPlaylists();
    },

    _exportWorkspaceInfo() {
        if (Workspace.count === 0) { this._toast('工作区为空', 'error'); return; }
        const name = document.getElementById('playlistName').value.trim() || '婚礼歌单';
        const json = PlaylistManager.exportJson(name);
        this._downloadFile(`${name}.json`, json, 'application/json');
        this._toast('歌单信息已导出');
    },

    // ==================== ZIP 导出（导出工作区音频） ====================

    async _exportZip() {
        if (Workspace.count === 0) { this._toast('工作区为空', 'error'); return; }
        if (typeof JSZip === 'undefined') { this._toast('加载 ZIP 组件...', ''); await this._loadJSZip(); }

        const name = document.getElementById('playlistName').value.trim() || '婚礼歌单';
        const zip = new JSZip();
        const items = Workspace.getAll();
        let fileCount = 0;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const num = String(i + 1).padStart(2, '0');
            let buf = null;
            let ext = '.mp3';

            if (item.isTrimmed && item.trimFileId && FileStorage.has(item.trimFileId)) {
                buf = FileStorage.getBuffer(item.trimFileId);
                ext = '.wav';
            } else if (FileStorage.has(item.sourceId)) {
                buf = FileStorage.getBuffer(item.sourceId);
                ext = '.mp3';
            }

            if (buf) {
                let fname = `${num}_${item.title}${ext}`.replace(/[<>:"/\\|?*]/g, '_');
                zip.file(fname, buf);
                fileCount++;
            }
        }

        zip.file('歌单信息.json', PlaylistManager.exportJson(name));
        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${name}.zip`; a.click();
        URL.revokeObjectURL(url);
        this._toast(`已导出 ${fileCount} 个音频文件`, 'success');
    },

    async _loadJSZip() {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            s.onload = resolve; s.onerror = reject;
            document.head.appendChild(s);
        });
    },

    // ==================== 拖拽排序（工作区） ====================

    _onDragStart(e) {
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', e.target.dataset.wsId || '');
    },
    _onDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        e.target.closest('.ws-card')?.classList.add('drag-over');
    },
    _onDragLeave(e) {
        e.target.closest('.ws-card')?.classList.remove('drag-over');
    },
    _onDrop(e) {
        e.preventDefault();
        e.target.closest('.ws-card')?.classList.remove('drag-over');
        const fromId = e.dataTransfer.getData('text/plain');
        const toCard = e.target.closest('.ws-card');
        if (!toCard || !fromId || fromId === toCard.dataset.wsId) return;
        const items = Workspace.getAll();
        const fromIdx = items.findIndex(i => i.id === fromId);
        const toIdx = items.findIndex(i => i.id === toCard.dataset.wsId);
        if (fromIdx === -1 || toIdx === -1) return;
        Workspace.reorder(fromIdx, toIdx);
        this.renderWorkspace();
    },
    _onDragEnd(e) {
        e.target.classList.remove('dragging');
        document.querySelectorAll('.ws-card.drag-over').forEach(c => c.classList.remove('drag-over'));
    },

    // ==================== 播放器 ====================

    _playLibrarySong(songId) {
        const song = MusicData.getSongById(songId);
        if (!song || !FileStorage.has(songId)) { this._toast('音频未加载', 'error'); return; }
        const allSongs = MusicData.search({
            query: document.getElementById('searchInput').value,
            genre: document.getElementById('filterGenre').value,
            artist: document.getElementById('filterArtist').value,
            scene: document.getElementById('filterScene').value,
        }).filter(s => FileStorage.has(s.id));
        this.player.playlist = allSongs;
        this.player.currentIndex = allSongs.findIndex(s => s.id === songId);
        this._loadAndPlay(song);
    },

    _playWorkspaceSong(wsId) {
        const item = Workspace.getById(wsId);
        if (!item) return;
        const url = Workspace.getAudioUrl(item);
        if (!url) { this._toast('音频未加载', 'error'); return; }
        const items = Workspace.getAll();
        this.player._wsPlaylist = items;
        this.player._wsIndex = items.findIndex(i => i.id === wsId);
        this._loadAndPlayUrl(url, { title: item.title, artist: item.artist });
    },

    _loadAndPlay(song) {
        const url = FileStorage.getBlobUrl(song.id);
        if (!url) return;
        this._loadAndPlayUrl(url, song);
    },

    _loadAndPlayUrl(url, info) {
        this.player.audio.src = url;
        this.player.audio.play().catch(e => console.warn(e));
        this.player.isPlaying = true;
        document.getElementById('miniPlayer').style.display = 'flex';
        document.getElementById('playerTitle').textContent = info.title;
        document.getElementById('playerArtist').textContent = info.artist || '';
        document.getElementById('btnPlay').textContent = '⏸️';
    },

    _togglePlay() {
        if (!this.player.audio.src) return;
        if (this.player.isPlaying) {
            this.player.audio.pause(); this.player.isPlaying = false;
            document.getElementById('btnPlay').textContent = '▶️';
        } else {
            this.player.audio.play().catch(e => console.warn(e));
            this.player.isPlaying = true;
            document.getElementById('btnPlay').textContent = '⏸️';
        }
    },

    _prev() {
        const items = this.player._wsPlaylist;
        if (!items || items.length === 0) return;
        const idx = (this.player._wsIndex - 1 + items.length) % items.length;
        this.player._wsIndex = idx;
        const item = items[idx];
        const url = Workspace.getAudioUrl(item);
        if (url) this._loadAndPlayUrl(url, { title: item.title, artist: item.artist });
    },

    _next() {
        const items = this.player._wsPlaylist;
        if (!items || items.length === 0) return;
        const idx = (this.player._wsIndex + 1) % items.length;
        this.player._wsIndex = idx;
        const item = items[idx];
        const url = Workspace.getAudioUrl(item);
        if (url) this._loadAndPlayUrl(url, { title: item.title, artist: item.artist });
    },

    _seek(percent) {
        if (!this.player.audio.duration) return;
        this.player.audio.currentTime = (percent / 100) * this.player.audio.duration;
    },

    _updateProgress() {
        const a = this.player.audio;
        if (!a.duration) return;
        document.getElementById('progressBar').value = (a.currentTime / a.duration) * 100;
        document.getElementById('playerTime').textContent =
            `${this._fmtTime(a.currentTime)} / ${this._fmtTime(a.duration)}`;
    },

    _fmtTime(s) {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${String(sec).padStart(2, '0')}`;
    },

    // ==================== 文件上传（管理员添加曲库） ====================

    async _handleUpload(e) {
        const files = e.target.files;
        if (files.length > 0) await this._handleUploadFiles(files);
        e.target.value = '';
    },

    async _handleUploadFiles(fileList) {
        const mp3Files = Array.from(fileList).filter(f => f.name.toLowerCase().endsWith('.mp3'));
        if (mp3Files.length === 0) { this._toast('请选择 MP3 文件', 'error'); return; }
        this._toast(`正在导入 ${mp3Files.length} 个文件...`, '');
        await MusicData.importFiles(mp3Files);
        this.renderLibrary();
        this.renderFilters();
        this._toast(`成功导入 ${mp3Files.length} 首歌曲到曲库`, 'success');
    },

    // ==================== 工具 ====================

    _esc(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    _downloadFile(filename, content, mimeType = 'application/json') {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },

    _toast(message, type = '') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = 'toast ' + type + ' show';
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
    },
};

// ==================== 启动 ====================

document.addEventListener('DOMContentLoaded', () => App.init());
