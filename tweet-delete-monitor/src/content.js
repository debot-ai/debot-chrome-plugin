const ACTION_CLASS = 'debot-delete-monitor-action';
const ACTION_BOUND_ATTR = 'data-debot-delete-monitor-bound';
const DEBOT_HOME_URL = 'https://debot.ai/';
const QUOTA_EXHAUSTED_MESSAGE = '删推监控额度已用完，最多可同时监控 20 条。请取消已有监控或等待过期后再添加。';
const MONITORED_TWEET_IDS = new Set();
let activeMonitorLoadPromise = null;

const observer = new MutationObserver(() => {
  injectTweetActions();
});

injectTweetActions();
observer.observe(document.documentElement, { childList: true, subtree: true });

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'EXTRACT_CURRENT_TWEET') {
    return false;
  }
  sendResponse({ ok: true, data: extractCurrentTweet() });
  return false;
});

function injectTweetActions() {
  if (!isTwitterHost(location.hostname)) {
    return;
  }
  document.querySelectorAll('article[data-testid="tweet"]').forEach((article) => {
    if (article.getAttribute(ACTION_BOUND_ATTR) === '1') {
      return;
    }
    const tweet = extractTweetFromArticle(article);
    if (!tweet?.tweet_id) {
      return;
    }
    const placement = findActionPlacement(article);
    if (!placement?.container) {
      return;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = ACTION_CLASS;
    if (placement.rowClass) {
      placement.container.classList.add(placement.rowClass);
    }
    if (placement.variant) {
      button.classList.add(placement.variant);
    }
    button.textContent = '监控删推';
    button.title = '添加这条推文到 Debot 删推监控';
    button.setAttribute('aria-label', '添加这条推文到 Debot 删推监控');
    button.dataset.state = 'idle';
    applyKnownMonitorState(button, tweet);
    syncKnownMonitorState(button, tweet);
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      addTweetMonitor(button, tweet);
    });
    placement.container.insertBefore(button, placement.before || null);
    article.setAttribute(ACTION_BOUND_ATTR, '1');
  });
}

async function addTweetMonitor(button, tweet) {
  setButtonState(button, '添加中...', '', 'loading');
  button.disabled = true;
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'ADD_TWEET_MONITOR',
      payload: tweet,
    });
    if (!response?.ok) {
      throw response?.error || new Error('REQUEST_FAILED');
    }
    const status = response.data?.status || response.data?.data?.status || 'created';
    const quota = response.data?.quota || response.data?.data?.quota;
    const quotaText = quota ? ` ${quota.used}/${quota.limit}` : '';
    MONITORED_TWEET_IDS.add(String(tweet.tweet_id));
    setButtonState(button, status === 'exists' ? `已监控${quotaText}` : `监控中${quotaText}`, 'is-success', 'success');
    button.title = '这条推文已在删推监控中';
    button.setAttribute('aria-label', '这条推文已在删推监控中');
  } catch (error) {
    const detail = await getAddErrorDetail(error);
    const message = detail === QUOTA_EXHAUSTED_MESSAGE ? '额度已满' : getAddErrorMessage(error);
    setButtonState(button, message, 'is-error', 'error');
    button.title = detail;
    button.setAttribute('aria-label', detail);
    showButtonNotice(button, detail);
    setTimeout(() => {
      setButtonState(button, '监控删推', '', 'idle');
      button.title = '添加这条推文到 Debot 删推监控';
      button.setAttribute('aria-label', '添加这条推文到 Debot 删推监控');
      button.disabled = false;
    }, 2500);
    return;
  }
  setTimeout(() => {
    button.disabled = false;
  }, 1200);
}

function applyKnownMonitorState(button, tweet) {
  if (!MONITORED_TWEET_IDS.has(String(tweet.tweet_id))) {
    return;
  }
  setButtonState(button, '已监控', 'is-success', 'success');
  button.title = '这条推文已在删推监控中';
  button.setAttribute('aria-label', '这条推文已在删推监控中');
}

function syncKnownMonitorState(button, tweet) {
  getActiveMonitorTweetIds()
    .then((tweetIds) => {
      if (!tweetIds.has(String(tweet.tweet_id))) {
        return;
      }
      MONITORED_TWEET_IDS.add(String(tweet.tweet_id));
      applyKnownMonitorState(button, tweet);
    })
    .catch(() => {});
}

async function getActiveMonitorTweetIds() {
  if (!activeMonitorLoadPromise) {
    activeMonitorLoadPromise = chrome.runtime
      .sendMessage({
        type: 'LIST_TWEET_MONITORS',
        payload: { status: 'active', limit: 50 },
      })
      .then((response) => {
        if (!response?.ok) {
          return new Set();
        }
        return new Set(normalizeMonitorList(response.data).map((item) => String(item.tweet_id)).filter(Boolean));
      })
      .finally(() => {
        setTimeout(() => {
          activeMonitorLoadPromise = null;
        }, 15000);
      });
  }
  return activeMonitorLoadPromise;
}

function normalizeMonitorList(data) {
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

function setButtonState(button, text, className, state = 'idle') {
  button.textContent = text;
  button.classList.remove('is-success', 'is-error');
  button.dataset.state = state;
  if (className) {
    button.classList.add(className);
  }
}

function getAddErrorMessage(error) {
  if (isUnauthorizedError(error)) {
    return '未登录';
  }
  if (isQuotaLimitError(error)) {
    return '额度已满';
  }
  return '添加失败';
}

async function getAddErrorDetail(error) {
  if (isUnauthorizedError(error)) {
    return `请先登录 Debot 后再添加删推监控：${DEBOT_HOME_URL}`;
  }
  if (isQuotaLimitError(error)) {
    return QUOTA_EXHAUSTED_MESSAGE;
  }
  try {
    return (await isQuotaFull()) ? QUOTA_EXHAUSTED_MESSAGE : '添加删推监控失败，请稍后重试。';
  } catch (_error) {
    return '添加删推监控失败，请稍后重试。';
  }
}

function showButtonNotice(button, message) {
  const oldNotice = button.parentElement?.querySelector('.debot-delete-monitor-error-tip');
  oldNotice?.remove();
  const notice = document.createElement('span');
  notice.className = 'debot-delete-monitor-error-tip';
  notice.textContent = message;
  button.insertAdjacentElement('afterend', notice);
  setTimeout(() => {
    notice.remove();
  }, 4200);
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

async function isQuotaFull() {
  const response = await chrome.runtime.sendMessage({
    type: 'LIST_TWEET_MONITORS',
    payload: { status: 'active', limit: 1 },
  });
  if (!response?.ok) {
    return false;
  }
  const data = response.data?.data || response.data || {};
  const quota = data.quota;
  const used = Number(quota?.used);
  const limit = Number(quota?.limit);
  return Number.isFinite(used) && Number.isFinite(limit) && limit > 0 && used >= limit;
}

function extractCurrentTweet() {
  const idFromURL = parseTweetURL(location.href);
  if (idFromURL?.tweet_id) {
    const article = Array.from(document.querySelectorAll('article[data-testid="tweet"]')).find((item) => {
      return extractTweetFromArticle(item)?.tweet_id === idFromURL.tweet_id;
    });
    return article ? extractTweetFromArticle(article) : idFromURL;
  }
  const firstArticle = document.querySelector('article[data-testid="tweet"]');
  return firstArticle ? extractTweetFromArticle(firstArticle) : null;
}

function extractTweetFromArticle(article) {
  const statusLink = findStatusLink(article);
  const parsed = parseTweetURL(statusLink?.href || '');
  if (!parsed?.tweet_id) {
    return null;
  }
  return {
    ...parsed,
    tweet_text_snapshot: article.querySelector('[data-testid="tweetText"]')?.textContent?.trim() || '',
  };
}

function findStatusLink(root) {
  return Array.from(root.querySelectorAll('a[href*="/status/"], a[href*="/statuses/"]')).find((link) => {
    return Boolean(parseTweetURL(link.href)?.tweet_id);
  });
}

function findActionPlacement(article) {
  const userName = article.querySelector('[data-testid="User-Name"]');
  if (userName) {
    const tweet = extractTweetFromArticle(article);
    const authorRow = findAuthorRow(userName, tweet?.screen_name);
    if (authorRow) {
      return {
        container: authorRow,
        before: null,
        rowClass: 'debot-delete-monitor-author-row',
        variant: 'is-author-inline',
      };
    }
    return {
      container: userName,
      before: null,
      variant: 'is-author-inline',
    };
  }

  const tweetText = article.querySelector('[data-testid="tweetText"]');
  if (tweetText?.parentElement) {
    return {
      container: tweetText.parentElement,
      before: tweetText,
      variant: 'is-before-text',
    };
  }

  const statusLink = findStatusLink(article);
  if (statusLink?.parentElement) {
    return {
      container: statusLink.parentElement,
      before: statusLink.nextSibling,
      variant: 'is-author-inline',
    };
  }
  return null;
}

function findAuthorRow(userName, screenName) {
  const profileLink = findProfileLink(userName, screenName);
  if (!profileLink?.parentElement) {
    return null;
  }
  let row = profileLink.parentElement;
  while (row.parentElement && row.parentElement !== userName && row.childElementCount <= 1) {
    row = row.parentElement;
  }
  return row;
}

function findProfileLink(userName, screenName) {
  const normalizedScreenName = String(screenName || '').toLowerCase();
  return Array.from(userName.querySelectorAll('a[href]')).find((link) => {
    try {
      const url = new URL(link.href, location.origin);
      const pathname = url.pathname.replace(/\/+$/, '').toLowerCase();
      return normalizedScreenName && pathname === `/${normalizedScreenName}`;
    } catch (_error) {
      return false;
    }
  });
}

function parseTweetURL(rawURL) {
  try {
    const url = new URL(rawURL, location.origin);
    if (!isTwitterHost(url.hostname)) {
      return null;
    }
    const iStatusMatch = url.pathname.match(/^\/i\/(?:web\/)?status\/([0-9]{5,30})/);
    if (iStatusMatch) {
      return {
        screen_name: '',
        tweet_id: iStatusMatch[1],
        tweet_url: `${url.origin}/i/status/${iStatusMatch[1]}`,
        tweet_text_snapshot: '',
      };
    }
    const match = url.pathname.match(/^\/([^/]+)\/status(?:es)?\/([0-9]{5,30})/);
    if (!match) {
      return null;
    }
    return {
      screen_name: match[1],
      tweet_id: match[2],
      tweet_url: `${url.origin}/${match[1]}/status/${match[2]}`,
      tweet_text_snapshot: '',
    };
  } catch (_error) {
    return null;
  }
}

function isTwitterHost(hostname) {
  return hostname === 'x.com' || hostname === 'twitter.com' || hostname.endsWith('.x.com') || hostname.endsWith('.twitter.com');
}
