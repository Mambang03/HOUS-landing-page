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
  let storage = null;
  let currentUser = null;
  let paymentHistoryRef = null;

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

  const PLAN_CONFIG = {
    A: { amount: 35, quota: 1 },
    B: { amount: 65, quota: 2 }
  };
  const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
  const ALLOWED_RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

  function showPaymentMessage(text, isError) {
    const el = $('paymentMessage');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('error', !!isError);
  }

  function renderPaymentHistory(snapshot) {
    const wrap = $('paymentHistory');
    if (!wrap) return;
    const requests = snapshot.val() || {};
    const entries = Object.entries(requests).sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));
    if (!entries.length) {
      wrap.innerHTML = '<strong>YOUR PAYMENT REQUESTS</strong><p>No payment requests submitted yet.</p>';
      return;
    }
    const rows = entries.map(([id, item]) => {
      const plan = item.plan === 'B' ? 'Plan B' : 'Plan A';
      const date = item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Recently submitted';
      const status = String(item.status || 'pending').replace(/</g, '&lt;').toUpperCase();
      return '<div class="payment-history-row"><span><b>' + plan + ' · RM' + Number(item.amount || 0) + '</b><small>' + date + '</small></span><em>' + status + '</em></div>';
    }).join('');
    wrap.innerHTML = '<strong>YOUR PAYMENT REQUESTS</strong>' + rows;
  }

  function watchPaymentHistory(user) {
    if (paymentHistoryRef) paymentHistoryRef.off();
    paymentHistoryRef = db.ref('paymentRequests/' + user.uid);
    paymentHistoryRef.on('value', renderPaymentHistory, error => {
      console.warn('HOUS payment history read:', error);
      showPaymentMessage('Payment history is unavailable. Please check the paymentRequests database rules.', true);
    });
  }

  async function submitPaymentRequest(event) {
    event.preventDefault();
    showPaymentMessage('', false);
    if (!currentUser) {
      showPaymentMessage('Please sign in before submitting a membership payment.', true);
      return;
    }
    const plan = $('paymentPlan').value;
    const file = $('receiptFile').files && $('receiptFile').files[0];
    const reference = $('paymentReference').value.trim();
    if (!PLAN_CONFIG[plan]) {
      showPaymentMessage('Please select Plan A or Plan B.', true);
      return;
    }
    if (!file) {
      showPaymentMessage('Please choose your payment receipt.', true);
      return;
    }
    if (!ALLOWED_RECEIPT_TYPES.includes(file.type)) {
      showPaymentMessage('Unsupported file type. Upload JPG, PNG, WEBP or PDF.', true);
      return;
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      showPaymentMessage('Your receipt is larger than 5 MB. Please choose a smaller file.', true);
      return;
    }
    if (!storage) {
      showPaymentMessage('Firebase Storage is not initialized. Enable Firebase Storage for the HOUS project, then try again.', true);
      return;
    }

    const config = PLAN_CONFIG[plan];
    const requestRef = db.ref('paymentRequests/' + currentUser.uid).push();
    const requestId = requestRef.key;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 90);
    const receiptPath = 'paymentReceipts/' + currentUser.uid + '/' + requestId + '/' + safeName;
    const submitButton = $('paymentSubmitBtn');
    submitButton.disabled = true;
    submitButton.textContent = 'UPLOADING RECEIPT…';

    try {
      const receiptRef = storage.ref(receiptPath);
      const upload = await receiptRef.put(file, {
        contentType: file.type,
        customMetadata: { uid: currentUser.uid, requestId: requestId }
      });
      await requestRef.set({
        requestId: requestId,
        uid: currentUser.uid,
        plan: plan,
        amount: config.amount,
        haircutQuota: config.quota,
        transferReference: reference || null,
        receiptPath: receiptPath,
        receiptContentType: file.type,
        receiptSize: file.size,
        status: 'pending',
        createdAt: firebase.database.ServerValue.TIMESTAMP
      });
      $('paymentForm').reset();
      showPaymentMessage('Receipt uploaded successfully. Your request is pending HOUS verification. Your membership is not active yet.', false);
    } catch (error) {
      console.error('HOUS payment submission error:', error);
      const code = error && error.code ? error.code : '';
      const messageText = code === 'storage/unauthorized'
        ? 'Upload permission denied. Check the Firebase Storage rules for paymentReceipts/{uid}.'
        : code === 'PERMISSION_DENIED'
          ? 'Payment request could not be saved. Check the paymentRequests Realtime Database rules.'
          : (error && error.message) || 'Could not submit your receipt. Please try again.';
      showPaymentMessage(messageText, true);
      // If database creation failed after upload, remove the orphaned receipt.
      try { await storage.ref(receiptPath).delete(); } catch (cleanupError) { console.warn('Receipt cleanup:', cleanupError); }
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = 'UPLOAD RECEIPT <span>↗</span>';
    }
  }

  const paymentForm = $('paymentForm');
  if (paymentForm) paymentForm.addEventListener('submit', submitPaymentRequest);

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
    if (!currentUser) {
      $('memberActionMessage').textContent = 'Please create an account or sign in before submitting a membership payment.';
      $('authSession').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    $('paymentPlan').value = chosenPlan;
    $('memberActionMessage').textContent = 'Plan ' + chosenPlan + ' selected. Complete your bank transfer / DuitNow payment, then upload the receipt below.';
    $('paymentWorkflow').scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    storage = firebase.storage();
    auth.onAuthStateChanged(user => {
      currentUser = user || null;
      setSignedIn(user);
      if (user) watchPaymentHistory(user);
      else if (paymentHistoryRef) { paymentHistoryRef.off(); paymentHistoryRef = null; }
    });
    renderMode();
  } catch (error) {
    console.error('HOUS Firebase initialization error:', error);
    showMessage('Firebase could not start. Please check the website configuration and try again.', true);
    submit.disabled = true;
  }
})();