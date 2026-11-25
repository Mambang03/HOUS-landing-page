(function () {
  'use strict';

  const firebaseConfig = {
    apiKey: "AIzaSyD5leUX-zDKYzbvIWuHjTO7m1HflUeAegw",
    authDomain: "hous-4a93c.firebaseapp.com",
    databaseURL: "https://hous-4a93c-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "hous-4a93c",
    storageBucket: "hous-4a93c.firebasestorage.app",
    messagingSenderId: "112517018028",
    appId: "1:112517018028:web:09a7f176db2e96a1998a09",
    measurementId: "G-RTVQN35TN6"
  };

  const $ = id => document.getElementById(id);
  const form = $('accountForm');
  const modeButtons = document.querySelectorAll('.switch-btn');
  const title = $('authTitle');
  const subtitle = $('authSubtitle');
  const submit = $('submitBtn');
  const note = $('formNote');
  const message = $('demoMessage');
  const session = $('authSession');
  const resetButton = $('resetPasswordBtn');
  let mode = 'register';
  let auth = null;
  let db = null;

  function showMessage(text, isError) {
    message.textContent = text;
    message.classList.toggle('error', !!isError);
  }

  function setBusy(busy, label) {
    submit.disabled = busy;
    submit.innerHTML = busy ? label : (mode === 'register' ? 'CREATE ACCOUNT' : 'SIGN IN') + ' <span>↗</span>';
  }

  function friendlyError(error) {
    const code = error && error.code ? error.code : '';
    const messages = {
      'auth/email-already-in-use': 'This email already has a HOUS account. Please sign in instead.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/weak-password': 'Please use a password with at least 6 characters.',
      'auth/user-not-found': 'No account was found for this email. Please create an account first.',
      'auth/wrong-password': 'Incorrect email or password.',
      'auth/invalid-credential': 'Incorrect email or password.',
      'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
      'auth/network-request-failed': 'Network error. Check your internet connection and try again.',
      'auth/operation-not-allowed': 'Email/Password sign-in is not enabled in Firebase yet. Enable it in Authentication → Sign-in method.',
      'PERMISSION_DENIED': 'Your account was created, but the profile could not be saved. Please check the Firebase users database rules.'
    };
    return messages[code] || (error && error.message) || 'Something went wrong. Please try again.';
  }

  function renderMode() {
    const registering = mode === 'register';
    title.innerHTML = registering ? 'Create your account<span>.</span>' : 'Welcome back<span>.</span>';
    subtitle.textContent = registering
      ? 'Join the club. Your next good cut starts here.'
      : 'Sign in to manage your HOUS account.';
    $('nameField').classList.toggle('hidden', !registering);
    $('phoneField').classList.toggle('hidden', !registering);
    $('emailField').classList.remove('hidden');
    $('passwordField').classList.remove('hidden');
    $('fullName').required = registering;
    $('phone').required = false;
    $('email').required = true;
    $('password').required = true;
    $('password').autocomplete = registering ? 'new-password' : 'current-password';
    resetButton.classList.toggle('hidden', registering);
    note.textContent = registering
      ? 'By creating an account, you agree to the HOUS membership terms and privacy policy.'
      : 'Enter the email address and password linked to your HOUS account.';
    submit.innerHTML = (registering ? 'CREATE ACCOUNT' : 'SIGN IN') + ' <span>↗</span>';
    showMessage('', false);
  }

  function setSignedIn(user) {
    if (!user) {
      session.classList.add('hidden');
      form.classList.remove('hidden');
      document.querySelector('.auth-switch').classList.remove('hidden');
      $('nameField').classList.toggle('hidden', mode !== 'register');
      $('phoneField').classList.toggle('hidden', mode !== 'register');
      return;
    }
    form.classList.add('hidden');
    document.querySelector('.auth-switch').classList.add('hidden');
    session.classList.remove('hidden');
    $('sessionName').textContent = user.displayName ? 'Welcome, ' + user.displayName + '.' : 'Welcome to HOUS.';
    $('sessionEmail').textContent = user.email || '';
    $('profileEmail').textContent = user.email || '—';
    subtitle.textContent = 'You are securely signed in to your HOUS account.';
    loadMemberData(user);
  }

  let profileListener = null;
  let subscriptionListener = null;

  function loadMemberData(user) {
    if (profileListener) profileListener.off();
    if (subscriptionListener) subscriptionListener.off();

    profileListener = db.ref('users/' + user.uid);
    profileListener.on('value', snapshot => {
      const profile = snapshot.val() || {};
      $('sessionName').textContent = 'Welcome, ' + (profile.name || user.displayName || 'HOUS member') + '.';
      $('profilePhone').textContent = profile.phone || 'Not added';
    }, error => {
      console.warn('HOUS profile read:', error);
      $('profilePhone').textContent = 'Profile unavailable';
    });

    subscriptionListener = db.ref('subscriptions/' + user.uid);
    subscriptionListener.on('value', snapshot => {
      const sub = snapshot.val();
      const status = $('subscriptionStatus');
      const quota = $('memberQuota');
      if (!sub || String(sub.status || '').toLowerCase() !== 'active') {
        status.textContent = 'NOT ACTIVE';
        status.classList.add('pending');
        $('subscriptionPlan').textContent = 'No active subscription';
        $('subscriptionDescription').textContent = 'Choose a plan below. Your 30-day membership begins only after HOUS verifies your payment.';
        quota.classList.add('hidden');
        return;
      }
      status.textContent = 'ACTIVE';
      status.classList.remove('pending');
      $('subscriptionPlan').textContent = 'PLAN ' + (sub.plan || '—');
      $('subscriptionDescription').textContent = 'Your HOUS subscription is active.';
      $('quotaValue').textContent = (Number(sub.remainingQuota) || 0) + ' / ' + (Number(sub.totalQuota) || 0);
      $('subscriptionExpiry').textContent = sub.expiryDate ? 'Valid until ' + sub.expiryDate : '';
      quota.classList.remove('hidden');
    }, error => {
      console.warn('HOUS subscription read:', error);
      $('subscriptionStatus').textContent = 'NOT AVAILABLE';
      $('subscriptionDescription').textContent = 'Membership information is not available yet.';
      quota.classList.add('hidden');
    });
  }

  function switchMode(nextMode) {
    mode = nextMode;
    modeButtons.forEach(button => {
      const active = button.dataset.mode === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    renderMode();
  }

  modeButtons.forEach(button => button.addEventListener('click', () => switchMode(button.dataset.mode)));

  document.querySelectorAll('.plan-select').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    const chosenPlan = link.dataset.plan;
    showMessage('Plan ' + chosenPlan + ' selected. Payment request and receipt upload will be enabled in the next step.', false);
    $('authSession').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }));

  form.addEventListener('submit', async event => {
    event.preventDefault();
    showMessage('', false);

    const email = $('email').value.trim().toLowerCase();
    const password = $('password').value;
    if (!email || !password) {
      showMessage('Please enter your email address and password.', true);
      return;
    }
    if (mode === 'register' && $('fullName').value.trim().length < 2) {
      showMessage('Please enter your full name.', true);
      return;
    }

    setBusy(true, mode === 'register' ? 'CREATING ACCOUNT…' : 'SIGNING IN…');
    try {
      if (mode === 'register') {
        const credential = await auth.createUserWithEmailAndPassword(email, password);
        const name = $('fullName').value.trim();
        const phone = $('phone').value.trim();
        await credential.user.updateProfile({ displayName: name });
        await db.ref('users/' + credential.user.uid).update({
          name: name,
          email: credential.user.email,
          phone: phone || null,
          createdAt: firebase.database.ServerValue.TIMESTAMP,
          updatedAt: firebase.database.ServerValue.TIMESTAMP
        });
        showMessage('Your HOUS account has been created successfully.', false);
      } else {
        await auth.signInWithEmailAndPassword(email, password);
        showMessage('You are now signed in.', false);
      }
    } catch (error) {
      console.error('HOUS account authentication error:', error);
      showMessage(friendlyError(error), true);
    } finally {
      setBusy(false);
    }
  });

  resetButton.addEventListener('click', async () => {
    const email = $('email').value.trim().toLowerCase();
    if (!email) {
      showMessage('Enter your email address first, then select Forgot password.', true);
      $('email').focus();
      return;
    }
    try {
      await auth.sendPasswordResetEmail(email);
      showMessage('Password reset email sent. Check your inbox and spam folder.', false);
    } catch (error) {
      showMessage(friendlyError(error), true);
    }
  });

  $('signOutBtn').addEventListener('click', async () => {
    try {
      if (profileListener) { profileListener.off(); profileListener = null; }
      if (subscriptionListener) { subscriptionListener.off(); subscriptionListener = null; }
      await auth.signOut();
      switchMode('login');
      showMessage('You have been signed out.', false);
    } catch (error) {
      showMessage(friendlyError(error), true);
    }
  });

  try {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.database();
    auth.onAuthStateChanged(user => setSignedIn(user));
    renderMode();
  } catch (error) {
    console.error('HOUS Firebase initialization error:', error);
    showMessage('Firebase could not start. Please check the website configuration and try again.', true);
    submit.disabled = true;
  }
})();