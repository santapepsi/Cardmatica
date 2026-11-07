// PROVISIONAL: modo claro y oscuro, con su botón en la cabecera. Probablemente
// se quite; para hacerlo, borrar este archivo, sus <script> en las páginas,
// el botón #theme de index.html y los bloques "PROVISIONAL" de styles.css.
//
// Es un script clásico que se carga en <head>, antes de pintar, para que la
// página no aparezca un instante con el otro tema. La elección se guarda en
// este navegador; sin elección, el modo oscuro de siempre.
(function () {
    var KEY = "cm_theme";
    var root = document.documentElement;

    function stored() {
        try {
            return localStorage.getItem(KEY);
        } catch (error) {
            return null; // Almacenamiento bloqueado: modo oscuro.
        }
    }

    function apply(theme) {
        root.dataset.theme = theme;
        // La barra del navegador en celulares toma el color del tema y de la
        // skin elegida (variable --bar de styles.css y de cada skin).
        var bar = document.querySelector('meta[name="theme-color"]');
        var color = getComputedStyle(root).getPropertyValue("--bar").trim();
        if (bar && color) bar.content = color;
        var button = document.getElementById("theme");
        if (!button) return;
        var light = theme === "light";
        button.setAttribute("aria-pressed", String(light));
        // El ícono muestra el modo al que se pasa.
        button.textContent = light ? "☾" : "☀";
        var t = window.t || String; // frontend/i18n.js, once loaded
        button.title = t(light ? "Modo oscuro (provisional)" : "Modo claro (provisional)");
    }

    apply(stored() === "light" ? "light" : "dark");
    document.addEventListener("DOMContentLoaded", function () {
        apply(root.dataset.theme);
    });
    document.addEventListener("click", function (event) {
        if (!event.target.closest || !event.target.closest("#theme")) return;
        var theme = root.dataset.theme === "light" ? "dark" : "light";
        apply(theme);
        try {
            localStorage.setItem(KEY, theme);
        } catch (error) {
            /* Sin almacenamiento, el tema dura hasta recargar. */
        }
    });
})();
