/**
 * MusicBox - 简易登录认证模块
 * 纯前端实现，localStorage 存储账户，sessionStorage 维持会话
 */

const Auth = {
    STORAGE_KEY: 'musicbox_users',
    SESSION_KEY: 'musicbox_current_user',

    /** 获取所有注册用户 */
    _getUsers() {
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || [];
        } catch (e) {
            return [];
        }
    },

    /** 保存用户列表 */
    _saveUsers(users) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(users));
    },

    /** 注册新用户 */
    register(name, password) {
        if (!name || !password) return { ok: false, msg: '用户名和密码不能为空' };
        if (name.length < 2) return { ok: false, msg: '用户名至少 2 个字符' };
        if (password.length < 3) return { ok: false, msg: '密码至少 3 位' };

        const users = this._getUsers();
        if (users.find(u => u.name === name)) {
            return { ok: false, msg: '该用户名已被注册' };
        }

        users.push({ name, password });
        this._saveUsers(users);
        return { ok: true, msg: '注册成功！请登录' };
    },

    /** 登录 */
    login(name, password) {
        if (!name || !password) return { ok: false, msg: '请输入用户名和密码' };

        const users = this._getUsers();
        const user = users.find(u => u.name === name && u.password === password);
        if (!user) return { ok: false, msg: '用户名或密码错误' };

        sessionStorage.setItem(this.SESSION_KEY, name);
        return { ok: true, msg: '登录成功' };
    },

    /** 退出登录 */
    logout() {
        sessionStorage.removeItem(this.SESSION_KEY);
    },

    /** 是否已登录 */
    isLoggedIn() {
        return !!sessionStorage.getItem(this.SESSION_KEY);
    },

    /** 获取当前用户名 */
    currentUser() {
        return sessionStorage.getItem(this.SESSION_KEY) || '';
    },
};

// ==================== 登录界面控制器 ====================

const LoginUI = {
    /** 需要隐藏/显示的主应用元素选择器 */
    _appSelectors: '.header, .main-container, .mini-player, .toast, .modal-overlay',

    /** 获取登录容器（兼容新旧 HTML） */
    _getLoginEl() {
        return document.getElementById('loginPage') || document.getElementById('loginOverlay');
    },

    init() {
        if (Auth.isLoggedIn()) {
            this.hide();
            return true;
        }
        this.show();
        this._bindEvents();
        return false;
    },

    show() {
        const el = this._getLoginEl();
        if (el) el.style.display = 'flex';
        // 隐藏主应用所有元素
        document.querySelectorAll(this._appSelectors).forEach(el => {
            el._prevDisplay = el.style.display;
            el.style.display = 'none';
        });
    },

    hide() {
        const el = this._getLoginEl();
        if (el) el.style.display = 'none';
        // 恢复主应用元素
        document.querySelectorAll(this._appSelectors).forEach(el => {
            el.style.display = el._prevDisplay || '';
        });
        // 确保 header 恢复为 flex
        const header = document.querySelector('.header');
        if (header) header.style.display = '';
    },

    _bindEvents() {
        // 切换登录/注册面板
        document.getElementById('btnGoRegister').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('loginPanel').style.display = 'none';
            document.getElementById('registerPanel').style.display = 'block';
            document.getElementById('loginError').textContent = '';
            document.getElementById('regError').textContent = '';
        });

        document.getElementById('btnGoLogin').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('registerPanel').style.display = 'none';
            document.getElementById('loginPanel').style.display = 'block';
            document.getElementById('loginError').textContent = '';
            document.getElementById('regError').textContent = '';
        });

        // 登录
        document.getElementById('btnLogin').addEventListener('click', () => this._handleLogin());
        document.getElementById('loginPassword').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this._handleLogin();
        });

        // 注册
        document.getElementById('btnRegister').addEventListener('click', () => this._handleRegister());
        document.getElementById('regPassword2').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this._handleRegister();
        });

        // 退出登录
        document.getElementById('btnLogout').addEventListener('click', () => {
            Auth.logout();
            location.reload();
        });
    },

    _handleLogin() {
        const name = document.getElementById('loginName').value.trim();
        const password = document.getElementById('loginPassword').value;
        const result = Auth.login(name, password);
        if (result.ok) {
            this.hide();
            App.init();
        } else {
            document.getElementById('loginError').textContent = result.msg;
        }
    },

    _handleRegister() {
        const name = document.getElementById('regName').value.trim();
        const password = document.getElementById('regPassword').value;
        const password2 = document.getElementById('regPassword2').value;

        if (password !== password2) {
            document.getElementById('regError').textContent = '两次密码不一致';
            return;
        }

        const result = Auth.register(name, password);
        if (result.ok) {
            // 注册成功，切回登录面板
            document.getElementById('regName').value = '';
            document.getElementById('regPassword').value = '';
            document.getElementById('regPassword2').value = '';
            document.getElementById('regError').textContent = '';
            document.getElementById('registerPanel').style.display = 'none';
            document.getElementById('loginPanel').style.display = 'block';
            document.getElementById('loginName').value = name;
            document.getElementById('loginError').textContent = '✅ ' + result.msg;
            document.getElementById('loginError').style.color = 'var(--success)';
        } else {
            document.getElementById('regError').textContent = result.msg;
        }
    },
};
