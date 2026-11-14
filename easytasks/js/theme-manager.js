const ThemeManager = {
  _currentTheme: 'system',
  _systemPrefersLight: false,

  init() {
    this._systemPrefersLight = this._detectSystemPreference();
    this._currentTheme = Storage.get('theme', 'system');
    this._applyTheme(this._getEffectiveTheme());
    this._setupSystemListener();
  },

  _detectSystemPreference() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  },

  _getEffectiveTheme() {
    if (this._currentTheme === 'system') {
      return this._systemPrefersLight ? 'light' : 'dark';
    }
    return this._currentTheme;
  },

  _applyTheme(theme) {
    const html = document.documentElement;
    if (theme === 'light') {
      html.setAttribute('data-theme', 'light');
    } else {
      html.setAttribute('data-theme', 'dark');
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'light' ? '#f5f5f0' : '#23242a');
    }
  },

  _setupSystemListener() {
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
      const handler = (e) => {
        this._systemPrefersLight = e.matches;
        if (this._currentTheme === 'system') {
          this._applyTheme(this._systemPrefersLight ? 'light' : 'dark');
        }
      };
      mediaQuery.addEventListener('change', handler);
    }
  },

  setTheme(theme) {
    this._currentTheme = theme;
    Storage.set('theme', theme);
    const effective = this._getEffectiveTheme();
    this._applyTheme(effective);
  },

  getTheme() {
    return this._currentTheme;
  },

  getEffectiveTheme() {
    return this._getEffectiveTheme();
  }
};

ThemeManager.init();
