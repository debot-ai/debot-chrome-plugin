const state = {
  tab: 'active',
};

const DEBOT_HOME_URL = 'https://debot.ai/';
const QUOTA_EXHAUSTED_MESSAGE = '删推监控额度已用完，最多可同时监控 20 条。请取消已有监控或等待过期后再添加。';

const elements = {
  quotaText: document.getElementById('quotaText'),
  quotaBarFill: document.getElementById('quotaBarFill'),
  lastCheckText: document.getElementById('lastCheckText'),
  refreshButton: document.getElementById('refreshButton'),
  statusMessage: document.getElementById('statusMessage'),
  list: document.getElementById('list'),
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  bindEvents();
  await loadList();
  await sendMessage({ type: 'REFRESH_BADGE' });
}

function bindEvents() {
  elements.refreshButton.addEventListener('click', () => loadList());
  document.querySelectorAll('.tab').forEach((button) => {
    button.addEventListener('click', () => {
      state.tab = button.dataset.tab;
      document.querySelectorAll('.tab').forEach((tab) => tab.classList.toggle('is-active', tab === button));
      loadList();
    });
  });
}

async function loadList() {
  setLoading();
  const response =
    state.tab === 'active'
      ? await sendMessage({ type: 'LIST_TWEET_MONITORS', payload: { status: 'active', limit: 50 } })
      : await sendMessage({ type: 'HISTORY_TWEET_MONITORS', payload: { limit: 50 } });
  if (!response.ok) {
    if (isUnauthorizedError(response.error)) {
      updateQuota(null, []);
      updateLastCheck(null, []);
      renderLoginGuide();
      return;
    }
    elements.list.innerHTML = `<div class="empty">${escapeHTML(errorText(response.error))}</div>`;
    return;
  }
  const data = response.data?.data || response.data || {};
  const list = Array.isArray(data.list) ? data.list : [];
  updateQuota(data.quota, list);
  updateLastCheck(data.last_check_at, list);
  renderList(list);
}

function renderList(list) {
  if (list.length === 0) {
    elements.list.innerHTML = `<div class="empty">${state.tab === 'active' ? '暂无监控中的推文' : '暂无历史记录'}</div>`;
    return;
  }
  elements.list.innerHTML = list.map(renderItem).join('');
  elements.list.querySelectorAll('[data-remove-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      const response = await sendMessage({
        type: 'REMOVE_TWEET_MONITOR',
        payload: { id: button.dataset.removeId },
      });
      if (!response.ok) {
        showMessage(errorText(response.error), true);
        button.disabled = false;
        return;
      }
      showMessage('已取消监控');
      await loadList();
    });
  });
}

function renderLoginGuide() {
  elements.list.innerHTML = `
    <div class="empty login-guide">
      <strong>未登录 debot</strong>
      <span>登录后才能查看和管理删推监控配置。</span>
      <a class="login-button" href="${DEBOT_HOME_URL}" target="_blank" rel="noopener noreferrer">去 debot 登录</a>
    </div>
  `;
}

function renderItem(item) {
  const status = normalizeStatus(item.status, item.last_check_status);
  const title = item.tweet_text_snapshot || item.tweet_url || item.tweet_id || '未命名推文';
  const screenName = item.screen_name ? `@${item.screen_name}` : '@unknown';
  const timeText = status.key === 'deleted' ? `删除：${formatTime(item.deleted_at)}` : `到期：${formatTime(item.expire_time)}`;
  const checkText = item.last_check_at ? `最近检测：${formatTime(item.last_check_at)}` : '最近检测：暂无';
  return `
    <article class="item">
      <div class="item-header">
        <div class="item-main">
          <a class="item-title" href="${escapeAttr(item.tweet_url || '#')}" target="_blank">${escapeHTML(title)}</a>
          <span class="item-meta">${escapeHTML(screenName)} · ${escapeHTML(item.tweet_id || '')}</span>
        </div>
        <span class="badge ${status.className}">${status.text}</span>
      </div>
      <span class="item-time">${escapeHTML(timeText)}</span>
      <span class="item-time">${escapeHTML(checkText)}</span>
      ${
        state.tab === 'active' && ['monitoring', 'unknown'].includes(item.status)
          ? `<div class="item-actions"><button class="secondary-button" data-remove-id="${escapeAttr(item.id)}">取消监控</button></div>`
          : ''
      }
    </article>
  `;
}

