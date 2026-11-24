const loginForm = document.querySelector("#login-form");
const loginButton = document.querySelector("#btn-login");
const loginMessage = document.querySelector("#login-message");
const loginMessageText = document.querySelector("#login-message-text");
const matriculaInput = document.querySelector("#matricula");
const passwordInput = document.querySelector("#password");
const forgotPasswordButton = document.querySelector("#btn-forgot-password");
const passwordVisibilityButton = document.querySelector("#visible-password-btn");

const LOGIN_ENDPOINT = "http://127.0.0.1:8000/api/login";

function setLoginLoading(isLoading) {
    loginButton.classList.toggle("is-loading", isLoading);
    loginButton.disabled = isLoading;
    loginButton.setAttribute("aria-busy", String(isLoading));
}

function showLoginMessage(message, status = "") {
    loginMessageText.textContent = message;
    loginMessage.hidden = !message;
    loginMessage.classList.remove("is-success", "is-error", "is-info");
    loginMessage.setAttribute("role", status === "error" ? "alert" : "status");
    loginMessage.setAttribute("aria-live", status === "error" ? "assertive" : "polite");

    if (status) {
        loginMessage.classList.add(`is-${status}`);
    }
}

function clearFieldErrors() {
    matriculaInput.removeAttribute("aria-invalid");
    passwordInput.removeAttribute("aria-invalid");
}

function clearValidation() {
    clearFieldErrors();
    showLoginMessage("");
}

async function handleLoginSubmit(event) {
    event.preventDefault();

    const matriculaIsMissing = matriculaInput.value.trim() === "";
    const passwordIsMissing = passwordInput.value.trim() === "";

    if (matriculaIsMissing || passwordIsMissing) {
        matriculaInput.setAttribute("aria-invalid", "true");
        passwordInput.setAttribute("aria-invalid", "true");
        showLoginMessage("Preencha a matrícula e a senha.", "error");
        (matriculaIsMissing ? matriculaInput : passwordInput).focus();
        return;
    }

    clearValidation();
    setLoginLoading(true);

    try {
        const response = await fetch(LOGIN_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                matricula: matriculaInput.value,
                password: passwordInput.value
            })
        });
        const result = await response.json();

        if (response.ok) {
            showLoginMessage(result.message, "success");
        } else if (response.status === 401) {
            matriculaInput.setAttribute("aria-invalid", "true");
            passwordInput.setAttribute("aria-invalid", "true");
            showLoginMessage("Matrícula ou senha incorretos.", "error");
        } else {
            throw new Error(result.message || "Erro inesperado no servidor.");
        }
    } catch (error) {
        console.error("Falha ao comunicar com o servidor de login:", error);
        showLoginMessage(
            "Não foi possível conectar ao servidor. Inicie a aplicação Python e tente novamente.",
            "error"
        );
    } finally {
        setLoginLoading(false);
    }
}

function handleForgotPassword() {
    clearFieldErrors();
    showLoginMessage(
        "A recuperação de senha não está disponível nesta demonstração local.",
        "info"
    );
}

function togglePasswordVisibility() {
    const isPasswordVisible = passwordInput.type === "text";

    passwordInput.type = isPasswordVisible ? "password" : "text";
    passwordVisibilityButton.querySelector("span").textContent = isPasswordVisible ? "Mostrar" : "Ocultar";
    passwordVisibilityButton.setAttribute("aria-pressed", String(!isPasswordVisible));
}

loginForm.addEventListener("submit", handleLoginSubmit);
forgotPasswordButton.addEventListener("click", handleForgotPassword);
passwordVisibilityButton.addEventListener("click", togglePasswordVisibility);
matriculaInput.addEventListener("input", clearValidation);
passwordInput.addEventListener("input", clearValidation);
