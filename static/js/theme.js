/**
 * Codexs Docs — Theme Management
 * Handles light/dark/system theme switching.
 * Must load BEFORE Alpine.js to prevent FOUC.
 */

// ─── Cookie helpers ──────────────────────────────────────────────────────────
function getCookie(name) {
    const value = "; " + document.cookie;
    const parts = value.split("; " + name + "=");
    if (parts.length === 2) return parts.pop().split(";").shift();
    return null;
}

function setCookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = name + "=" + value + ";expires=" + date.toUTCString() + ";path=/;SameSite=Strict";
}

// ─── Apply theme immediately on script load (prevents flash) ─────────────────
(function applyThemeImmediately() {
    const cookiePref = getCookie('codexs-theme');
    const localPref = window.localStorage.getItem('codexs-theme');
    const preference = cookiePref || localPref || 'system';
    let resolvedTheme;
    if (preference === 'system') {
        resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else {
        resolvedTheme = preference;
    }
    if (resolvedTheme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
})();

// ─── Alpine.js theme state factory ───────────────────────────────────────────
function themeState() {
    const cookiePref = getCookie('codexs-theme');
    const localPref = window.localStorage.getItem('codexs-theme');
    const preference = cookiePref || localPref || 'system';

    return {
        preference: preference,
        themeMenuOpen: false,

        get theme() {
            if (this.preference === 'system') {
                return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            }
            return this.preference;
        },

        applyTheme() {
            if (this.theme === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        },

        setPreference(pref) {
            if (['system', 'light', 'dark'].includes(pref)) {
                this.preference = pref;
                window.localStorage.setItem('codexs-theme', pref);
                setCookie('codexs-theme', pref, 365);
                this.applyTheme();
                this.themeMenuOpen = false;
            }
        },

        init() {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addEventListener('change', () => {
                if (this.preference === 'system') {
                    this.applyTheme();
                }
            });
        }
    };
}
