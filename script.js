document.addEventListener('DOMContentLoaded', () => {
    // Set current year in footer
    // document.getElementById('year').textContent = new Date().getFullYear();
  
    // Once everything (including images) is fully loaded
    window.addEventListener('load', () => {
      const preloader = document.querySelector('.preloader');
      const mainContent = document.querySelector('.fade-in');
  
      // Let the user see the circle pulse briefly
      setTimeout(() => {
        // Trigger the "shrinkCircle" animation
        preloader.classList.add('loaded');
        
        // Wait for the 0.5s shrink animation to finish
        setTimeout(() => {
          // Remove the preloader from the DOM flow
          preloader.style.display = 'none';
  
          // Now fade in the main content
          mainContent.classList.add('loaded');
        }, 500); // match the shrinkCircle 0.5s
      }, 1200); // how long the circle just pulses before shrinking
    });
  });
  