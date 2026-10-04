import './pairing.css';

type AuthorityPair = (proof: string) => Promise<void>;

export function renderAuthorityPairing(pair: AuthorityPair): Promise<void> {
  const app = document.getElementById('app');
  if (app === null) return Promise.reject(new Error('#app missing'));

  return new Promise<void>(resolve => {
    const screen = document.createElement('main');
    screen.className = 'authority-pairing';
    screen.setAttribute('aria-labelledby', 'authority-pairing-title');
    const card = document.createElement('section');
    card.className = 'authority-pairing__card';
    const title = document.createElement('h1');
    title.id = 'authority-pairing-title';
    title.textContent = 'Secure browser pairing';
    const instructions = document.createElement('p');
    instructions.textContent = 'Create a one-use code in the Covert launch terminal, then enter it here. The code expires after five minutes. Keep it on this device; never share it in chat or screenshots.';

    const form = document.createElement('form');
    const label = document.createElement('label');
    label.htmlFor = 'authority-pairing-code';
    label.textContent = 'One-use pairing code';
    const input = document.createElement('input');
    input.id = label.htmlFor;
    input.name = 'pairing-code';
    input.type = 'password';
    input.autocomplete = 'off';
    input.autocapitalize = 'off';
    input.spellcheck = false;
    input.required = true;
    input.minLength = 32;
    input.maxLength = 256;
    input.setAttribute('aria-describedby', 'authority-pairing-help authority-pairing-status');
    const help = document.createElement('small');
    help.id = 'authority-pairing-help';
    help.textContent = 'The code is used once and kept in memory only.';
    const status = document.createElement('p');
    status.id = 'authority-pairing-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    const error = document.createElement('p');
    error.className = 'authority-pairing__error';
    error.setAttribute('role', 'alert');
    error.hidden = true;
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.textContent = 'Pair Covert';

    form.append(label, input, help, status, error, submit);
    input.addEventListener('input', () => {
      error.hidden = true;
      status.textContent = '';
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (submit.disabled) return;
      const proof = input.value.trim();
      if (!proof) {
        error.textContent = 'Enter the one-use pairing code from the Covert launch terminal.';
        error.hidden = false;
        input.focus();
        return;
      }
      input.value = '';
      submit.disabled = true;
      error.hidden = true;
      status.textContent = 'Checking the one-use code…';
      void pair(proof).then(resolve).catch(cause => {
        status.textContent = '';
        const rejectedProof = cause instanceof Error && /FORBIDDEN|invalid pairing proof/i.test(cause.message);
        error.textContent = rejectedProof
          ? 'That code was invalid, expired, or already used. Create a new one-use code in the Covert launch terminal and try again.'
          : 'Covert could not verify the code. Check that the Covert service is running, then try again. The code was not saved.';
        error.hidden = false;
        submit.disabled = false;
        input.focus();
      });
    });

    card.append(title, instructions, form);
    screen.append(card);
    app.removeAttribute('role');
    app.replaceChildren(screen);
    input.focus();
  });
}
