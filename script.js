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
