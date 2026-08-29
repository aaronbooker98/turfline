// The sign-in screen. Two shared logins: office and fitters.
import { esc } from "../util.js";

export function renderLogin({ error = "", busy = false } = {}) {
  return `
    <div class="login-wrap">
      <form class="login-card" id="loginform" autocomplete="on">
        <img class="login-logo" src="src/assets/yate-logo.png" alt="Yate Artificial Grass">
        <h1>Sign in</h1>
        <p class="login-sub">Use the office or fitters login.</p>
        ${error ? `<div class="login-err">${esc(error)}</div>` : ""}
        <label class="lbl" for="li-email">Email</label>
        <input class="inp" type="email" id="li-email" name="email" required autocomplete="username"
               autocapitalize="none" spellcheck="false" placeholder="office@yateartificialgrass.com"${busy ? " disabled" : ""}>
        <label class="lbl" for="li-pass">Password</label>
        <input class="inp" type="password" id="li-pass" name="password" required autocomplete="current-password"${busy ? " disabled" : ""}>
        <button class="btn primary login-btn" type="submit"${busy ? " disabled" : ""}>${busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </div>`;
}
