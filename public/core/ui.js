export function createUi({ modalRoot, toastRoot } = {}) {
  const root = modalRoot || document.createElement('div');
  let lastFocused = null;

  function close(result) {
    root.classList.remove('ui-modal-root--visible');
    root.hidden = true;
    root.innerHTML = '';
    if (lastFocused && typeof lastFocused.focus === 'function') {
      try { lastFocused.focus(); } catch {}
    }
    return result;
  }

  function open({ title = '', body = '', actions = [], className = '' } = {}) {
    lastFocused = document.activeElement;
    return new Promise(resolve => {
      root.hidden = false;
      root.className = `ui-modal-root ui-modal-root--visible ${className}`.trim();
      root.innerHTML = `<div class="ui-modal-backdrop" data-modal-close></div><section class="ui-modal" role="dialog" aria-modal="true"><header class="ui-modal__header"><h2>${escapeHtml(title)}</h2><button class="ui-modal__x" type="button" data-modal-close aria-label="Cerrar">×</button></header><div class="ui-modal__body">${body}</div><footer class="ui-modal__footer"></footer></section>`;
      const footer = root.querySelector('.ui-modal__footer');
      for (const action of actions) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `ui-modal__button ${action.variant ? `ui-modal__button--${action.variant}` : ''}`.trim();
        btn.textContent = action.label;
        btn.addEventListener('click', () => {
          if (typeof action.onClick === 'function') {
            const value = action.onClick(root);
            if (value === false) return;
            resolve(close(value));
          } else {
            resolve(close(action.value));
          }
        });
        footer.appendChild(btn);
      }
      root.querySelectorAll('[data-modal-close]').forEach(node => node.addEventListener('click', () => resolve(close(null))));
      const firstInput = root.querySelector('input, button');
      if (firstInput) setTimeout(() => firstInput.focus(), 0);
    });
  }

  function toast(message, { detail = '', duration = 3200 } = {}) {
    const node = document.createElement('div');
    node.className = 'ui-toast';
    node.innerHTML = `<strong>${escapeHtml(message)}</strong>${detail ? `<span>${escapeHtml(detail)}</span>` : ''}`;
    const host = toastRoot || document.body;
    host.appendChild(node);
    setTimeout(() => node.classList.add('ui-toast--visible'), 20);
    setTimeout(() => {
      node.classList.remove('ui-toast--visible');
      setTimeout(() => node.remove(), 240);
    }, duration);
  }

  function alert(message, options = {}) {
    return open({
      title: options.title || 'Aviso',
      body: `<p>${escapeHtml(message)}</p>`,
      actions: [{ label: options.okText || 'Aceptar', value: true, variant: 'primary' }]
    });
  }

  function confirm({ title = 'Confirmar', message = '', confirmText = 'Aceptar', cancelText = 'Cancelar', danger = false } = {}) {
    return open({
      title,
      body: `<p>${escapeHtml(message)}</p>`,
      actions: [
        { label: cancelText, value: false },
        { label: confirmText, value: true, variant: danger ? 'danger' : 'primary' }
      ]
    });
  }

  function prompt({ title = 'Introducir valor', message = '', placeholder = '', defaultValue = '', confirmText = 'Aceptar', cancelText = 'Cancelar' } = {}) {
    const inputId = `ui-input-${Date.now()}`;
    return open({
      title,
      body: `${message ? `<p>${escapeHtml(message)}</p>` : ''}<label class="ui-field"><span>${escapeHtml(placeholder || title)}</span><input id="${inputId}" type="text" value="${escapeAttr(defaultValue)}"></label>`,
      actions: [
        { label: cancelText, value: null },
        { label: confirmText, variant: 'primary', onClick: (rootNode) => rootNode.querySelector(`#${inputId}`).value.trim() }
      ]
    });
  }

  async function chooseCollection(collections = []) {
    root.__collectionChoice = null;
    const inputId = `ui-new-${Date.now()}`;
    const buttons = collections.length
      ? collections.map(c => `<button type="button" data-collection-choice="${escapeAttr(c.id)}">${escapeHtml(c.name)}</button>`).join('')
      : '<p>No hay colecciones todavía. Crea una nueva.</p>';

    return new Promise(resolve => {
      lastFocused = document.activeElement;
      root.hidden = false;
      root.className = 'ui-modal-root ui-modal-root--visible';
      root.innerHTML = `<div class="ui-modal-backdrop" data-modal-close></div><section class="ui-modal" role="dialog" aria-modal="true"><header class="ui-modal__header"><h2>Añadir a colección</h2><button class="ui-modal__x" type="button" data-modal-close aria-label="Cerrar">×</button></header><div class="ui-modal__body"><p>Elige una colección existente o escribe el nombre de una nueva.</p><div class="ui-choice-list">${buttons}</div><label class="ui-field"><span>Nueva colección</span><input id="${inputId}" type="text" placeholder="Nombre de la colección"></label></div><footer class="ui-modal__footer"><button class="ui-modal__button" type="button" data-modal-close>Cancelar</button><button class="ui-modal__button ui-modal__button--primary" type="button" data-add> Añadir </button></footer></section>`;

      root.querySelectorAll('[data-modal-close]').forEach(node => node.addEventListener('click', () => { root.__collectionChoice = null; resolve(close(null)); }));
      root.querySelectorAll('[data-collection-choice]').forEach(node => node.addEventListener('click', () => {
        root.__collectionChoice = node.dataset.collectionChoice;
        root.querySelectorAll('[data-collection-choice]').forEach(btn => btn.classList.toggle('is-active', btn === node));
      }));
      root.querySelector('[data-add]').addEventListener('click', () => {
        const selectedId = root.__collectionChoice || '';
        const newName = root.querySelector(`#${inputId}`).value.trim();
        if (!selectedId && !newName) return;
        root.__collectionChoice = null;
        resolve(close({ selectedId, newName }));
      });
    });
  }

  function actions({ title = 'Acciones', actions = [] } = {}) {
    return open({
      title,
      className: 'ui-modal-root--sheet',
      body: `<div class="ui-action-list">${actions.map((action, index) => `<button type="button" data-action-index="${index}" ${action.disabled ? 'disabled' : ''}><strong>${escapeHtml(action.label)}</strong>${action.description ? `<span>${escapeHtml(action.description)}</span>` : ''}</button>`).join('')}</div>`,
      actions: [{ label: 'Cerrar', value: null }]
    }).then(result => result);
  }

  root.addEventListener('click', event => {
    const btn = event.target.closest('[data-action-index]');
    if (!btn) return;
    const index = Number(btn.dataset.actionIndex);
    const activeActions = root.__activeActions || [];
    const action = activeActions[index];
    if (action && typeof action.run === 'function') action.run();
  });

  function actionSheet({ title = 'Acciones', actions = [] } = {}) {
    root.__activeActions = actions;
    lastFocused = document.activeElement;
    return new Promise(resolve => {
      root.hidden = false;
      root.className = 'ui-modal-root ui-modal-root--visible ui-modal-root--sheet';
      root.innerHTML = `<div class="ui-modal-backdrop" data-modal-close></div><section class="ui-modal" role="dialog" aria-modal="true"><header class="ui-modal__header"><h2>${escapeHtml(title)}</h2><button class="ui-modal__x" type="button" data-modal-close aria-label="Cerrar">×</button></header><div class="ui-action-list">${actions.map((action, index) => `<button type="button" data-action-index="${index}" ${action.disabled ? 'disabled' : ''}><strong>${escapeHtml(action.label)}</strong>${action.description ? `<span>${escapeHtml(action.description)}</span>` : ''}</button>`).join('')}</div></section>`;
      root.querySelectorAll('[data-modal-close]').forEach(node => node.addEventListener('click', () => { root.__activeActions = []; resolve(close(null)); }));
      root.querySelectorAll('[data-action-index]').forEach(node => node.addEventListener('click', async () => {
        const action = actions[Number(node.dataset.actionIndex)];
        if (!action || action.disabled) return;
        root.__activeActions = [];
        close(null);
        try { await action.run?.(); } catch (error) { alert(error.message || String(error)); }
        resolve(action.id || true);
      }));
    });
  }

  return { open, toast, alert, confirm, prompt, chooseCollection, actionSheet };
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
}
function escapeAttr(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }
