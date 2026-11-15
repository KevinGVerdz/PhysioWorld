/* Service worker mínimo de Physio World: muestra las notificaciones de citas
   y, al tocarlas, enfoca la pestaña abierta (o abre una nueva) en esa cita. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const citaId = event.notification.data && event.notification.data.citaId;
    const conCita = citaId && citaId !== 'prueba';

    event.waitUntil((async () => {
        const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const portal = ventanas.find((c) => !/nosotros\.html/.test(c.url));
        if (portal) {
            await portal.focus();
            if (conCita) portal.postMessage({ tipo: 'abrir-cita', citaId });
            return;
        }
        const url = new URL('index.html', self.registration.scope);
        if (conCita) url.searchParams.set('cita', citaId);
        await self.clients.openWindow(url.href);
    })());
});
