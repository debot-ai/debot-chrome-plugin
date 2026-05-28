const DEFAULT_SETTINGS = {
  apiBaseUrl: 'https://debot.ai',
};

const API_PATHS = {
  add: '/api/social/tweet-delete-monitor/add',
  list: '/api/social/tweet-delete-monitor/list',
  history: '/api/social/tweet-delete-monitor/history',
  remove: '/api/social/tweet-delete-monitor/remove',
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('tweet-delete-monitor-refresh', { periodInMinutes: 1 });
  configureSidePanel();
});

chrome.runtime.onStartup.addListener(() => {
  configureSidePanel();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'tweet-delete-monitor-refresh') {
    refreshBadge().catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => sendResponse({ ok: false, error: toPublicError(error) }));
  return true;
});

async function handleMessage(message) {
  switch (message?.type) {
    case 'ADD_TWEET_MONITOR':
      return addTweetMonitor(message.payload);
    case 'LIST_TWEET_MONITORS':
      return listTweetMonitors(message.payload);
    case 'HISTORY_TWEET_MONITORS':
      return historyTweetMonitors(message.payload);
    case 'REMOVE_TWEET_MONITOR':
      return removeTweetMonitor(message.payload);
    case 'GET_SETTINGS':
      return getSettings();
    case 'REFRESH_BADGE':
      return refreshBadge();
    default:
      throw new Error('UNKNOWN_MESSAGE_TYPE');
  }
}

async function addTweetMonitor(payload) {
  const data = {
    tweet_id: normalizeString(payload?.tweet_id),
    tweet_url: normalizeString(payload?.tweet_url),
    screen_name: normalizeScreenName(payload?.screen_name),
    tweet_text_snapshot: normalizeString(payload?.tweet_text_snapshot).slice(0, 1000),
    source: 'chrome_extension',
  };
  if (!data.tweet_id && !data.tweet_url) {
    throw new Error('MISSING_TWEET_ID');
  }
  return apiFetch(API_PATHS.add, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

async function listTweetMonitors(payload = {}) {
  const params = new URLSearchParams();
  params.set('status', payload.status || 'active');
  params.set('page', String(payload.page || 1));
  params.set('limit', String(payload.limit || 50));
  return apiFetch(`${API_PATHS.list}?${params.toString()}`);
}

async function historyTweetMonitors(payload = {}) {
  const params = new URLSearchParams();
  params.set('page', String(payload.page || 1));
  params.set('limit', String(payload.limit || 50));
  return apiFetch(`${API_PATHS.history}?${params.toString()}`);
}

async function removeTweetMonitor(payload) {
  const id = Number(payload?.id);
  if (!id) {
    throw new Error('MISSING_RECORD_ID');
  }
  return apiFetch(API_PATHS.remove, {
    method: 'POST',
    body: JSON.stringify({ record_id: id }),
  });
}

async function refreshBadge() {
  try {
    const data = await listTweetMonitors({ status: 'active', page: 1, limit: 1 });
    const quota = normalizeQuota(data);
    const count = quota?.used ?? normalizeList(data).length;
    await chrome.action.setBadgeText({ text: count > 0 ? String(Math.min(count, 99)) : '' });
    await chrome.action.setBadgeBackgroundColor({ color: '#F9DF43' });
    await chrome.action.setBadgeTextColor?.({ color: '#02050A' });
    return { active_count: count };
  } catch (error) {
    await chrome.action.setBadgeText({ text: '' });
    return { active_count: 0, error: toPublicError(error) };
  }
}

async function getSettings() {
  return DEFAULT_SETTINGS;
}

function configureSidePanel() {
  if (!chrome.sidePanel?.setPanelBehavior) {
    return;
  }
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
}

async function apiFetch(path, options = {}) {
  const baseURL = DEFAULT_SETTINGS.apiBaseUrl;
  const response = await fetch(`${baseURL}${path}`, {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: options.body,
  });

  const text = await response.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch (_error) {
      json = { message: text };
    }
  }

  if (!response.ok) {
    const error = new Error(json?.message || json?.error || response.statusText || 'REQUEST_FAILED');
    error.status = response.status;
    error.payload = json;
    throw error;
  }
  if (json && Number(json.code) !== 0) {
    const error = new Error(json.description || json.message || json.error || 'REQUEST_FAILED');
    error.status = response.status;
    error.payload = json;
    throw error;
  }
  return json;
}

function normalizeList(data) {
  if (Array.isArray(data?.list)) {
    return data.list;
  }
  if (Array.isArray(data?.data?.list)) {
    return data.data.list;
  }
  if (Array.isArray(data?.data)) {
    return data.data;
  }
  return [];
}

function normalizeQuota(data) {
  if (data?.quota) {
    return data.quota;
  }
  if (data?.data?.quota) {
    return data.data.quota;
  }
  return null;
}

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizeScreenName(value) {
  return normalizeString(value).replace(/^@+/, '');
}

function toPublicError(error) {
  return {
    message: error?.message || 'UNKNOWN_ERROR',
    status: error?.status || 0,
    payload: error?.payload || null,
  };
}
