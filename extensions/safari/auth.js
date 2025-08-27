// Safari Auth Page Logic
let cognitoAuth;

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Auth page loaded");

  // Initialize auth
  try {
    cognitoAuth = new SafariCognitoAuth(CONFIG.getCognitoConfig());
    await checkAuthStatus();
  } catch (error) {
    console.error("Auth initialization error:", error);
    showMessage(`Authentication system error: ${ error.message}`, "error");
    showSignInForm();
  }

  // Setup form handlers
  setupFormHandlers();
});

async function checkAuthStatus() {
  try {
    console.log("Auth page: Starting auth check");

    // Add timeout for auth check
    const authTimeout = setTimeout(() => {
      console.error("Auth page: Authentication check timed out");
      showSignInForm();
    }, 8000); // 8 second timeout

    const userResult = await cognitoAuth.getCurrentUser();
    clearTimeout(authTimeout);

    if (userResult.success) {
      console.log("Auth page: User authenticated");
      showAuthenticatedState(userResult.data);
    } else {
      console.log("Auth page: No authentication found");
      showSignInForm();
    }
  } catch (error) {
    console.error("Auth check error:", error);
    showSignInForm();
  }
}

function showAuthenticatedState(user) {
  document.getElementById("loadingState").style.display = "none";
  document.getElementById("authenticatedState").style.display = "block";
  document.getElementById("userEmail").textContent = user.email;
  hideAllForms();
}

function showSignInForm() {
  document.getElementById("loadingState").style.display = "none";
  document.getElementById("authenticatedState").style.display = "none";
  hideAllForms();
  document.getElementById("signInForm").classList.add("active");
}

function showSignUpForm() {
  hideAllForms();
  document.getElementById("signUpForm").classList.add("active");
}

function showConfirmationForm(email) {
  hideAllForms();
  document.getElementById("confirmEmail").value = email;
  document.getElementById("confirmationForm").classList.add("active");
}

function hideAllForms() {
  document.querySelectorAll(".auth-form").forEach(form => {
    form.classList.remove("active");
  });
}

function setupFormHandlers() {
  // Navigation handlers
  document.addEventListener("click", (e) => {
    const action = e.target.getAttribute("data-action");

    switch(action) {
      case "show-signin":
        e.preventDefault();
        showSignInForm();
        break;
      case "show-signup":
        e.preventDefault();
        showSignUpForm();
        break;
      case "go-to-popup":
        window.location.href = "popup.html";
        break;
      case "sign-out":
        handleSignOut();
        break;
    }
  });

  // Sign In form
  document.getElementById("signInFormElement").addEventListener("submit", handleSignIn);

  // Sign Up form
  document.getElementById("signUpFormElement").addEventListener("submit", handleSignUp);

  // Confirmation form
  document.getElementById("confirmFormElement").addEventListener("submit", handleConfirmation);
}

async function handleSignIn(e) {
  e.preventDefault();

  const email = document.getElementById("signInEmail").value;
  const password = document.getElementById("signInPassword").value;
  const btn = document.getElementById("signInBtn");

  btn.disabled = true;
  btn.textContent = "Signing in...";

  try {
    const result = await cognitoAuth.signIn(email, password);

    if (result.success) {
      showMessage("Sign in successful!", "success");
      setTimeout(() => {
        showAuthenticatedState(result.data.user);
      }, 1000);
    } else {
      showMessage(`Sign in failed: ${ result.error}`, "error");
    }
  } catch (error) {
    showMessage(`Sign in error: ${ error.message}`, "error");
  }

  btn.disabled = false;
  btn.textContent = "Sign In";
}

async function handleSignUp(e) {
  e.preventDefault();

  const email = document.getElementById("signUpEmail").value;
  const password = document.getElementById("signUpPassword").value;
  const btn = document.getElementById("signUpBtn");

  btn.disabled = true;
  btn.textContent = "Signing up...";

  try {
    const result = await cognitoAuth.signUp(email, password);

    if (result.success) {
      showMessage("Sign up successful! Check your email for confirmation.", "success", "signUpMessage");
      setTimeout(() => {
        showConfirmationForm(email);
      }, 2000);
    } else {
      showMessage(`Sign up failed: ${ result.error}`, "error", "signUpMessage");
    }
  } catch (error) {
    showMessage(`Sign up error: ${ error.message}`, "error", "signUpMessage");
  }

  btn.disabled = false;
  btn.textContent = "Sign Up";
}

async function handleConfirmation(e) {
  e.preventDefault();

  const email = document.getElementById("confirmEmail").value;
  const code = document.getElementById("confirmCode").value;
  const btn = document.getElementById("confirmBtn");

  btn.disabled = true;
  btn.textContent = "Confirming...";

  try {
    const result = await cognitoAuth.confirmSignUp(email, code);

    if (result.success) {
      showMessage("Account confirmed! You can now sign in.", "success", "confirmMessage");
      setTimeout(() => {
        showSignInForm();
      }, 2000);
    } else {
      showMessage(`Confirmation failed: ${ result.error}`, "error", "confirmMessage");
    }
  } catch (error) {
    showMessage(`Confirmation error: ${ error.message}`, "error", "confirmMessage");
  }

  btn.disabled = false;
  btn.textContent = "Confirm Account";
}

async function handleSignOut() {
  try {
    await cognitoAuth.signOut();
    showMessage("Signed out successfully", "success");
    setTimeout(() => {
      showSignInForm();
    }, 1000);
  } catch (error) {
    showMessage(`Sign out error: ${ error.message}`, "error");
  }
}

function showMessage(text, type, targetId = "message") {
  const messageDiv = document.getElementById(targetId);
  messageDiv.textContent = text;
  messageDiv.className = `message ${ type}`;
}
