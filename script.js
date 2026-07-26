console.log("Maloy Miao portfolio framework loaded successfully.");

// Navigation Scroll Trigger Component Animation
document.addEventListener("DOMContentLoaded", () => {
    const mainHeader = document.querySelector("header");

    window.addEventListener("scroll", () => {
        // Triggers active state when scrolled down past 50 pixels
        if (window.scrollY > 50) {
            mainHeader.classList.add("scroll-active");
        } else {
            mainHeader.classList.add("scroll-active"); // Remove target transition
            mainHeader.classList.remove("scroll-active");
        }
    });
});

// ==========================================
// 🚀 SPA NAVIGATION ROUTING INTERFACE LAYER
// ==========================================
const mainPortfolioSections = ['home', 'about', 'applications', 'contact'];

function openSpaApplication(targetAppId) {
    console.log("SPA Engine Opening App ID:", targetAppId);
    
    // Hide standard landing cards cleanly without breaking flexbox grids
    mainPortfolioSections.forEach(sectionId => {
        const el = document.getElementById(sectionId);
        if (el) {
            el.style.visibility = 'hidden';
            el.style.position = 'absolute';
            el.style.opacity = '0';
        }
    });

    // Illuminate the application tracking layer 
    const layer = document.getElementById('app-workspace-layer');
    if (layer) {
        layer.style.setProperty('display', 'block', 'important');
        layer.style.visibility = 'visible';
        layer.style.position = 'relative';
        layer.style.opacity = '1';
        layer.style.pointerEvents = 'auto';
    }

    // Hide any previous calculations and reveal target panel
    document.querySelectorAll('.spa-app-panel').forEach(panel => panel.style.display = 'none');
    const targetPanel = document.getElementById(targetAppId);
    if (targetPanel) targetPanel.style.display = 'block';

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function returnToMainPortfolio() {
    console.log("SPA Engine Returning to Main Portfolio Hub");
    
    // Completely kill visibility footprint of the calculator canvas wrapper
    const layer = document.getElementById('app-workspace-layer');
    if (layer) {
        layer.style.setProperty('display', 'none', 'important');
        layer.style.visibility = 'hidden';
        layer.style.pointerEvents = 'none';
    }

    // Restore original homepage centered layouts flawlessly
    mainPortfolioSections.forEach(sectionId => {
        const el = document.getElementById(sectionId);
        if (el) el.style.cssText = '';
    });
}
