'use strict';

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data;
  try { data = event.data.json(); } catch (_) { return; }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Krispie\'s', {
      body:    data.body  || 'New order received.',
      icon:    '/assets/logo.png',
      badge:   '/assets/logo.png',
      tag:     'new-order',        // replaces any previous unread order notification
      renotify: true,
      data:    { url: data.url || '/admin/orders.html' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/admin/orders.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes('/admin/') && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
