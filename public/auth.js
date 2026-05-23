document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('authForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const submitBtn = document.getElementById('submitBtn');
  const errorDiv = document.getElementById('formError');
  const tabLogin = document.getElementById('tabLogin');
  const tabRegister = document.getElementById('tabRegister');
  
  let isLogin = true;

  function switchTab(login) {
    isLogin = login;
    if (login) {
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      submitBtn.textContent = 'Login';
      document.title = 'Login - LiveTicker';
    } else {
      tabRegister.classList.add('active');
      tabLogin.classList.remove('active');
      submitBtn.textContent = 'Register';
      document.title = 'Register - LiveTicker';
    }
    errorDiv.style.display = 'none';
  }

  tabLogin.addEventListener('click', () => switchTab(true));
  tabRegister.addEventListener('click', () => switchTab(false));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorDiv.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Please wait...';

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput.value,
          password: passwordInput.value
        })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong');
      }
      
      localStorage.setItem('token', data.access_token || data.token);
      if (data.refresh_token) localStorage.setItem('refreshToken', data.refresh_token);
      if (data.user?.email) localStorage.setItem('userEmail', data.user.email);
      window.location.href = '/';
    } catch (err) {
      errorDiv.textContent = err.message;
      errorDiv.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = isLogin ? 'Login' : 'Register';
    }
  });
});
