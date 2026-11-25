(function(){
  const modeButtons = document.querySelectorAll('.switch-btn');
  const methodButtons = document.querySelectorAll('.method-btn');
  const title = document.getElementById('authTitle');
  const subtitle = document.getElementById('authSubtitle');
  const submit = document.getElementById('submitBtn');
  const note = document.getElementById('formNote');
  const message = document.getElementById('demoMessage');
  const form = document.getElementById('accountForm');
  let mode = 'register';
  let method = 'email';
  let otpRequested = false;

  function setVisibility(id, show){ document.getElementById(id).classList.toggle('hidden', !show); }
  function render(){
    const registering = mode === 'register';
    title.innerHTML = registering ? 'Create your account<span>.</span>' : 'Welcome back<span>.</span>';
    subtitle.textContent = registering ? 'Join the club. Your next good cut starts here.' : 'Sign in to manage your HOUS account.';
    submit.innerHTML = (registering ? 'CREATE ACCOUNT' : 'SIGN IN') + ' <span>↗</span>';
    setVisibility('nameField', registering);
    setVisibility('phoneField', registering || method === 'phone');
    setVisibility('emailField', method === 'email');
    setVisibility('passwordField', method === 'email');
    setVisibility('otpField', method === 'phone' && otpRequested);
    document.getElementById('fullName').required = registering;
    document.getElementById('phone').required = method === 'phone' || registering;
    document.getElementById('email').required = method === 'email';
    document.getElementById('password').required = method === 'email';
    document.getElementById('otp').required = method === 'phone' && otpRequested;
    note.textContent = method === 'phone'
      ? 'Phone verification is a prototype interaction. SMS OTP will be connected through Firebase Authentication.'
      : 'By continuing, you agree to the HOUS membership terms and privacy policy.';
    message.textContent = '';
  }
  modeButtons.forEach(btn => btn.addEventListener('click', () => {
    mode = btn.dataset.mode; otpRequested = false;
    modeButtons.forEach(b => { const active=b===btn; b.classList.toggle('active',active); b.setAttribute('aria-selected',String(active)); });
    render();
  }));
  methodButtons.forEach(btn => btn.addEventListener('click', () => {
    method = btn.dataset.method; otpRequested = false;
    methodButtons.forEach(b => { const active=b===btn; b.classList.toggle('active',active); b.setAttribute('aria-selected',String(active)); });
    render();
  }));
  form.addEventListener('submit', e => {
    e.preventDefault();
    if(method === 'phone' && !otpRequested){
      otpRequested = true; render();
      message.textContent = 'Demo: OTP entry is now shown. No SMS has been sent.';
      return;
    }
    message.textContent = 'Interface demo only — Firebase authentication and account creation are not connected yet.';
  });
  render();
})();