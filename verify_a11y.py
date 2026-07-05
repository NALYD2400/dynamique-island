from playwright.sync_api import sync_playwright
import os

def run_cuj(page):
    # Intercept file:// requests to load local modules correctly
    repo_root = os.getcwd()

    def handle_route(route):
        url = route.request.url
        if url.startswith("file:///"):
            path = url.replace("file://", "")
            if os.path.exists(path):
                route.fulfill(path=path)
            else:
                route.continue_()
        else:
            route.continue_()

    page.route("**/*", handle_route)

    # Mock window.electronAPI and window.localStorage
    page.add_init_script("""
        window.electronAPI = {
            ipcRenderer: {
                send: () => {},
                on: () => {},
                invoke: async () => {}
            }
        };
    """)

    index_path = f"file://{repo_root}/src/island/index.html"
    page.goto(index_path)
    page.wait_for_timeout(2000)

    # Open the music player mode directly by injecting a call
    page.evaluate("""
        if (window.island) {
            window.island.setMode('music');
            window.island.isExpanded = true;
            window.island.renderContent();
        }
    """)
    page.wait_for_timeout(1000)

    # Toggle play state to demonstrate visual change
    page.evaluate("""
        if (window.island) {
            window.island.updatePlaybackVisualState(true);
        }
    """)
    page.wait_for_timeout(1000)

    # Take screenshot at the key moment
    page.screenshot(path="/home/jules/verification/screenshots/verification.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