function normalizeStatus(status, lastCheckStatus) {
  if (status === 'deleted') {
    return { key: status, text: '已删除', className: 'deleted' };
  }
  if (status === 'expired') {
    return { key: status, text: '已过期', className: '' };
  }
  if (status === 'cancelled') {
    return { key: status, text: '已取消', className: '' };
  }
  if (status === 'unknown' || lastCheckStatus === 'check_failed') {
    return { key: status, text: '检测异常，待重试', className: 'warning' };
  }
  return { key: status || 'monitoring', text: '监控中', className: '' };
}

function updateQuota(quota, list = []) {
  const used = Number(quota?.used ?? list.filter((item) => ['monitoring', 'unknown'].includes(item.status)).length);
  const limit = Number(quota?.limit ?? 20);
  if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) {
    elements.quotaText.textContent = '删推监控额度 -/20';
    elements.quotaBarFill.style.width = '0%';
    return;
  }
  elements.quotaText.textContent = `删推监控额度 ${used}/${limit}`;
  elements.quotaBarFill.style.width = `${Math.min(100, Math.max(0, (used / limit) * 100))}%`;
}

function updateLastCheck(value, list = []) {
  const lastCheckAt =
    value ||
    list
      .map((item) => item.last_check_at)
      .filter(Boolean)
      .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];
  elements.lastCheckText.textContent = `最近检测：${formatTime(lastCheckAt)}`;
}

function setLoading() {
  elements.list.innerHTML = '<div class="empty">加载中...</div>';
}

function showMessage(message, isError = false) {
  elements.statusMessage.hidden = false;
  elements.statusMessage.textContent = message;
  elements.statusMessage.classList.toggle('is-error', isError);
  elements.statusMessage.classList.toggle('is-success', !isError);
  setTimeout(() => {
    elements.statusMessage.hidden = true;
  }, 2600);
}

async function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}

function formatTime(value) {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return date.toLocaleString();
}

function errorText(error) {
  if (isUnauthorizedError(error)) {
    return '请先登录 debot';
  }
  if (error?.message === 'MISSING_TWEET_ID') {
    return '未识别到推文 ID';
  }
  if (isQuotaLimitError(error)) {
    return QUOTA_EXHAUSTED_MESSAGE;
  }
  if (error?.payload?.message) {
    return error.payload.message;
  }
  if (error?.payload?.description) {
    return isTweetNotFoundError(error.payload.description)
      ? '未找到该推文，请检查链接或 tweetId 是否正确'
      : error.payload.description;
  }
  return isTweetNotFoundError(error?.message)
    ? '未找到该推文，请检查链接或 tweetId 是否正确'
    : error?.message || '请求失败';
}

function isUnauthorizedError(error) {
  if (Number(error?.status) === 401) {
    return true;
  }
  const payload = error?.payload || {};
  const candidates = [error?.message, payload.message, payload.description, payload.error, payload.code]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  return candidates.some((message) => {
    return (
      message === '401' ||
      message.includes('unauthorized') ||
      message.includes('not login') ||
      message.includes('not logged') ||
      message.includes('login required') ||
      message.includes('未登录') ||
      message.includes('请登录') ||
      message.includes('请先登录')
    );
  });
}

function isQuotaLimitError(error) {
  const payload = error?.payload || {};
  const candidates = [error?.message, payload.message, payload.description, payload.error, payload.code]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  return candidates.some((message) => {
    return (
      message.includes('tweet delete monitor limit exceeded') ||
      message.includes('quota exceeded') ||
      message.includes('limit exceeded') ||
      message.includes('exceed limit') ||
      message.includes('额度已满') ||
      message.includes('额度用完') ||
      message.includes('超过上限') ||
      message.includes('达到上限')
    );
  });
}

function isTweetNotFoundError(message) {
  const normalized = String(message || '').toLowerCase();
  return (
    normalized.includes('failed to resolve tweet') ||
    normalized.includes('gitter tweet data is empty') ||
    normalized.includes('tweet not found') ||
    normalized.includes('not found') ||
    normalized.includes('未找到推文') ||
    normalized.includes('推文不存在')
  );
}

function escapeHTML(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttr(value) {
  return escapeHTML(value);
}
