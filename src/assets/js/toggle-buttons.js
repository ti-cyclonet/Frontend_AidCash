document.addEventListener('DOMContentLoaded', function () {
    var sidebar = document.getElementById('sidebar');
    var toggleButton = document.getElementById('sidebarToggle');
  
    toggleButton.addEventListener('click', function () {
      if (sidebar.classList.contains('hidden')) {
        sidebar.classList.remove('hidden');
      } else {
        sidebar.classList.add('hidden');
      }
    });
  });
  