// The tabs, when they do not fit in one line (Magic on a laptop, every game on
// a phone), slide sideways. The side that hides more of them fades out
// (styles.css, #tabs[data-more]) and, with a mouse, the wheel slides them; at
// either end the wheel scrolls the page as usual.
const EDGE = 2; // px of slack at each end

export function installTabScroll(nav) {
    const end = () => nav.scrollWidth - nav.clientWidth;
    const mark = () => {
        const last = end();
        nav.dataset.more =
            last < EDGE ? "" : nav.scrollLeft < EDGE ? "end" : nav.scrollLeft > last - EDGE ? "start" : "both";
    };
    nav.addEventListener("scroll", mark, { passive: true });
    new ResizeObserver(mark).observe(nav);
    // Another game brings other tabs without resizing the bar.
    new MutationObserver(mark).observe(nav, { childList: true });
    nav.addEventListener(
        "wheel",
        (event) => {
            if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
            const forward = event.deltaY > 0;
            const room = forward ? nav.scrollLeft < end() - EDGE : nav.scrollLeft > EDGE;
            if (!room) return;
            event.preventDefault();
            // Some mice count in lines, not pixels.
            nav.scrollLeft += event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
        },
        { passive: false }
    );
    mark();
}
