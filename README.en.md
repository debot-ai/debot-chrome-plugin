# debot Chrome Extensions

[中文](./README.md) | **English**

Official debot Chrome extensions for use with [debot.ai](https://debot.ai/) in your browser.

## Extension List

| Extension | Description |
| --- | --- |
| [tweet-delete-monitor](./tweet-delete-monitor) | Tweet delete monitor: add delete monitoring for specific tweets on X/Twitter and view active and historical records |

---

## debot Tweet Delete Monitor

A Chrome extension for X/Twitter. Add tweet delete monitoring with one click on X, and view active and historical records in the extension side panel.

### Direct Download

**[Download tweet-delete-monitor v0.1.0 (zip)](https://github.com/debot-ai/debot-chrome-plugin/raw/main/dist/tweet-delete-monitor-v0.1.0.zip)**

After downloading, unzip to get the `tweet-delete-monitor` folder, then follow the installation steps below to load it in Chrome.

### Key Features

- Shows a "Monitor delete" button next to tweet authors on `x.com` / `twitter.com`.
- Opens the monitoring panel in Chrome's right side panel when you click the extension icon.
- View "Active" and "History" lists.
- Displays delete monitoring quota, last check time, tweet status, and expiration time.
- Supports canceling monitoring.
- Marks tweets as "Deleted" in the list after they are removed.
- Shows "Check error, retry pending" on detection errors instead of incorrectly marking tweets as deleted.

### Before You Start

You need to sign in to debot first:

<https://debot.ai/>

The extension uses your debot login session in the browser. If you are not signed in, the side panel shows a login prompt. Click "Sign in on debot" to open the debot homepage.

### Installation

The current version must be loaded in developer mode:

1. **Download the extension package** (recommended): click the [direct download link](https://github.com/debot-ai/debot-chrome-plugin/raw/main/dist/tweet-delete-monitor-v0.1.0.zip) above and unzip to get the `tweet-delete-monitor` folder.
   Or **clone the repository**: `git clone https://github.com/debot-ai/debot-chrome-plugin.git` and use the `tweet-delete-monitor` directory inside.
2. Open Chrome: `chrome://extensions/`.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked**.
5. Select the `tweet-delete-monitor` folder (the unzipped folder, or the subdirectory in a cloned repo).
6. Click the debot Tweet Delete Monitor icon in the toolbar and confirm the right side panel opens.

### How to Add Delete Monitoring

1. Sign in to debot.
2. Open <https://x.com> or <https://twitter.com>.
3. Go to a tweet detail page, or find the tweet you want to monitor in your timeline.
4. Click the "Monitor delete" button next to the tweet author.
5. After a successful add, the button changes to "Monitored" or "Monitoring".
6. Click the extension icon to view the tweet in the right side panel.

### Side Panel Overview

#### Active

Shows delete monitoring that is still within its validity period:

- Tweet summary
- Author
- Tweet ID
- Current status
- Expiration time
- Last check time
- Cancel monitoring action

#### History

Shows historical records for deleted, expired, canceled, or check-error entries.

### Quota and Validity

- Each user can monitor up to 20 tweets at the same time.
- Delete monitoring quota is separate and does not consume other social media monitoring quota.
- Each monitoring entry is valid for 5 days.
- After expiration, entries move to History and the quota is released.
- The number on the extension icon shows how many active delete monitoring entries you have.

### Status Reference

- `Monitoring`: the tweet is being checked.
- `Monitored`: this tweet is already in your monitoring list.
- `Deleted`: the system confirmed the tweet was deleted.
- `Expired`: monitoring exceeded the 5-day validity period.
- `Canceled`: you canceled monitoring manually.
- `Check error, retry pending`: this check could not confirm the result; retries will continue.

### FAQ

#### Why does it show that I'm not signed in?

Visit <https://debot.ai/> and sign in first. Then return to X, refresh the page, or reopen the extension side panel.

#### Why did adding monitoring fail?

Common reasons include:

- Not signed in to debot.
- Delete monitoring quota is used up.
- The tweet link or tweet ID could not be parsed.
- The tweet does not exist or cannot be fetched.
- Temporary network or service issues.

#### Why is a check error not marked as deleted?

Check errors can come from network failures, rate limits, permission issues, or temporary unavailability. A tweet is marked "Deleted" only when the system explicitly confirms deletion.

#### After refreshing X, will monitored status still be shown?

Yes. The extension reads your active monitoring list. If the current tweet is already monitored, the button shows "Monitored".

### Feedback

If you run into issues, please open a [GitHub Issue](https://github.com/debot-ai/debot-chrome-plugin/issues) with:

- Chrome version
- Extension version or commit hash
- Link to the affected tweet
- Screenshots or error messages
