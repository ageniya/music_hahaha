/**
 * MusicBox - 数据管理模块 v2
 * 支持 MP3 文件存储、WAV 编码、歌单管理、本地持久化
 */

// ==================== 文件存储（内存 + IndexedDB 持久化） ====================

const FileStorage = {
    _files: new Map(),
    _db: null,

    /** 初始化 IndexedDB */
    async _initDB() {
        if (this._db) return;
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('musicbox_audio', 1);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains('files')) {
                    db.createObjectStore('files', { keyPath: 'songId' });
                }
            };
            req.onsuccess = () => { this._db = req.result; resolve(); };
            req.onerror = () => reject(req.error);
        });
    },

    set(songId, arrayBuffer, fileName = '', mimeType = 'audio/mpeg') {
        this._files.set(songId, { arrayBuffer, mimeType, fileName });
        this._saveToDB(songId, arrayBuffer, fileName, mimeType);
    },

    async _saveToDB(songId, arrayBuffer, fileName, mimeType) {
        try {
            await this._initDB();
            const tx = this._db.transaction('files', 'readwrite');
            tx.objectStore('files').put({ songId, arrayBuffer, fileName, mimeType });
        } catch (e) { /* IndexedDB may not be available */ }
    },

    get(songId) {
        return this._files.get(songId) || null;
    },

    getBlobUrl(songId) {
        const file = this._files.get(songId);
        if (!file) return null;
        if (file._blobUrl) URL.revokeObjectURL(file._blobUrl);
        const blob = new Blob([file.arrayBuffer], { type: file.mimeType });
        file._blobUrl = URL.createObjectURL(blob);
        return file._blobUrl;
    },

    getBuffer(songId) {
        const file = this._files.get(songId);
        return file ? file.arrayBuffer.slice(0) : null;
    },

    delete(songId) {
        const file = this._files.get(songId);
        if (file && file._blobUrl) URL.revokeObjectURL(file._blobUrl);
        this._files.delete(songId);
        this._deleteFromDB(songId);
    },

    async _deleteFromDB(songId) {
        try {
            await this._initDB();
            const tx = this._db.transaction('files', 'readwrite');
            tx.objectStore('files').delete(songId);
        } catch (e) { /* ignore */ }
    },

    has(songId) { return this._files.has(songId); },
    get size() { return this._files.size; },

    clear() {
        for (const [, file] of this._files) {
            if (file._blobUrl) URL.revokeObjectURL(file._blobUrl);
        }
        this._files.clear();
    },

    /** 从 IndexedDB 恢复所有文件到内存 */
    async restoreFromDB() {
        try {
            await this._initDB();
            return new Promise((resolve) => {
                const tx = this._db.transaction('files', 'readonly');
                const req = tx.objectStore('files').getAll();
                req.onsuccess = () => {
                    const entries = req.result || [];
                    for (const entry of entries) {
                        if (!this._files.has(entry.songId)) {
                            this._files.set(entry.songId, {
                                arrayBuffer: entry.arrayBuffer,
                                mimeType: entry.mimeType,
                                fileName: entry.fileName,
                            });
                        }
                    }
                    resolve(entries.length);
                };
                req.onerror = () => resolve(0);
            });
        } catch (e) { return 0; }
    },
};

// ==================== WAV 编码器 ====================

