/**
 * Popup Script — Shows connection status and last post result.
 * Communicates with background.js via chrome.runtime.sendMessage.
 */

document.addEventListener('DOMContentLoaded', () => {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const lastPostDiv = document.getElementById('lastPost');
  const reconnectBtn = document.getElementById('reconnectBtn');

  function updateUI(data) {
    const { connectionStatus, lastPostResult } = data;

    // Update connection status
    statusDot.className = 'status-dot ' + (connectionStatus || 'disconnected');

    switch (connectionStatus) {
      case 'connected':
        statusText.textContent = 'Connected to ws-bridge';
        statusText.className = 'status-text ok';
        break;
      case 'connecting':
        statusText.textContent = 'Connecting...';
        statusText.className = 'status-text warn';
        break;
      default:
        statusText.textContent = 'Disconnected';
        statusText.className = 'status-text err';
    }

    // Update last post result
    if (lastPostResult) {
      const platform = lastPostResult.platform || 'unknown';
      const success = lastPostResult.success;
      const timestamp = lastPostResult.timestamp;
      const postUrl = lastPostResult.post_url || lastPostResult.pin_url;
      const error = lastPostResult.error;

      lastPostDiv.innerHTML = `
        <div class="label">Platform</div>
        <div class="platform">${platform}</div>
        <div class="result ${success ? 'success' : 'fail'}">
          ${success ? '&#10003; Posted successfully' : '&#10007; Failed' + (error ? ': ' + escapeHtml(error.substring(0, 80)) : '')}
        </div>
        ${postUrl ? `<div class="url">${escapeHtml(postUrl)}</div>` : ''}
        ${timestamp ? `<div class="timestamp">${formatTime(timestamp)}</div>` : ''}
      `;
    } else {
      lastPostDiv.innerHTML = '<span class="no-post">No posts yet</span>';
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatTime(isoStr) {
    try {
      const d = new Date(isoStr);
      return d.toLocaleString();
    } catch {
      return isoStr;
    }
  }

  // Load initial state
  chrome.runtime.sendMessage({ type: 'getStatus' }, (response) => {
    if (response) updateUI(response);
  });

  // Listen for storage changes (updated by background.js)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      chrome.storage.local.get(['connectionStatus', 'lastPostResult'], (data) => {
        updateUI(data);
      });
    }
  });

  // Reconnect button
  reconnectBtn.addEventListener('click', () => {
    statusDot.className = 'status-dot connecting';
    statusText.textContent = 'Reconnecting...';
    statusText.className = 'status-text warn';
    chrome.runtime.sendMessage({ type: 'reconnect' }, () => {});
  });
});
