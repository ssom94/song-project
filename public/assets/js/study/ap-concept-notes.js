(() => {
  const lang = document.body?.dataset?.blogLanguage === 'ja' ? 'ja' : 'ko';
  const t = (ko, ja) => lang === 'ko' ? ko : ja;
  const params = new URLSearchParams(location.search);
  const conceptCode = (params.get('code') || params.get('no') || '').trim().toUpperCase();
  if (!/^[AB]-\d{2}$/.test(conceptCode)) return;

  const notes = new Map();
  let authenticated = false;
  let currentTarget = null;
  let migrationRequired = false;

  const noteKey = (targetType, questionId) => targetType === 'concept' ? 'concept' : `question:${questionId}`;

  function makeModal() {
    const root = document.createElement('div');
    root.id = 'ap-note-modal';
    root.className = 'ap-note-modal';
    root.hidden = true;
    root.innerHTML = `<button class="ap-note-modal-backdrop" type="button" data-ap-note-close aria-label="${t('메모 닫기', 'メモを閉じる')}"></button>
      <section class="ap-note-sheet" role="dialog" aria-modal="true" aria-labelledby="ap-note-title">
        <header class="ap-note-sheet-head">
          <div class="ap-note-sheet-title"><span class="ap-note-bubble-icon is-large" aria-hidden="true"></span><div><span class="ap-note-eyebrow">MEMO</span><h2 id="ap-note-title">${t('메모', 'メモ')}</h2></div></div>
          <button class="ap-note-close" type="button" data-ap-note-close aria-label="${t('닫기', '閉じる')}">×</button>
        </header>
        <div id="ap-note-login-message" class="ap-note-login-message" hidden></div>
        <textarea id="ap-note-text" class="ap-note-text" maxlength="4000" rows="9" placeholder="${t('이 개념이나 문제에서 기억할 내용을 적어두세요.', 'この概念や問題で覚えておきたい内容を書いてください。')}"></textarea>
        <div class="ap-note-meta"><span id="ap-note-status" role="status"></span><span id="ap-note-count">0 / 4000</span></div>
        <footer class="ap-note-actions">
          <button id="ap-note-delete" class="ap-note-delete" type="button">${t('메모 삭제', 'メモを削除')}</button>
          <button id="ap-note-save" class="ap-note-save" type="button">${t('저장', '保存')}</button>
        </footer>
      </section>`;
    document.body.appendChild(root);
    return root;
  }

  const modal = makeModal();
  const textarea = document.getElementById('ap-note-text');
  const title = document.getElementById('ap-note-title');
  const status = document.getElementById('ap-note-status');
  const count = document.getElementById('ap-note-count');
  const saveButton = document.getElementById('ap-note-save');
  const deleteButton = document.getElementById('ap-note-delete');
  const loginMessage = document.getElementById('ap-note-login-message');

  function buttonTarget(button) {
    const targetType = button.dataset.apNoteTarget === 'question' ? 'question' : 'concept';
    const questionId = targetType === 'question' ? Number(button.dataset.questionId) : null;
    if (targetType === 'question' && (!Number.isSafeInteger(questionId) || questionId <= 0)) return null;
    return {
      targetType,
      questionId,
      label: button.dataset.apNoteLabel || (targetType === 'concept' ? conceptCode : t('문제', '問題')),
    };
  }

  function syncButtons() {
    document.querySelectorAll('[data-ap-note-target]').forEach((button) => {
      const target = buttonTarget(button);
      if (!target) return;
      const hasNote = notes.has(noteKey(target.targetType, target.questionId));
      button.classList.toggle('has-note', hasNote);
      button.setAttribute('aria-label', hasNote
        ? t(`${target.label} 메모 보기`, `${target.label}のメモを見る`)
        : t(`${target.label} 메모 추가`, `${target.label}にメモを追加`));
      button.setAttribute('title', hasNote ? t('저장된 메모 보기', '保存済みメモを見る') : t('메모 추가', 'メモを追加'));
      const copy = button.querySelector('.ap-note-trigger-copy');
      const wanted = hasNote ? t('메모 보기', 'メモを見る') : t('메모 추가', 'メモ追加');
      if (copy && copy.textContent !== wanted) copy.textContent = wanted;
    });
  }

  function updateCounter() {
    const length = textarea?.value.length || 0;
    if (count) count.textContent = `${length} / 4000`;
    if (saveButton) saveButton.disabled = !authenticated || length === 0 || length > 4000 || migrationRequired;
  }

  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove('ap-note-open');
    currentTarget = null;
  }

  function openModal(target) {
    currentTarget = target;
    const existing = notes.get(noteKey(target.targetType, target.questionId));
    title.textContent = target.targetType === 'concept'
      ? t(`${conceptCode} 개념 메모`, `${conceptCode} 概念メモ`)
      : t(`${target.label} 문제 메모`, `${target.label} 問題メモ`);
    textarea.value = existing?.body || '';
    status.textContent = existing ? t('저장된 메모', '保存済みメモ') : '';
    deleteButton.hidden = !existing || !authenticated;
    loginMessage.hidden = authenticated && !migrationRequired;
    if (migrationRequired) {
      loginMessage.textContent = t('DB 메모 기능 적용이 필요합니다.', 'DBのメモ機能を適用する必要があります。');
    } else if (!authenticated) {
      loginMessage.textContent = t('메모는 관리자 로그인 후 저장할 수 있습니다.', 'メモの保存には管理者ログインが必要です。');
    }
    textarea.readOnly = !authenticated || migrationRequired;
    modal.hidden = false;
    document.body.classList.add('ap-note-open');
    updateCounter();
    if (authenticated && !migrationRequired) setTimeout(() => textarea.focus(), 40);
  }

  async function requestJson(url, options) {
    const response = await fetch(url, { credentials: 'same-origin', ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || `HTTP_${response.status}`);
    return data;
  }

  async function loadNotes() {
    try {
      const data = await requestJson(`/api/public/ap/concept-notes?code=${encodeURIComponent(conceptCode)}`);
      authenticated = Boolean(data.viewer?.authenticated);
      migrationRequired = Boolean(data.migrationRequired);
      notes.clear();
      (data.notes || []).forEach((note) => {
        notes.set(noteKey(note.targetType, note.questionId), note);
      });
      syncButtons();
      updateCounter();
    } catch (error) {
      console.warn('Failed to load AP concept notes', error);
      syncButtons();
    }
  }

  async function saveCurrent() {
    if (!currentTarget || !authenticated || migrationRequired) return;
    const body = textarea.value.trim();
    if (!body) return;
    saveButton.disabled = true;
    status.textContent = t('저장 중...', '保存中...');
    try {
      const data = await requestJson('/api/admin/ap/concept-notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conceptCode,
          targetType: currentTarget.targetType,
          questionId: currentTarget.questionId,
          body,
        }),
      });
      const note = data.note || { targetType: currentTarget.targetType, questionId: currentTarget.questionId, body };
      notes.set(noteKey(currentTarget.targetType, currentTarget.questionId), note);
      status.textContent = t('저장됨', '保存しました');
      deleteButton.hidden = false;
      syncButtons();
    } catch (error) {
      console.error(error);
      status.textContent = t('저장하지 못했습니다.', '保存できませんでした。');
    } finally {
      updateCounter();
    }
  }

  async function deleteCurrent() {
    if (!currentTarget || !authenticated || migrationRequired) return;
    if (!confirm(t('이 메모를 삭제할까요?', 'このメモを削除しますか？'))) return;
    deleteButton.disabled = true;
    status.textContent = t('삭제 중...', '削除中...');
    try {
      await requestJson('/api/admin/ap/concept-notes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conceptCode,
          targetType: currentTarget.targetType,
          questionId: currentTarget.questionId,
        }),
      });
      notes.delete(noteKey(currentTarget.targetType, currentTarget.questionId));
      syncButtons();
      closeModal();
    } catch (error) {
      console.error(error);
      status.textContent = t('삭제하지 못했습니다.', '削除できませんでした。');
    } finally {
      deleteButton.disabled = false;
    }
  }

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest?.('[data-ap-note-target]');
    if (trigger) {
      const target = buttonTarget(trigger);
      if (target) openModal(target);
      return;
    }
    if (event.target.closest?.('[data-ap-note-close]')) closeModal();
  });
  textarea?.addEventListener('input', updateCounter);
  saveButton?.addEventListener('click', saveCurrent);
  deleteButton?.addEventListener('click', deleteCurrent);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) closeModal();
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !modal.hidden) saveCurrent();
  });
  window.addEventListener('ap:concept-rendered', syncButtons);
  loadNotes();
})();