const WavEncoder = {
    encode(audioBuffer) {
        const numChannels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const bitsPerSample = 16;
        const bytesPerSample = bitsPerSample / 8;

        const channels = [];
        for (let c = 0; c < numChannels; c++) {
            channels.push(audioBuffer.getChannelData(c));
        }
        const length = channels[0].length;
        const dataLength = length * numChannels * bytesPerSample;
        const totalLength = 44 + dataLength;

        const buffer = new ArrayBuffer(totalLength);
        const view = new DataView(buffer);

        writeStr(view, 0, 'RIFF');
        view.setUint32(4, totalLength - 8, true);
        writeStr(view, 8, 'WAVE');
        writeStr(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
        view.setUint16(32, numChannels * bytesPerSample, true);
        view.setUint16(34, bitsPerSample, true);
        writeStr(view, 36, 'data');
        view.setUint32(40, dataLength, true);

        let offset = 44;
        for (let i = 0; i < length; i++) {
            for (let c = 0; c < numChannels; c++) {
                const s = Math.max(-1, Math.min(1, channels[c][i]));
                view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
                offset += 2;
            }
        }
        return buffer;
    },
};

function writeStr(view, offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

// ==================== 音乐库数据管理 ====================

const MusicData = {
    _songs: [],

    async loadDefaultLibrary() {
        // 1. 尝试从内嵌数据加载（file:// 兼容）
        try {
            const el = document.getElementById('preset-songs');
            if (el && el.textContent.trim()) {
                const data = JSON.parse(el.textContent.trim());
                this._songs = data.map((s, i) => this._normalizeSong(s, i));
                console.log(`从内嵌数据加载了 ${this._songs.length} 首歌曲`);
                return true;
            }
        } catch (e) { console.warn('内嵌数据解析失败:', e.message); }

        // 2. 尝试从 data/songs.json 加载（HTTP 服务器模式）
        try {
            const resp = await fetch('data/songs.json');
            if (resp.ok) {
                const data = await resp.json();
                this._songs = data.map((s, i) => this._normalizeSong(s, i));
                this._preloadAudioFiles();
                return true;
            }
        } catch (e) { console.warn('加载音乐库失败:', e.message); }

        this._songs = [];
        return false;
    },

    async _preloadAudioFiles() {
        // file:// 协议下 fetch 不可用，跳过预加载
        if (window.location.protocol === 'file:') return;

        for (const song of this._songs) {
            if (!song.audioUrl || FileStorage.has(song.id)) continue;
            try {
                const resp = await fetch(song.audioUrl);
                if (resp.ok) {
                    const buf = await resp.arrayBuffer();
                    FileStorage.set(song.id, buf, song.audioUrl.split('/').pop(), 'audio/mpeg');
                    await this._detectDuration(song.id);
                }
            } catch (e) { /* skip */ }
        }
    },

    async _detectDuration(songId) {
        const buffer = FileStorage.getBuffer(songId);
        if (!buffer) return;
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const ab = await ctx.decodeAudioData(buffer);
            const song = this._songs.find(s => s.id === songId);
            if (song) {
                song.duration = ab.duration;
                song.durationStr = this._formatDuration(ab.duration);
                song._sampleRate = ab.sampleRate;
                song._channels = ab.numberOfChannels;
            }
            ctx.close();
        } catch (e) { /* skip */ }
    },

    async importFiles(fileList) {
        const newSongs = [];
        for (const file of fileList) {
            const fname = file.name.toLowerCase();
            if (!fname.endsWith('.mp3')) continue;

            const buf = await file.arrayBuffer();

            // 尝试匹配预设歌曲（通过文件名中的 cue 字母）
            let matched = null;
            const cueMatch = file.name.match(/^([a-z])_/i);
            if (cueMatch) {
                const cue = cueMatch[1].toLowerCase();
                // 特殊处理：j 对应两个预设
                if (cue === 'j') {
                    if (fname.includes('卡点') || fname.includes('come alive')) {
                        matched = this._songs.find(s => s.cue === 'J-1');
                    } else {
                        matched = this._songs.find(s => s.cue === 'J-2');
                    }
                } else {
                    const cueUpper = cue.toUpperCase();
                    matched = this._songs.find(s => s.cue === cueUpper);
                }
            }

            if (matched) {
                // 匹配成功 → 将音频数据关联到预设歌曲
                FileStorage.set(matched.id, buf, file.name, 'audio/mpeg');
                matched._isUploaded = true;
                matched._fileName = file.name;
                await this._detectDuration(matched.id);
            } else {
                // 未匹配 → 创建新歌曲条目
                const id = 'file_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
                FileStorage.set(id, buf, file.name, 'audio/mpeg');
                const nameNoExt = file.name.replace(/\.mp3$/i, '');
                const title = nameNoExt.replace(/^[a-z]_/i, '').slice(0, 50);
                const song = this._normalizeSong({ id, title, artist: '', audioUrl: '' });
                song._isUploaded = true;
                song._fileName = file.name;
                newSongs.push(song);
            }
        }

        if (newSongs.length > 0) {
            this._songs.push(...newSongs);
            for (const s of newSongs) await this._detectDuration(s.id);
        }
        this._saveToLocal();
        return newSongs;
    },

    addTrimmedSong(originalSong, trimmedBuffer, newTitle, trimStart, trimEnd) {
        const id = 'trim_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        const wavBuf = WavEncoder.encode(trimmedBuffer);
        const duration = trimEnd - trimStart;
        FileStorage.set(id, wavBuf, newTitle + '.wav', 'audio/wav');
        const song = this._normalizeSong({
            id, title: newTitle, artist: originalSong.artist || '', duration,
        });
        song._isTrimmed = true;
        song._originalId = originalSong.id;
        song._originalTitle = originalSong.title;
        song._trimStart = trimStart;
        song._trimEnd = trimEnd;
        song._sampleRate = trimmedBuffer.sampleRate;
        song._channels = trimmedBuffer.numberOfChannels;
        this._songs.push(song);
        this._saveToLocal();
        return song;
    },

    renameSong(songId, newTitle) {
        const song = this._songs.find(s => s.id === songId);
        if (song) { song.title = newTitle; this._saveToLocal(); }
    },

    deleteSong(songId) {
        FileStorage.delete(songId);
        this._songs = this._songs.filter(s => s.id !== songId);
        this._saveToLocal();
    },

    _normalizeSong(song, index) {
        return {
            id: song.id || `song_${Date.now()}_${index}`,
            title: String(song.title || '未知歌曲').trim(),
            artist: String(song.artist || '').trim(),
            album: String(song.album || '').trim(),
            genre: String(song.genre || '').trim(),
            scene: String(song.scene || '').trim(),
            cue: String(song.cue || '').trim(),
            originalTitle: String(song.originalTitle || '').trim(),
            note: String(song.note || '').trim(),
            duration: song.duration || 0,
            durationStr: song.durationStr || '--:--',
            cover: song.cover || '',
            audioUrl: song.audioUrl || '',
            year: song.year || '',
            _isUploaded: !!song._isUploaded,
            _isTrimmed: !!song._isTrimmed,
            _originalId: song._originalId || null,
            _originalTitle: song._originalTitle || '',
            _trimStart: song._trimStart || 0,
            _trimEnd: song._trimEnd || 0,
            _sampleRate: song._sampleRate || 44100,
            _channels: song._channels || 2,
            _fileName: song._fileName || '',
        };
    },

    _formatDuration(seconds) {
        if (!seconds || seconds <= 0 || !isFinite(seconds)) return '--:--';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${String(s).padStart(2, '0')}`;
    },

    getAllSongs() { return [...this._songs]; },

    getGenres() { return [...new Set(this._songs.map(s => s.genre).filter(Boolean))].sort(); },
    getArtists() { return [...new Set(this._songs.map(s => s.artist).filter(Boolean))].sort(); },
    getScenes() { return [...new Set(this._songs.map(s => s.scene).filter(Boolean))].sort(); },

    getSongById(id) { return this._songs.find(s => s.id === id) || null; },

    search({ query = '', genre = '', artist = '', scene = '' } = {}) {
        let results = [...this._songs];
        const q = query.toLowerCase().trim();
        if (q) {
            results = results.filter(s =>
                s.title.toLowerCase().includes(q) ||
                s.artist.toLowerCase().includes(q) ||
                s.scene.toLowerCase().includes(q) ||
                (s.originalTitle && s.originalTitle.toLowerCase().includes(q)) ||
                (s.note && s.note.toLowerCase().includes(q))
            );
        }
        if (genre) results = results.filter(s => s.genre === genre);
        if (artist) results = results.filter(s => s.artist === artist);
        if (scene) results = results.filter(s => s.scene === scene);
        return results;
    },

    get count() { return this._songs.length; },

    getSongsWithFiles() {
        return this._songs.filter(s => FileStorage.has(s.id));
    },

    _saveToLocal() {
        try {
            const meta = this._songs.map(s => ({
                id: s.id, title: s.title, artist: s.artist, album: s.album,
                genre: s.genre, scene: s.scene, cue: s.cue,
                originalTitle: s.originalTitle, note: s.note,
                duration: s.duration, durationStr: s.durationStr,
                cover: s.cover, audioUrl: s.audioUrl, year: s.year,
                _isUploaded: s._isUploaded, _isTrimmed: s._isTrimmed,
                _originalId: s._originalId, _originalTitle: s._originalTitle,
                _trimStart: s._trimStart, _trimEnd: s._trimEnd,
                _fileName: s._fileName,
            }));
            localStorage.setItem('musicbox_library_v2', JSON.stringify(meta));
        } catch (e) { /* ignore */ }
    },

    _loadFromLocal() {
        try {
            const data = localStorage.getItem('musicbox_library_v2');
            if (data) {
                this._songs = JSON.parse(data).map((s, i) => this._normalizeSong(s, i));
                return true;
            }
        } catch (e) { /* ignore */ }
        return false;
    },

    exportLibrary() {
        return JSON.stringify(this._songs.map(s => ({
            id: s.id, title: s.title, artist: s.artist, scene: s.scene,
            cue: s.cue, originalTitle: s.originalTitle, note: s.note,
            duration: s.duration, durationStr: s.durationStr,
        })), null, 2);
    },
};

// ==================== 个人工作区（用户独立编辑空间） ====================

const Workspace = {
    STORAGE_KEY: 'musicbox_workspace_v2',
    _items: [], // { id, sourceId, title, artist, scene, cue, duration, durationStr, isTrimmed, trimStart, trimEnd, trimFileId, order }

    /** 从曲库添加歌曲到工作区 */
    addFromLibrary(librarySong) {
        if (this._items.find(item => item.sourceId === librarySong.id && !item.isTrimmed)) {
            return null; // 已存在
        }
        const item = {
            id: 'ws_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            sourceId: librarySong.id,
            title: librarySong.title,
            artist: librarySong.artist || '',
            scene: librarySong.scene || '',
            cue: librarySong.cue || '',
            duration: librarySong.duration || 0,
            durationStr: librarySong.durationStr || '--:--',
            isTrimmed: false,
            trimStart: 0,
            trimEnd: librarySong.duration || 0,
            trimFileId: null,
            order: this._items.length,
        };
        this._items.push(item);
        this._save();
        return item;
    },

    /** 工作区中重命名 */
    rename(id, newTitle) {
        const item = this._items.find(i => i.id === id);
        if (item) { item.title = newTitle; this._save(); }
    },

    /** 从工作区移除 */
    remove(id) {
        const item = this._items.find(i => i.id === id);
        if (item && item.trimFileId) {
            FileStorage.delete(item.trimFileId);
        }
        this._items = this._items.filter(i => i.id !== id);
        this._save();
    },

    /** 在工作区中保存剪辑版本 */
    addTrimmed(wsItem, audioBuffer, newTitle, trimStart, trimEnd) {
        const trimFileId = 'trim_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        const wavBuf = WavEncoder.encode(audioBuffer);
        FileStorage.set(trimFileId, wavBuf, newTitle + '.wav', 'audio/wav');
        const duration = trimEnd - trimStart;

        const newItem = {
            id: 'ws_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            sourceId: wsItem.sourceId,
            title: newTitle,
            artist: wsItem.artist,
            scene: wsItem.scene,
            cue: wsItem.cue,
            duration,
            durationStr: MusicData._formatDuration(duration),
            isTrimmed: true,
            trimStart,
            trimEnd,
            trimFileId,
            order: this._items.length,
        };
        this._items.push(newItem);
        this._save();
        return newItem;
    },

    /** 重排序 */
    reorder(fromIdx, toIdx) {
        const [moved] = this._items.splice(fromIdx, 1);
        this._items.splice(toIdx, 0, moved);
        this._save();
    },

    /** 获取工作区音频的 Blob URL */
    getAudioUrl(wsItem) {
        if (wsItem.isTrimmed && wsItem.trimFileId) {
            return FileStorage.getBlobUrl(wsItem.trimFileId);
        }
        return FileStorage.getBlobUrl(wsItem.sourceId);
    },

    /** 获取工作区音频的 ArrayBuffer */
    getAudioBuffer(wsItem) {
        if (wsItem.isTrimmed && wsItem.trimFileId) {
            return FileStorage.getBuffer(wsItem.trimFileId);
        }
        return FileStorage.getBuffer(wsItem.sourceId);
    },

    /** 是否有音频（内存中有 或 曲库中已知时长） */
    hasAudio(wsItem) {
        if (wsItem.isTrimmed && wsItem.trimFileId) {
            return FileStorage.has(wsItem.trimFileId);
        }
        if (FileStorage.has(wsItem.sourceId)) return true;
        // 曲库中时长 > 0 说明音频曾加载过（FileStorage 在页面刷新后清空但元数据保留）
        const src = MusicData.getSongById(wsItem.sourceId);
        return !!(src && src.duration > 0);
    },

    getAll() { return [...this._items]; },
    get count() { return this._items.length; },
    getById(id) { return this._items.find(i => i.id === id) || null; },

    /** 获取总时长 */
    getTotalDuration() {
        return this._items.reduce((sum, i) => sum + (i.duration || 0), 0);
    },

    /** 清空工作区 */
    clear() {
        for (const item of this._items) {
            if (item.trimFileId) FileStorage.delete(item.trimFileId);
        }
        this._items = [];
        this._save();
    },

    _save() {
        try {
            const data = this._items.map(i => ({
                id: i.id, sourceId: i.sourceId, title: i.title,
                artist: i.artist, scene: i.scene, cue: i.cue,
                duration: i.duration, durationStr: i.durationStr,
                isTrimmed: i.isTrimmed, trimStart: i.trimStart,
                trimEnd: i.trimEnd, trimFileId: i.trimFileId,
            }));
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
        } catch (e) { /* ignore */ }
    },

    _load() {
        try {
            const data = JSON.parse(localStorage.getItem(this.STORAGE_KEY));
            if (data && data.length > 0) {
                this._items = data;
                return true;
            }
        } catch (e) { /* ignore */ }
        return false;
    },
};

// ==================== 歌单管理（保存工作区快照） ====================

const PlaylistManager = {
    STORAGE_KEY: 'musicbox_playlists_v3',

    getAll() {
        try { return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || []; }
        catch (e) { return []; }
    },

    /** 保存工作区快照 */
    save(name) {
        const playlists = this.getAll();
        const idx = playlists.findIndex(p => p.name === name);
        const snapshot = Workspace.getAll().map(i => ({
            id: i.id, sourceId: i.sourceId, title: i.title,
            artist: i.artist, scene: i.scene, cue: i.cue,
            duration: i.duration, durationStr: i.durationStr,
            isTrimmed: i.isTrimmed, trimStart: i.trimStart,
            trimEnd: i.trimEnd, trimFileId: i.trimFileId,
        }));
        const entry = { name, items: snapshot, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        if (idx >= 0) playlists[idx] = entry;
        else playlists.push(entry);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(playlists));
    },

    delete(name) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.getAll().filter(p => p.name !== name)));
    },

    get(name) { return this.getAll().find(p => p.name === name) || null; },

    /** 加载歌单到工作区（替换当前工作区） */
    loadToWorkspace(name) {
        const playlist = this.get(name);
        if (!playlist) return false;
        Workspace.clear();
        Workspace._items = playlist.items.map(i => ({ ...i }));
        Workspace._save();
        return true;
    },

    exportJson(name) {
        const items = Workspace.getAll();
        const songs = items.map(i => ({
            title: i.title, artist: i.artist, scene: i.scene,
            cue: i.cue, duration: i.durationStr,
            isTrimmed: i.isTrimmed,
        }));
        return JSON.stringify({ playlistName: name, exportedAt: new Date().toISOString(), songs }, null, 2);
    },
};
