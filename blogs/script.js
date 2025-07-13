document.addEventListener('DOMContentLoaded', function() {
  // Highlight active page in sidebar
  const currentPage = window.location.pathname.split('/').pop();
  
  document.querySelectorAll('.blog-link').forEach(link => {
    const linkPage = link.getAttribute('href');
    if (linkPage === currentPage) {
      link.closest('.blog-item').classList.add('active');
    }
  });
  
  // Add click event to featured article
  document.querySelector('.featured-article a').addEventListener('click', function(e) {
    e.preventDefault();
    window.location.href = this.getAttribute('href');
  });
});